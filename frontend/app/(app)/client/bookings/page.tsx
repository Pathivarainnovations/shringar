"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { send } from "@/lib/api";
import { useRoleApi, useServiceNames } from "@/lib/hooks";
import { formatNpr } from "@/lib/pricing";
import type { Booking } from "@/lib/types";
import { ConfirmDialog, EmptyState, Skeleton, Tabs, useToast } from "@/components/app-shell";
import { BookingHeader, LIVE_STATUSES } from "@/components/BookingBits";

const TABS = [
  { id: "active", label: "Active" },
  { id: "done", label: "Completed" },
  { id: "cancelled", label: "Cancelled" },
] as const;

export default function ClientBookingsPage() {
  const router = useRouter();
  const { showToast } = useToast();
  const { data, error, loading, reload } = useRoleApi<{ bookings: Booking[] }>("/bookings", ["customer"], 15000);
  const names = useServiceNames();
  const [tab, setTab] = useState<string>("active");
  const [cancelling, setCancelling] = useState<Booking | null>(null);
  const [busy, setBusy] = useState(false);

  const all = data?.bookings ?? [];
  const shown = all.filter((b) => (tab === "active" ? !["done", "cancelled"].includes(b.status) : b.status === tab));

  async function confirmCancel() {
    if (!cancelling) return;
    setBusy(true);
    const r = await send(`/bookings/${cancelling.id}/cancel`, "POST", {});
    setBusy(false);
    if (!r.ok) return showToast({ type: "error", title: r.error });
    showToast({ type: "success", title: "Booking cancelled" });
    setCancelling(null);
    reload();
  }

  return (
    <div>
      <h1 className="h1">My bookings</h1>
      <p className="sub">Track, pay for or cancel your bookings.</p>
      <Tabs tabs={TABS} activeTab={tab} onChange={setTab} variant="pills" style={{ marginTop: 16 }} />

      <div style={{ display: "grid", gap: 12, marginTop: 16 }}>
        {loading ? (
          <Skeleton variant="card" count={2} />
        ) : error ? (
          <EmptyState title="Could not load your bookings" description={error} action={{ label: "Try again", onClick: reload }} />
        ) : shown.length === 0 ? (
          <EmptyState
            title={tab === "active" ? "No active bookings" : tab === "done" ? "No completed bookings yet" : "No cancelled bookings"}
            description={tab === "active" ? "Book a stylist to your home or at a salon." : undefined}
            action={tab === "active" ? { label: "Book a service", onClick: () => router.push("/booking") } : undefined}
          />
        ) : (
          shown.map((b) => (
            <div key={b.id} className="card" style={{ padding: 16 }}>
              <BookingHeader b={b} names={names} who={b.providerName || "Waiting for a provider"} />
              {b.status === "requested" && (b.counterOffers?.length ?? 0) > 0 && (
                <p style={{ marginTop: 8 }}>
                  {b.counterOffers![0].providerName} offered {formatNpr(b.counterOffers![0].amount)}. <Link href="/client/offers">Review</Link>
                </p>
              )}
              {b.status === "cancelled" && b.cancelReason && <p className="mut" style={{ marginTop: 8 }}>Reason: {b.cancelReason}</p>}
              <div className="row" style={{ gap: 8, marginTop: 12, flexWrap: "wrap" }}>
                {b.providerId && LIVE_STATUSES.includes(b.status) && (
                  <Link className="btn btn-primary btn-sm" href={`/track/${b.id}`}>Track live</Link>
                )}
                {["accepted", "on_the_way", "arrived", "in_progress", "done"].includes(b.status) && b.payStatus !== "paid" && (
                  <Link className="btn btn-outline btn-sm" href={`/checkout/${b.id}`}>{b.payStatus === "cash_due" ? "Change payment" : "Pay"}</Link>
                )}
                {b.status === "done" && <Link className="btn btn-outline btn-sm" href={`/track/${b.id}`}>Review</Link>}
                {b.providerId && b.status !== "cancelled" && <Link className="btn btn-outline btn-sm" href={`/client/messages?booking=${b.id}`}>Message</Link>}
                {["requested", "accepted"].includes(b.status) && (
                  <button className="btn btn-outline btn-sm" onClick={() => setCancelling(b)}>Cancel</button>
                )}
              </div>
            </div>
          ))
        )}
      </div>

      <ConfirmDialog
        open={cancelling !== null}
        onClose={() => setCancelling(null)}
        onConfirm={confirmCancel}
        title="Cancel this booking?"
        message="You can cancel for free until your stylist is on the way. Any wallet payment is refunded."
        confirmLabel="Cancel booking"
        cancelLabel="Keep it"
        variant="danger"
        loading={busy}
      />
    </div>
  );
}
