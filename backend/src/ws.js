// Live-location push. The HTTP tracking route is the source of truth; the WebSocket only makes updates arrive sooner.
// A client authenticates with its session cookie, then sends { type: "subscribe", bookingId }.
import { WebSocketServer } from "ws";
import { getBookingById } from "./db.js";
import { tokenFromCookieHeader, userFromToken } from "./http.js";
import { partyRole } from "./routes/bookings.js";

const subscribers = new Map(); // bookingId -> Set<WebSocket>

export function broadcast(bookingId, message) {
  const payload = JSON.stringify(message);
  for (const ws of subscribers.get(bookingId) ?? []) if (ws.readyState === 1) ws.send(payload);
}

export function attachWebSocket(server, allowedOrigins) {
  const wss = new WebSocketServer({
    server,
    path: "/ws",
    verifyClient: ({ origin }) => !origin || allowedOrigins.includes(origin),
  });

  wss.on("connection", (ws, req) => {
    const user = userFromToken(tokenFromCookieHeader(req.headers.cookie));
    if (!user) return ws.close(4001, "Sign in first");
    let watching = null;
    ws.isAlive = true;
    ws.on("pong", () => (ws.isAlive = true));
    ws.on("message", (data) => {
      let msg;
      try { msg = JSON.parse(data.toString()); } catch { return; }
      if (msg?.type !== "subscribe" || typeof msg.bookingId !== "string") return;
      const booking = getBookingById.get(msg.bookingId);
      if (!booking || !partyRole(user, booking)) return ws.send(JSON.stringify({ type: "error", error: "Booking not found" }));
      if (watching) subscribers.get(watching)?.delete(ws);
      watching = booking.id;
      if (!subscribers.has(watching)) subscribers.set(watching, new Set());
      subscribers.get(watching).add(ws);
      ws.send(JSON.stringify({ type: "subscribed", bookingId: watching }));
    });
    ws.on("close", () => {
      if (watching) subscribers.get(watching)?.delete(ws);
    });
  });

  const beat = setInterval(() => {
    for (const ws of wss.clients) {
      if (!ws.isAlive) { ws.terminate(); continue; }
      ws.isAlive = false;
      ws.ping();
    }
  }, 30_000);
  beat.unref();
  return wss;
}
