-- Shringar salon booking schema (SQLite)

PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS users (
  id          TEXT PRIMARY KEY,
  email       TEXT NOT NULL UNIQUE,
  name        TEXT NOT NULL,
  wallet      INTEGER NOT NULL DEFAULT 0,
  referred    INTEGER NOT NULL DEFAULT 0,
  created_at  TEXT NOT NULL,
  role        TEXT NOT NULL DEFAULT 'customer' CHECK (role IN ('customer', 'provider', 'admin')),
  provider_id TEXT REFERENCES providers(id) ON DELETE SET NULL,
  password_hash TEXT,
  referral_code TEXT,
  status      TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'suspended', 'deleted'))
);

CREATE TABLE IF NOT EXISTS sessions (
  token      TEXT PRIMARY KEY,
  user_id    TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at TEXT NOT NULL,
  expires_at TEXT
);

CREATE TABLE IF NOT EXISTS otps (
  email   TEXT PRIMARY KEY,
  code    TEXT NOT NULL,
  expires INTEGER NOT NULL,
  attempts INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS favorites (
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name    TEXT NOT NULL,
  PRIMARY KEY (user_id, name)
);

CREATE TABLE IF NOT EXISTS services (
  id      INTEGER PRIMARY KEY,
  name    TEXT NOT NULL,
  minutes INTEGER NOT NULL,
  price   INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS categories (
  name  TEXT PRIMARY KEY,
  image TEXT NOT NULL
);

-- Reference data: cities/areas providers can serve (admin-managed)
CREATE TABLE IF NOT EXISTS areas (
  id     INTEGER PRIMARY KEY AUTOINCREMENT,
  name   TEXT NOT NULL,
  city   TEXT NOT NULL,
  active INTEGER NOT NULL DEFAULT 1,
  UNIQUE (name, city)
);

-- Platform settings (admin-managed key/value; defaults live in backend/src/settings.js)
CREATE TABLE IF NOT EXISTS settings (
  key        TEXT PRIMARY KEY,
  value      TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS providers (
  id              TEXT PRIMARY KEY,
  user_id         TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name            TEXT NOT NULL,
  type            TEXT NOT NULL CHECK (type IN ('salon', 'freelance')),
  service         TEXT NOT NULL,
  area            TEXT NOT NULL,
  address         TEXT,
  lat             REAL,
  lng             REAL,
  travel_radius   INTEGER NOT NULL DEFAULT 5,
  travel_fee      INTEGER NOT NULL DEFAULT 200,
  verified        INTEGER NOT NULL DEFAULT 0,
  verification_data TEXT,
  hours           TEXT,
  price_from      INTEGER,
  bio             TEXT,
  phone           TEXT,
  created_at      TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_providers_user ON providers(user_id);
CREATE INDEX IF NOT EXISTS idx_providers_type ON providers(type);
CREATE INDEX IF NOT EXISTS idx_providers_area ON providers(area);

CREATE TABLE IF NOT EXISTS coupons (
  code    TEXT PRIMARY KEY,
  percent INTEGER NOT NULL CHECK (percent BETWEEN 1 AND 50),
  min     INTEGER NOT NULL DEFAULT 0,
  active  INTEGER NOT NULL DEFAULT 1,
  used_count INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS bookings (
  id             TEXT PRIMARY KEY,
  created_at     TEXT NOT NULL,
  service_ids    TEXT NOT NULL,
  mode           TEXT NOT NULL CHECK (mode IN ('home', 'salon')),
  start_hour     REAL NOT NULL,
  status         TEXT NOT NULL DEFAULT 'requested'
                 CHECK (status IN ('requested', 'accepted', 'on_the_way', 'arrived', 'in_progress', 'done', 'cancelled')),
  pay_status     TEXT NOT NULL DEFAULT 'unpaid' CHECK (pay_status IN ('unpaid', 'paid', 'cash_due')),
  address        TEXT NOT NULL,
  day            TEXT NOT NULL,
  provider_name  TEXT NOT NULL,
  provider_phone TEXT NOT NULL,
  coupon_code    TEXT,
  user_id        TEXT REFERENCES users(id) ON DELETE SET NULL,
  provider_id    TEXT REFERENCES providers(id) ON DELETE SET NULL,
  minutes        INTEGER NOT NULL,
  services_total INTEGER NOT NULL,
  travel_fee     INTEGER NOT NULL,
  discount       INTEGER NOT NULL,
  total          INTEGER NOT NULL,
  area           TEXT,
  offer_amount   INTEGER,
  staff_id       TEXT REFERENCES staff(id) ON DELETE SET NULL,
  commission_rate   REAL,
  commission_amount INTEGER,
  provider_earning  INTEGER,
  paid_method    TEXT,
  completed_at   TEXT,
  cancelled_by   TEXT,
  cancel_reason  TEXT
);

CREATE INDEX IF NOT EXISTS idx_bookings_user ON bookings(user_id);

CREATE TABLE IF NOT EXISTS transactions (
  id         TEXT PRIMARY KEY,
  booking_id TEXT NOT NULL REFERENCES bookings(id) ON DELETE CASCADE,
  method     TEXT NOT NULL,
  amount     INTEGER NOT NULL,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS reviews (
  id         TEXT PRIMARY KEY,
  booking_id TEXT,
  provider_id TEXT REFERENCES providers(id) ON DELETE SET NULL,
  target     TEXT NOT NULL,
  stars      INTEGER NOT NULL CHECK (stars BETWEEN 1 AND 5),
  text       TEXT NOT NULL DEFAULT '',
  author     TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS provider_apps (
  id         TEXT PRIMARY KEY,
  name       TEXT NOT NULL,
  phone      TEXT NOT NULL,
  type       TEXT NOT NULL CHECK (type IN ('salon', 'freelance')),
  service    TEXT NOT NULL,
  area       TEXT NOT NULL,
  id_note    TEXT NOT NULL,
  user_id    TEXT REFERENCES users(id) ON DELETE CASCADE,
  status     TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  created_at TEXT NOT NULL
);

-- Provider availability/schedule
CREATE TABLE IF NOT EXISTS provider_availability (
  id            TEXT PRIMARY KEY,
  provider_id   TEXT NOT NULL REFERENCES providers(id) ON DELETE CASCADE,
  day_of_week   INTEGER NOT NULL CHECK (day_of_week BETWEEN 0 AND 6),
  start_time    TEXT NOT NULL,
  end_time      TEXT NOT NULL,
  is_active     INTEGER NOT NULL DEFAULT 1,
  created_at    TEXT NOT NULL,
  UNIQUE(provider_id, day_of_week)
);

CREATE INDEX IF NOT EXISTS idx_provider_availability_provider ON provider_availability(provider_id);

-- Staff members for salons
CREATE TABLE IF NOT EXISTS staff (
  id            TEXT PRIMARY KEY,
  provider_id   TEXT NOT NULL REFERENCES providers(id) ON DELETE CASCADE,
  name          TEXT NOT NULL,
  email         TEXT,
  specialty     TEXT,
  gender        TEXT CHECK (gender IN ('male', 'female')),
  is_active     INTEGER NOT NULL DEFAULT 1,
  created_at    TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_staff_provider ON staff(provider_id);

-- Counter-offers for home service
CREATE TABLE IF NOT EXISTS offers (
  id              TEXT PRIMARY KEY,
  booking_id      TEXT NOT NULL REFERENCES bookings(id) ON DELETE CASCADE,
  provider_id     TEXT NOT NULL REFERENCES providers(id) ON DELETE CASCADE,
  amount          INTEGER NOT NULL,
  status          TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'rejected', 'countered')),
  original_amount INTEGER NOT NULL,
  created_at      TEXT NOT NULL,
  responded_at    TEXT
);

CREATE INDEX IF NOT EXISTS idx_offers_booking ON offers(booking_id);
CREATE INDEX IF NOT EXISTS idx_offers_provider ON offers(provider_id);

-- Service packages (combo packages)
CREATE TABLE IF NOT EXISTS packages (
  id            TEXT PRIMARY KEY,
  name          TEXT NOT NULL,
  description   TEXT,
  service_ids   TEXT NOT NULL,
  price         INTEGER NOT NULL,
  discount_pct  INTEGER NOT NULL DEFAULT 0,
  image         TEXT,
  is_active     INTEGER NOT NULL DEFAULT 1,
  created_at    TEXT NOT NULL
);

-- Disputes & refunds
CREATE TABLE IF NOT EXISTS disputes (
  id            TEXT PRIMARY KEY,
  booking_id    TEXT NOT NULL REFERENCES bookings(id) ON DELETE CASCADE,
  user_id       TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  provider_id   TEXT NOT NULL REFERENCES providers(id) ON DELETE CASCADE,
  reason        TEXT NOT NULL,
  status        TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'under_review', 'resolved', 'rejected')),
  resolution    TEXT,
  admin_id      TEXT REFERENCES users(id) ON DELETE SET NULL,
  created_at    TEXT NOT NULL,
  resolved_at   TEXT
);

CREATE INDEX IF NOT EXISTS idx_disputes_booking ON disputes(booking_id);
CREATE INDEX IF NOT EXISTS idx_disputes_status ON disputes(status);

-- Notifications
CREATE TABLE IF NOT EXISTS notifications (
  id            TEXT PRIMARY KEY,
  user_id       TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  type          TEXT NOT NULL,
  title         TEXT NOT NULL,
  message       TEXT NOT NULL,
  data          TEXT,
  is_read       INTEGER NOT NULL DEFAULT 0,
  created_at    TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_notifications_user ON notifications(user_id, is_read);

-- Referrals
CREATE TABLE IF NOT EXISTS referrals (
  id              TEXT PRIMARY KEY,
  referrer_id     TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  referred_id     TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  status          TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'completed', 'expired')),
  bonus_amount    INTEGER NOT NULL DEFAULT 300,
  created_at      TEXT NOT NULL,
  completed_at    TEXT
);

CREATE INDEX IF NOT EXISTS idx_referrals_referrer ON referrals(referrer_id);
CREATE INDEX IF NOT EXISTS idx_referrals_referred ON referrals(referred_id);

-- Loyalty points
CREATE TABLE IF NOT EXISTS loyalty_points (
  id            TEXT PRIMARY KEY,
  user_id       TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  points        INTEGER NOT NULL DEFAULT 0,
  total_earned  INTEGER NOT NULL DEFAULT 0,
  total_redeemed INTEGER NOT NULL DEFAULT 0,
  updated_at    TEXT NOT NULL,
  UNIQUE(user_id)
);

CREATE INDEX IF NOT EXISTS idx_loyalty_user ON loyalty_points(user_id);

-- Loyalty transactions
CREATE TABLE IF NOT EXISTS loyalty_transactions (
  id            TEXT PRIMARY KEY,
  user_id       TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  type          TEXT NOT NULL CHECK (type IN ('earned', 'redeemed', 'expired')),
  points        INTEGER NOT NULL,
  description   TEXT,
  booking_id    TEXT REFERENCES bookings(id) ON DELETE SET NULL,
  created_at    TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_loyalty_trans_user ON loyalty_transactions(user_id);

-- SOS alerts
CREATE TABLE IF NOT EXISTS sos_alerts (
  id            TEXT PRIMARY KEY,
  booking_id    TEXT NOT NULL REFERENCES bookings(id) ON DELETE CASCADE,
  user_id       TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  lat           REAL NOT NULL,
  lng           REAL NOT NULL,
  address       TEXT,
  status        TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'resolved', 'false_alarm')),
  created_at    TEXT NOT NULL,
  resolved_at   TEXT
);

CREATE INDEX IF NOT EXISTS idx_sos_booking ON sos_alerts(booking_id);

-- Trip sharing
CREATE TABLE IF NOT EXISTS trip_shares (
  id            TEXT PRIMARY KEY,
  booking_id    TEXT NOT NULL REFERENCES bookings(id) ON DELETE CASCADE,
  shared_with   TEXT NOT NULL,
  token         TEXT NOT NULL UNIQUE,
  expires_at    TEXT NOT NULL,
  created_at    TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_trip_shares_booking ON trip_shares(booking_id);

-- Emergency contacts for safety
CREATE TABLE IF NOT EXISTS emergency_contacts (
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  phone   TEXT NOT NULL,
  PRIMARY KEY (user_id, phone)
);

-- Provider location tracking for live tracking
CREATE TABLE IF NOT EXISTS tracking_locations (
  id            TEXT PRIMARY KEY,
  booking_id    TEXT NOT NULL UNIQUE REFERENCES bookings(id) ON DELETE CASCADE,
  provider_id   TEXT NOT NULL REFERENCES providers(id) ON DELETE CASCADE,
  lat           REAL NOT NULL,
  lng           REAL NOT NULL,
  address       TEXT,
  eta_minutes   INTEGER,
  status        TEXT NOT NULL DEFAULT 'on_the_way' CHECK (status IN ('on_the_way', 'arrived', 'in_progress', 'completed')),
  updated_at    TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_tracking_provider ON tracking_locations(provider_id);

-- Provider-owned prices: a provider sells a catalogue service at its own price
CREATE TABLE IF NOT EXISTS provider_services (
  provider_id TEXT NOT NULL REFERENCES providers(id) ON DELETE CASCADE,
  service_id  INTEGER NOT NULL REFERENCES services(id) ON DELETE CASCADE,
  price       INTEGER NOT NULL CHECK (price > 0),
  is_active   INTEGER NOT NULL DEFAULT 1,
  updated_at  TEXT NOT NULL,
  PRIMARY KEY (provider_id, service_id)
);

-- Provider promotions (discount codes a provider offers on their own bookings)
CREATE TABLE IF NOT EXISTS promotions (
  id          TEXT PRIMARY KEY,
  provider_id TEXT NOT NULL REFERENCES providers(id) ON DELETE CASCADE,
  code        TEXT NOT NULL,
  percent     INTEGER NOT NULL CHECK (percent BETWEEN 1 AND 50),
  min_amount  INTEGER NOT NULL DEFAULT 0,
  max_uses    INTEGER,
  used_count  INTEGER NOT NULL DEFAULT 0,
  expires_at  TEXT,
  is_active   INTEGER NOT NULL DEFAULT 1,
  created_at  TEXT NOT NULL,
  UNIQUE (provider_id, code)
);

-- Booking chat between the customer and the assigned provider
CREATE TABLE IF NOT EXISTS messages (
  id         TEXT PRIMARY KEY,
  booking_id TEXT NOT NULL REFERENCES bookings(id) ON DELETE CASCADE,
  sender_id  TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  body       TEXT NOT NULL,
  created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_messages_booking ON messages(booking_id, created_at);

CREATE TABLE IF NOT EXISTS announcements (
  id         TEXT PRIMARY KEY,
  title      TEXT NOT NULL,
  body       TEXT NOT NULL,
  audience   TEXT NOT NULL CHECK (audience IN ('all', 'customers', 'providers')),
  recipients INTEGER NOT NULL DEFAULT 0,
  created_by TEXT REFERENCES users(id) ON DELETE SET NULL,
  created_at TEXT NOT NULL
);

-- Commission settlements. amount > 0: provider paid the platform; amount < 0: platform paid the provider.
CREATE TABLE IF NOT EXISTS settlements (
  id          TEXT PRIMARY KEY,
  provider_id TEXT NOT NULL REFERENCES providers(id) ON DELETE CASCADE,
  amount      INTEGER NOT NULL CHECK (amount <> 0),
  note        TEXT,
  created_by  TEXT REFERENCES users(id) ON DELETE SET NULL,
  created_at  TEXT NOT NULL
);

-- Admin audit log
CREATE TABLE IF NOT EXISTS audit_log (
  id          TEXT PRIMARY KEY,
  admin_id    TEXT NOT NULL REFERENCES users(id) ON DELETE SET NULL,
  action      TEXT NOT NULL,
  target_type TEXT NOT NULL,
  target_id   TEXT NOT NULL,
  details     TEXT,
  created_at  TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_audit_log_target ON audit_log(target_type, target_id);
CREATE INDEX IF NOT EXISTS idx_audit_log_admin ON audit_log(admin_id, created_at);

-- =============================================================================
-- PROVIDER CUSTOM SERVICES (Self-Service Service Management)
-- =============================================================================

-- Provider-created custom services (separate from admin catalogue services)
CREATE TABLE IF NOT EXISTS provider_custom_services (
  id                    TEXT PRIMARY KEY,
  provider_id           TEXT NOT NULL REFERENCES providers(id) ON DELETE CASCADE,
  category_id           TEXT REFERENCES categories(name) ON DELETE SET NULL,
  custom_category_name  TEXT, -- For custom categories not in admin catalogue
  name                  TEXT NOT NULL,
  description           TEXT,
  short_description     TEXT,
  service_type          TEXT NOT NULL CHECK (service_type IN ('on_site', 'remote', 'both')) DEFAULT 'on_site',
  
  -- Pricing
  pricing_type          TEXT NOT NULL CHECK (pricing_type IN ('fixed', 'hourly', 'daily', 'per_person', 'starting_from', 'custom_quote')) DEFAULT 'fixed',
  price                 INTEGER NOT NULL CHECK (price >= 0),
  min_price             INTEGER,
  additional_charges    TEXT, -- JSON array of additional charges
  currency              TEXT NOT NULL DEFAULT 'NPR',
  
  -- Duration
  duration_minutes      INTEGER,
  min_booking_duration  INTEGER,
  
  -- Service coverage
  areas                 TEXT, -- JSON array of area IDs
  
  -- Availability
  available             INTEGER NOT NULL DEFAULT 1,
  working_days          TEXT, -- JSON array of days (0-6)
  time_slots            TEXT, -- JSON array of time slots
  booking_notice_hours  INTEGER DEFAULT 24,
  
  -- Content
  whats_included        TEXT,
  whats_not_included    TEXT,
  terms_conditions      TEXT,
  cancellation_policy   TEXT,
  tags                  TEXT, -- JSON array of tags/keywords
  
  -- Approval workflow
  status                TEXT NOT NULL DEFAULT 'draft' 
                        CHECK (status IN ('draft', 'pending_approval', 'approved', 'rejected', 'suspended', 'inactive')),
  rejection_reason      TEXT,
  approved_by           TEXT REFERENCES users(id) ON DELETE SET NULL,
  approved_at           TEXT,
  submitted_at          TEXT,
  requires_reapproval   INTEGER NOT NULL DEFAULT 0, -- Set to 1 when approved service is modified
  
  -- Publication
  is_published          INTEGER NOT NULL DEFAULT 0,
  published_at          TEXT,
  
  -- Metadata
  created_at            TEXT NOT NULL,
  updated_at            TEXT NOT NULL,
  
  -- Soft delete
  deleted_at            TEXT,
  deleted_by            TEXT REFERENCES users(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_provider_custom_services_provider ON provider_custom_services(provider_id);
CREATE INDEX IF NOT EXISTS idx_provider_custom_services_status ON provider_custom_services(status);
CREATE INDEX IF NOT EXISTS idx_provider_custom_services_published ON provider_custom_services(is_published, status);
CREATE INDEX IF NOT EXISTS idx_provider_custom_services_category ON provider_custom_services(category_id);

-- Provider custom service images
CREATE TABLE IF NOT EXISTS provider_service_images (
  id              TEXT PRIMARY KEY,
  service_id      TEXT NOT NULL REFERENCES provider_custom_services(id) ON DELETE CASCADE,
  image_url       TEXT NOT NULL,
  alt_text        TEXT,
  sort_order      INTEGER NOT NULL DEFAULT 0,
  is_primary      INTEGER NOT NULL DEFAULT 0,
  created_at      TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_provider_service_images_service ON provider_service_images(service_id);

-- Provider custom service availability (detailed slots beyond provider_availability)
CREATE TABLE IF NOT EXISTS provider_service_availability (
  id              TEXT PRIMARY KEY,
  service_id      TEXT NOT NULL REFERENCES provider_custom_services(id) ON DELETE CASCADE,
  day_of_week     INTEGER NOT NULL CHECK (day_of_week BETWEEN 0 AND 6),
  start_time      TEXT NOT NULL,
  end_time        TEXT NOT NULL,
  is_active       INTEGER NOT NULL DEFAULT 1,
  created_at      TEXT NOT NULL,
  UNIQUE(service_id, day_of_week, start_time, end_time)
);

CREATE INDEX IF NOT EXISTS idx_provider_service_availability_service ON provider_service_availability(service_id);

-- Provider custom service approval history
CREATE TABLE IF NOT EXISTS provider_service_approval_history (
  id              TEXT PRIMARY KEY,
  service_id      TEXT NOT NULL REFERENCES provider_custom_services(id) ON DELETE CASCADE,
  action          TEXT NOT NULL CHECK (action IN ('submitted', 'approved', 'rejected', 'modification_requested', 'suspended', 'restored', 'published', 'unpublished')),
  admin_id        TEXT REFERENCES users(id) ON DELETE SET NULL,
  admin_notes     TEXT,
  previous_status TEXT,
  new_status      TEXT,
  created_at      TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_provider_service_approval_history_service ON provider_service_approval_history(service_id);

-- Provider custom service tags (for search/filter)
CREATE TABLE IF NOT EXISTS provider_service_tags (
  service_id      TEXT NOT NULL REFERENCES provider_custom_services(id) ON DELETE CASCADE,
  tag             TEXT NOT NULL,
  PRIMARY KEY (service_id, tag)
);

CREATE INDEX IF NOT EXISTS idx_provider_service_tags_tag ON provider_service_tags(tag);
