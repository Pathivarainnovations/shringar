import { db, getProviderById } from "./db.js";
import { getSettings } from "./settings.js";

const money = (n) => (Number.isFinite(n) && n > 0 ? Math.round(n) : 0);

/**
 * Price a set of catalogue services.
 *  - With a `provider`, each service is charged at THAT provider's own price; services the provider
 *    does not offer are returned in `unavailableServiceIds`.
 *  - Without a provider (open request) the catalogue's suggested price is used as an estimate.
 * Totals are never negative or NaN.
 */
export function priceServices(serviceIds, mode, { first = false, coupon = null, provider = null } = {}) {
  const settings = getSettings();
  const ids = [...new Set(serviceIds.map(Number).filter((n) => Number.isInteger(n) && n > 0))];
  const q = (sql, ...args) => db.prepare(sql).all(...args);
  const marks = ids.map(() => "?").join(",");
  const catalogue = ids.length ? q(`SELECT * FROM services WHERE id IN (${marks})`, ...ids) : [];
  const known = new Set(catalogue.map((s) => s.id));
  const missingServiceIds = ids.filter((id) => !known.has(id));

  let items = catalogue.map((s) => ({ id: s.id, minutes: s.minutes, price: s.price }));
  let unavailableServiceIds = [];
  if (provider) {
    const own = new Map(
      q(`SELECT service_id, price FROM provider_services WHERE provider_id = ? AND is_active = 1 AND service_id IN (${marks})`, provider.id, ...ids)
        .map((r) => [r.service_id, r.price])
    );
    unavailableServiceIds = catalogue.filter((s) => !own.has(s.id)).map((s) => s.id);
    items = items.filter((s) => own.has(s.id)).map((s) => ({ ...s, price: own.get(s.id) }));
  }

  const minutes = items.reduce((n, s) => n + s.minutes, 0);
  const servicesTotal = money(items.reduce((n, s) => n + s.price, 0));
  const homeFee = provider && Number.isFinite(provider.travel_fee) ? provider.travel_fee : settings.default_travel_fee;
  const travelFee = items.length && mode === "home" ? money(homeFee) : 0;
  const firstDiscount = first ? money((servicesTotal * settings.first_booking_discount_pct) / 100) : 0;
  const couponDiscount = coupon && servicesTotal >= coupon.min ? money((servicesTotal * Math.min(100, Math.max(0, coupon.percent))) / 100) : 0;
  const discount = Math.min(servicesTotal, Math.max(firstDiscount, couponDiscount));
  // The coupon counts as used only when it is what produced the discount (it is not stacked with the first-booking discount).
  const couponApplied = couponDiscount > 0 && couponDiscount >= firstDiscount;
  return {
    couponApplied,
    minutes,
    servicesTotal,
    travelFee,
    discount,
    total: Math.max(0, servicesTotal + travelFee - discount),
    missingServiceIds,
    unavailableServiceIds,
    estimate: !provider,
  };
}

/**
 * Force the payable total to `amount` (an accepted offer or counter-offer) while keeping
 * servicesTotal + travelFee - discount === total.
 */
export function withAgreedAmount(priced, amount) {
  const total = Math.max(0, Math.round(amount));
  const gross = priced.servicesTotal + priced.travelFee;
  if (total <= gross) return { ...priced, discount: gross - total, total };
  return { ...priced, servicesTotal: Math.max(0, total - priced.travelFee), discount: 0, total };
}

/** Commission is charged on the service amount (total minus travel fee); travel fee goes to the provider. */
export function splitCommission(total, travelFee, ratePct) {
  const base = Math.max(0, total - travelFee);
  const commission = Math.min(total, Math.round((base * ratePct) / 100));
  return { commission, earning: total - commission };
}

export const getProviderFor = (id) => (id ? getProviderById.get(id) ?? null : null);

export function rowToBooking(row) {
  if (!row) return null;
  return {
    id: row.id,
    createdAt: row.created_at,
    serviceIds: JSON.parse(row.service_ids),
    mode: row.mode,
    startHour: row.start_hour,
    status: row.status,
    payStatus: row.pay_status,
    paidMethod: row.paid_method ?? null,
    address: row.address,
    area: row.area ?? null,
    day: row.day,
    providerId: row.provider_id ?? null,
    providerName: row.provider_name,
    providerPhone: row.provider_phone,
    staffId: row.staff_id ?? null,
    couponCode: row.coupon_code,
    userId: row.user_id,
    minutes: row.minutes,
    servicesTotal: row.services_total,
    travelFee: row.travel_fee,
    discount: row.discount,
    total: row.total,
    offerAmount: row.offer_amount ?? null,
    commissionAmount: row.commission_amount ?? null,
    providerEarning: row.provider_earning ?? null,
    completedAt: row.completed_at ?? null,
    cancelledBy: row.cancelled_by ?? null,
    cancelReason: row.cancel_reason ?? null,
  };
}
