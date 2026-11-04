// Shared HTTP helpers: sessions/cookies, role guards, rate limiting, input cleaning.
import crypto from "node:crypto";
import {
  db, createSession, findSession, SESSION_TTL_MS, maskUserEmail, now,
} from "./db.js";
import { isProduction } from "./env.js";

export const SESSION_COOKIE = "sh_session";

/* ----- input cleaning ----- */
export const cleanText = (v, max) => (typeof v === "string" ? v.trim().slice(0, max) : "");
export const cleanEmail = (v) => cleanText(v, 254).toLowerCase();
export const isEmail = (v) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);
export const positiveInt = (v) => (Number.isInteger(Number(v)) && Number(v) > 0 ? Number(v) : null);
export const nonNegInt = (v) => (v !== "" && v !== null && Number.isInteger(Number(v)) && Number(v) >= 0 ? Number(v) : null);
export const isValidPhone = (v) => /^[0-9+()\-\s]{7,20}$/.test(v);
export const maskPhone = (p) => (p ? String(p).replace(/\d(?=\d{3})/g, "*") : "");

/* ----- sessions ----- */
function getCookieDomain() {
  // Extract hostname from FRONTEND_ORIGIN (e.g., "http://localhost:3000" -> "localhost")
  const origin = process.env.FRONTEND_ORIGIN || "http://localhost:3000";
  try {
    const url = new URL(origin);
    const hostname = url.hostname;
    // For localhost, we can't set domain to "localhost" (browsers block it),
    // so we return undefined to let the browser set it for the current host.
    // In production with a real domain, this will return the actual domain.
    if (hostname === "localhost" || hostname === "127.0.0.1") {
      return undefined;
    }
    return hostname;
  } catch {
    return undefined;
  }
}

const cookieOptions = () => {
  const domain = getCookieDomain();
  return {
    httpOnly: true,
    sameSite: "lax",
    secure: isProduction(),
    path: "/",
    maxAge: SESSION_TTL_MS,
    ...(domain ? { domain } : {}),
  };
};

// Non-HttpOnly cookie for frontend to read and send in Authorization header
const clientCookieOptions = () => {
  const domain = getCookieDomain();
  return {
    httpOnly: false,
    sameSite: "lax",
    secure: isProduction(),
    path: "/",
    maxAge: SESSION_TTL_MS,
    ...(domain ? { domain } : {}),
  };
};

export function startSession(res, userId) {
  const token = "tok-" + crypto.randomBytes(24).toString("hex");
  createSession.run(token, userId, now(), new Date(Date.now() + SESSION_TTL_MS).toISOString());
  res.cookie(SESSION_COOKIE, token, cookieOptions());
  // Non-HttpOnly cookie for frontend to read and send in Authorization header
  res.cookie(SESSION_COOKIE + "_client", token, clientCookieOptions());
  return token;
}

export function clearSessionCookie(res) {
  res.clearCookie(SESSION_COOKIE, { ...cookieOptions(), maxAge: undefined });
  res.clearCookie(SESSION_COOKIE + "_client", { ...clientCookieOptions(), maxAge: undefined });
}

export function tokenFromCookieHeader(header) {
  const m = /(?:^|;\s*)sh_session=([^;]+)/.exec(header || "");
  return m ? decodeURIComponent(m[1]) : null;
}

/** The signed-in user row (includes password_hash: never send it to a client) or null. */
export function authedUser(req) {
  // Try cookie first
  let token = req.cookies?.[SESSION_COOKIE];
  // Fallback: check Authorization header (Bearer token)
  if (!token) {
    const auth = req.headers?.authorization;
    if (auth && auth.startsWith("Bearer ")) {
      token = auth.slice(7);
    }
  }
  if (!token) return null;
  return findSession.get(token, now()) ?? null;
}

export function userFromToken(token) {
  return token ? findSession.get(token, now()) ?? null : null;
}

/** Safe public view of the signed-in user. Never contains password_hash. */
export function maskUser(user) {
  return {
    id: user.id,
    name: user.name,
    email: maskUserEmail(user.email),
    wallet: user.wallet,
    role: user.role,
    favorites: db.prepare(`SELECT name FROM favorites WHERE user_id = ? ORDER BY name`).all(user.id).map((f) => f.name),
    createdAt: user.created_at,
    hasPassword: !!user.password_hash,
    referralCode: user.referral_code ?? null,
  };
}

/* ----- guards ----- */
export const requireUser = (req, res, next) => {
  const user = authedUser(req);
  if (!user) return res.status(401).json({ error: "Please sign in" });
  req.user = user;
  next();
};

export const requireRole = (...roles) => (req, res, next) => {
  const user = authedUser(req);
  if (!user) return res.status(401).json({ error: "Please sign in" });
  if (!roles.includes(user.role)) return res.status(403).json({ error: `requires role: ${roles.join(", ")}` });
  req.user = user;
  next();
};

export const requireAdmin = requireRole("admin");

/* ----- rate limiting (in memory, per process) ----- */
const buckets = new Map();
setInterval(() => {
  const t = Date.now();
  for (const [k, v] of buckets) if (v.resetAt <= t) buckets.delete(k);
}, 60_000).unref();

/** rateLimit({ windowMs, max, key(req) }) -> middleware; also usable as hit(key,...) */
export function hit(key, windowMs, max) {
  const t = Date.now();
  let b = buckets.get(key);
  if (!b || b.resetAt <= t) {
    b = { count: 0, resetAt: t + windowMs };
    buckets.set(key, b);
  }
  b.count++;
  return b.count <= max ? { allowed: true } : { allowed: false, retryAfter: Math.ceil((b.resetAt - t) / 1000) };
}

export const rateLimit = ({ name, windowMs, max, key = (req) => req.ip }) => (req, res, next) => {
  const r = hit(`${name}:${key(req)}`, windowMs, max);
  if (r.allowed) return next();
  res.set("Retry-After", String(r.retryAfter));
  res.status(429).json({ error: `Too many attempts. Try again in ${r.retryAfter} seconds.` });
};

/* ----- misc ----- */
export const jsonError = (res, status, error) => res.status(status).json({ error });
