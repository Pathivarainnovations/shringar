"use client";

import { useState } from "react";
import { send } from "@/lib/api";
import { useApi } from "@/lib/hooks";
import { EmptyState, Skeleton, StatusBadge, useToast } from "@/components/app-shell";

interface Dispute {
  id: string;
  booking_id: string;
  customer_name: string | null;
  provider_name: string | null;
  reason: string;
  status: string;
  resolution: string | null;
  created_at: string;
}

export default function AdminDisputesPage() {
  const { showToast } = useToast();
  const { data, error, loading, reload } = useApi<{ disputes: Dispute[] }>("/admin/disputes", 30000);
  const [notes, setNotes] = useState<Record<string, string>>({});

  async function update(d: Dispute, status: "under_review" | "resolved" | "rejected") {
    const r = await send(`/admin/disputes/${d.id}`, "PATCH", { status, resolution: notes[d.id] ?? "" });
    if (!r.ok) return showToast({ type: "error", title: r.error });
    showToast({ type: "success", title: "Dispute updated" });
    reload();
  }

  return (
    <div>
      <h1 className="h1">Disputes</h1>
      <p className="sub">Problems customers reported on completed bookings.</p>
      <div style={{ display: "grid", gap: 12, marginTop: 16 }}>
        {loading ? <Skeleton variant="card" count={2} /> : error ? (
          <EmptyState title="Could not load disputes" description={error} action={{ label: "Try again", onClick: reload }} />
        ) : (data?.disputes.length ?? 0) === 0 ? (
          <EmptyState title="No disputes" description="Reported problems will appear here." />
        ) : (
          data!.disputes.map((d) => {
            const closed = d.status === "resolved" || d.status === "rejected";
            return (
              <div key={d.id} className="card" style={{ padding: 16 }}>
                <div style={{ display: "flex", justifyContent: "space-between", gap: 8, flexWrap: "wrap" }}>
                  <div><b>{d.booking_id}</b> <span className="mut">{d.customer_name ?? "Customer"} vs {d.provider_name ?? "provider"} • {new Date(d.created_at).toLocaleDateString()}</span></div>
                  <StatusBadge status={d.status} size="sm" />
                </div>
                <p style={{ margin: "8px 0" }}>{d.reason}</p>
                {closed ? (
                  <p className="mut">Resolution: {d.resolution}</p>
                ) : (
                  <>
                    <div className="fld"><label htmlFor={`note-${d.id}`}>Resolution note (sent to the customer)</label><textarea id={`note-${d.id}`} rows={2} value={notes[d.id] ?? ""} onChange={(e) => setNotes({ ...notes, [d.id]: e.target.value })} maxLength={1000} /></div>
                    <div className="row" style={{ gap: 8, flexWrap: "wrap" }}>
                      {d.status === "open" && <button className="btn btn-outline btn-sm" onClick={() => update(d, "under_review")}>Start review</button>}
                      <button className="btn btn-primary btn-sm" onClick={() => update(d, "resolved")} disabled={!(notes[d.id] ?? "").trim()}>Resolve</button>
                      <button className="btn btn-outline btn-sm" onClick={() => update(d, "rejected")} disabled={!(notes[d.id] ?? "").trim()}>Reject</button>
                    </div>
                  </>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
