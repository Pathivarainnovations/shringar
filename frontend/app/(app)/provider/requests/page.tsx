"use client";

import { useState } from "react";
import Link from "next/link";
import { send } from "@/lib/api";
import { useApi } from "@/lib/hooks";
import { formatNpr } from "@/lib/pricing";
import type { Booking } from "@/lib/types";
import { EmptyState, Skeleton, StatusBadge, Tabs, useToast } from "@/components/app-shell";
import { BookingHeader, LIVE_STATUSES } from "@/components/BookingBits";
import LocationSender from "@/components/LocationSender";

const TABS = [
  { id: "new", label: "New requests" },
  { id: "active", label: "Active" },
  { id: "done", label: "Completed" },
] as const;

const NEXT_ACTION: Record<string, { to: string; label: string; salonLabel?: string }> = {
  accepted: { to: "on_the_way", label: "Start trip", salonLabel: "Customer arrived" },
  on_the_way: { to: "arrived", label: "I have arrived" },
  arrived: { to: "in_progress", label: "Start service" },
  in_progress: { to: "done", label: "Mark done" },
};

export default function ProviderRequestsPage() {
  const { showToast } = useToast();
  const reqs = useApi<{ requests: Booking[] }>("/provider/requests", 10000);
  const mine = useApi<{ bookings: Booking[] }>("/provider/bookings", 10000);
  const staff = useApi<{ staff: { id: string; name: string; active: boolean }[] }>("/provider/staff");
  const [tab, setTab] = useState<string>("new");
  const [busy, setBusy] = useState<string | null>(null);
  const [counter, setCounter] = useState<Record<string, string>>({});
  const [staffPick, setStaffPick] = useState<Record<string, string>>({});

  const reload = () => {
    reqs.reload();
    mine.reload();
  };
  async function act(id: string, path: string, body: unknown, ok: string) {
    setBusy(id);
    const r = await send(`/bookings/${id}/${path}`, "POST", body);
    setBusy(null);
    if (!r.ok) return showToast({ type: "error", title: r.error });
    showToast({ type: "success", title: ok });
    reload();
  }

  const all = mine.data?.bookings ?? [];
  const active = all.filter((b) => ["accepted", "on_the_way", "arrived", "in_progress"].includes(b.status));
  const done = all.filter((b) => b.status === "done");
  const requests = reqs.data?.requests ?? [];

  return (
    <div>
      <h1 className="h1">Requests &amp; bookings</h1>
      <p className="sub">Accept, counter or decline requests, then run your bookings from start to finish.</p>
      <Tabs
        tabs={TABS.map((t) => ({ ...t, label: t.id === "new" ? `New requests (${requests.length})` : t.id === "active" ? `Active (${active.length})` : t.label }))}
        activeTab={tab}
        onChange={setTab}
        variant="pills"
        style={{ marginTop: 16 }}
      />

      <div style={{ display: "grid", gap: 12, marginTop: 16 }}>
        {(reqs.loading || mine.loading) && <Skeleton variant="card" count={2} />}

        {tab === "new" && !reqs.loading && (reqs.error ? (
          <EmptyState title="Could not load requests" description={reqs.error} action={{ label: "Try again", onClick: reqs.reload }} />
        ) : requests.length === 0 ? (
          <EmptyState title="No new requests" description="Requests from customers in your area appear here." />
        ) : (
          requests.map((b) => (
            <div key={b.id} className="card" style={{ padding: 16 }}>
              <BookingHeader b={b} who={b.customerName} />
              <p className="mut" style={{ marginTop: 8 }}>{b.address}</p>
              <p style={{ marginTop: 4 }}>
                {b.offerAmount ? <>Customer offers <b>{formatNpr(b.offerAmount)}</b>. </> : null}
                {b.yourPrice !== null && b.yourPrice !== undefined ? <>You would earn from <b>{formatNpr(b.yourPrice)}</b>.</> : <>You have not priced: <b>{b.missingPrices?.join(", ")}</b>. <Link href="/provider/services">Add prices</Link> to respond.</>}
                {b.myCounter ? <> Your counter-offer: <b>{formatNpr(b.myCounter)}</b> (waiting).</> : null}
              </p>
              {b.yourPrice !== null && b.yourPrice !== undefined && (
                <div className="row" style={{ gap: 8, marginTop: 12, flexWrap: "wrap", alignItems: "center" }}>
                  {(staff.data?.staff.length ?? 0) > 0 && (
                    <select aria-label="Assign staff" value={staffPick[b.id] ?? ""} onChange={(e) => setStaffPick({ ...staffPick, [b.id]: e.target.value })}>
                      <option value="">No specific staff</option>
                      {staff.data!.staff.filter((s) => s.active).map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
                    </select>
                  )}
                  <button className="btn btn-primary btn-sm" disabled={busy === b.id} onClick={() => act(b.id, "accept", { staffId: staffPick[b.id] || undefined }, "Booking accepted")}>Accept</button>
                  <input aria-label="Counter-offer amount" inputMode="numeric" placeholder="Counter (NPR)" value={counter[b.id] ?? ""} onChange={(e) => setCounter({ ...counter, [b.id]: e.target.value.replace(/\D/g, "") })} style={{ width: 130 }} />
                  <button className="btn btn-outline btn-sm" disabled={busy === b.id || !counter[b.id]} onClick={() => act(b.id, "counter", { amount: Number(counter[b.id]) }, "Counter-offer sent")}>Counter</button>
                  <button className="btn btn-outline btn-sm" disabled={busy === b.id} onClick={() => act(b.id, "reject", {}, "Request declined")}>Decline</button>
                </div>
              )}
            </div>
          ))
        ))}

        {tab === "active" && !mine.loading && (active.length === 0 ? (
          <EmptyState title="No active bookings" description="Accepted bookings you still need to complete show up here." />
        ) : (
          active.map((b) => {
            const next = NEXT_ACTION[b.status];
            const label = b.mode === "salon" && next?.salonLabel ? next.salonLabel : next?.label;
            const to = b.mode === "salon" && b.status === "accepted" ? "arrived" : next?.to;
            return (
              <div key={b.id} className="card" style={{ padding: 16 }}>
                <BookingHeader b={b} who={b.customerName} />
                <p className="mut" style={{ marginTop: 8 }}>{b.address}</p>
                <div className="row" style={{ gap: 8, marginTop: 12, flexWrap: "wrap" }}>
                  {next && <button className="btn btn-primary btn-sm" disabled={busy === b.id} onClick={() => act(b.id, "status", { status: to }, label ?? "Updated")}>{label}</button>}
                  <Link className="btn btn-outline btn-sm" href={`/provider/messages?booking=${b.id}`}>Message</Link>
                  {["accepted", "on_the_way"].includes(b.status) && <button className="btn btn-outline btn-sm" disabled={busy === b.id} onClick={() => window.confirm("Cancel this booking?") && act(b.id, "cancel", { reason: "Cancelled by the provider" }, "Booking cancelled")}>Cancel</button>}
                </div>
                {b.mode === "home" && <LocationSender bookingId={b.id} active={LIVE_STATUSES.includes(b.status)} />}
              </div>
            );
          })
        ))}

        {tab === "done" && !mine.loading && (done.length === 0 ? (
          <EmptyState title="No completed bookings yet" />
        ) : (
          done.map((b) => (
            <div key={b.id} className="card" style={{ padding: 16 }}>
              <BookingHeader b={b} who={b.customerName} />
              <p className="mut" style={{ marginTop: 8 }}>
                You earn {formatNpr(b.providerEarning ?? 0)} • commission {formatNpr(b.commissionAmount ?? 0)} • <StatusBadge status={b.payStatus} size="sm" /> {b.paidMethod ? `(${b.paidMethod})` : ""}
              </p>
              {b.payStatus !== "paid" && (
                <button className="btn btn-primary btn-sm" style={{ marginTop: 12 }} disabled={busy === b.id} onClick={() => act(b.id, "cash-received", {}, "Cash payment recorded")}>Cash received</button>
              )}
            </div>
          ))
        ))}
      </div>
    </div>
  );
}
