// Signed-in account features: notifications, favorites, wallet, referrals, loyalty, reviews, disputes.
import { Router } from "express";
import {
  db, rid, now, getBookingById, getProviderByUserId, getLoyalty, getLoyaltyTransactions, getReferralsByReferrer,
  getNotifications, markAllNotificationsRead, createDispute, createReview,
} from "../db.js";
import { requireUser, requireRole, cleanText, isValidPhone } from "../http.js";
import { notify } from "../lifecycle.js";

/* ---------------- notifications ---------------- */
export const notifications = Router();
notifications.use(requireUser);
notifications.get("/", (req, res) => {
  const rows = getNotifications.all(req.user.id);
  res.json({ notifications: rows, unread: db.prepare(`SELECT COUNT(*) AS n FROM notifications WHERE user_id = ? AND is_read = 0`).get(req.user.id).n });
});
notifications.patch("/read-all", (req, res) => {
  markAllNotificationsRead.run(req.user.id);
  res.json({ ok: true });
});
notifications.patch("/:id/read", (req, res) => {
  const info = db.prepare(`UPDATE notifications SET is_read = 1 WHERE id = ? AND user_id = ?`).run(req.params.id, req.user.id);
  if (!info.changes) return res.status(404).json({ error: "Notification not found" });
  res.json({ ok: true });
});

/* ---------------- favorites (saved providers, by name) ---------------- */
export const favorites = Router();
favorites.use(requireUser);
const listFavorites = (userId) => db.prepare(`SELECT name FROM favorites WHERE user_id = ? ORDER BY name`).all(userId);
favorites.get("/", (req, res) => res.json({ favorites: listFavorites(req.user.id) }));
favorites.post("/", (req, res) => {
  const name = cleanText(req.body?.name, 80);
  const action = req.body?.action === "remove" ? "remove" : req.body?.action === "add" ? "add" : null;
  if (!name || !action) return res.status(400).json({ error: "name and action (add or remove) are required" });
  if (action === "add") {
    if (!db.prepare(`SELECT 1 FROM providers WHERE name = ? AND verified = 1`).get(name)) return res.status(404).json({ error: "Provider not found" });
    db.prepare(`INSERT OR IGNORE INTO favorites (user_id, name) VALUES (?, ?)`).run(req.user.id, name);
  } else {
    db.prepare(`DELETE FROM favorites WHERE user_id = ? AND name = ?`).run(req.user.id, name);
  }
  res.json({ favorites: listFavorites(req.user.id) });
});

/* ---------------- wallet / referrals / loyalty ---------------- */
export const wallet = Router();
wallet.get("/", requireUser, (req, res) => res.json({ wallet: req.user.wallet }));

export const referrals = Router();
referrals.get("/", requireUser, (req, res) => res.json({ referrals: getReferralsByReferrer.all(req.user.id) }));

export const loyalty = Router();
loyalty.get("/", requireUser, (req, res) => {
  const l = getLoyalty.get(req.user.id);
  res.json({ loyalty: l ?? { points: 0, total_earned: 0, total_redeemed: 0 }, transactions: getLoyaltyTransactions.all(req.user.id) });
});

/* ---------------- reviews ---------------- */
export const reviews = Router();
reviews.post("/", requireRole("customer"), (req, res) => {
  const stars = Number(req.body?.stars);
  const text = cleanText(req.body?.text, 1000);
  const bookingId = cleanText(req.body?.bookingId, 40);
  if (!bookingId) return res.status(400).json({ error: "bookingId is required" });
  if (!Number.isInteger(stars) || stars < 1 || stars > 5) return res.status(400).json({ error: "stars must be 1 to 5" });
  const booking = getBookingById.get(bookingId);
  if (!booking || booking.user_id !== req.user.id) return res.status(404).json({ error: "Booking not found" });
  if (booking.status !== "done") return res.status(409).json({ error: "You can review a booking once it is completed" });
  if (!booking.provider_id) return res.status(409).json({ error: "This booking has no provider to review" });
  if (db.prepare(`SELECT 1 FROM reviews WHERE booking_id = ?`).get(bookingId)) return res.status(409).json({ error: "You already reviewed this booking" });
  const review = { id: rid("REV"), bookingId, providerId: booking.provider_id, target: booking.provider_name, stars, text, author: req.user.name, createdAt: now() };
  createReview.run(review.id, review.bookingId, review.target, review.stars, review.text, review.author, review.createdAt, review.providerId);
  const provider = db.prepare(`SELECT user_id FROM providers WHERE id = ?`).get(booking.provider_id);
  if (provider) notify(provider.user_id, "review", "New review", `${req.user.name} left you ${stars} star${stars === 1 ? "" : "s"}`, { bookingId });
  res.status(201).json({ review });
});

/* ---------------- disputes ---------------- */
export const disputes = Router();
disputes.get("/", requireRole("customer", "provider"), (req, res) => {
  const provider = req.user.role === "provider" ? getProviderByUserId.get(req.user.id) : null;
  const rows = provider
    ? db.prepare(`SELECT * FROM disputes WHERE provider_id = ? ORDER BY created_at DESC`).all(provider.id)
    : db.prepare(`SELECT * FROM disputes WHERE user_id = ? ORDER BY created_at DESC`).all(req.user.id);
  res.json({ disputes: rows });
});

disputes.post("/", requireRole("customer"), (req, res) => {
  const bookingId = cleanText(req.body?.bookingId, 40);
  const reason = cleanText(req.body?.reason, 1000);
  if (!bookingId || reason.length < 10) return res.status(400).json({ error: "Enter the booking ID and describe the problem (at least 10 characters)" });
  const booking = getBookingById.get(bookingId);
  if (!booking || booking.user_id !== req.user.id) return res.status(404).json({ error: "Booking not found" });
  if (!booking.provider_id) return res.status(409).json({ error: "This booking had no provider" });
  if (booking.status !== "done") return res.status(409).json({ error: "You can open a dispute once the service is completed" });
  if (db.prepare(`SELECT 1 FROM disputes WHERE booking_id = ? AND status IN ('open', 'under_review')`).get(bookingId)) {
    return res.status(409).json({ error: "There is already an open dispute for this booking" });
  }
  const id = rid("DSP");
  createDispute.run(id, bookingId, req.user.id, booking.provider_id, reason, "open", now());
  for (const a of db.prepare(`SELECT id FROM users WHERE role = 'admin'`).all()) notify(a.id, "dispute", "New dispute", `Booking ${bookingId}: ${reason.slice(0, 100)}`, { disputeId: id });
  res.status(201).json({ dispute: db.prepare(`SELECT * FROM disputes WHERE id = ?`).get(id) });
});

/* ---------------- provider application (signed-in customers) ---------------- */
export const partner = Router();
partner.post("/apply", requireUser, (req, res) => {
  const user = req.user;
  if (user.role === "admin") return res.status(403).json({ error: "Admin accounts cannot apply as providers" });
  if (user.role === "provider" || getProviderByUserId.get(user.id)) return res.status(409).json({ error: "You already have a provider account" });
  const name = cleanText(req.body?.name, 80);
  const phone = cleanText(req.body?.phone, 20);
  const type = req.body?.type;
  const service = cleanText(req.body?.service, 120);
  const area = cleanText(req.body?.area, 60);
  const idNote = cleanText(req.body?.idNote, 500);
  if (!name || !phone || !type || !service || !area || !idNote) return res.status(400).json({ error: "All fields are required" });
  if (!["salon", "freelance"].includes(type)) return res.status(400).json({ error: "Invalid type" });
  if (!isValidPhone(phone)) return res.status(400).json({ error: "Enter a valid phone number" });
  if (db.prepare(`SELECT 1 FROM provider_apps WHERE user_id = ? AND status = 'pending'`).get(user.id)) {
    return res.status(409).json({ error: "You already have an application waiting for review" });
  }
  db.prepare(`INSERT INTO provider_apps (id, name, phone, type, service, area, id_note, status, created_at, user_id) VALUES (?, ?, ?, ?, ?, ?, ?, 'pending', ?, ?)`)
    .run(rid("APP"), name, phone, type, service, area, idNote, now(), user.id);
  for (const a of db.prepare(`SELECT id FROM users WHERE role = 'admin'`).all()) notify(a.id, "application", "New provider application", `${name} applied as a ${type}`, {});
  res.status(201).json({ ok: true, message: "Application submitted. We will review it shortly." });
});
