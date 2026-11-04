"use client";

import { useRouter } from "next/navigation";
import { useApi } from "@/lib/hooks";
import { formatNpr } from "@/lib/pricing";
import { EmptyState, Skeleton, StatCard } from "@/components/app-shell";

interface Stats {
  users: { total: number; byRole: { customer: number; provider: number; admin: number } };
  providers: { total: number; active: number; suspended: number; pendingApplications: number };
  bookings: { total: number; byStatus: Record<string, number>; today: number };
  revenue: { gross: number; commission: number; providerEarnings: number; completedBookings: number };
  openDisputes: number;
  activeSos: number;
}

export default function AdminHome() {
  const router = useRouter();
  const { data, error, loading, reload } = useApi<{ stats: Stats }>("/admin/stats", 30000);

  if (loading) {
    return (
      <div>
        <h1 className="h1">Admin overview</h1>
        <Skeleton variant="card" count={2} />
      </div>
    );
  }
  if (error || !data) {
    return (
      <div>
        <h1 className="h1">Admin overview</h1>
        <EmptyState title="Could not load statistics" description={error ?? undefined} action={{ label: "Try again", onClick: reload }} />
      </div>
    );
  }
  const s = data.stats;
  const open = (s.bookings.byStatus.requested ?? 0) + (s.bookings.byStatus.accepted ?? 0) + (s.bookings.byStatus.on_the_way ?? 0) + (s.bookings.byStatus.arrived ?? 0) + (s.bookings.byStatus.in_progress ?? 0);

  return (
    <div>
      <h1 className="h1">Admin overview</h1>
      <p className="sub">Live figures from the database.</p>

      {(s.activeSos > 0 || s.providers.pendingApplications > 0 || s.openDisputes > 0) && (
        <section className="card" style={{ marginTop: 16, display: "flex", gap: 16, flexWrap: "wrap" }}>
          {s.activeSos > 0 && <button className="btn btn-danger btn-sm" onClick={() => router.push("/admin/live-map")}>{s.activeSos} active SOS alert{s.activeSos === 1 ? "" : "s"}</button>}
          {s.providers.pendingApplications > 0 && <button className="btn btn-outline btn-sm" onClick={() => router.push("/admin/providers")}>{s.providers.pendingApplications} provider application{s.providers.pendingApplications === 1 ? "" : "s"} to review</button>}
          {s.openDisputes > 0 && <button className="btn btn-outline btn-sm" onClick={() => router.push("/admin/disputes")}>{s.openDisputes} open dispute{s.openDisputes === 1 ? "" : "s"}</button>}
        </section>
      )}

      <div className="grid3" style={{ marginTop: 24 }}>
        <StatCard label="Total users" value={String(s.users.total)} trend={{ value: `${s.users.byRole.customer} customers • ${s.users.byRole.provider} providers • ${s.users.byRole.admin} admins`, positive: true }} />
        <StatCard label="Providers" value={String(s.providers.total)} trend={{ value: `${s.providers.active} active • ${s.providers.suspended} suspended`, positive: true }} />
        <StatCard label="Bookings" value={String(s.bookings.total)} trend={{ value: `${s.bookings.today} today • ${open} open`, positive: true }} />
        <StatCard label="Completed bookings" value={String(s.revenue.completedBookings)} />
        <StatCard label="Total billed" value={formatNpr(s.revenue.gross)} />
        <StatCard label="Platform commission" value={formatNpr(s.revenue.commission)} />
      </div>

      <section className="card" style={{ marginTop: 24 }}>
        <h3>Bookings by status</h3>
        {s.bookings.total === 0 ? (
          <EmptyState title="No bookings yet" description="Bookings appear here as customers make them." />
        ) : (
          <div style={{ display: "flex", gap: 16, flexWrap: "wrap" }}>
            {Object.entries(s.bookings.byStatus).map(([k, v]) => (
              <div key={k}><b>{v}</b> <span className="mut">{k.replace(/_/g, " ")}</span></div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
