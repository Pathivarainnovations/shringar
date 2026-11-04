// First-admin bootstrap. No hardcoded admin: set ADMIN_EMAIL (and optionally ADMIN_NAME) in backend/.env.
// If that email has no account, an admin account is created WITHOUT a password. The first login is
// by emailed code (OTP); the admin can then set a password from their profile.
// An existing account is never modified or promoted.
import { createUser, findUserByEmail, newReferralCode, now, rid } from "./db.js";

export function bootstrapAdmin() {
  const email = (process.env.ADMIN_EMAIL ?? "").trim().toLowerCase();
  if (!email) return { status: "disabled" };
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    console.warn("[bootstrap] ADMIN_EMAIL is not a valid email address; skipping");
    return { status: "invalid" };
  }
  const existing = findUserByEmail.get(email);
  if (existing) {
    if (existing.role !== "admin") {
      console.warn(`[bootstrap] ${email} already has a '${existing.role}' account; not changing it`);
    }
    return { status: "exists", role: existing.role };
  }
  const name = (process.env.ADMIN_NAME ?? "").trim().slice(0, 80) || "Administrator";
  createUser.run(rid("USR"), email, name, 0, 0, now(), "admin", newReferralCode());
  console.log(`[bootstrap] created admin account for ${email} - sign in with the emailed code, then set a password`);
  return { status: "created" };
}
