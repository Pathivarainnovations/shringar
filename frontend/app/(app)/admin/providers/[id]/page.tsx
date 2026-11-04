"use client";

import { useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { send } from "@/lib/api";
import { useApi } from "@/lib/hooks";
import { formatNpr } from "@/lib/pricing";
import type { Booking } from "@/lib/types";
import { BookingHeader } from "@/components/BookingBits";
import { EmptyState, Skeleton, StatCard, StatusBadge, Tabs, useToast } from "@/components/app-shell";

const TABS = [
  { id: "details", label: "Details" },
  { id: "services", label: "Services" },
  { id: "bookings", label: "Bookings" },
  { id: "commission", label: "Commission" },
] as const;

interface Ledger { bookings: number; gross: number; commission: number; earning: number; cashCommission: number; walletEarning: number; settled: number; balance: number; unpaid: number }
interface ProviderDetail {
  provider: Record<string, any> & { ledger: Ledger; rating: number | null; review_count: number };
  services: { id: number; name: string; price: number; is_active: number }[];
}

export default function AdminProviderDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { showToast } = useToast();
  const detail = useApi<ProviderDetail>(id ? `/admin/providers/${encodeURIComponent(id)}` : null);
  const bookings = useApi<{ bookings: Booking[] }>(id ? `/admin/bookings?providerId=${encodeURIComponent(id)}` : null);
  const [tab, setTab] = useState("details");
  const [busy, setBusy] = useState(false);

  async function act(action: "approve" | "suspend") {
    setBusy(true);
    const r = await send(`/admin/providers/${id}`, "PATCH", { action });
    setBusy(false);
    if (!r.ok) return showToast({ type: "error", title: r.error });
    showToast({ type: "success", title: action === "approve" ? "Provider approved" : "Provider suspended" });
    detail.reload();
  }

  if (detail.loading) {
    return (
      <div>
        <h1 className="h1">Provider details</h1>
        <Skeleton variant="card" count={2} />
      </div>
    );
  }
  const p = detail.data?.provider;
  if (!p) {
    return (
      <div>
        <h1 className="h1">Provider not found</h1>
        <EmptyState title="We could not find this provider" description={detail.error ?? undefined} action={{ label: "Back to providers", onClick: () => router.push("/admin/providers") }} />
      </div>
    );
  }
  const l = p.ledger;
  const list = bookings.data?.bookings ?? [];

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
        <div>
          <h1 className="h1">{p.name}</h1>
          <p className="sub">{p.type === "salon" ? "Salon" : "Freelancer"} • {p.service} • {p.area}</p>
        </div>
        <div className="row" style={{ gap: 8, alignItems: "center" }}>
          <StatusBadge status={p.verified ? "verified" : "unverified"} size="lg" />
          {p.verified ? (
            <button className="btn btn-outline btn-sm" onClick={() => window.confirm(`Suspend ${p.name}? They will not be able to accept new bookings.`) && act("suspend")} disabled={busy}>Suspend</button>
          ) : (
            <button className="btn btn-primary btn-sm" onClick={() => act("approve")} disabled={busy}>Reactivate</button>
          )}
          <button className="btn btn-outline btn-sm" onClick={() => router.push("/admin/providers")}>Back</button>
        </div>
      </div>

      <div className="grid3" style={{ marginTop: 24 }}>
        <StatCard label="Completed bookings" value={String(l.bookings)} />
        <StatCard label="Provider earned" value={formatNpr(l.earning)} />
        <StatCard label={l.balance > 0 ? "Owes the platform" : l.balance < 0 ? "Platform owes provider" : "Settled"} value={formatNpr(Math.abs(l.balance))} />
      </div>

      <Tabs tabs={TABS} activeTab={tab} onChange={setTab} style={{ marginTop: 24 }} />

      {tab === "details" && (
        <section className="card" style={{ marginTop: 16 }}>
          <h3>Provider information</h3>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 16 }}>
            {([
              ["ID", p.id], ["Account", p.user_email ?? "—"], ["Phone", p.phone ?? "Not provided"], ["Address", p.address || "Not provided"],
              ["Travel radius", `${p.travel_radius} km`], ["Travel fee", formatNpr(p.travel_fee)],
              ["Rating", p.rating !== null ? `★ ${p.rating} (${p.review_count})` : "No reviews yet"], ["Verification note", p.verification_data ?? "—"],
            ] as [string, string][]).map(([k, v]) => (
              <div key={k} className="fld"><label>{k}</label><span>{v}</span></div>
            ))}
          </div>
        </section>
      )}

      {tab === "services" && (
        <section className="card" style={{ marginTop: 16 }}>
          <h3>Services &amp; prices</h3>
          {(detail.data?.services.length ?? 0) === 0 ? (
            <EmptyState title="No prices set" description="The provider has not priced any services yet, so they cannot accept bookings." />
          ) : (
            <table className="tbl" style={{ width: "100%" }}>
              <thead><tr><th align="left">Service</th><th align="right">Price</th><th align="left">Status</th></tr></thead>
              <tbody>{detail.data!.services.map((s) => <tr key={s.id}><td>{s.name}</td><td align="right">{formatNpr(s.price)}</td><td>{s.is_active ? "Offered" : "Paused"}</td></tr>)}</tbody>
            </table>
          )}
        </section>
      )}

      {tab === "bookings" && (
        <section className="card" style={{ marginTop: 16 }}>
          <h3>Bookings ({list.length})</h3>
          {bookings.loading ? <Skeleton variant="text" count={3} /> : list.length === 0 ? (
            <EmptyState title="No bookings" description="Bookings for this provider will appear here." />
          ) : (
            <div style={{ display: "grid", gap: 8 }}>
              {list.map((b) => (
                <div key={b.id} className="card" style={{ padding: 12 }}>
                  <BookingHeader b={b} who={b.customerName} />
                </div>
              ))}
            </div>
          )}
        </section>
      )}

      {tab === "commission" && (
        <section className="card" style={{ marginTop: 16 }}>
          <h3>Commission</h3>
          <div className="grid3" style={{ marginBottom: 16 }}>
            <StatCard label="Commission earned" value={formatNpr(l.commission)} />
            <StatCard label="Settled so far" value={formatNpr(l.settled)} />
            <StatCard label="Billed but unpaid" value={formatNpr(l.unpaid)} />
          </div>
          <p className="mut">Record payments between the platform and this provider on the <Link href="/admin/commission">Commission Settlement</Link> page.</p>
        </section>
      )}
    </div>
  );
}
