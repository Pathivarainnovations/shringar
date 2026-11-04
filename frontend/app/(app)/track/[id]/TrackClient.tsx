"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { API_URL, send } from "@/lib/api";
import { useApi, useServiceNames } from "@/lib/hooks";
import { formatHour, formatNpr } from "@/lib/pricing";
import type { Booking } from "@/lib/types";
import { EmptyState, Skeleton, StatusBadge, useToast } from "@/components/app-shell";
import { LIVE_STATUSES, serviceLabel } from "@/components/BookingBits";
import LiveMap from "@/components/maps/LiveMap";

interface TrackingPayload {
  booking: { id: string; status: string; address: string; providerName: string; providerPhone: string };
  tracking: { lat: number; lng: number; status: string; etaMinutes: number | null; updatedAt: string } | null;
}

const STEPS = [
  ["requested", "Requested"],
  ["accepted", "Accepted"],
  ["on_the_way", "On the way"],
  ["arrived", "Arrived"],
  ["in_progress", "In progress"],
  ["done", "Done"],
] as const;

const HEADLINE: Record<string, string> = {
  requested: "Waiting for a provider to accept",
  accepted: "Your booking is confirmed",
  on_the_way: "Your provider is on the way",
  arrived: "Your provider has arrived",
  in_progress: "Your service is in progress",
  done: "Service completed",
  cancelled: "This booking was cancelled",
};

export default function TrackClient() {
  const params = useParams<{ id: string }>();
  const id = params?.id ?? "";
  const { showToast } = useToast();
  const booking = useApi<{ booking: Booking; role: string }>(id ? `/bookings/${encodeURIComponent(id)}` : null, 10000);
  const tracking = useApi<TrackingPayload>(id ? `/tracking/${encodeURIComponent(id)}` : null, 5000);
  const names = useServiceNames();

  const b = booking.data?.booking;
  const role = booking.data?.role;
  const live = Boolean(b && LIVE_STATUSES.includes(b.status));
  const position = tracking.data?.tracking ?? null;

  // The WebSocket only makes updates arrive sooner; the polling above stays the source of truth.
  useEffect(() => {
    if (!live || !id) return;
    let ws: WebSocket | null = null;
    try {
      ws = new WebSocket(process.env.NEXT_PUBLIC_WS_URL ?? API_URL.replace(/^http/, "ws") + "/ws");
      ws.onopen = () => ws?.send(JSON.stringify({ type: "subscribe", bookingId: id }));
      ws.onmessage = () => tracking.reload();
    } catch {
      /* polling continues */
    }
    return () => ws?.close();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [live, id]);

  const [stars, setStars] = useState(0);
  const [reviewText, setReviewText] = useState("");
  const [sharedWith, setSharedWith] = useState("");
  const [shareUrl, setShareUrl] = useState("");
  const [busy, setBusy] = useState(false);

  if (booking.loading) {
    return (
      <div>
        <h1 className="h1">Loading your booking…</h1>
        <Skeleton variant="card" />
      </div>
    );
  }
  if (!b) {
    return (
      <div>
        <h1 className="h1">Booking not found</h1>
        <EmptyState title="We could not open this booking" description={booking.error ?? "It may not be yours."} />
      </div>
    );
  }

  const stepIndex = STEPS.findIndex(([s]) => s === b.status);

  async function submitReview() {
    if (!b) return;
    if (stars < 1) return showToast({ type: "error", title: "Choose a star rating" });
    setBusy(true);
    const r = await send("/reviews", "POST", { bookingId: b.id, stars, text: reviewText });
    setBusy(false);
    if (!r.ok) return showToast({ type: "error", title: r.error });
    showToast({ type: "success", title: "Thanks for your review!" });
    booking.reload();
  }

  async function shareTrip() {
    if (!b) return;
    const r = await send<{ shareUrl: string }>("/trip/share", "POST", { bookingId: b.id, sharedWith });
    if (!r.ok) return showToast({ type: "error", title: r.error });
    setShareUrl(r.data.shareUrl);
  }

  function triggerSos() {
    if (!b || !window.confirm("Send an SOS alert to Shringar support with your location?")) return;
    if (!navigator.geolocation) return showToast({ type: "error", title: "This device cannot share a location" });
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const r = await send("/sos", "POST", { bookingId: b.id, lat: pos.coords.latitude, lng: pos.coords.longitude });
        showToast(r.ok ? { type: "success", title: "SOS sent. Support has been alerted." } : { type: "error", title: r.error });
      },
      () => showToast({ type: "error", title: "Could not get your location. Allow location access and try again." }),
      { enableHighAccuracy: true, timeout: 15000 }
    );
  }

  return (
    <div>
      <h1 className="h1">{HEADLINE[b.status] ?? "Booking"}</h1>
      <p className="sub">
        {b.id} • {serviceLabel(b, names)} • {b.day} {formatHour(b.startHour)}
      </p>

      {b.status !== "cancelled" && (
        <section className="card" style={{ marginTop: 16 }}>
          <ol style={{ display: "flex", gap: 8, flexWrap: "wrap", listStyle: "none", padding: 0, margin: 0 }} aria-label="Booking progress">
            {STEPS.map(([s, label], i) => (
              <li key={s} aria-current={i === stepIndex ? "step" : undefined} style={{ padding: "6px 12px", borderRadius: 999, fontSize: "0.8125rem", background: i <= stepIndex ? "var(--gold)" : "var(--line)", color: i <= stepIndex ? "#0E3B2C" : "var(--muted)", fontWeight: i === stepIndex ? 700 : 500 }}>
                {label}
              </li>
            ))}
          </ol>
        </section>
      )}

      {live && (
        <section className="card" style={{ marginTop: 16 }}>
          <h3>Live location</h3>
          {position ? (
            <>
              <LiveMap markers={[{ id: "provider", lat: position.lat, lng: position.lng, title: b.providerName, popup: b.providerName }]} />
              <p className="mut" style={{ marginTop: 8 }}>
                {position.etaMinutes !== null ? `About ${position.etaMinutes} min away • ` : ""}Updated {new Date(position.updatedAt).toLocaleTimeString()}
              </p>
            </>
          ) : (
            <EmptyState title="Waiting for the provider's location..." description="The map appears as soon as your provider shares their position." />
          )}
        </section>
      )}

      <div className="grid2" style={{ marginTop: 16 }}>
        <section className="card">
          <h3>Details</h3>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            <div className="r"><span>Provider</span><b>{b.providerName || "Not assigned yet"}</b></div>
            {b.mode === "home" && <div className="r"><span>Address</span><b>{b.address}</b></div>}
            <div className="r"><span>Status</span><StatusBadge status={b.status} /></div>
            <div className="r"><span>Payment</span><StatusBadge status={b.payStatus} /></div>
            <div className="r" style={{ borderTop: "1px solid var(--line)", paddingTop: 8 }}><span>Total</span><b>{formatNpr(b.total)}</b></div>
          </div>
          {role === "customer" && (
            <div className="row" style={{ gap: 8, marginTop: 12, flexWrap: "wrap" }}>
              {b.providerId && b.status !== "cancelled" && <Link className="btn btn-outline btn-sm" href={`/client/messages?booking=${b.id}`}>Message provider</Link>}
              {b.payStatus !== "paid" && ["accepted", "on_the_way", "arrived", "in_progress", "done"].includes(b.status) && <Link className="btn btn-primary btn-sm" href={`/checkout/${b.id}`}>Pay</Link>}
              {b.status === "requested" && <Link className="btn btn-outline btn-sm" href="/client/bookings">Manage booking</Link>}
            </div>
          )}
        </section>

        {role === "customer" && live && (
          <section className="card">
            <h3>Safety</h3>
            <p className="mut" style={{ marginBottom: 12 }}>Share this trip with someone you trust, or alert support.</p>
            <div className="fld">
              <label htmlFor="share-with">Share with</label>
              <input id="share-with" value={sharedWith} onChange={(e) => setSharedWith(e.target.value)} placeholder="Name of a friend or family member" maxLength={100} />
            </div>
            <div className="row" style={{ gap: 8, flexWrap: "wrap" }}>
              <button className="btn btn-outline btn-sm" onClick={shareTrip} disabled={!sharedWith.trim()}>Create share link</button>
              <button className="btn btn-danger btn-sm" onClick={triggerSos}>SOS</button>
            </div>
            {shareUrl && (
              <p style={{ marginTop: 8, wordBreak: "break-all" }}>
                <input readOnly value={shareUrl} aria-label="Share link" onFocus={(e) => e.currentTarget.select()} style={{ width: "100%" }} />
              </p>
            )}
          </section>
        )}
      </div>

      {role === "customer" && b.status === "done" && b.providerId && (
        <section className="card" style={{ marginTop: 16, maxWidth: 520 }}>
          <h3>Rate your experience</h3>
          {b.reviewed ? (
            <p className="mut">Thanks - you already reviewed this booking.</p>
          ) : (
            <>
              <div role="radiogroup" aria-label="Stars" style={{ display: "flex", gap: 4, margin: "8px 0" }}>
                {[1, 2, 3, 4, 5].map((n) => (
                  <button key={n} type="button" role="radio" aria-checked={stars === n} aria-label={`${n} star${n === 1 ? "" : "s"}`} onClick={() => setStars(n)} style={{ fontSize: "1.75rem", background: "none", border: 0, cursor: "pointer", color: n <= stars ? "#F5B301" : "var(--line)" }}>★</button>
                ))}
              </div>
              <div className="fld">
                <label htmlFor="review-text">Comment (optional)</label>
                <textarea id="review-text" rows={3} value={reviewText} onChange={(e) => setReviewText(e.target.value)} maxLength={1000} />
              </div>
              <button className="btn btn-primary" onClick={submitReview} disabled={busy}>{busy ? "Sending..." : "Submit review"}</button>
            </>
          )}
        </section>
      )}
    </div>
  );
}
