// Provider API (mounted at /api/provider). Only signed-in providers; every query is scoped to the caller's own provider row.
import { Router } from "express";
import {
  db, rid, now, getProviderByUserId, getProviderById, getProviderRating, updateProvider, getCouponByCode,
} from "../db.js";
import { requireRole, cleanText, positiveInt, nonNegInt, isValidPhone } from "../http.js";
import { priceServices, rowToBooking } from "../pricing.js";
import { resolveCoupon, isFirstBooking, providerLedger } from "../lifecycle.js";

const router = Router();
router.use(requireRole("provider"));
router.use((req, res, next) => {
  const provider = getProviderByUserId.get(req.user.id);
  if (!provider) return res.status(404).json({ error: "No provider profile found for this account" });
  req.provider = provider;
  next();
});

const serviceNameMap = () => new Map(db.prepare(`SELECT id, name FROM services`).all().map((s) => [s.id, s.name]));

const ownView = (p) => {
  const { rating: _legacy, ...rest } = p;
  const { rating, review_count } = getProviderRating.get(p.id);
  return { ...rest, rating: rating ?? null, review_count };
};

/* ---------------- profile (includes travel radius/fee) ---------------- */
router.get("/profile", (req, res) => res.json({ provider: ownView(req.provider) }));

router.post("/profile", (req, res) => {
  const p = req.provider;
  const b = req.body ?? {};
  const text = (key, current, max) => (b[key] === undefined ? current : cleanText(b[key], max));
  const num = (key, current, lo, hi) => {
    if (b[key] === undefined) return current;
    if (b[key] === null || b[key] === "") return null;
    const n = Number(b[key]);
    return Number.isFinite(n) && n >= lo && n <= hi ? n : NaN;
  };
  const next = {
    name: text("name", p.name, 80), service: text("service", p.service, 120), area: text("area", p.area, 60),
    address: text("address", p.address ?? "", 300), hours: text("hours", p.hours ?? "", 120), bio: text("bio", p.bio ?? "", 1000),
    phone: text("phone", p.phone ?? "", 20),
    lat: num("lat", p.lat, -90, 90), lng: num("lng", p.lng, -180, 180),
    travelRadius: num("travelRadius", p.travel_radius, 1, 200), travelFee: num("travelFee", p.travel_fee, 0, 100000),
    priceFrom: num("priceFrom", p.price_from, 0, 10_000_000),
  };
  if (!next.name || !next.service || !next.area) return res.status(400).json({ error: "name, service and area cannot be empty" });
  if (next.phone && !isValidPhone(next.phone)) return res.status(400).json({ error: "Enter a valid phone number" });
  if (Object.values(next).some((v) => typeof v === "number" && Number.isNaN(v))) return res.status(400).json({ error: "One of the numeric fields is invalid" });
  if (next.travelRadius === null || next.travelFee === null) return res.status(400).json({ error: "travelRadius and travelFee are required" });
  updateProvider.run(next.name, p.type, next.service, next.area, next.address, next.lat, next.lng, next.travelRadius, next.travelFee, next.hours, next.priceFrom, next.bio, next.phone || null, p.id);
  res.json({ provider: ownView(getProviderById.get(p.id)) });
});

/* ---------------- requests and bookings ---------------- */
function bookingForProvider(row, provider, extra = {}) {
  const names = serviceNameMap();
  const mine = row.provider_id === provider.id;
  const base = rowToBooking(row);
  return {
    ...base,
    userId: undefined, // customers are never identified by id to providers
    customerName: (row.customer_name || "Customer").split(" ")[0],
    services: base.serviceIds.map((id) => ({ id, name: names.get(id) ?? `Service ${id}` })),
    // The exact address is shared once the request is yours.
    address: mine || row.status !== "requested" ? row.address : row.area ? `${row.area} (exact address shared after you accept)` : "Hidden until accepted",
    ...extra,
  };
}

router.get("/requests", (req, res) => {
  const p = req.provider;
  const rows = db.prepare(
    `SELECT b.*, u.name AS customer_name FROM bookings b LEFT JOIN users u ON u.id = b.user_id
      WHERE b.status = 'requested'
        AND (b.provider_id = ? OR (b.provider_id IS NULL AND b.mode = 'home' AND b.area = ?))
        AND NOT EXISTS (SELECT 1 FROM offers o WHERE o.booking_id = b.id AND o.provider_id = ? AND o.status = 'rejected')
      ORDER BY b.created_at DESC LIMIT 100`
  ).all(p.id, p.area, p.id);
  const requests = rows.map((row) => {
    const quote = priceServices(JSON.parse(row.service_ids), row.mode, { first: isFirstBooking(row.user_id, row.id), coupon: resolveCoupon(row.coupon_code, p.id), provider: p });
    const counter = db.prepare(`SELECT amount FROM offers WHERE booking_id = ? AND provider_id = ? AND status = 'pending'`).get(row.id, p.id);
    return bookingForProvider(row, p, {
      direct: row.provider_id === p.id,
      yourPrice: quote.unavailableServiceIds.length ? null : row.offer_amount ?? quote.total,
      missingPrices: quote.unavailableServiceIds.map((id) => serviceNameMap().get(id)),
      myCounter: counter?.amount ?? null,
    });
  });
  res.json({ requests });
});

router.get("/bookings", (req, res) => {
  const status = typeof req.query.status === "string" ? req.query.status.split(",").filter(Boolean) : [];
  const rows = db.prepare(
    `SELECT b.*, u.name AS customer_name FROM bookings b LEFT JOIN users u ON u.id = b.user_id
      WHERE b.provider_id = ? ${status.length ? `AND b.status IN (${status.map(() => "?").join(",")})` : ""}
      ORDER BY b.created_at DESC LIMIT 300`
  ).all(req.provider.id, ...status);
  res.json({ bookings: rows.map((r) => bookingForProvider(r, req.provider)) });
});

router.get("/dashboard", (req, res) => {
  const id = req.provider.id;
  const one = (sql, ...a) => db.prepare(sql).get(...a);
  const month = now().slice(0, 7);
  const today = now().slice(0, 10);
  const pending = one(
    `SELECT COUNT(*) AS n FROM bookings b WHERE b.status = 'requested' AND (b.provider_id = ? OR (b.provider_id IS NULL AND b.mode = 'home' AND b.area = ?))
       AND NOT EXISTS (SELECT 1 FROM offers o WHERE o.booking_id = b.id AND o.provider_id = ? AND o.status = 'rejected')`, id, req.provider.area, id).n;
  const earn = (prefix) => one(`SELECT COALESCE(SUM(provider_earning), 0) AS v FROM bookings WHERE provider_id = ? AND status = 'done' AND completed_at LIKE ?`, id, prefix + "%").v;
  const { rating, review_count } = getProviderRating.get(id);
  const ledger = providerLedger(id);
  res.json({
    verified: !!req.provider.verified,
    pendingRequests: pending,
    activeBookings: one(`SELECT COUNT(*) AS n FROM bookings WHERE provider_id = ? AND status IN ('accepted', 'on_the_way', 'arrived', 'in_progress')`, id).n,
    completedBookings: ledger.bookings,
    earningsToday: earn(today),
    earningsMonth: earn(month),
    earningsTotal: ledger.earning,
    unpaidAmount: ledger.unpaid,
    rating: rating ?? null,
    reviewCount: review_count,
    servicesWithPrice: one(`SELECT COUNT(*) AS n FROM provider_services WHERE provider_id = ? AND is_active = 1`, id).n,
  });
});

router.get("/earnings", (req, res) => {
  const id = req.provider.id;
  const rows = db.prepare(`SELECT * FROM bookings WHERE provider_id = ? AND status = 'done' ORDER BY completed_at DESC LIMIT 200`).all(id);
  res.json({
    ledger: providerLedger(id),
    bookings: rows.map((b) => ({ id: b.id, completedAt: b.completed_at, total: b.total, commission: b.commission_amount, earning: b.provider_earning, payStatus: b.pay_status, paidMethod: b.paid_method })),
  });
});

router.get("/payouts", (req, res) => {
  const ledger = providerLedger(req.provider.id);
  const settlements = db.prepare(`SELECT id, amount, note, created_at FROM settlements WHERE provider_id = ? ORDER BY created_at DESC LIMIT 100`).all(req.provider.id)
    .map((s) => ({ id: s.id, amount: Math.abs(s.amount), direction: s.amount > 0 ? "you_paid_platform" : "platform_paid_you", note: s.note, createdAt: s.created_at }));
  res.json({ ledger, owes: ledger.balance > 0 ? "provider" : ledger.balance < 0 ? "platform" : "none", settlements });
});

/* ---------------- services and prices ---------------- */
router.get("/services", (req, res) => {
  const rows = db.prepare(
    `SELECT s.id, s.name, s.minutes, s.price AS suggested_price, ps.price AS my_price, COALESCE(ps.is_active, 0) AS is_active
       FROM services s LEFT JOIN provider_services ps ON ps.service_id = s.id AND ps.provider_id = ? ORDER BY s.id`
  ).all(req.provider.id);
  res.json({ services: rows.map((r) => ({ id: r.id, name: r.name, minutes: r.minutes, suggestedPrice: r.suggested_price, price: r.my_price ?? null, active: !!r.is_active })) });
});

router.put("/services/:serviceId", (req, res) => {
  const serviceId = positiveInt(req.params.serviceId);
  if (!serviceId || !db.prepare(`SELECT 1 FROM services WHERE id = ?`).get(serviceId)) return res.status(404).json({ error: "Service not found" });
  const b = req.body ?? {};
  if (b.price === null) {
    db.prepare(`DELETE FROM provider_services WHERE provider_id = ? AND service_id = ?`).run(req.provider.id, serviceId);
    return res.json({ ok: true });
  }
  const price = positiveInt(b.price);
  if (!price || price > 1_000_000) return res.status(400).json({ error: "Enter a price between 1 and 1,000,000" });
  db.prepare(
    `INSERT INTO provider_services (provider_id, service_id, price, is_active, updated_at) VALUES (?, ?, ?, ?, ?)
     ON CONFLICT(provider_id, service_id) DO UPDATE SET price = excluded.price, is_active = excluded.is_active, updated_at = excluded.updated_at`
  ).run(req.provider.id, serviceId, price, b.active === false ? 0 : 1, now());
  res.json({ ok: true });
});

/* ---------------- promotions ---------------- */
const promoView = (p) => ({ id: p.id, code: p.code, percent: p.percent, minAmount: p.min_amount, maxUses: p.max_uses, usedCount: p.used_count, expiresAt: p.expires_at, active: !!p.is_active, createdAt: p.created_at });

router.get("/promotions", (req, res) => {
  res.json({ promotions: db.prepare(`SELECT * FROM promotions WHERE provider_id = ? ORDER BY created_at DESC`).all(req.provider.id).map(promoView) });
});

router.post("/promotions", (req, res) => {
  const code = cleanText(req.body?.code, 30).toUpperCase();
  const percent = Number(req.body?.percent);
  const minAmount = nonNegInt(req.body?.minAmount ?? 0);
  const maxUses = req.body?.maxUses === undefined || req.body.maxUses === "" || req.body.maxUses === null ? null : positiveInt(req.body.maxUses);
  const expiresRaw = cleanText(req.body?.expiresAt, 30);
  const expires = expiresRaw ? new Date(expiresRaw) : null;
  if (!/^[A-Z0-9_-]{3,30}$/.test(code)) return res.status(400).json({ error: "Code must be 3-30 letters, numbers, - or _" });
  if (!Number.isInteger(percent) || percent < 1 || percent > 50) return res.status(400).json({ error: "Discount must be 1 to 50 percent" });
  if (minAmount === null) return res.status(400).json({ error: "Minimum amount must be a whole number" });
  if (req.body?.maxUses && maxUses === null) return res.status(400).json({ error: "Max uses must be a whole number" });
  if (expires && (Number.isNaN(expires.getTime()) || expires.getTime() < Date.now())) return res.status(400).json({ error: "Expiry must be a future date" });
  if (getCouponByCode.get(code)) return res.status(409).json({ error: "That code is already used by a platform coupon" });
  if (db.prepare(`SELECT 1 FROM promotions WHERE provider_id = ? AND code = ?`).get(req.provider.id, code)) return res.status(409).json({ error: "You already have a promotion with that code" });
  const id = rid("PRM");
  db.prepare(`INSERT INTO promotions (id, provider_id, code, percent, min_amount, max_uses, expires_at, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`)
    .run(id, req.provider.id, code, percent, minAmount, maxUses, expires ? expires.toISOString() : null, now());
  res.status(201).json({ promotion: promoView(db.prepare(`SELECT * FROM promotions WHERE id = ?`).get(id)) });
});

router.patch("/promotions/:id", (req, res) => {
  if (typeof req.body?.active !== "boolean") return res.status(400).json({ error: "active must be true or false" });
  const info = db.prepare(`UPDATE promotions SET is_active = ? WHERE id = ? AND provider_id = ?`).run(req.body.active ? 1 : 0, req.params.id, req.provider.id);
  if (!info.changes) return res.status(404).json({ error: "Promotion not found" });
  res.json({ ok: true });
});

router.delete("/promotions/:id", (req, res) => {
  const info = db.prepare(`DELETE FROM promotions WHERE id = ? AND provider_id = ?`).run(req.params.id, req.provider.id);
  if (!info.changes) return res.status(404).json({ error: "Promotion not found" });
  res.json({ ok: true });
});

/* ---------------- staff (salons) ---------------- */
const salonOnly = (req, res, next) => (req.provider.type === "salon" ? next() : res.status(403).json({ error: "Staff management is for salons" }));
const staffView = (s) => ({ id: s.id, name: s.name, email: s.email, specialty: s.specialty, gender: s.gender, active: !!s.is_active });

router.get("/staff", salonOnly, (req, res) => {
  res.json({ staff: db.prepare(`SELECT * FROM staff WHERE provider_id = ? ORDER BY created_at`).all(req.provider.id).map(staffView) });
});

router.post("/staff", salonOnly, (req, res) => {
  const name = cleanText(req.body?.name, 80);
  if (!name) return res.status(400).json({ error: "Name is required" });
  const id = rid("STF");
  db.prepare(`INSERT INTO staff (id, provider_id, name, email, specialty, gender, is_active, created_at) VALUES (?, ?, ?, ?, ?, ?, 1, ?)`)
    .run(id, req.provider.id, name, cleanText(req.body?.email, 120) || null, cleanText(req.body?.specialty, 80) || null, cleanText(req.body?.gender, 20) || null, now());
  res.status(201).json({ staff: staffView(db.prepare(`SELECT * FROM staff WHERE id = ?`).get(id)) });
});

router.patch("/staff/:id", salonOnly, (req, res) => {
  const s = db.prepare(`SELECT * FROM staff WHERE id = ? AND provider_id = ?`).get(req.params.id, req.provider.id);
  if (!s) return res.status(404).json({ error: "Staff member not found" });
  const b = req.body ?? {};
  const name = b.name === undefined ? s.name : cleanText(b.name, 80);
  if (!name) return res.status(400).json({ error: "Name cannot be empty" });
  db.prepare(`UPDATE staff SET name = ?, email = ?, specialty = ?, gender = ?, is_active = ? WHERE id = ?`).run(
    name, b.email === undefined ? s.email : cleanText(b.email, 120) || null, b.specialty === undefined ? s.specialty : cleanText(b.specialty, 80) || null,
    b.gender === undefined ? s.gender : cleanText(b.gender, 20) || null, b.active === undefined ? s.is_active : b.active ? 1 : 0, s.id);
  res.json({ staff: staffView(db.prepare(`SELECT * FROM staff WHERE id = ?`).get(s.id)) });
});

router.delete("/staff/:id", salonOnly, (req, res) => {
  const info = db.prepare(`DELETE FROM staff WHERE id = ? AND provider_id = ?`).run(req.params.id, req.provider.id);
  if (!info.changes) return res.status(404).json({ error: "Staff member not found" });
  res.json({ ok: true });
});

/* ---------------- weekly availability ---------------- */
router.get("/availability", (req, res) => {
  const rows = db.prepare(`SELECT day_of_week, start_time, end_time, is_active FROM provider_availability WHERE provider_id = ? ORDER BY day_of_week`).all(req.provider.id);
  res.json({ days: rows.map((r) => ({ dayOfWeek: r.day_of_week, start: r.start_time, end: r.end_time, active: !!r.is_active })) });
});

router.put("/availability", (req, res) => {
  const days = Array.isArray(req.body?.days) ? req.body.days : null;
  if (!days || days.length > 7) return res.status(400).json({ error: "days must be a list of up to 7 entries" });
  const seen = new Set();
  const clean = [];
  for (const d of days) {
    const dow = Number(d?.dayOfWeek);
    const ok = /^([01]\d|2[0-3]):[0-5]\d$/;
    if (!Number.isInteger(dow) || dow < 0 || dow > 6 || seen.has(dow)) return res.status(400).json({ error: "Each day must be 0-6 and listed once" });
    if (!ok.test(d.start) || !ok.test(d.end) || d.start >= d.end) return res.status(400).json({ error: "Each day needs a start time earlier than its end time (HH:MM)" });
    seen.add(dow);
    clean.push({ dow, start: d.start, end: d.end, active: d.active === false ? 0 : 1 });
  }
  db.transaction(() => {
    db.prepare(`DELETE FROM provider_availability WHERE provider_id = ?`).run(req.provider.id);
    for (const d of clean) {
      db.prepare(`INSERT INTO provider_availability (id, provider_id, day_of_week, start_time, end_time, is_active, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)`)
        .run(rid("AVL"), req.provider.id, d.dow, d.start, d.end, d.active, now());
    }
  })();
  res.json({ ok: true });
});

/* ---------------- reviews ---------------- */
router.get("/reviews", (req, res) => {
  const rows = db.prepare(`SELECT * FROM reviews WHERE provider_id = ? ORDER BY created_at DESC LIMIT 100`).all(req.provider.id);
  const { rating, review_count } = getProviderRating.get(req.provider.id);
  res.json({ rating: rating ?? null, reviewCount: review_count, reviews: rows.map((r) => ({ id: r.id, bookingId: r.booking_id, stars: r.stars, text: r.text, author: r.author, createdAt: r.created_at })) });
});

export default router;
