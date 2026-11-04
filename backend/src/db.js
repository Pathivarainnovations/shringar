import Database from "better-sqlite3";
import path from "node:path";
import { fileURLToPath } from "node:url";
import crypto from "node:crypto";
import { copyFileSync, existsSync, mkdirSync, readFileSync } from "node:fs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DB_FILE = process.env.DB_FILE ?? path.resolve(__dirname, "../../database/shringar.db");
const SCHEMA_FILE = path.resolve(__dirname, "../../database/schema.sql");

mkdirSync(path.dirname(DB_FILE), { recursive: true });

export const db = new Database(DB_FILE);
db.pragma("journal_mode = WAL");
db.pragma("foreign_keys = ON");

// ---------------------------------------------------------------------------
// Migrations. Columns added after the first release are applied here so that an
// existing database keeps working. Before touching an existing database we copy
// it to backend/backup-YYYYMMDD.db (never overwritten, never deleted).
// ---------------------------------------------------------------------------
const COLUMN_MIGRATIONS = [
  ["users", "password_hash", "TEXT"],
  ["users", "referral_code", "TEXT"],
  ["users", "status", "TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'suspended', 'deleted'))"],
  ["providers", "phone", "TEXT"],
  ["bookings", "provider_id", "TEXT REFERENCES providers(id) ON DELETE SET NULL"],
  ["reviews", "provider_id", "TEXT REFERENCES providers(id) ON DELETE SET NULL"],
  ["provider_apps", "user_id", "TEXT REFERENCES users(id) ON DELETE CASCADE"],
  ["sessions", "expires_at", "TEXT"],
  ["otps", "attempts", "INTEGER NOT NULL DEFAULT 0"],
  ["coupons", "used_count", "INTEGER NOT NULL DEFAULT 0"],
  ["bookings", "area", "TEXT"],
  ["bookings", "offer_amount", "INTEGER"],
  ["bookings", "staff_id", "TEXT REFERENCES staff(id) ON DELETE SET NULL"],
  ["bookings", "commission_rate", "REAL"],
  ["bookings", "commission_amount", "INTEGER"],
  ["bookings", "provider_earning", "INTEGER"],
  ["bookings", "paid_method", "TEXT"],
  ["bookings", "completed_at", "TEXT"],
  ["bookings", "cancelled_by", "TEXT"],
  ["bookings", "cancel_reason", "TEXT"],
];

const hasTable = (name) =>
  Boolean(db.prepare("SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = ?").get(name));
const hasColumn = (table, column) =>
  db.prepare(`PRAGMA table_info(${table})`).all().some((c) => c.name === column);

function backupBeforeMigration() {
  const missing = COLUMN_MIGRATIONS.filter(([t, c]) => hasTable(t) && !hasColumn(t, c));
  if (!missing.length || !hasTable("users") || DB_FILE === ":memory:") return;
  db.pragma("wal_checkpoint(TRUNCATE)");
  const ymd = new Date().toISOString().slice(0, 10).replaceAll("-", "");
  let target = path.resolve(__dirname, "..", `backup-${ymd}.db`);
  if (existsSync(target)) {
    target = path.resolve(__dirname, "..", `backup-${ymd}-${new Date().toISOString().slice(11, 19).replaceAll(":", "")}.db`);
  }
  copyFileSync(DB_FILE, target);
  console.log(`[db] existing database needs migration -> backup written to ${target}`);
}

backupBeforeMigration();
db.exec(readFileSync(SCHEMA_FILE, "utf8"));

for (const [table, column, ddl] of COLUMN_MIGRATIONS) {
  if (!hasColumn(table, column)) db.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${ddl}`);
}

// Indexes on migrated columns must be created after the columns exist.
db.exec(`
  CREATE UNIQUE INDEX IF NOT EXISTS idx_users_referral_code ON users(referral_code) WHERE referral_code IS NOT NULL;
  CREATE INDEX IF NOT EXISTS idx_bookings_provider ON bookings(provider_id);
  CREATE INDEX IF NOT EXISTS idx_reviews_provider ON reviews(provider_id);
  CREATE INDEX IF NOT EXISTS idx_bookings_user ON bookings(user_id);
  CREATE INDEX IF NOT EXISTS idx_bookings_status ON bookings(status);
  CREATE INDEX IF NOT EXISTS idx_sessions_expires ON sessions(expires_at);
  CREATE INDEX IF NOT EXISTS idx_users_status ON users(status);
  CREATE INDEX IF NOT EXISTS idx_audit_log_target ON audit_log(target_type, target_id);
  CREATE INDEX IF NOT EXISTS idx_audit_log_admin ON audit_log(admin_id, created_at);
`);

export const rid = (prefix) => prefix + "-" + crypto.randomBytes(4).toString("hex").toUpperCase();

export function hashPassword(password) {
  const salt = crypto.randomBytes(16);
  const hash = crypto.scryptSync(password, salt, 32);
  return salt.toString("hex") + ":" + hash.toString("hex");
}

export function verifyPassword(password, stored) {
  const [saltHex, hashHex] = stored.split(":");
  if (!saltHex || !hashHex) return false;
  const salt = Buffer.from(saltHex, "hex");
  const hash = crypto.scryptSync(password, salt, 32);
  return crypto.timingSafeEqual(hash, Buffer.from(hashHex, "hex"));
}

export function maskUserEmail(email) {
  if (!email) return "****";
  const [local, domain] = email.split("@");
  if (!domain) return "****";
  const masked = local.length > 2 ? local.slice(0, 2) + "****" : "****";
  return `${masked}@${domain}`;
}

export function maskPhone(phone) {
  if (!phone || phone.length < 4) return "••••";
  return "••••" + phone.slice(-4);
}

export const now = () => new Date().toISOString();

// Auth queries
export const findUserByEmail = db.prepare("SELECT * FROM users WHERE email = ?");
export const findUserById = db.prepare("SELECT * FROM users WHERE id = ?");
export const createUser = db.prepare(`INSERT INTO users (id, email, name, wallet, referred, created_at, role, referral_code) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`);
export const SESSION_TTL_MS = 30 * 24 * 3600 * 1000;
export const createSession = db.prepare(`INSERT INTO sessions (token, user_id, created_at, expires_at) VALUES (?, ?, ?, ?)`);
export const deleteSession = db.prepare(`DELETE FROM sessions WHERE token = ?`);
export const findSession = db.prepare(`SELECT u.* FROM sessions s JOIN users u ON u.id = s.user_id WHERE s.token = ? AND s.expires_at > ?`);
export const purgeExpiredSessions = db.prepare(`DELETE FROM sessions WHERE expires_at <= ?`);
export const upsertOTP = db.prepare(`INSERT INTO otps (email, code, expires, attempts) VALUES (?, ?, ?, 0) ON CONFLICT(email) DO UPDATE SET code = excluded.code, expires = excluded.expires, attempts = 0`);
export const bumpOTPAttempts = db.prepare(`UPDATE otps SET attempts = attempts + 1 WHERE email = ?`);
export const getOTP = db.prepare(`SELECT * FROM otps WHERE email = ?`);
export const deleteOTP = db.prepare(`DELETE FROM otps WHERE email = ?`);
export const updateUserPassword = db.prepare(`UPDATE users SET password_hash = ? WHERE id = ?`);
export const deleteUserSessions = db.prepare(`DELETE FROM sessions WHERE user_id = ?`);

// Provider queries
export const createProvider = db.prepare(`INSERT INTO providers (id, user_id, name, type, service, area, address, lat, lng, travel_radius, travel_fee, verified, verification_data, hours, price_from, bio, phone, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`);
export const getProviderByUserId = db.prepare(`SELECT * FROM providers WHERE user_id = ?`);
export const getProviderById = db.prepare(`SELECT * FROM providers WHERE id = ?`);
export const updateProvider = db.prepare(`UPDATE providers SET name = ?, type = ?, service = ?, area = ?, address = ?, lat = ?, lng = ?, travel_radius = ?, travel_fee = ?, hours = ?, price_from = ?, bio = ?, phone = ? WHERE id = ?`);
export const getAllProviders = db.prepare(`SELECT * FROM providers WHERE verified = 1`);

// Services
export const getAllServices = db.prepare(`SELECT * FROM services ORDER BY id`);
export const getServiceById = db.prepare(`SELECT * FROM services WHERE id = ?`);
export const getCategories = db.prepare(`SELECT * FROM categories ORDER BY rowid`);
export const createCategory = db.prepare(`INSERT INTO categories (name, image) VALUES (?, ?)`);
export const updateCategory = db.prepare(`UPDATE categories SET name = ?, image = ? WHERE name = ?`);
export const deleteCategory = db.prepare(`DELETE FROM categories WHERE name = ?`);

// Areas (reference data, admin-managed)
export const getAreas = db.prepare(`SELECT * FROM areas WHERE active = 1 ORDER BY city, name`);
export const getAllAreas = db.prepare(`SELECT * FROM areas ORDER BY city, name`);
export const getAreaById = db.prepare(`SELECT * FROM areas WHERE id = ?`);
export const createArea = db.prepare(`INSERT INTO areas (name, city, active) VALUES (?, ?, ?)`);
export const updateArea = db.prepare(`UPDATE areas SET name = ?, city = ?, active = ? WHERE id = ?`);
export const deleteArea = db.prepare(`DELETE FROM areas WHERE id = ?`);

// Settings (admin-managed key/value; defaults in settings.js)
export const getAllSettingRows = db.prepare(`SELECT key, value FROM settings`);
export const upsertSetting = db.prepare(`INSERT INTO settings (key, value, updated_at) VALUES (?, ?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at`);

// Referral + provider rating helpers
export const getUserByReferralCode = db.prepare(`SELECT * FROM users WHERE referral_code = ?`);
export const getProviderRating = db.prepare(`SELECT ROUND(AVG(stars), 1) AS rating, COUNT(*) AS review_count FROM reviews WHERE provider_id = ?`);

export function newReferralCode() {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // no 0/O/1/I
  for (;;) {
    let code = "SHR";
    for (let i = 0; i < 6; i++) code += alphabet[crypto.randomInt(alphabet.length)];
    if (!getUserByReferralCode.get(code)) return code;
  }
}

// Sessions created before expiry existed get 30 days from their creation date.
for (const s of db.prepare("SELECT token, created_at FROM sessions WHERE expires_at IS NULL").all()) {
  db.prepare("UPDATE sessions SET expires_at = ? WHERE token = ?").run(new Date(Date.parse(s.created_at) + 30 * 24 * 3600 * 1000).toISOString(), s.token);
}

// Backfill: give every existing user a referral code; link legacy bookings/reviews to a provider
// only when the legacy provider name matches exactly one real provider.
for (const u of db.prepare("SELECT id FROM users WHERE referral_code IS NULL").all()) {
  db.prepare("UPDATE users SET referral_code = ? WHERE id = ?").run(newReferralCode(), u.id);
}
db.exec(`
  UPDATE bookings SET provider_id = (SELECT p.id FROM providers p WHERE p.name = bookings.provider_name)
   WHERE provider_id IS NULL AND provider_name <> ''
     AND (SELECT COUNT(*) FROM providers p WHERE p.name = bookings.provider_name) = 1;
  UPDATE reviews SET provider_id = (SELECT p.id FROM providers p WHERE p.name = reviews.target)
   WHERE provider_id IS NULL
     AND (SELECT COUNT(*) FROM providers p WHERE p.name = reviews.target) = 1;
`);
export const createService = db.prepare(`INSERT INTO services (name, minutes, price) VALUES (?, ?, ?)`);
export const updateService = db.prepare(`UPDATE services SET name = ?, minutes = ?, price = ? WHERE id = ?`);
export const deleteService = db.prepare(`DELETE FROM services WHERE id = ?`);

// Bookings
export const createBooking = db.prepare(`INSERT INTO bookings (id, created_at, service_ids, mode, start_hour, status, pay_status, address, day, provider_name, provider_phone, coupon_code, user_id, minutes, services_total, travel_fee, discount, total, provider_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`);
export const getBookingById = db.prepare(`SELECT * FROM bookings WHERE id = ?`);

// Packages
export const getAllPackages = db.prepare(`SELECT * FROM packages WHERE is_active = 1`);
export const getPackageById = db.prepare(`SELECT * FROM packages WHERE id = ?`);

// Coupons
export const getCouponByCode = db.prepare(`SELECT * FROM coupons WHERE code = ?`);
export const createCoupon = db.prepare(`INSERT INTO coupons (code, percent, min, active) VALUES (?, ?, ?, ?)`);
export const updateCoupon = db.prepare(`UPDATE coupons SET active = ? WHERE code = ?`);

// Transactions
export const createTransaction = db.prepare(`INSERT INTO transactions (id, booking_id, method, amount, created_at) VALUES (?, ?, ?, ?, ?)`);

// Reviews
export const createReview = db.prepare(`INSERT INTO reviews (id, booking_id, target, stars, text, author, created_at, provider_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`);

// Wallet
export const updateWallet = db.prepare(`UPDATE users SET wallet = wallet + ? WHERE id = ?`);

// Disputes
export const createDispute = db.prepare(`INSERT INTO disputes (id, booking_id, user_id, provider_id, reason, status, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)`);
export const updateDispute = db.prepare(`UPDATE disputes SET status = ?, resolution = ?, admin_id = ?, resolved_at = ? WHERE id = ?`);

// Notifications
export const createNotification = db.prepare(`INSERT INTO notifications (id, user_id, type, title, message, data, is_read, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`);
export const getNotifications = db.prepare(`SELECT * FROM notifications WHERE user_id = ? ORDER BY created_at DESC LIMIT 50`);
export const markAllNotificationsRead = db.prepare(`UPDATE notifications SET is_read = 1 WHERE user_id = ?`);

// Referrals
export const createReferral = db.prepare(`INSERT INTO referrals (id, referrer_id, referred_id, status, bonus_amount, created_at) VALUES (?, ?, ?, ?, ?, ?)`);
export const getReferralByReferred = db.prepare(`SELECT * FROM referrals WHERE referred_id = ? AND status = 'pending'`);
export const completeReferral = db.prepare(`UPDATE referrals SET status = 'completed', completed_at = ? WHERE id = ?`);
export const getReferralsByReferrer = db.prepare(`SELECT * FROM referrals WHERE referrer_id = ? ORDER BY created_at DESC`);

// Loyalty
export const getLoyalty = db.prepare(`SELECT * FROM loyalty_points WHERE user_id = ?`);
export const upsertLoyalty = db.prepare(`INSERT INTO loyalty_points (id, user_id, points, total_earned, total_redeemed, updated_at) VALUES (?, ?, ?, ?, ?, ?) ON CONFLICT(user_id) DO UPDATE SET points = excluded.points, total_earned = excluded.total_earned, total_redeemed = excluded.total_redeemed, updated_at = excluded.updated_at`);
export const createLoyaltyTransaction = db.prepare(`INSERT INTO loyalty_transactions (id, user_id, type, points, description, booking_id, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)`);
export const getLoyaltyTransactions = db.prepare(`SELECT * FROM loyalty_transactions WHERE user_id = ? ORDER BY created_at DESC`);

// Provider Applications
export const getProviderAppById = db.prepare(`SELECT * FROM provider_apps WHERE id = ?`);
export const updateProviderApp = db.prepare(`UPDATE provider_apps SET status = ? WHERE id = ?`);

// User status management (admin)
export const updateUserStatus = db.prepare(`UPDATE users SET status = ? WHERE id = ?`);
export const findUserByIdWithStatus = db.prepare(`SELECT * FROM users WHERE id = ?`);

// Audit log
export const createAuditLog = db.prepare(`INSERT INTO audit_log (id, admin_id, action, target_type, target_id, details, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)`);
export const getAuditLog = db.prepare(`SELECT * FROM audit_log WHERE target_type = ? AND target_id = ? ORDER BY created_at DESC LIMIT 50`);

// Provider Custom Services queries
export const createProviderCustomService = db.prepare(`
  INSERT INTO provider_custom_services (
    id, provider_id, category_id, custom_category_name, name, description, short_description,
    service_type, pricing_type, price, min_price, additional_charges, currency,
    duration_minutes, min_booking_duration, areas, available, working_days, time_slots,
    booking_notice_hours, whats_included, whats_not_included, terms_conditions,
    cancellation_policy, tags, status, requires_reapproval, is_published,
    created_at, updated_at
  ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
`);

export const getProviderCustomServiceById = db.prepare(`SELECT * FROM provider_custom_services WHERE id = ?`);
export const getProviderCustomServices = db.prepare(`
  SELECT * FROM provider_custom_services WHERE provider_id = ? ORDER BY created_at DESC
`);

export const updateProviderCustomService = db.prepare(`
  UPDATE provider_custom_services SET
    category_id = ?, custom_category_name = ?, name = ?, description = ?, short_description = ?,
    service_type = ?, pricing_type = ?, price = ?, min_price = ?, additional_charges = ?, currency = ?,
    duration_minutes = ?, min_booking_duration = ?, areas = ?, available = ?, working_days = ?,
    time_slots = ?, booking_notice_hours = ?, whats_included = ?, whats_not_included = ?,
    terms_conditions = ?, cancellation_policy = ?, tags = ?, status = ?,
    requires_reapproval = ?, is_published = ?, updated_at = ?
  WHERE id = ? AND provider_id = ?
`);

export const updateProviderCustomServiceStatus = db.prepare(`
  UPDATE provider_custom_services SET status = ?, updated_at = ?, approved_by = ?, approved_at = ?, rejection_reason = ?
  WHERE id = ?
`);

export const deleteProviderCustomService = db.prepare(`
  UPDATE provider_custom_services SET deleted_at = ?, deleted_by = ?, status = 'inactive', updated_at = ?
  WHERE id = ? AND provider_id = ?
`);

export const hardDeleteProviderCustomService = db.prepare(`
  DELETE FROM provider_custom_services WHERE id = ? AND provider_id = ?
`);

export const getProviderCustomServiceImages = db.prepare(`SELECT * FROM provider_service_images WHERE service_id = ? ORDER BY sort_order`);
export const createProviderServiceImage = db.prepare(`
  INSERT INTO provider_service_images (id, service_id, image_url, alt_text, sort_order, is_primary, created_at)
  VALUES (?, ?, ?, ?, ?, ?, ?)
`);
export const updateProviderServiceImage = db.prepare(`
  UPDATE provider_service_images SET image_url = ?, alt_text = ?, sort_order = ?, is_primary = ?
  WHERE id = ? AND service_id = ?
`);
export const deleteProviderServiceImage = db.prepare(`DELETE FROM provider_service_images WHERE id = ? AND service_id = ?`);
export const setPrimaryProviderServiceImage = db.prepare(`
  UPDATE provider_service_images SET is_primary = CASE WHEN id = ? THEN 1 ELSE 0 END
  WHERE service_id = ?
`);

export const getProviderServiceAvailability = db.prepare(`SELECT * FROM provider_service_availability WHERE service_id = ? ORDER BY day_of_week, start_time`);
export const createProviderServiceAvailability = db.prepare(`
  INSERT INTO provider_service_availability (id, service_id, day_of_week, start_time, end_time, is_active, created_at)
  VALUES (?, ?, ?, ?, ?, ?, ?)
`);
export const updateProviderServiceAvailability = db.prepare(`
  UPDATE provider_service_availability SET start_time = ?, end_time = ?, is_active = ?
  WHERE id = ? AND service_id = ?
`);
export const deleteProviderServiceAvailability = db.prepare(`DELETE FROM provider_service_availability WHERE id = ? AND service_id = ?`);
export const deleteAllProviderServiceAvailability = db.prepare(`DELETE FROM provider_service_availability WHERE service_id = ?`);

export const createProviderServiceApprovalHistory = db.prepare(`
  INSERT INTO provider_service_approval_history (id, service_id, action, admin_id, admin_notes, previous_status, new_status, created_at)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?)
`);
export const getProviderServiceApprovalHistory = db.prepare(`SELECT * FROM provider_service_approval_history WHERE service_id = ? ORDER BY created_at DESC`);

export const getProviderServiceTags = db.prepare(`SELECT tag FROM provider_service_tags WHERE service_id = ?`);
export const createProviderServiceTag = db.prepare(`INSERT INTO provider_service_tags (service_id, tag) VALUES (?, ?)`);
export const deleteProviderServiceTags = db.prepare(`DELETE FROM provider_service_tags WHERE service_id = ?`);

// Admin approval queries
export const getAllProviderCustomServices = db.prepare(`
  SELECT pcs.*, p.name as provider_name, p.type as provider_type, u.email as provider_email
  FROM provider_custom_services pcs
  JOIN providers p ON p.id = pcs.provider_id
  JOIN users u ON u.id = p.user_id
  ORDER BY pcs.created_at DESC
`);

export const getPendingApprovalServices = db.prepare(`
  SELECT pcs.*, p.name as provider_name, p.type as provider_type, u.email as provider_email
  FROM provider_custom_services pcs
  JOIN providers p ON p.id = pcs.provider_id
  JOIN users u ON u.id = p.user_id
  WHERE pcs.status = 'pending_approval'
  ORDER BY pcs.submitted_at ASC
`);

export const getApprovedPublishedServices = db.prepare(`
  SELECT pcs.*, p.name as provider_name, p.type as provider_type, p.area as provider_area,
         u.email as provider_email, u.id as user_id
  FROM provider_custom_services pcs
  JOIN providers p ON p.id = pcs.provider_id
  JOIN users u ON u.id = p.user_id
  WHERE pcs.status = 'approved' AND pcs.is_published = 1
  ORDER BY pcs.published_at DESC
`);
