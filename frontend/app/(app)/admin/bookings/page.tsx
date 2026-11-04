"use client";

import { useState } from "react";
import { send } from "@/lib/api";
import { useApi } from "@/lib/hooks";
import type { Booking } from "@/lib/types";
import { BookingHeader } from "@/components/BookingBits";
import { EmptyState, Skeleton, useToast } from "@/components/app-shell";

const STATUSES = ["", "requested", "accepted", "on_the_way", "arrived", "in_progress", "done", "cancelled"];

export default function AdminBookingsPage() {
  const { showToast } = useToast();
  const [status, setStatus] = useState("");
  const { data, error, loading, reload } = useApi<{ bookings: Booking[] }>(`/admin/bookings${status ? `?status=${status}` : ""}`, 20000);

  async function cancel(b: Booking) {
    if (!window.confirm(`Cancel booking ${b.id}? The customer and provider are notified.`)) return;
    const r = await send(`/bookings/${b.id}/cancel`, "POST", { reason: "Cancelled by support" });
    if (!r.ok) return showToast({ type: "error", title: r.error });
    showToast({ type: "success", title: "Booking cancelled" });
    reload();
  }

  return (
    <div>
      <h1 className="h1">Bookings</h1>
      <p className="sub">Every booking on the platform, newest first.</p>
      <div className="fld" style={{ maxWidth: 240, marginTop: 16 }}>
        <label htmlFor="status-filter">Status</label>
        <select id="status-filter" value={status} onChange={(e) => setStatus(e.target.value)}>
          {STATUSES.map((s) => <option key={s} value={s}>{s ? s.replace(/_/g, " ") : "All"}</option>)}
        </select>
      </div>
      <div style={{ display: "grid", gap: 12, marginTop: 8 }}>
        {loading ? <Skeleton variant="card" count={3} /> : error ? (
          <EmptyState title="Could not load bookings" description={error} action={{ label: "Try again", onClick: reload }} />
        ) : (data?.bookings.length ?? 0) === 0 ? (
          <EmptyState title="No bookings" description={status ? "No bookings with that status." : "Bookings appear here as customers make them."} />
        ) : (
          data!.bookings.map((b) => (
            <div key={b.id} className="card" style={{ padding: 16 }}>
              <BookingHeader b={b} who={`${b.customerName} → ${b.providerName || "no provider yet"}`} />
              {!["done", "cancelled"].includes(b.status) && (
                <button className="btn btn-outline btn-sm" style={{ marginTop: 12 }} onClick={() => cancel(b)}>Cancel booking</button>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
}
