// Bookings: quote, create, list/read, and every state change (accept, counter, progress, cancel, pay, cash).
import { Router } from "express";
import { db, getBookingById, getProviderById, getProviderByUserId, now, rid } from "../db.js";
import { requireUser, requireRole, authedUser, cleanText } from "../http.js";
import { priceServices, rowToBooking } from "../pricing.js";
import {
  createBooking, acceptBooking, rejectBooking, counterBooking, answerOffer, advance, cancelBooking, payBooking,
  markCashReceived, resolveCoupon, isFirstBooking, notify, NEXT_STATUS,
} from "../lifecycle.js";

const router = Router();

const send = (res, r, okStatus = 200) => (r.ok ? res.status(okStatus).json(shape(r)) : res.status(r.status).json({ error: r.error }));
const shape = ({ ok: _ok, booking, ...rest }) => ({ ...(booking ? { booking: rowToBooking(booking) } : {}), ...rest });

/** Who may see this booking: its customer, its assigned provider, an admin. */
export function partyRole(user, booking) {
  if (user.role === "admin") return "admin";
  if (booking.user_id === user.id) return "customer";
  const p = getProviderByUserId.get(user.id);
  if (p && booking.provider_id === p.id) return "provider";
  return null;
}

function loadBooking(req, res, next) {
  const booking = getBookingById.get(req.params.id);
  if (!booking) return res.status(404).json({ error: "Booking not found" });
  req.booking = booking;
  next();
}

/* ---------- quote ---------- */
router.post("/price", (req, res) => {
  const ids = Array.isArray(req.body?.serviceIds) ? req.body.serviceIds.map(Number).filter((n) => Number.isInteger(n) && n > 0) : [];
  const mode = req.body?.mode === "home" || req.body?.mode === "salon" ? req.body.mode : null;
  const couponCode = cleanText(req.body?.couponCode, 40).toUpperCase() || null;
  const providerId = cleanText(req.body?.providerId, 40);
  if (!ids.length) return res.status(400).json({ error: "Add at least one service" });
  if (!mode) return res.status(400).json({ error: "mode must be home or salon" });

  const provider = providerId ? getProviderById.get(providerId) : null;
  if (providerId && (!provider || !provider.verified)) return res.status(404).json({ error: "That provider is not available" });
  // Guests are quoted without the first-booking discount; signed-in customers get it only if it applies to them.
  const user = authedUser(req);
  const coupon = resolveCoupon(couponCode, provider?.id);
  const priced = priceServices(ids, mode, { first: user ? isFirstBooking(user.id) : false, coupon, provider });
  if (priced.missingServiceIds.length) return res.status(400).json({ error: "One or more selected services no longer exist" });
  if (priced.unavailableServiceIds.length) return res.status(409).json({ error: `${provider.name} does not offer one of the selected services` });
  const { missingServiceIds: _m, unavailableServiceIds: _u, ...quote } = priced;
  res.json({ ...quote, couponInvalid: Boolean(couponCode && !coupon), couponTooSmall: Boolean(coupon && priced.servicesTotal < coupon.min) });
});

/* ---------- customer: create + list ---------- */
router.post("/", requireRole("customer"), (req, res) => send(res, createBooking(req.user, req.body), 201));

const offersFor = (bookingId) =>
  db.prepare(`SELECT o.id, o.provider_id, o.amount, o.created_at, p.name AS provider_name FROM offers o JOIN providers p ON p.id = o.provider_id
               WHERE o.booking_id = ? AND o.status = 'pending' ORDER BY o.created_at DESC`).all(bookingId)
    .map((o) => ({ id: o.id, providerId: o.provider_id, providerName: o.provider_name, amount: o.amount, createdAt: o.created_at }));

router.get("/", requireRole("customer"), (req, res) => {
  const rows = db.prepare(`SELECT * FROM bookings WHERE user_id = ? ORDER BY created_at DESC LIMIT 200`).all(req.user.id);
  res.json({ bookings: rows.map((b) => ({ ...rowToBooking(b), counterOffers: b.status === "requested" ? offersFor(b.id) : [] })) });
});

router.get("/:id", requireUser, loadBooking, (req, res) => {
  const role = partyRole(req.user, req.booking);
  if (!role) return res.status(404).json({ error: "Booking not found" });
  const booking = rowToBooking(req.booking);
  if (role === "customer" && req.booking.status === "requested") booking.counterOffers = offersFor(req.booking.id);
  const reviewed = Boolean(db.prepare(`SELECT 1 FROM reviews WHERE booking_id = ?`).get(req.booking.id));
  res.json({ booking: { ...booking, reviewed }, role });
});

/* ---------- provider actions ---------- */
router.post("/:id/accept", requireRole("provider"), loadBooking, (req, res) => send(res, acceptBooking(req.user, req.booking, { staffId: cleanText(req.body?.staffId, 40) || null })));
router.post("/:id/reject", requireRole("provider"), loadBooking, (req, res) => send(res, rejectBooking(req.user, req.booking)));
router.post("/:id/counter", requireRole("provider"), loadBooking, (req, res) => send(res, counterBooking(req.user, req.booking, req.body?.amount)));
router.post("/:id/cash-received", requireRole("provider"), loadBooking, (req, res) => send(res, markCashReceived(req.user, req.booking)));
router.post("/:id/status", requireRole("provider"), loadBooking, (req, res) => {
  const to = req.body?.status;
  if (!Object.values(NEXT_STATUS).includes(to)) return res.status(400).json({ error: "status must be on_the_way, arrived, in_progress or done" });
  send(res, advance(req.user, req.booking, to));
});

/* ---------- cancel / pay ---------- */
router.post("/:id/cancel", requireUser, loadBooking, (req, res) => send(res, cancelBooking(req.user, req.booking, req.body?.reason)));
router.post("/:id/pay", requireRole("customer"), loadBooking, (req, res) => send(res, payBooking(req.user, req.booking, req.body?.method)));

/* ---------- messages between the customer and the assigned provider ---------- */
const canChat = (booking) => Boolean(booking.provider_id) && booking.status !== "cancelled";

router.get("/:id/messages", requireUser, loadBooking, (req, res) => {
  if (!partyRole(req.user, req.booking) || req.user.role === "admin") return res.status(404).json({ error: "Booking not found" });
  const rows = db.prepare(`SELECT m.id, m.sender_id, m.body, m.created_at, u.name AS sender_name FROM messages m JOIN users u ON u.id = m.sender_id WHERE m.booking_id = ? ORDER BY m.created_at, m.rowid`).all(req.booking.id);
  res.json({ messages: rows.map((m) => ({ id: m.id, mine: m.sender_id === req.user.id, senderName: m.sender_name, body: m.body, createdAt: m.created_at })), canSend: canChat(req.booking) });
});

router.post("/:id/messages", requireUser, loadBooking, (req, res) => {
  const role = partyRole(req.user, req.booking);
  if (!role || role === "admin") return res.status(404).json({ error: "Booking not found" });
  if (!canChat(req.booking)) return res.status(409).json({ error: "Chat opens once a provider accepts the booking" });
  const body = cleanText(req.body?.body, 1000);
  if (!body) return res.status(400).json({ error: "Write a message first" });
  const id = rid("MSG");
  db.prepare(`INSERT INTO messages (id, booking_id, sender_id, body, created_at) VALUES (?, ?, ?, ?, ?)`).run(id, req.booking.id, req.user.id, body, now());
  const provider = getProviderById.get(req.booking.provider_id);
  const recipient = role === "customer" ? provider?.user_id : req.booking.user_id;
  notify(recipient, "message", `New message from ${req.user.name}`, body.slice(0, 120), { bookingId: req.booking.id });
  res.status(201).json({ ok: true, id });
});

/** Conversation list for the signed-in customer or provider (mounted at /api/messages). */
export const conversations = Router();
conversations.get("/", requireRole("customer", "provider"), (req, res) => {
  const provider = req.user.role === "provider" ? getProviderByUserId.get(req.user.id) : null;
  const rows = db.prepare(
    `SELECT b.id, b.status, b.provider_name, b.day, b.start_hour, u.name AS customer_name,
            (SELECT body FROM messages m WHERE m.booking_id = b.id ORDER BY m.created_at DESC, m.rowid DESC LIMIT 1) AS last_message,
            (SELECT created_at FROM messages m WHERE m.booking_id = b.id ORDER BY m.created_at DESC, m.rowid DESC LIMIT 1) AS last_at
       FROM bookings b LEFT JOIN users u ON u.id = b.user_id
      WHERE b.provider_id IS NOT NULL AND b.status <> 'cancelled' AND ${provider ? "b.provider_id = ?" : "b.user_id = ?"}
      ORDER BY COALESCE(last_at, b.created_at) DESC LIMIT 100`
  ).all(provider ? provider.id : req.user.id);
  res.json({ conversations: rows.map((r) => ({ bookingId: r.id, status: r.status, with: provider ? r.customer_name : r.provider_name, day: r.day, startHour: r.start_hour, lastMessage: r.last_message, lastAt: r.last_at })) });
});

/* ---------- counter-offers (mounted at /api/offers) ---------- */
export const offers = Router();
offers.get("/", requireRole("customer"), (req, res) => {
  const rows = db.prepare(
    `SELECT o.id, o.booking_id, o.amount, o.original_amount, o.created_at, p.name AS provider_name, p.id AS provider_id
       FROM offers o JOIN bookings b ON b.id = o.booking_id JOIN providers p ON p.id = o.provider_id
      WHERE b.user_id = ? AND o.status = 'pending' AND b.status = 'requested' ORDER BY o.created_at DESC`
  ).all(req.user.id);
  res.json({ offers: rows.map((o) => ({ id: o.id, bookingId: o.booking_id, providerId: o.provider_id, providerName: o.provider_name, amount: o.amount, originalAmount: o.original_amount, createdAt: o.created_at })) });
});

offers.patch("/:id", requireRole("customer"), (req, res) => {
  const offer = db.prepare(`SELECT * FROM offers WHERE id = ?`).get(req.params.id);
  if (!offer) return res.status(404).json({ error: "Offer not found" });
  const status = req.body?.status;
  if (status !== "accepted" && status !== "rejected") return res.status(400).json({ error: "status must be accepted or rejected" });
  send(res, answerOffer(req.user, offer, status));
});

export default router;
