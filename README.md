# Shringar - beauty services marketplace

Customers book stylists at home or at a salon. Providers (freelancers and salons) set their own prices,
accept requests and get paid in cash or from the customer's wallet. Admins approve providers, manage the
catalogue and see commission, reports and live locations.

- `backend/` - Express + SQLite API (`better-sqlite3`), email via SMTP or Resend, WebSocket for live tracking
- `frontend/` - Next.js 16 website and the three dashboards (customer, provider, admin)
- `database/schema.sql` - the database schema (applied automatically when the backend starts)

## Requirements

- Windows 10/11 (macOS and Linux work too), **Node.js 20.9 or newer** (LTS recommended)
- If `npm install` in `backend` tries to compile `better-sqlite3` and fails, install the
  "Desktop development with C++" workload from Visual Studio Build Tools, then run it again.

## Setup (PowerShell)

```powershell
cd backend
npm install
copy .env.example .env
notepad .env            # set ADMIN_EMAIL to your own email address

cd ..\frontend
npm install
copy .env.example .env.local
```

## Run it

Open three PowerShell windows (or use the single command at the end of this section).

```powershell
# 1) backend  (creates database\shringar.db on first start)
cd backend
node src\server.js          # or: npm run dev   (restarts when files change)

# 2) once, in another window: load the service catalogue, categories and areas
cd backend
npm run init-reference-data

# 3) frontend
cd frontend
npm run dev
```

Open <http://localhost:3000>. Alternatively run `npm install` once in the project root and then
`npm run dev` there to start both servers together.

### First admin

There is no built-in admin account. `ADMIN_EMAIL` (and optionally `ADMIN_NAME`) in `backend\.env` creates one
on startup if that email has no account yet (no password). Then:

1. Open <http://localhost:3000/login> and choose **Sign in with a code instead**.
2. Enter that email. In development the code is printed in the backend window and shown on the page as
   "Dev code".
3. Open **Profile** and set a password. After that you can sign in with email + password.

An existing account is never changed or promoted by this setting.

### Reference data

`npm run init-reference-data` (in `backend`) loads what the app needs to work: service categories, a starter
service catalogue (name, minutes, suggested price) and service areas. It can be run again safely (it only adds
what is missing), never creates users or activity, and everything it loads is editable afterwards under
**Admin -> Catalogue**.

### Starting over (development only)

```powershell
cd backend
npm run reset-dev-db
```

Asks you to type `RESET`, saves `backend\backup-YYYYMMDD.db`, then deletes the database. It refuses to run when
`NODE_ENV=production`. Start the backend again and re-run the reference-data script.

## How it works

1. **Customers** sign up at `/login` (email + password with an emailed code, or just a code) and book from the
   landing page or `/booking`. Prices come from the chosen provider's own price list. Customers can also name
   their own price for a home visit; providers can accept, decline or counter it.
2. **Providers** apply at `/partner` (signed in). An admin approves them under **Admin -> Providers**. They then
   set prices (**Services & Prices**), hours, travel fee, promotions and staff, accept requests, run the trip
   (the customer can follow them live), mark the service done and record cash received.
3. **Admins** manage providers, users, bookings, disputes, coupons, the catalogue, announcements and settings
   (commission rate, first-booking discount, referral credit), and settle commission with providers.
4. **Payments:** cash to the provider after the service, or the customer's wallet (credited by referral rewards).
   There is no card/eSewa/Khalti gateway. Commission is charged on the service amount (travel fee excluded).

## Tests

```powershell
cd frontend
npm test
```

Renders the real pages (sign-in, booking, checkout, provider requests and trip, tracking, reviews, messages,
admin dashboard and catalogue) against a **temporary backend** on port 4177 with its own throw-away database,
so your real data is never touched. Run `npm install` in both `backend` and `frontend` first.

**API end-to-end test (PowerShell):**

```powershell
powershell -ExecutionPolicy Bypass -File scripts\e2e.ps1     # or: npm run e2e   (from the project root)
```

Starts a temporary backend on port 4188 with a brand-new database (your real one is never used), then runs the
whole business flow through the HTTP API: admin bootstrap by emailed code, customer and provider sign-up, provider
application and approval, prices / staff / promotion, booking, accept, live location, done, cash received, review,
admin statistics and commission settlement, wrong-role (401/403) checks, rate limiting and code lockout. It prints
`PASS`/`FAIL` for each step and exits with code 1 if anything fails. Use `-BaseUrl http://localhost:4000/api` to test
an already running backend instead (it must be on a fresh database with `ADMIN_EMAIL=owner@example.com`).
It works in Windows PowerShell 5.1 and PowerShell 7 (verified on PowerShell 7 only).

Other checks: `npm run typecheck` (TypeScript), `npm run build` (production build, in `frontend`).
The tests do not cover browser layout, real GPS, real email delivery or the map tiles.

## Scripts

| Where | Command | What it does |
|---|---|---|
| backend | `npm run dev` / `npm start` | start the API (with / without auto-restart) |
| backend | `npm run init-reference-data` | load categories, services, areas (idempotent) |
| backend | `npm run backup` | consistent backup copy of the database into `backend\backups` |
| backend | `npm run reset-dev-db` | development only: backup, then delete the database |
| frontend | `npm run dev` / `build` / `start` | Next.js development server / production build / serve the build |
| frontend | `npm run typecheck` | `tsc --noEmit` |
| frontend | `npm test` | UI tests against a temporary backend |
| root | `npm run e2e` | PowerShell API end-to-end test against a temporary backend |

## Production notes

- **HTTPS is required.** Put both apps behind a reverse proxy that terminates TLS. Set `NODE_ENV=production`,
  `FRONTEND_ORIGIN=https://your-site`, `TRUST_PROXY=1` (number of proxies) and
  `NEXT_PUBLIC_API_URL=https://your-api` (then rebuild the frontend). Session cookies are `HttpOnly`,
  `SameSite=Lax` and `Secure` in production, so keep the site and the API on the same registrable domain
  (for example `app.example.com` and `api.example.com`).
- **Real email is required.** Set `SMTP_*` or `RESEND_API_KEY` plus `MAIL_FROM`. Until then, production answers
  503 to every sign-in request. In production sign-in codes are never returned by the API or written to logs.
- **Back up SQLite.** Schedule `npm run backup` (Windows Task Scheduler or cron) and copy the files off the
  machine. Do not copy `shringar.db` by hand while the server runs; the database uses WAL mode.
- **Run a single backend instance.** Rate limits, WebSocket subscriptions and the SQLite file live in one
  process, so it cannot be scaled horizontally as it is.
- **PostgreSQL is planned.** All SQL is currently SQLite-flavoured (`better-sqlite3` synchronous calls,
  `INSERT OR IGNORE`, `AUTOINCREMENT`, JSON stored as text) and is spread over `backend/src/db.js` and the route
  modules. A migration needs a data-access layer first; it is not done yet.

## Known gaps

- Some marketing copy promises things the product does not do: a "women-only option / female stylist", "ID,
  certificates and background checks" (admins only review a typed ID note) and, on `/partner`, "weekly eSewa
  payouts" and a fixed "10-20%" commission (commission is one admin setting, 15% by default). Review the text
  in `frontend/lib/i18n.ts`, `frontend/components/Safety.tsx` and `frontend/app/(marketing)/partner/page.tsx`
  before launch.
- No online payment gateway; the wallet can only be credited through referral rewards.
- Rate limiting is in memory per process, and there is no admin tool to suspend or delete user accounts.
- Browser layout, the map, real GPS and real email delivery are not covered by automated tests.

## Troubleshooting

- *Port already in use:* change `PORT` in `backend\.env` (and `NEXT_PUBLIC_API_URL` in `frontend\.env.local`).
- *The map is blank:* run `npm install` again in `frontend` (it copies the MapLibre worker into `public`).
- *"Email sending is not configured on this server":* you are in production mode without SMTP/Resend settings.
- *Login keeps returning to `/login` after a restart of the browser:* the session expired (30 days) - sign in again.

## Project layout

```
backend/src/        server.js (entry), routes/ (auth, catalogue, bookings, provider, admin, account, safety),
                    lifecycle.js (booking rules, money), pricing.js, settings.js, mailer.js, db.js, ws.js
backend/scripts/    init-reference-data.js, backup-db.js, reset-dev-db.js
frontend/app/       pages: (marketing) public site, (app) customer / provider / admin dashboards
frontend/components shared UI (app-shell, maps, messages, booking helpers)
frontend/tests/     UI tests (vitest + jsdom)
scripts/e2e.ps1     PowerShell API end-to-end test
database/           schema.sql
```
