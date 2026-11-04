import "./env.js";
import http from "node:http";
import express from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import { db, purgeExpiredSessions, now } from "./db.js";
import { isProduction } from "./env.js";
import { rateLimit } from "./http.js";
import { bootstrapAdmin } from "./bootstrap.js";
import { attachWebSocket } from "./ws.js";
import auth, { profileRouter } from "./routes/auth.js";
import catalogue from "./routes/catalogue.js";
import bookings, { offers, conversations } from "./routes/bookings.js";
import provider from "./routes/provider.js";
import providerCustomServices from "./routes/provider-custom-services.js";
import admin from "./routes/admin.js";
import adminProviderServices from "./routes/admin-provider-services.js";
import { notifications, favorites, wallet, referrals, loyalty, reviews, disputes, partner } from "./routes/account.js";
import { contacts, sos, trip, tripShares, tracking } from "./routes/safety.js";

const PORT = process.env.PORT ? Number(process.env.PORT) : 4000;
const ORIGINS = (process.env.FRONTEND_ORIGIN || "http://localhost:3000").split(",").map((s) => s.trim()).filter(Boolean);

const app = express();
// Behind a reverse proxy (HTTPS terminator), set TRUST_PROXY=1 so req.ip and secure cookies work.
if (process.env.TRUST_PROXY) app.set("trust proxy", Number(process.env.TRUST_PROXY) || process.env.TRUST_PROXY);
app.disable("x-powered-by");

app.use(cors({ origin: ORIGINS, credentials: true }));
app.use((req, res, next) => {
  res.set({ "X-Content-Type-Options": "nosniff", "X-Frame-Options": "DENY", "Referrer-Policy": "no-referrer" });
  if (req.path.startsWith("/api")) res.set("Cache-Control", "no-store");
  // Defence in depth against cross-site writes: a browser request that names another origin is refused.
  const origin = req.get("origin");
  if (origin && !["GET", "HEAD", "OPTIONS"].includes(req.method) && !ORIGINS.includes(origin)) {
    return res.status(403).json({ error: "Origin not allowed" });
  }
  next();
});
app.use(express.json({ limit: "50kb" }));
app.use(cookieParser());
app.use("/api", rateLimit({ name: "api", windowMs: 60_000, max: 600 }));

app.get("/api/health", (_req, res) => res.json({ ok: true }));

app.use("/api/auth", auth);
app.use("/api/profile", profileRouter);
app.use("/api/bookings", bookings);
app.use("/api/messages", conversations);
app.use("/api/offers", offers);
app.use("/api/provider", provider);
app.use("/api/provider/custom-services", providerCustomServices);
app.use("/api/admin", admin);
app.use("/api/admin/provider-services", adminProviderServices);
app.use("/api/notifications", notifications);
app.use("/api/favorites", favorites);
app.use("/api/wallet", wallet);
app.use("/api/referrals", referrals);
app.use("/api/loyalty", loyalty);
app.use("/api/reviews", reviews);
app.use("/api/disputes", disputes);
app.use("/api/partner", partner);
app.use("/api/safety/contacts", contacts);
app.use("/api/sos", sos);
app.use("/api/trip", trip);
app.use("/api/trip-shares", tripShares);
app.use("/api/tracking", tracking);
app.use("/api", catalogue);

// Unknown API routes and unexpected errors answer with JSON (never an HTML page or a stack trace).
app.use("/api", (_req, res) => res.status(404).json({ error: "Not found" }));
app.use((err, req, res, _next) => {
  if (err?.type === "entity.parse.failed") return res.status(400).json({ error: "Invalid JSON body" });
  if (err?.type === "entity.too.large") return res.status(413).json({ error: "Request body too large" });
  console.error(`[error] ${req.method} ${req.originalUrl}:`, isProduction() ? err?.message : err);
  res.status(500).json({ error: "Something went wrong" });
});

bootstrapAdmin();
purgeExpiredSessions.run(now());
setInterval(() => purgeExpiredSessions.run(now()), 60 * 60 * 1000).unref();

const server = http.createServer(app);

// Handle EADDRINUSE on HTTP server
server.on("error", (err) => {
  if (err.code === "EADDRINUSE") {
    console.error(`Port ${PORT} is already in use. Stop the other process or change PORT.`);
    process.exit(1);
  }
  throw err;
});

const wss = attachWebSocket(server, ORIGINS);

// Handle EADDRINUSE on WebSocket server
wss.on("error", (err) => {
  if (err.code === "EADDRINUSE") {
    console.error(`Port ${PORT} is already in use. Stop the other process or change PORT.`);
    process.exit(1);
  }
});

function shutdown() {
  console.log("Shutting down gracefully...");
  wss.close(() => {
    server.close(() => {
      db.close();
      process.exit(0);
    });
  });
  // Force exit after 10 seconds
  setTimeout(() => {
    console.error("Forced shutdown after timeout");
    process.exit(1);
  }, 10_000);
}

for (const sig of ["SIGINT", "SIGTERM"]) {
  process.on(sig, shutdown);
}

server.listen(PORT, () => {
  console.log(`Shringar backend listening on http://localhost:${PORT}`);
});
