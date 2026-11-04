// Booking lifecycle: every state change, money movement and notification lives here so the
// rules are enforced in one place. Functions return { ok: true, ... } or { ok: false, status, error }.
import {
  db,
  rid,
  now,
  getBookingById,
  getProviderById,
  getProviderByUserId,
  getCouponByCode,
  createNotification,
  createTransaction,
  updateWallet,
  getLoyalty,
  upsertLoyalty,
  createLoyaltyTransaction,
  getReferralByReferred,
  completeReferral,
} from "./db.js";
import { priceServices, withAgreedAmount, splitCommission, getProviderFor } from "./pricing.js";
import { getSettings } from "./settings.js";
import { cleanText, maskPhone } from "./http.js";

const fail = (status, error) => ({ ok: false, status, error });
const ok = (extra = {}) => ({ ok: true, ...extra });

export const NEXT_STATUS = { accepted: "on_the_way", on_the_way: "arrived", arrived: "in_progress", in_progress: "done" };
const CANCELLABLE = {
  customer: ["requested", "accepted"],
  provider: ["requested", "accepted", "on_the_way"],
  admin: ["requested", "accepted", "on_the_way", "arrived", "in_progress"],
};

export function notify(userId, type, title, message, data = {}) {
  if (!userId) return;
  createNotification.run(rid("NOTIF"), userId, type, title, message, JSON.stringify(data), 0, now());
}

/** Provider promotion for this provider first, then an admin (global) coupon. */
export function resolveCoupon(code, providerId) {
  if (!code) return null;
  if (providerId) {
    const p = db.prepare(
      `SELECT * FROM promotions WHERE provider_id = ? AND code = ? AND is_active = 1
         AND (expires_at IS NULL OR expires_at > ?) AND (max_uses IS NULL OR used_count < max_uses)`
    ).get(providerId, code, now());
    if (p) return { code, percent: p.percent, min: p.min_amount, source: "promotion" };
  }
  const g = getCouponByCode.get(code);
  return g && g.active ? { code, percent: g.percent, min: g.min, source: "global" } : null;
}

const useCoupon = (code, providerId, delta) => {
  if (!code) return;
  const promo = providerId ? db.prepare(`SELECT id FROM promotions WHERE provider_id = ? AND code = ?`).get(providerId, code) : null;
  if (promo) db.prepare(`UPDATE promotions SET used_count = MAX(0, used_count + ?) WHERE id = ?`).run(delta, promo.id);
  else db.prepare(`UPDATE coupons SET used_count = MAX(0, used_count + ?) WHERE code = ?`).run(delta, code);
};

/** The first-booking discount applies only while the customer has no other live or finished booking. */
export const isFirstBooking = (userId, excludeId = "") =>
  db.prepare(`SELECT COUNT(*) AS n FROM bookings WHERE user_id = ? AND id <> ? AND status <> 'cancelled'`).get(userId, excludeId).n === 0;

const serviceNames = (ids) =>
  ids.length ? db.prepare(`SELECT name FROM services WHERE id IN (${ids.map(() => "?").join(",")})`).all(...ids).map((s) => s.name) : [];

/* ------------------------------------------------------------------ create */
export function createBooking(user, body) {
  const ids = Array.isArray(body?.serviceIds) ? body.serviceIds.map(Number).filter((n) => Number.isInteger(n) && n > 0) : [];
  const mode = body?.mode === "home" || body?.mode === "salon" ? body.mode : null;
  const hour = Number(body?.startHour);
  const address = cleanText(body?.address, 300);
  const area = cleanText(body?.area, 60);
  const day = cleanText(body?.day, 40) || "Today";
  const couponCode = cleanText(body?.couponCode, 40).toUpperCase() || null;
  const providerId = cleanText(body?.providerId, 40) || null;
  const isOffer = body?.isOffer === true;
  const offerAmount = Math.round(Number(body?.offerAmount));

  if (!ids.length) return fail(400, "Add at least one service");
  if (!mode) return fail(400, "mode must be home or salon");
  if (!Number.isFinite(hour) || hour < 9 || hour > 18 || !Number.isInteger(hour * 2)) {
    return fail(400, "startHour must be between 9 and 18, in half-hour steps");
  }
  if (mode === "home" && !address) return fail(400, "Address is required for home service");
  if (isOffer && (mode !== "home" || !Number.isFinite(offerAmount) || offerAmount <= 0 || offerAmount > 10_000_000)) {
    return fail(400, "An offer needs a home booking and an amount above zero");
  }

  let provider = null;
  if (providerId) {
    provider = getProviderById.get(providerId);
    if (!provider || !provider.verified) return fail(404, "That provider is not available");
    if (mode === "salon" && provider.type !== "salon") return fail(400, "Choose a salon for a salon visit");
  } else if (mode === "salon") {
    return fail(400, "Choose a salon for a salon visit");
  } else {
    if (!area) return fail(400, "Choose your area so nearby providers can see the request");
    if (!db.prepare(`SELECT 1 FROM areas WHERE name = ? AND active = 1`).get(area)) return fail(400, "That area is not served yet");
  }

  const coupon = resolveCoupon(couponCode, provider?.id);
  if (couponCode && !coupon) return fail(400, "That coupon code is not valid");

  const priced = priceServices(ids, mode, { first: isFirstBooking(user.id), coupon, provider });
  if (priced.missingServiceIds.length) return fail(400, "One or more selected services no longer exist");
  if (priced.unavailableServiceIds.length) {
    return fail(409, `${provider.name} does not offer: ${serviceNames(priced.unavailableServiceIds).join(", ")}`);
  }
  if (coupon && priced.servicesTotal < coupon.min) return fail(400, `This coupon needs a minimum of NPR ${coupon.min}`);
  const usedCode = priced.couponApplied ? couponCode : null; // only record/count a coupon that actually gave the discount

  const id = rid("SHR");
  const created = now();
  db.transaction(() => {
    db.prepare(
      `INSERT INTO bookings (id, created_at, service_ids, mode, start_hour, status, pay_status, address, day,
         provider_name, provider_phone, coupon_code, user_id, provider_id, minutes, services_total, travel_fee, discount, total, area, offer_amount)
       VALUES (?, ?, ?, ?, ?, 'requested', 'unpaid', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).run(
      id, created, JSON.stringify(ids), mode, hour, mode === "salon" ? "At salon" : address, day,
      provider?.name ?? "", provider?.phone ? maskPhone(provider.phone) : "", usedCode, user.id, provider?.id ?? null,
      priced.minutes, priced.servicesTotal, priced.travelFee, priced.discount, priced.total, area || null, isOffer ? offerAmount : null
    );
    useCoupon(usedCode, provider?.id, +1);

    const detail = isOffer
      ? `Customer offered NPR ${offerAmount} for ${ids.length} service(s)`
      : `New ${mode} booking request for ${ids.length} service(s)`;
    const targets = provider ? [provider] : db.prepare(`SELECT * FROM providers WHERE area = ? AND verified = 1`).all(area);
    for (const t of targets) notify(t.user_id, "booking_request", "New booking request", detail, { bookingId: id });
    notify(user.id, "booking_created", "Booking request sent", provider ? `Waiting for ${provider.name} to accept` : "Waiting for a provider to accept", { bookingId: id });
  })();
  return ok({ booking: getBookingById.get(id) });
}

/* ------------------------------------------------- provider acts on request */
function providerFor(user) {
  const p = getProviderByUserId.get(user.id);
  if (!p || !p.verified) return null;
  return p;
}

/** Can this provider see/answer this requested booking? (assigned to them, or an open request in their area) */
export function providerCanRespond(provider, booking) {
  if (booking.status !== "requested") return false;
  if (booking.provider_id) return booking.provider_id === provider.id;
  return booking.mode === "home" && booking.area === provider.area;
}

const assign = (booking, provider, priced, staffId) => {
  db.prepare(
    `UPDATE bookings SET provider_id = ?, provider_name = ?, provider_phone = ?, staff_id = ?, services_total = ?, travel_fee = ?,
       discount = ?, total = ?, minutes = ?, status = 'accepted' WHERE id = ?`
  ).run(provider.id, provider.name, provider.phone ? maskPhone(provider.phone) : "", staffId, priced.servicesTotal, priced.travelFee,
        priced.discount, priced.total, priced.minutes, booking.id);
};

function priceFor(provider, booking) {
  const ids = JSON.parse(booking.service_ids);
  const priced = priceServices(ids, booking.mode, {
    first: isFirstBooking(booking.user_id, booking.id),
    coupon: resolveCoupon(booking.coupon_code, provider.id),
    provider,
  });
  if (priced.unavailableServiceIds.length) {
    return { error: fail(409, `Add a price for: ${serviceNames(priced.unavailableServiceIds).join(", ")} (Provider -> Services)`) };
  }
  return { priced };
}

export function acceptBooking(user, booking, { staffId } = {}) {
  const provider = providerFor(user);
  if (!provider) return fail(403, "Only a verified provider can accept bookings");
  if (booking.status !== "requested") return fail(409, `This booking is already ${booking.status}`);
  if (!providerCanRespond(provider, booking)) return fail(403, "This request is not available to you");
  if (db.prepare(`SELECT 1 FROM offers WHERE booking_id = ? AND provider_id = ? AND status = 'rejected'`).get(booking.id, provider.id)) {
    return fail(409, "You already declined this request");
  }
  let staff = null;
  if (staffId) {
    staff = db.prepare(`SELECT * FROM staff WHERE id = ? AND provider_id = ? AND is_active = 1`).get(staffId, provider.id);
    if (!staff) return fail(400, "Choose one of your own active staff members");
  }
  const { priced, error } = priceFor(provider, booking);
  if (error) return error;
  const final = booking.offer_amount ? withAgreedAmount(priced, booking.offer_amount) : priced;
  db.transaction(() => {
    assign(booking, provider, final, staff?.id ?? null);
    db.prepare(`UPDATE offers SET status = 'rejected', responded_at = ? WHERE booking_id = ? AND status = 'pending'`).run(now(), booking.id);
    notify(booking.user_id, "booking_accepted", "Booking accepted", `${provider.name} accepted your booking`, { bookingId: booking.id });
  })();
  return ok({ booking: getBookingById.get(booking.id) });
}

export function rejectBooking(user, booking) {
  const provider = providerFor(user);
  if (!provider) return fail(403, "Only a verified provider can respond to bookings");
  if (!providerCanRespond(provider, booking)) return fail(403, "This request is not available to you");
  if (booking.provider_id === provider.id) {
    return cancelBooking(user, booking, "Declined by the provider");
  }
  db.prepare(`INSERT INTO offers (id, booking_id, provider_id, amount, status, original_amount, created_at, responded_at) VALUES (?, ?, ?, ?, 'rejected', ?, ?, ?)`)
    .run(rid("OFR"), booking.id, provider.id, booking.offer_amount ?? booking.total, booking.offer_amount ?? booking.total, now(), now());
  return ok({ hidden: true });
}

export function counterBooking(user, booking, rawAmount) {
  const provider = providerFor(user);
  if (!provider) return fail(403, "Only a verified provider can send counter-offers");
  if (!providerCanRespond(provider, booking)) return fail(403, "This request is not available to you");
  const amount = Math.round(Number(rawAmount));
  if (!Number.isFinite(amount) || amount <= 0 || amount > 10_000_000) return fail(400, "Enter a counter-offer amount above zero");
  const { error } = priceFor(provider, booking);
  if (error) return error;
  const original = booking.offer_amount ?? booking.total;
  const existing = db.prepare(`SELECT id FROM offers WHERE booking_id = ? AND provider_id = ? AND status = 'pending'`).get(booking.id, provider.id);
  db.transaction(() => {
    if (existing) db.prepare(`UPDATE offers SET amount = ?, created_at = ? WHERE id = ?`).run(amount, now(), existing.id);
    else db.prepare(`INSERT INTO offers (id, booking_id, provider_id, amount, status, original_amount, created_at) VALUES (?, ?, ?, ?, 'pending', ?, ?)`).run(rid("OFR"), booking.id, provider.id, amount, original, now());
    notify(booking.user_id, "counter_offer", "New counter-offer", `${provider.name} offered NPR ${amount}`, { bookingId: booking.id });
  })();
  return ok({ amount });
}

export function answerOffer(user, offer, decision) {
  const booking = getBookingById.get(offer.booking_id);
  if (!booking || booking.user_id !== user.id) return fail(404, "Offer not found");
  if (offer.status !== "pending") return fail(409, `This offer is already ${offer.status}`);
  if (booking.status !== "requested") return fail(409, `This booking is already ${booking.status}`);
  const provider = getProviderById.get(offer.provider_id);
  if (decision === "rejected") {
    db.prepare(`UPDATE offers SET status = 'rejected', responded_at = ? WHERE id = ?`).run(now(), offer.id);
    if (provider) notify(provider.user_id, "offer_rejected", "Counter-offer declined", `The customer declined your NPR ${offer.amount} offer`, { bookingId: booking.id });
    return ok();
  }
  if (!provider || !provider.verified) return fail(409, "That provider is no longer available");
  const { priced, error } = priceFor(provider, booking);
  if (error) return fail(409, "That provider can no longer offer these services");
  const final = withAgreedAmount(priced, offer.amount);
  db.transaction(() => {
    assign(booking, provider, final, null);
    db.prepare(`UPDATE offers SET status = 'accepted', responded_at = ? WHERE id = ?`).run(now(), offer.id);
    db.prepare(`UPDATE offers SET status = 'rejected', responded_at = ? WHERE booking_id = ? AND status = 'pending' AND id <> ?`).run(now(), booking.id, offer.id);
    notify(provider.user_id, "offer_accepted", "Offer accepted", `Your NPR ${offer.amount} offer was accepted`, { bookingId: booking.id });
  })();
  return ok({ booking: getBookingById.get(booking.id) });
}

/* --------------------------------------------------------- progress / done */
export function advance(user, booking, to) {
  const provider = getProviderByUserId.get(user.id);
  if (!provider || booking.provider_id !== provider.id) return fail(403, "This is not your booking");
  // A salon visit has no travel step, so the customer can be checked in straight after acceptance.
  const salonCheckIn = booking.mode === "salon" && booking.status === "accepted" && to === "arrived";
  if (NEXT_STATUS[booking.status] !== to && !salonCheckIn) return fail(409, `A ${booking.status} booking cannot move to ${to}`);

  db.transaction(() => {
    if (to === "done") {
      const rate = getSettings().commission_rate;
      const { commission, earning } = splitCommission(booking.total, booking.travel_fee, rate);
      db.prepare(`UPDATE bookings SET status = 'done', completed_at = ?, commission_rate = ?, commission_amount = ?, provider_earning = ? WHERE id = ?`)
        .run(now(), rate, commission, earning, booking.id);
      db.prepare(`UPDATE tracking_locations SET status = 'completed', updated_at = ? WHERE booking_id = ?`).run(now(), booking.id);
      awardCompletion(booking);
      notify(booking.user_id, "booking_done", "Service completed", "How was it? Leave a review.", { bookingId: booking.id });
    } else {
      db.prepare(`UPDATE bookings SET status = ? WHERE id = ?`).run(to, booking.id);
      const text = { on_the_way: "Your provider is on the way", arrived: "Your provider has arrived", in_progress: "Your service has started" }[to];
      notify(booking.user_id, `booking_${to}`, text, text, { bookingId: booking.id });
    }
  })();
  return ok({ booking: getBookingById.get(booking.id) });
}

function awardCompletion(booking) {
  const points = Math.floor(booking.total / 100);
  if (points > 0) {
    const l = getLoyalty.get(booking.user_id);
    upsertLoyalty.run(l?.id ?? rid("LOY"), booking.user_id, (l?.points ?? 0) + points, (l?.total_earned ?? 0) + points, l?.total_redeemed ?? 0, now());
    createLoyaltyTransaction.run(rid("LTX"), booking.user_id, "earned", points, `Booking ${booking.id}`, booking.id, now());
  }
  const priorDone = db.prepare(`SELECT COUNT(*) AS n FROM bookings WHERE user_id = ? AND status = 'done' AND id <> ?`).get(booking.user_id, booking.id).n;
  if (priorDone === 0) {
    const ref = getReferralByReferred.get(booking.user_id);
    if (ref) {
      completeReferral.run(now(), ref.id);
      updateWallet.run(ref.bonus_amount, ref.referrer_id);
      notify(ref.referrer_id, "referral_bonus", "Referral bonus", `You earned NPR ${ref.bonus_amount} - your friend completed a booking.`, {});
    }
  }
}

/* ------------------------------------------------------------------ cancel */
export function cancelBooking(user, booking, reason = "") {
  const provider = getProviderByUserId.get(user.id);
  const role = user.role === "admin" ? "admin" : booking.user_id === user.id ? "customer" : provider && booking.provider_id === provider.id ? "provider" : null;
  if (!role) return fail(404, "Booking not found");
  if (!CANCELLABLE[role].includes(booking.status)) {
    return fail(409, `A ${booking.status} booking cannot be cancelled${role === "customer" ? " - contact support" : ""}`);
  }
  db.transaction(() => {
    if (booking.pay_status === "paid" && booking.paid_method === "wallet") {
      updateWallet.run(booking.total, booking.user_id);
      createTransaction.run(rid("TXN"), booking.id, "wallet_refund", -booking.total, now());
    }
    useCoupon(booking.coupon_code, booking.provider_id, -1);
    db.prepare(`UPDATE bookings SET status = 'cancelled', cancelled_by = ?, cancel_reason = ?, pay_status = 'unpaid', paid_method = NULL WHERE id = ?`)
      .run(role, cleanText(reason, 300) || null, booking.id);
    const text = `Booking ${booking.id} was cancelled${role === "customer" ? " by the customer" : role === "provider" ? " by the provider" : " by support"}`;
    if (role !== "customer") notify(booking.user_id, "booking_cancelled", "Booking cancelled", text, { bookingId: booking.id });
    const p = getProviderFor(booking.provider_id);
    if (p && role !== "provider") notify(p.user_id, "booking_cancelled", "Booking cancelled", text, { bookingId: booking.id });
  })();
  return ok({ booking: getBookingById.get(booking.id) });
}

/* ---------------------------------------------------------------- payments */
export function payBooking(user, booking, method) {
  if (booking.user_id !== user.id) return fail(404, "Booking not found");
  if (!["accepted", "on_the_way", "arrived", "in_progress", "done"].includes(booking.status)) {
    return fail(409, "You can pay once a provider has accepted the booking");
  }
  if (booking.pay_status === "paid") return fail(409, "This booking is already paid");
  if (method === "cash") {
    db.prepare(`UPDATE bookings SET pay_status = 'cash_due', paid_method = 'cash' WHERE id = ?`).run(booking.id);
    return ok({ booking: getBookingById.get(booking.id) });
  }
  if (method !== "wallet") return fail(400, "Payment method must be cash or wallet");
  const result = db.transaction(() => {
    const debit = db.prepare(`UPDATE users SET wallet = wallet - ? WHERE id = ? AND wallet >= ?`).run(booking.total, user.id, booking.total);
    if (!debit.changes) return fail(409, "Not enough wallet balance");
    createTransaction.run(rid("TXN"), booking.id, "wallet", booking.total, now());
    db.prepare(`UPDATE bookings SET pay_status = 'paid', paid_method = 'wallet' WHERE id = ?`).run(booking.id);
    const p = getProviderFor(booking.provider_id);
    if (p) notify(p.user_id, "payment", "Paid by wallet", `Booking ${booking.id} was paid from the customer's wallet`, { bookingId: booking.id });
    return ok({ booking: getBookingById.get(booking.id) });
  })();
  return result;
}

export function markCashReceived(user, booking) {
  const provider = getProviderByUserId.get(user.id);
  if (!provider || booking.provider_id !== provider.id) return fail(403, "This is not your booking");
  if (booking.status !== "done") return fail(409, "Mark the service as done first");
  if (booking.pay_status === "paid") return fail(409, booking.paid_method === "wallet" ? "The customer already paid by wallet" : "Already marked as paid");
  db.transaction(() => {
    createTransaction.run(rid("TXN"), booking.id, "cash", booking.total, now());
    db.prepare(`UPDATE bookings SET pay_status = 'paid', paid_method = 'cash' WHERE id = ?`).run(booking.id);
    notify(booking.user_id, "payment", "Payment received", `Cash payment for ${booking.id} was recorded`, { bookingId: booking.id });
  })();
  return ok({ booking: getBookingById.get(booking.id) });
}

/* -------------------------------------------------------------- commission */
/**
 * Per-provider commission balance.
 *  cash bookings: the provider holds the money and owes the platform the commission
 *  wallet bookings: the platform holds the money and owes the provider the earning
 *  balance > 0 -> provider owes the platform; balance < 0 -> platform owes the provider
 */
export function providerLedger(providerId) {
  const row = db.prepare(
    `SELECT COUNT(*) AS bookings,
            COALESCE(SUM(total), 0) AS gross,
            COALESCE(SUM(commission_amount), 0) AS commission,
            COALESCE(SUM(provider_earning), 0) AS earning,
            COALESCE(SUM(CASE WHEN paid_method = 'cash' AND pay_status = 'paid' THEN commission_amount END), 0) AS cashCommission,
            COALESCE(SUM(CASE WHEN paid_method = 'wallet' AND pay_status = 'paid' THEN provider_earning END), 0) AS walletEarning,
            COALESCE(SUM(CASE WHEN pay_status <> 'paid' THEN total END), 0) AS unpaid
       FROM bookings WHERE provider_id = ? AND status = 'done'`
  ).get(providerId);
  const settled = db.prepare(`SELECT COALESCE(SUM(amount), 0) AS s FROM settlements WHERE provider_id = ?`).get(providerId).s;
  return { ...row, settled, balance: row.cashCommission - row.walletEarning - settled };
}
