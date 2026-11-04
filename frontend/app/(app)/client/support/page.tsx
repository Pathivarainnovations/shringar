"use client";

import { useState } from "react";
import { send } from "@/lib/api";
import { useRoleApi } from "@/lib/hooks";
import type { Booking } from "@/lib/types";
import { EmptyState, Skeleton, StatusBadge, useToast } from "@/components/app-shell";

interface Dispute {
  id: string;
  booking_id: string;
  reason: string;
  status: string;
  resolution: string | null;
  created_at: string;
}

export default function ClientSupportPage() {
  const { showToast } = useToast();
  const disputes = useRoleApi<{ disputes: Dispute[] }>("/disputes", ["customer"]);
  const bookings = useRoleApi<{ bookings: Booking[] }>("/bookings", ["customer"]);
  const [bookingId, setBookingId] = useState("");
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);

  const completed = (bookings.data?.bookings ?? []).filter((b) => b.status === "done" && b.providerId);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    const r = await send("/disputes", "POST", { bookingId, reason });
    setBusy(false);
    if (!r.ok) return showToast({ type: "error", title: r.error });
    showToast({ type: "success", title: "Dispute submitted. Support will review it." });
    setBookingId("");
    setReason("");
    disputes.reload();
  }

  return (
    <div>
      <h1 className="h1">Support</h1>
      <p className="sub">Something wrong with a completed booking? Tell us and we will review it.</p>
      <div className="grid2" style={{ marginTop: 24, alignItems: "start" }}>
        <form className="card" onSubmit={submit}>
          <h3>Report a problem</h3>
          {completed.length === 0 && !bookings.loading ? (
            <EmptyState title="No completed bookings" description="You can report a problem once a service is completed." />
          ) : (
            <>
              <div className="fld">
                <label htmlFor="dispute-booking">Booking</label>
                <select id="dispute-booking" value={bookingId} onChange={(e) => setBookingId(e.target.value)} required>
                  <option value="">Choose a completed booking</option>
                  {completed.map((b) => (
                    <option key={b.id} value={b.id}>{b.id} • {b.providerName} • {b.day}</option>
                  ))}
                </select>
              </div>
              <div className="fld">
                <label htmlFor="dispute-reason">What went wrong?</label>
                <textarea id="dispute-reason" rows={4} value={reason} onChange={(e) => setReason(e.target.value)} minLength={10} maxLength={1000} required />
              </div>
              <button className="btn btn-primary" type="submit" disabled={busy || !bookingId || reason.trim().length < 10}>Submit</button>
            </>
          )}
        </form>

        <section className="card">
          <h3>Your reports</h3>
          {disputes.loading ? (
            <Skeleton variant="text" count={3} />
          ) : (disputes.data?.disputes.length ?? 0) === 0 ? (
            <EmptyState title="No reports" description="Anything you report shows up here with its status." />
          ) : (
            <div style={{ display: "grid", gap: 12 }}>
              {disputes.data!.disputes.map((d) => (
                <div key={d.id} className="card" style={{ padding: 12 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", gap: 8 }}>
                    <b>{d.booking_id}</b>
                    <StatusBadge status={d.status} size="sm" />
                  </div>
                  <p style={{ margin: "4px 0" }}>{d.reason}</p>
                  {d.resolution && <p className="mut">Support: {d.resolution}</p>}
                </div>
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
