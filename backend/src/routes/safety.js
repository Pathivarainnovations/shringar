// Safety (SOS, trip sharing, emergency contacts) and live tracking.
import crypto from "node:crypto";
import { Router } from "express";
import { db, rid, now, getBookingById, getProviderByUserId } from "../db.js";
import { requireUser, requireRole, cleanText, isValidPhone, hit } from "../http.js";
import { notify } from "../lifecycle.js";
import { partyRole } from "./bookings.js";
import { broadcast } from "../ws.js";

const FRONTEND_ORIGIN = () => process.env.FRONTEND_ORIGIN || "http://localhost:3000";
const LIVE = ["on_the_way", "arrived", "in_progress"];
const validLat = (v) => Number.isFinite(v) && v >= -90 && v <= 90;
const validLng = (v) => Number.isFinite(v) && v >= -180 && v <= 180;

/* ---------------- emergency contacts ---------------- */
export const contacts = Router();
contacts.use(requireUser);
contacts.get("/", (req, res) => res.json({ contacts: db.prepare(`SELECT phone FROM emergency_contacts WHERE user_id = ?`).all(req.user.id).map((c) => c.phone) }));
contacts.post("/", (req, res) => {
  const phone = cleanText(req.body?.phone, 20);
  if (!isValidPhone(phone)) return res.status(400).json({ error: "Enter a valid phone number" });
  if (db.prepare(`SELECT COUNT(*) AS n FROM emergency_contacts WHERE user_id = ?`).get(req.user.id).n >= 5) return res.status(409).json({ error: "You can save up to 5 contacts" });
  db.prepare(`INSERT OR IGNORE INTO emergency_contacts (user_id, phone) VALUES (?, ?)`).run(req.user.id, phone);
  res.status(201).json({ ok: true });
});
contacts.delete("/", (req, res) => {
  db.prepare(`DELETE FROM emergency_contacts WHERE user_id = ? AND phone = ?`).run(req.user.id, cleanText(req.body?.phone, 20));
  res.json({ ok: true });
});

/* ---------------- SOS ---------------- */
export const sos = Router();
sos.post("/", requireRole("customer"), (req, res) => {
  const bookingId = cleanText(req.body?.bookingId, 40);
  const lat = Number(req.body?.lat);
  const lng = Number(req.body?.lng);
  if (!bookingId || !validLat(lat) || !validLng(lng)) return res.status(400).json({ error: "bookingId and a valid location are required" });
  const booking = getBookingById.get(bookingId);
  if (!booking || booking.user_id !== req.user.id) return res.status(404).json({ error: "Booking not found" });
  if (!LIVE.includes(booking.status)) return res.status(409).json({ error: "SOS is available while a service is under way" });
  const id = rid("SOS");
  db.prepare(`INSERT INTO sos_alerts (id, booking_id, user_id, lat, lng, address, status, created_at) VALUES (?, ?, ?, ?, ?, ?, 'active', ?)`).run(id, bookingId, req.user.id, lat, lng, cleanText(req.body?.address, 200), now());
  for (const a of db.prepare(`SELECT id FROM users WHERE role = 'admin'`).all()) notify(a.id, "sos", "SOS alert", `${req.user.name} triggered SOS on booking ${bookingId}`, { bookingId, lat, lng });
  res.status(201).json({ alert: db.prepare(`SELECT * FROM sos_alerts WHERE id = ?`).get(id) });
});

sos.patch("/:id", requireRole("admin"), (req, res) => {
  const status = req.body?.status;
  if (!["resolved", "false_alarm"].includes(status)) return res.status(400).json({ error: "Invalid status" });
  const info = db.prepare(`UPDATE sos_alerts SET status = ?, resolved_at = ? WHERE id = ?`).run(status, now(), req.params.id);
  if (!info.changes) return res.status(404).json({ error: "Alert not found" });
  res.json({ ok: true });
});

/* ---------------- trip sharing ---------------- */
export const trip = Router();
trip.post("/share", requireRole("customer"), (req, res) => {
  const booking = getBookingById.get(cleanText(req.body?.bookingId, 40));
  const sharedWith = cleanText(req.body?.sharedWith, 100);
  if (!booking || booking.user_id !== req.user.id) return res.status(404).json({ error: "Booking not found" });
  if (!sharedWith) return res.status(400).json({ error: "Say who you are sharing with" });
  const token = crypto.randomBytes(16).toString("hex");
  db.prepare(`INSERT INTO trip_shares (id, booking_id, shared_with, token, expires_at, created_at) VALUES (?, ?, ?, ?, ?, ?)`)
    .run(rid("TRIP"), booking.id, sharedWith, token, new Date(Date.now() + 24 * 3600 * 1000).toISOString(), now());
  res.status(201).json({ shareUrl: `${FRONTEND_ORIGIN()}/trip/${token}` });
});

// Public (anyone with the unguessable link, for 24 hours): status, provider first name and last known position only.
trip.get("/:token", (req, res) => {
  const share = db.prepare(`SELECT * FROM trip_shares WHERE token = ?`).get(req.params.token);
  if (!share || new Date(share.expires_at) < new Date()) return res.status(404).json({ error: "This link is invalid or has expired" });
  const b = getBookingById.get(share.booking_id);
  const t = b ? db.prepare(`SELECT lat, lng, status, eta_minutes, updated_at FROM tracking_locations WHERE booking_id = ?`).get(b.id) : null;
  res.json({
    booking: { id: b?.id, status: b?.status, day: b?.day, startHour: b?.start_hour, providerName: (b?.provider_name || "").split(" ")[0] },
    tracking: t ? { lat: t.lat, lng: t.lng, status: t.status, etaMinutes: t.eta_minutes, updatedAt: t.updated_at } : null,
  });
});

export const tripShares = Router();
tripShares.get("/", requireRole("customer"), (req, res) => {
  const rows = db.prepare(`SELECT s.id, s.booking_id AS bookingId, s.shared_with AS sharedWith, s.expires_at AS expiresAt, s.created_at AS createdAt
                             FROM trip_shares s JOIN bookings b ON b.id = s.booking_id WHERE b.user_id = ? ORDER BY s.created_at DESC LIMIT 50`).all(req.user.id);
  res.json({ tripShares: rows });
});

/* ---------------- live tracking ---------------- */
export const tracking = Router();

tracking.get("/:bookingId", requireUser, (req, res) => {
  const b = getBookingById.get(req.params.bookingId);
  const role = b ? partyRole(req.user, b) : null;
  if (!b || !role) return res.status(404).json({ error: "Booking not found" });
  const t = db.prepare(`SELECT lat, lng, status, eta_minutes, updated_at FROM tracking_locations WHERE booking_id = ?`).get(b.id);
  res.json({
    booking: { id: b.id, status: b.status, address: b.address, mode: b.mode, providerName: b.provider_name, providerPhone: b.provider_phone, day: b.day, startHour: b.start_hour },
    tracking: t && LIVE.includes(b.status) ? { lat: t.lat, lng: t.lng, status: t.status, etaMinutes: t.eta_minutes, updatedAt: t.updated_at } : null,
  });
});

tracking.post("/location", requireRole("provider"), (req, res) => {
  const provider = getProviderByUserId.get(req.user.id);
  const b = getBookingById.get(cleanText(req.body?.bookingId, 40));
  if (!provider || !b || b.provider_id !== provider.id) return res.status(404).json({ error: "Booking not found" });
  if (!LIVE.includes(b.status)) return res.status(409).json({ error: "Start the trip first (mark the booking as on the way)" });
  const lat = Number(req.body?.lat);
  const lng = Number(req.body?.lng);
  if (!validLat(lat) || !validLng(lng)) return res.status(400).json({ error: "A valid lat and lng are required" });
  const limited = hit(`loc:${provider.id}`, 60_000, 120);
  if (!limited.allowed) return res.status(429).json({ error: "Sending locations too quickly" });
  const eta = req.body?.etaMinutes === undefined || req.body.etaMinutes === null ? null : Math.round(Number(req.body.etaMinutes));
  if (eta !== null && (!Number.isFinite(eta) || eta < 0 || eta > 600)) return res.status(400).json({ error: "etaMinutes must be 0 to 600" });
  db.prepare(
    `INSERT INTO tracking_locations (id, booking_id, provider_id, lat, lng, address, eta_minutes, status, updated_at) VALUES (?, ?, ?, ?, ?, '', ?, ?, ?)
     ON CONFLICT(booking_id) DO UPDATE SET lat = excluded.lat, lng = excluded.lng, eta_minutes = excluded.eta_minutes, status = excluded.status, updated_at = excluded.updated_at`
  ).run(rid("TRK"), b.id, provider.id, lat, lng, eta, b.status, now());
  broadcast(b.id, { type: "location", lat, lng, etaMinutes: eta, status: b.status, updatedAt: now() });
  res.json({ ok: true });
});
