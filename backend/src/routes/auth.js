import crypto from "node:crypto";
import { Router } from "express";
import {
  db, rid, now, createUser, findUserByEmail, findUserById, getOTP, upsertOTP, deleteOTP, bumpOTPAttempts,
  updateUserPassword, deleteUserSessions, deleteSession, hashPassword, verifyPassword, newReferralCode,
  getUserByReferralCode, createReferral,
} from "../db.js";
import {
  SESSION_COOKIE, authedUser, maskUser, startSession, clearSessionCookie, requireUser, cleanText, cleanEmail, isEmail, hit,
} from "../http.js";
import { isProduction } from "../env.js";
import { getSettings } from "../settings.js";
import { sendOtpEmail, MailNotConfiguredError } from "../mailer.js";
import { notify } from "../lifecycle.js";

const router = Router();
const WINDOW = 15 * 60 * 1000;
const OTP_TTL_MS = 10 * 60 * 1000; // shown to the user as "10 minutes" in the email
const MAX_OTP_ATTEMPTS = 5;

const tooMany = (res, r) => res.set("Retry-After", String(r.retryAfter)).status(429).json({ error: `Too many attempts. Try again in ${r.retryAfter} seconds.` });
const welcomeMessage = () => {
  const pct = getSettings().first_booking_discount_pct;
  return pct > 0 ? `Browse verified stylists and book your first service - ${pct}% off your first booking.` : "Browse verified stylists and book your first service.";
};

async function issueOtp(email, purpose) {
  const code = String(crypto.randomInt(100000, 1000000)); // 6 digits
  upsertOTP.run(email, code, Date.now() + OTP_TTL_MS);
  await sendOtpEmail(email, code, purpose);
  return isProduction() ? undefined : code; // dev hint only; never returned in production
}

function sendOtp(purpose, { onlyExisting = false } = {}) {
  return async (req, res) => {
    const email = cleanEmail(req.body?.email);
    if (!isEmail(email)) return res.status(400).json({ error: "Enter a valid email address" });
    const a = hit(`otp-ip:${req.ip}`, WINDOW, 20);
    const b = hit(`otp:${email}`, WINDOW, 5);
    if (!a.allowed || !b.allowed) return tooMany(res, a.allowed ? b : a);
    const message = "If that address can receive a code, we sent one";
    if (onlyExisting && !findUserByEmail.get(email)) return res.json({ ok: true, message }); // no account enumeration
    try {
      const devCode = await issueOtp(email, purpose);
      res.json({ ok: true, message, ...(devCode ? { devCode } : {}) });
    } catch (err) {
      if (err instanceof MailNotConfiguredError) return res.status(503).json({ error: "Email sending is not configured on this server" });
      res.status(502).json({ error: "We could not send the email. Please try again shortly." });
    }
  };
}

/** Validates a code. Returns an error response object or null when the code is right (and consumes it). */
function checkOtp(email, code) {
  const otp = getOTP.get(email);
  if (!otp) return { status: 400, error: "Request a code first" };
  if (otp.expires < Date.now()) {
    deleteOTP.run(email);
    return { status: 400, error: "That code expired. Request a new one." };
  }
  if (otp.attempts >= MAX_OTP_ATTEMPTS) {
    deleteOTP.run(email);
    return { status: 429, error: "Too many wrong codes. Request a new one." };
  }
  const given = Buffer.from(String(code));
  const real = Buffer.from(otp.code);
  if (given.length !== real.length || !crypto.timingSafeEqual(given, real)) {
    bumpOTPAttempts.run(email);
    return { status: 400, error: "Wrong code" };
  }
  deleteOTP.run(email);
  return null;
}

function createCustomer({ email, name, referrer, passwordHash }) {
  const id = rid("USR");
  const credit = referrer ? getSettings().referral_credit : 0;
  db.transaction(() => {
    createUser.run(id, email, name || "Guest " + email.split("@")[0], credit, referrer ? 1 : 0, now(), "customer", newReferralCode());
    if (passwordHash) updateUserPassword.run(passwordHash, id);
    if (referrer) {
      createReferral.run(rid("REF"), referrer.id, id, "pending", credit, now());
      notify(referrer.id, "referral", "Referral signup", `${name || "A friend"} joined with your code. You earn NPR ${credit} when they complete their first booking.`, {});
    }
    notify(id, "welcome", "Welcome to Shringar!", welcomeMessage());
  })();
  return findUserById.get(id);
}

const referrerFrom = (body) => {
  const code = cleanText(body?.referral, 20).toUpperCase();
  if (!code) return { referrer: null };
  const referrer = getUserByReferralCode.get(code);
  return referrer ? { referrer } : { error: "That referral code was not found" };
};

/* ---------- email code (OTP) ---------- */
router.post("/request-otp", sendOtp("login"));
router.post("/signup", sendOtp("signup"));
router.post("/forgot-password", sendOtp("reset", { onlyExisting: true }));

router.post("/verify-otp", (req, res) => {
  const email = cleanEmail(req.body?.email);
  const code = cleanText(req.body?.code, 12);
  if (!isEmail(email) || !code) return res.status(400).json({ error: "Email and code are required" });
  const ref = referrerFrom(req.body);
  if (ref.error) return res.status(400).json({ error: ref.error });

  const bad = checkOtp(email, code);
  if (bad) return res.status(bad.status).json({ error: bad.error });

  let user = findUserByEmail.get(email);
  const fresh = !user;
  if (!user) user = createCustomer({ email, name: cleanText(req.body?.name, 80), referrer: ref.referrer });
  startSession(res, user.id);
  res.status(fresh ? 201 : 200).json({ user: maskUser(user) });
});

router.post("/signup/verify", (req, res) => {
  const email = cleanEmail(req.body?.email);
  const code = cleanText(req.body?.code, 12);
  const name = cleanText(req.body?.name, 80);
  const password = typeof req.body?.password === "string" ? req.body.password : "";
  if (!isEmail(email) || !code) return res.status(400).json({ error: "Email and code are required" });
  if (name.length < 2) return res.status(400).json({ error: "Enter your name" });
  if (password.length < 8 || password.length > 128) return res.status(400).json({ error: "Password must be 8 to 128 characters" });
  const ref = referrerFrom(req.body);
  if (ref.error) return res.status(400).json({ error: ref.error });

  const bad = checkOtp(email, code);
  if (bad) return res.status(bad.status).json({ error: bad.error });

  let user = findUserByEmail.get(email);
  const fresh = !user;
  // An existing account is signed in but its password is never replaced here (use reset-password for that).
  if (!user) user = createCustomer({ email, name, referrer: ref.referrer, passwordHash: hashPassword(password) });
  startSession(res, user.id);
  res.status(fresh ? 201 : 200).json({ user: maskUser(user) });
});

/* ---------- email + password ---------- */
router.post("/login", (req, res) => {
  const email = cleanEmail(req.body?.email);
  const password = typeof req.body?.password === "string" ? req.body.password : "";
  if (!isEmail(email) || !password) return res.status(400).json({ error: "Enter your email and password" });
  const a = hit(`login-ip:${req.ip}`, WINDOW, 30);
  const b = hit(`login:${email}:${req.ip}`, WINDOW, 8);
  if (!a.allowed || !b.allowed) return tooMany(res, a.allowed ? b : a);

  const user = findUserByEmail.get(email);
  if (!user || !user.password_hash || !verifyPassword(password, user.password_hash)) {
    return res.status(401).json({ error: "Invalid email or password" });
  }
  startSession(res, user.id);
  res.json({ user: maskUser(user) });
});

router.post("/reset-password", (req, res) => {
  const email = cleanEmail(req.body?.email);
  const code = cleanText(req.body?.code, 12);
  const newPassword = typeof req.body?.newPassword === "string" ? req.body.newPassword : "";
  if (!isEmail(email) || !code) return res.status(400).json({ error: "Email and code are required" });
  if (newPassword.length < 8 || newPassword.length > 128) return res.status(400).json({ error: "Password must be 8 to 128 characters" });
  const bad = checkOtp(email, code);
  if (bad) return res.status(bad.status).json({ error: bad.error });
  const user = findUserByEmail.get(email);
  if (!user) return res.status(400).json({ error: "Request a code first" });
  updateUserPassword.run(hashPassword(newPassword), user.id);
  deleteUserSessions.run(user.id); // sign out everywhere, then sign in fresh
  startSession(res, user.id);
  res.json({ user: maskUser(user) });
});

/* ---------- session ---------- */
router.get("/me", (req, res) => {
  const user = authedUser(req);
  res.json({ user: user ? maskUser(user) : null });
});

const logout = (req, res) => {
  const token = req.cookies?.[SESSION_COOKIE];
  if (token) deleteSession.run(token);
  clearSessionCookie(res);
  res.json({ ok: true });
};
router.post("/logout", logout);
router.delete("/me", logout);

router.post("/logout-all", requireUser, (req, res) => {
  deleteUserSessions.run(req.user.id);
  clearSessionCookie(res);
  res.json({ ok: true });
});

/* ---------- profile (mounted at /api/profile) ---------- */
export const profileRouter = Router();
profileRouter.patch("/", requireUser, (req, res) => {
  const name = cleanText(req.body?.name, 80);
  if (name.length < 2) return res.status(400).json({ error: "Enter your name" });
  db.prepare(`UPDATE users SET name = ? WHERE id = ?`).run(name, req.user.id);
  res.json({ user: maskUser(findUserById.get(req.user.id)) });
});

profileRouter.patch("/password", requireUser, (req, res) => {
  const { currentPassword, newPassword } = req.body ?? {};
  if (typeof newPassword !== "string" || newPassword.length < 8 || newPassword.length > 128) {
    return res.status(400).json({ error: "New password must be 8 to 128 characters" });
  }
  const limited = hit(`pw:${req.user.id}`, WINDOW, 8);
  if (!limited.allowed) return tooMany(res, limited);
  // A first password (account created by email code) needs no current password.
  if (req.user.password_hash && (typeof currentPassword !== "string" || !verifyPassword(currentPassword, req.user.password_hash))) {
    return res.status(401).json({ error: "Current password is incorrect" });
  }
  updateUserPassword.run(hashPassword(newPassword), req.user.id);
  res.json({ user: maskUser(findUserById.get(req.user.id)) });
});

export default router;
