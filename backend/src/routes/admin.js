// Admin-only API (mounted at /api/admin). Every route here requires role = admin.
import { Router } from "express";
import {
  db, rid, now, getServiceById, getAllServices, createService, updateService, deleteService, getCategories, createCategory,
  updateCategory, deleteCategory, getAllAreas, getAreaById, createArea, updateArea, deleteArea, getProviderById, getProviderByUserId,
  getProviderRating, findUserById, createProvider, updateProviderApp, getProviderAppById, getCouponByCode, createCoupon, updateCoupon,
  updateDispute, createNotification, updateUserStatus, findUserByIdWithStatus, createAuditLog,
} from "../db.js";
import { requireAdmin, cleanText, positiveInt, nonNegInt } from "../http.js";
import { getSettings, saveSettings } from "../settings.js";
import { rowToBooking } from "../pricing.js";
import { notify, providerLedger } from "../lifecycle.js";

const router = Router();
router.use(requireAdmin);

const limitOf = (v, def = 100, max = 500) => Math.min(max, Math.max(1, Number(v) || def));

/* ---------------- reference data: services, categories, areas, settings ---------------- */

router.get("/services", (_req, res) => {
  res.json({ services: getAllServices.all() });
});

router.post("/services", (req, res) => {
  const name = cleanText(req.body?.name, 80);
  const minutes = positiveInt(req.body?.minutes);
  const price = positiveInt(req.body?.price);
  if (!name || !minutes || !price) {
    return res.status(400).json({ error: "name, minutes (whole number) and price (whole number) are required" });
  }
  if (db.prepare("SELECT 1 FROM services WHERE lower(name) = lower(?)").get(name)) {
    return res.status(409).json({ error: "A service with that name already exists" });
  }
  const info = createService.run(name, minutes, price);
  res.status(201).json({ service: getServiceById.get(Number(info.lastInsertRowid)) });
});

router.patch("/services/:id", (req, res) => {
  const id = Number(req.params.id);
  const service = getServiceById.get(id);
  if (!service) return res.status(404).json({ error: "Service not found" });
  const name = req.body?.name === undefined ? service.name : cleanText(req.body.name, 80);
  const minutes = req.body?.minutes === undefined ? service.minutes : positiveInt(req.body.minutes);
  const price = req.body?.price === undefined ? service.price : positiveInt(req.body.price);
  if (!name || !minutes || !price) return res.status(400).json({ error: "Invalid name, minutes or price" });
  updateService.run(name, minutes, price, id);
  const updated = getServiceById.get(id);
  res.json({ service: updated });
});

router.delete("/services/:id", (req, res) => {
  const id = Number(req.params.id);
  const service = getServiceById.get(id);
  if (!service) return res.status(404).json({ error: "Service not found" });
  deleteService.run(id);
  res.json({ ok: true });
});

router.get("/categories", (_req, res) => {
  res.json({ categories: getCategories.all() });
});

router.post("/categories", (req, res) => {
  const name = cleanText(req.body?.name, 60);
  const image = cleanText(req.body?.image, 300);
  if (!name || !image) return res.status(400).json({ error: "name and image are required" });
  if (!image.startsWith("/") && !/^https?:\/\//.test(image)) return res.status(400).json({ error: "image must be a path (/…) or an http(s) URL" });
  if (getCategories.all().some((c) => c.name.toLowerCase() === name.toLowerCase())) {
    return res.status(409).json({ error: "A category with that name already exists" });
  }
  createCategory.run(name, image);
  res.status(201).json({ category: { name, image } });
});

router.patch("/categories/:name", (req, res) => {
  const existing = getCategories.all().find((c) => c.name === req.params.name);
  if (!existing) return res.status(404).json({ error: "Category not found" });
  const name = req.body?.name === undefined ? existing.name : cleanText(req.body.name, 60);
  const image = req.body?.image === undefined ? existing.image : cleanText(req.body.image, 300);
  if (!name || !image) return res.status(400).json({ error: "name and image cannot be empty" });
  if (name !== existing.name && getCategories.all().some((c) => c.name.toLowerCase() === name.toLowerCase())) {
    return res.status(409).json({ error: "A category with that name already exists" });
  }
  updateCategory.run(name, image, existing.name);
  res.json({ category: { name, image } });
});

router.delete("/categories/:name", (req, res) => {
  const info = deleteCategory.run(req.params.name);
  if (!info.changes) return res.status(404).json({ error: "Category not found" });
  res.json({ ok: true });
});

router.get("/areas", (_req, res) => {
  res.json({ areas: getAllAreas.all().map((a) => ({ id: a.id, name: a.name, city: a.city, active: !!a.active })) });
});

router.post("/areas", (req, res) => {
  const name = cleanText(req.body?.name, 60);
  const city = cleanText(req.body?.city, 60);
  if (!name || !city) return res.status(400).json({ error: "name and city are required" });
  try {
    const info = createArea.run(name, city, 1);
    res.status(201).json({ area: { id: Number(info.lastInsertRowid), name, city, active: true } });
  } catch (err) {
    if (String(err.message).includes("UNIQUE")) return res.status(409).json({ error: "That area already exists in that city" });
    throw err;
  }
});

router.patch("/areas/:id", (req, res) => {
  const area = getAreaById.get(Number(req.params.id));
  if (!area) return res.status(404).json({ error: "Area not found" });
  const name = req.body?.name === undefined ? area.name : cleanText(req.body.name, 60);
  const city = req.body?.city === undefined ? area.city : cleanText(req.body.city, 60);
  const active = req.body?.active === undefined ? area.active : req.body.active ? 1 : 0;
  if (!name || !city) return res.status(400).json({ error: "name and city cannot be empty" });
  try {
    updateArea.run(name, city, active, area.id);
  } catch (err) {
    if (String(err.message).includes("UNIQUE")) return res.status(409).json({ error: "That area already exists in that city" });
    throw err;
  }
  res.json({ area: { id: area.id, name, city, active: !!active } });
});

router.delete("/areas/:id", (req, res) => {
  const info = deleteArea.run(Number(req.params.id));
  if (!info.changes) return res.status(404).json({ error: "Area not found" });
  res.json({ ok: true });
});

router.get("/settings", (_req, res) => {
  res.json({ settings: getSettings() });
});

router.put("/settings", (req, res) => {
  const result = saveSettings(req.body);
  if (result.error) return res.status(400).json({ error: result.error });
  res.json(result);
});

/* ---------------- dashboard stats (all from the database) ---------------- */
router.get("/stats", (_req, res) => {
  const one = (sql, ...a) => db.prepare(sql).get(...a);
  const roles = Object.fromEntries(db.prepare(`SELECT role, COUNT(*) AS n FROM users GROUP BY role`).all().map((r) => [r.role, r.n]));
  const usersByRole = { customer: 0, provider: 0, admin: 0, ...roles };
  const byStatus = Object.fromEntries(db.prepare(`SELECT status, COUNT(*) AS n FROM bookings GROUP BY status`).all().map((r) => [r.status, r.n]));
  const money = one(`SELECT COALESCE(SUM(total), 0) AS gross, COALESCE(SUM(commission_amount), 0) AS commission,
                            COALESCE(SUM(provider_earning), 0) AS providerEarnings, COUNT(*) AS completed
                       FROM bookings WHERE status = 'done'`);
  res.json({
    stats: {
      users: { total: Object.values(usersByRole).reduce((a, b) => a + b, 0), byRole: usersByRole },
      providers: {
        total: one(`SELECT COUNT(*) AS n FROM providers`).n,
        active: one(`SELECT COUNT(*) AS n FROM providers WHERE verified = 1`).n,
        suspended: one(`SELECT COUNT(*) AS n FROM providers WHERE verified = 0`).n,
        pendingApplications: one(`SELECT COUNT(*) AS n FROM provider_apps WHERE status = 'pending'`).n,
      },
      bookings: {
        total: Object.values(byStatus).reduce((a, b) => a + b, 0),
        byStatus,
        today: one(`SELECT COUNT(*) AS n FROM bookings WHERE created_at >= ?`, now().slice(0, 10)).n,
      },
      revenue: { gross: money.gross, commission: money.commission, providerEarnings: money.providerEarnings, completedBookings: money.completed },
      openDisputes: one(`SELECT COUNT(*) AS n FROM disputes WHERE status IN ('open', 'under_review')`).n,
      activeSos: one(`SELECT COUNT(*) AS n FROM sos_alerts WHERE status = 'active'`).n,
    },
  });
});

/* ---------------- users ---------------- */
router.get("/users", (req, res) => {
  const q = cleanText(req.query.q, 80);
  const role = ["customer", "provider", "admin"].includes(req.query.role) ? req.query.role : "";
  const where = [];
  const args = [];
  if (q) { where.push(`(u.name LIKE ? OR u.email LIKE ?)`); args.push(`%${q}%`, `%${q}%`); }
  if (role) { where.push(`u.role = ?`); args.push(role); }
  const clause = where.length ? `WHERE ${where.join(" AND ")}` : "";
  const total = db.prepare(`SELECT COUNT(*) AS n FROM users u ${clause}`).get(...args).n;
  const rows = db.prepare(
    `SELECT u.id, u.name, u.email, u.role, u.wallet, u.status, u.created_at,
            (SELECT COUNT(*) FROM bookings b WHERE b.user_id = u.id) AS bookings
       FROM users u ${clause} ORDER BY u.created_at DESC LIMIT ? OFFSET ?`
  ).all(...args, limitOf(req.query.limit, 100, 200), Math.max(0, Number(req.query.offset) || 0));
  res.json({ total, users: rows.map((u) => ({ id: u.id, name: u.name, email: u.email, role: u.role, wallet: u.wallet, status: u.status, bookings: u.bookings, createdAt: u.created_at })) });
});

router.patch("/users/:id", (req, res) => {
  const targetId = req.params.id;
  const target = findUserByIdWithStatus.get(targetId);
  if (!target) return res.status(404).json({ error: "User not found" });
  if (target.id === req.user.id) return res.status(400).json({ error: "You cannot change your own status" });
  const action = req.body?.action;
  if (!["suspend", "activate", "delete"].includes(action)) return res.status(400).json({ error: "action must be suspend, activate, or delete" });
  const newStatus = action === "delete" ? "deleted" : action === "suspend" ? "suspended" : "active";
  if (target.status === newStatus) return res.status(409).json({ error: `User is already ${newStatus}` });
  const note = cleanText(req.body?.note, 500);
  db.transaction(() => {
    updateUserStatus.run(newStatus, targetId);
    if (newStatus === "deleted") {
      deleteUserSessions.run(targetId);
    }
    createAuditLog.run(rid("AUD"), req.user.id, action, "user", targetId, note || null, now());
  })();
  if (newStatus === "suspended" || newStatus === "deleted") {
    deleteUserSessions.run(targetId);
  }
  notify(targetId, "account_status", newStatus === "deleted" ? "Account deleted" : newStatus === "suspended" ? "Account suspended" : "Account reactivated",
    newStatus === "deleted" ? "Your account has been permanently deleted by an administrator." : newStatus === "suspended" ? "Your account has been suspended. Contact support for assistance." : "Your account has been reactivated.", { status: newStatus, note });
  res.json({ ok: true, user: { ...target, status: newStatus } });
});

router.delete("/users/:id", (req, res) => {
  const targetId = req.params.id;
  const target = findUserByIdWithStatus.get(targetId);
  if (!target) return res.status(404).json({ error: "User not found" });
  if (target.id === req.user.id) return res.status(400).json({ error: "You cannot delete your own account" });
  const note = cleanText(req.body?.note, 500);
  db.transaction(() => {
    updateUserStatus.run("deleted", targetId);
    deleteUserSessions.run(targetId);
    createAuditLog.run(rid("AUD"), req.user.id, "delete", "user", targetId, note || null, now());
  })();
  res.json({ ok: true });
});

/* ---------------- bookings ---------------- */
router.get("/bookings", (req, res) => {
  const where = [];
  const args = [];
  if (typeof req.query.status === "string" && req.query.status) { where.push(`b.status = ?`); args.push(req.query.status); }
  if (typeof req.query.providerId === "string" && req.query.providerId) { where.push(`b.provider_id = ?`); args.push(req.query.providerId); }
  const clause = where.length ? `WHERE ${where.join(" AND ")}` : "";
  const rows = db.prepare(
    `SELECT b.*, u.name AS customer_name FROM bookings b LEFT JOIN users u ON u.id = b.user_id ${clause} ORDER BY b.created_at DESC LIMIT ?`
  ).all(...args, limitOf(req.query.limit, 200, 500));
  res.json({ bookings: rows.map((r) => ({ ...rowToBooking(r), customerName: r.customer_name ?? "Deleted user" })) });
});

/* ---------------- providers + applications ---------------- */
const adminProvider = (p) => {
  const { rating, review_count } = getProviderRating.get(p.id);
  const { rating: _legacy, ...rest } = p;
  return { ...rest, rating: rating ?? null, review_count, ledger: providerLedger(p.id) };
};
const PROVIDER_SQL = `SELECT p.*, u.email AS user_email, u.name AS user_name FROM providers p LEFT JOIN users u ON u.id = p.user_id`;

router.get("/providers", (_req, res) => {
  res.json({ providers: db.prepare(`${PROVIDER_SQL} ORDER BY p.created_at DESC`).all().map(adminProvider) });
});

router.get("/providers/:id", (req, res) => {
  const p = db.prepare(`${PROVIDER_SQL} WHERE p.id = ?`).get(req.params.id);
  if (!p) return res.status(404).json({ error: "Provider not found" });
  const services = db.prepare(
    `SELECT s.id, s.name, ps.price, ps.is_active FROM provider_services ps JOIN services s ON s.id = ps.service_id WHERE ps.provider_id = ? ORDER BY s.id`
  ).all(p.id);
  res.json({ provider: adminProvider(p), services });
});

// Suspending hides the provider and blocks new accepts; their existing bookings can still be completed.
router.patch("/providers/:id", (req, res) => {
  const p = getProviderById.get(req.params.id);
  if (!p) return res.status(404).json({ error: "Provider not found" });
  const action = req.body?.action;
  if (action !== "approve" && action !== "suspend") return res.status(400).json({ error: "action must be approve or suspend" });
  db.prepare(`UPDATE providers SET verified = ? WHERE id = ?`).run(action === "approve" ? 1 : 0, p.id);
  notify(p.user_id, action === "approve" ? "approved" : "suspended",
    action === "approve" ? "Provider account active" : "Provider account suspended",
    action === "approve" ? "You can accept bookings again." : "You cannot accept new bookings until support reactivates your account.", { providerId: p.id });
  res.json({ ok: true, provider: adminProvider(db.prepare(`${PROVIDER_SQL} WHERE p.id = ?`).get(p.id)) });
});

router.get("/applications", (_req, res) => {
  const rows = db.prepare(`SELECT a.*, u.email AS user_email FROM provider_apps a LEFT JOIN users u ON u.id = a.user_id ORDER BY a.created_at DESC`).all();
  res.json({ applications: rows });
});

const approveApplication = db.transaction((appRow, applicant) => {
  const providerId = rid("PRV");
  createProvider.run(providerId, applicant.id, appRow.name, appRow.type, appRow.service, appRow.area, "", null, null, 5, getSettings().default_travel_fee, 1, appRow.id_note, "", null, "", appRow.phone, now());
  db.prepare(`UPDATE users SET role = 'provider' WHERE id = ?`).run(applicant.id);
  updateProviderApp.run("approved", appRow.id);
  notify(applicant.id, "approved", "Application approved", "You are now a verified provider. Add your services and prices to start receiving bookings.", { providerId });
});

router.patch("/applications/:id", (req, res) => {
  const status = req.body?.status;
  if (status !== "approved" && status !== "rejected") return res.status(400).json({ error: "status must be approved or rejected" });
  const appRow = getProviderAppById.get(req.params.id);
  if (!appRow) return res.status(404).json({ error: "Application not found" });
  if (appRow.status !== "pending") return res.status(409).json({ error: `Application is already ${appRow.status}` });
  const applicant = appRow.user_id ? findUserById.get(appRow.user_id) : null;
  if (status === "approved") {
    if (!applicant) return res.status(409).json({ error: "This application has no linked account. Ask the applicant to sign in and apply again." });
    if (applicant.role === "admin" || getProviderByUserId.get(applicant.id)) return res.status(409).json({ error: "The applicant already has an admin or provider account" });
    approveApplication(appRow, applicant);
  } else {
    updateProviderApp.run("rejected", appRow.id);
    if (applicant) notify(applicant.id, "rejected", "Application not approved", "Your provider application was not approved.");
  }
  res.json({ ok: true });
});

/* ---------------- disputes ---------------- */
router.get("/disputes", (_req, res) => {
  const rows = db.prepare(
    `SELECT d.*, u.name AS customer_name, p.name AS provider_name FROM disputes d
       LEFT JOIN users u ON u.id = d.user_id LEFT JOIN providers p ON p.id = d.provider_id ORDER BY d.created_at DESC`
  ).all();
  res.json({ disputes: rows });
});

router.patch("/disputes/:id", (req, res) => {
  const d = db.prepare(`SELECT * FROM disputes WHERE id = ?`).get(req.params.id);
  if (!d) return res.status(404).json({ error: "Dispute not found" });
  const status = req.body?.status;
  if (!["under_review", "resolved", "rejected"].includes(status)) return res.status(400).json({ error: "Invalid status" });
  const resolution = cleanText(req.body?.resolution, 1000);
  if ((status === "resolved" || status === "rejected") && !resolution) return res.status(400).json({ error: "Write a resolution note for the customer" });
  updateDispute.run(status, resolution || d.resolution, req.user.id, status === "under_review" ? null : now(), d.id);
  notify(d.user_id, "dispute", "Dispute update", status === "under_review" ? "Your dispute is being reviewed" : `Your dispute was ${status}: ${resolution}`, { disputeId: d.id });
  res.json({ ok: true });
});

/* ---------------- coupons (platform-wide; providers manage their own promotions) ---------------- */
router.get("/coupons", (_req, res) => res.json({ coupons: db.prepare(`SELECT * FROM coupons ORDER BY code`).all() }));

router.post("/coupons", (req, res) => {
  const code = cleanText(req.body?.code, 40).toUpperCase();
  const percent = Number(req.body?.percent);
  const min = nonNegInt(req.body?.min ?? 0);
  if (!/^[A-Z0-9_-]{3,40}$/.test(code)) return res.status(400).json({ error: "Code must be 3-40 letters, numbers, - or _" });
  if (!Number.isInteger(percent) || percent < 1 || percent > 50) return res.status(400).json({ error: "percent must be 1 to 50" });
  if (min === null) return res.status(400).json({ error: "Minimum must be a whole number" });
  if (getCouponByCode.get(code)) return res.status(409).json({ error: "That code already exists" });
  createCoupon.run(code, percent, min, 1);
  res.status(201).json({ coupon: getCouponByCode.get(code) });
});

router.patch("/coupons/:code", (req, res) => {
  const code = req.params.code.toUpperCase();
  if (!getCouponByCode.get(code)) return res.status(404).json({ error: "Coupon not found" });
  if (typeof req.body?.active !== "boolean") return res.status(400).json({ error: "active must be true or false" });
  updateCoupon.run(req.body.active ? 1 : 0, code);
  res.json({ coupon: getCouponByCode.get(code) });
});

router.delete("/coupons/:code", (req, res) => {
  const info = db.prepare(`DELETE FROM coupons WHERE code = ?`).run(req.params.code.toUpperCase());
  if (!info.changes) return res.status(404).json({ error: "Coupon not found" });
  res.json({ ok: true });
});

/* ---------------- commission and settlements ---------------- */
router.get("/commission", (_req, res) => {
  const providers = db.prepare(`SELECT id, name, type, verified FROM providers ORDER BY name`).all()
    .map((p) => ({ ...p, ...providerLedger(p.id) }))
    .filter((p) => p.bookings > 0 || p.settled !== 0);
  const sum = (k) => providers.reduce((n, p) => n + p[k], 0);
  res.json({
    rate: getSettings().commission_rate,
    totals: { gross: sum("gross"), commission: sum("commission"), cashCommission: sum("cashCommission"), walletEarning: sum("walletEarning"), settled: sum("settled"), balance: sum("balance") },
    providers,
  });
});

router.get("/settlements", (req, res) => {
  const providerId = cleanText(req.query.providerId, 40);
  const rows = db.prepare(
    `SELECT s.*, p.name AS provider_name FROM settlements s JOIN providers p ON p.id = s.provider_id ${providerId ? "WHERE s.provider_id = ?" : ""} ORDER BY s.created_at DESC LIMIT 200`
  ).all(...(providerId ? [providerId] : []));
  res.json({ settlements: rows });
});

router.post("/settlements", (req, res) => {
  const p = getProviderById.get(cleanText(req.body?.providerId, 40));
  if (!p) return res.status(404).json({ error: "Provider not found" });
  const direction = req.body?.direction;
  const amount = positiveInt(req.body?.amount);
  if (direction !== "provider_paid" && direction !== "platform_paid") return res.status(400).json({ error: "direction must be provider_paid or platform_paid" });
  if (!amount) return res.status(400).json({ error: "Enter an amount above zero" });
  const { balance } = providerLedger(p.id);
  const owed = direction === "provider_paid" ? balance : -balance;
  if (owed <= 0) return res.status(409).json({ error: direction === "provider_paid" ? "This provider does not owe the platform anything" : "The platform does not owe this provider anything" });
  if (amount > owed) return res.status(409).json({ error: `The outstanding amount is NPR ${owed}` });
  db.prepare(`INSERT INTO settlements (id, provider_id, amount, note, created_by, created_at) VALUES (?, ?, ?, ?, ?, ?)`)
    .run(rid("STL"), p.id, direction === "provider_paid" ? amount : -amount, cleanText(req.body?.note, 200) || null, req.user.id, now());
  notify(p.user_id, "settlement", "Settlement recorded", direction === "provider_paid" ? `We recorded your payment of NPR ${amount}` : `We recorded a payout of NPR ${amount} to you`, {});
  res.status(201).json({ ledger: providerLedger(p.id) });
});

/* ---------------- live map ---------------- */
router.get("/live-locations", (_req, res) => {
  const rows = db.prepare(
    `SELECT t.booking_id, t.lat, t.lng, t.status, t.eta_minutes, t.updated_at, p.name AS provider_name, b.status AS booking_status, b.address
       FROM tracking_locations t JOIN bookings b ON b.id = t.booking_id JOIN providers p ON p.id = t.provider_id
      WHERE b.status IN ('on_the_way', 'arrived', 'in_progress') ORDER BY t.updated_at DESC`
  ).all();
  res.json({ locations: rows.map((r) => ({ bookingId: r.booking_id, providerName: r.provider_name, lat: r.lat, lng: r.lng, status: r.status, etaMinutes: r.eta_minutes, updatedAt: r.updated_at, address: r.address })) });
});

/* ---------------- SOS alerts ---------------- */
router.get("/sos", (_req, res) => {
  const rows = db.prepare(
    `SELECT s.*, u.name AS customer_name, b.provider_name FROM sos_alerts s LEFT JOIN users u ON u.id = s.user_id LEFT JOIN bookings b ON b.id = s.booking_id
      ORDER BY (s.status = 'active') DESC, s.created_at DESC LIMIT 100`
  ).all();
  res.json({ alerts: rows.map((r) => ({ id: r.id, bookingId: r.booking_id, customerName: r.customer_name, providerName: r.provider_name, lat: r.lat, lng: r.lng, status: r.status, createdAt: r.created_at })) });
});

/* ---------------- reports ---------------- */
router.get("/reports", (req, res) => {
  const days = Math.min(365, Math.max(1, Number(req.query.days) || 30));
  const from = new Date(Date.now() - (days - 1) * 86400000).toISOString().slice(0, 10);
  const rows = db.prepare(`SELECT * FROM bookings WHERE created_at >= ? ORDER BY created_at`).all(from);
  const series = new Map();
  for (let i = 0; i < days; i++) series.set(new Date(Date.now() - (days - 1 - i) * 86400000).toISOString().slice(0, 10), { date: "", bookings: 0, completed: 0, gross: 0, commission: 0 });
  const byProvider = new Map();
  const byService = new Map();
  const names = new Map(getAllServices.all().map((s) => [s.id, s.name]));
  for (const b of rows) {
    const d = series.get(b.created_at.slice(0, 10));
    if (d) {
      d.bookings++;
      if (b.status === "done") { d.completed++; d.gross += b.total; d.commission += b.commission_amount ?? 0; }
    }
    if (b.status === "done" && b.provider_id) {
      const p = byProvider.get(b.provider_id) ?? { id: b.provider_id, name: b.provider_name, completed: 0, gross: 0 };
      p.completed++; p.gross += b.total; byProvider.set(b.provider_id, p);
    }
    if (b.status !== "cancelled") for (const id of JSON.parse(b.service_ids)) byService.set(id, (byService.get(id) ?? 0) + 1);
  }
  res.json({
    days,
    series: [...series.entries()].map(([date, v]) => ({ ...v, date })),
    topProviders: [...byProvider.values()].sort((a, b) => b.gross - a.gross).slice(0, 10),
    topServices: [...byService.entries()].map(([id, bookings]) => ({ id, name: names.get(id) ?? `Service ${id}`, bookings })).sort((a, b) => b.bookings - a.bookings).slice(0, 10),
  });
});

/* ---------------- announcements ---------------- */
router.get("/announcements", (_req, res) => {
  res.json({ announcements: db.prepare(`SELECT * FROM announcements ORDER BY created_at DESC LIMIT 100`).all() });
});

router.post("/announcements", (req, res) => {
  const title = cleanText(req.body?.title, 120);
  const body = cleanText(req.body?.body, 1000);
  const audience = req.body?.audience;
  if (!title || !body) return res.status(400).json({ error: "Title and message are required" });
  if (!["all", "customers", "providers"].includes(audience)) return res.status(400).json({ error: "audience must be all, customers or providers" });
  const roles = audience === "customers" ? ["customer"] : audience === "providers" ? ["provider"] : ["customer", "provider"];
  const id = rid("ANN");
  const recipients = db.transaction(() => {
    const users = db.prepare(`SELECT id FROM users WHERE role IN (${roles.map(() => "?").join(",")})`).all(...roles);
    for (const u of users) createNotification.run(rid("NOTIF"), u.id, "announcement", title, body, JSON.stringify({ announcementId: id }), 0, now());
    db.prepare(`INSERT INTO announcements (id, title, body, audience, recipients, created_by, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)`).run(id, title, body, audience, users.length, req.user.id, now());
    return users.length;
  })();
  res.status(201).json({ ok: true, recipients });
});

/* ---------------- packages (templates shown in the planner) ---------------- */
router.get("/packages", (_req, res) => res.json({ packages: db.prepare(`SELECT * FROM packages ORDER BY created_at DESC`).all() }));

router.post("/packages", (req, res) => {
  const name = cleanText(req.body?.name, 80);
  const ids = Array.isArray(req.body?.serviceIds) ? [...new Set(req.body.serviceIds.map(Number))].filter((n) => Number.isInteger(n)) : [];
  const discountPct = Number(req.body?.discountPct ?? 0);
  if (!name || !ids.length) return res.status(400).json({ error: "Name and at least one service are required" });
  if (!ids.every((id) => getServiceById.get(id))) return res.status(400).json({ error: "One of the services does not exist" });
  if (!Number.isInteger(discountPct) || discountPct < 0 || discountPct > 50) return res.status(400).json({ error: "discountPct must be 0 to 50" });
  const price = ids.reduce((n, id) => n + getServiceById.get(id).price, 0);
  const pkgId = rid("PKG");
  db.prepare(`INSERT INTO packages (id, name, description, service_ids, price, discount_pct, image, is_active, created_at) VALUES (?, ?, ?, ?, ?, ?, '', 1, ?)`)
    .run(pkgId, name, cleanText(req.body?.description, 300), JSON.stringify(ids), price, discountPct, now());
  res.status(201).json({ package: db.prepare(`SELECT * FROM packages WHERE id = ?`).get(pkgId) });
});

router.patch("/packages/:id", (req, res) => {
  if (typeof req.body?.isActive !== "boolean") return res.status(400).json({ error: "isActive must be true or false" });
  const info = db.prepare(`UPDATE packages SET is_active = ? WHERE id = ?`).run(req.body.isActive ? 1 : 0, req.params.id);
  if (!info.changes) return res.status(404).json({ error: "Package not found" });
  res.json({ ok: true });
});

router.delete("/packages/:id", (req, res) => {
  const info = db.prepare(`DELETE FROM packages WHERE id = ?`).run(req.params.id);
  if (!info.changes) return res.status(404).json({ error: "Package not found" });
  res.json({ ok: true });
});

export default router;
