"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useApi } from "@/lib/hooks";
import { formatNpr } from "@/lib/pricing";
import { EmptyState, Skeleton, StatCard } from "@/components/app-shell";

interface Dashboard {
  verified: boolean;
  pendingRequests: number;
  activeBookings: number;
  completedBookings: number;
  earningsToday: number;
  earningsMonth: number;
  earningsTotal: number;
  unpaidAmount: number;
  rating: number | null;
  reviewCount: number;
  servicesWithPrice: number;
}

export default function ProviderHome() {
  const router = useRouter();
  const { data: d, error, loading, reload } = useApi<Dashboard>("/provider/dashboard", 30000);

  if (loading) {
    return (
      <div>
        <h1 className="h1">Provider dashboard</h1>
        <Skeleton variant="card" count={2} />
      </div>
    );
  }
  if (error || !d) {
    return (
      <div>
        <h1 className="h1">Provider dashboard</h1>
        <EmptyState title="Could not load your dashboard" description={error ?? undefined} action={{ label: "Try again", onClick: reload }} />
      </div>
    );
  }

  return (
    <div>
      <h1 className="h1">Provider dashboard</h1>
      <p className="sub">Your requests, bookings and earnings.</p>

      {!d.verified && (
        <section className="card" style={{ marginTop: 16, borderColor: "var(--rose)" }}>
          <b>Your account is suspended.</b> <span className="mut">You cannot accept new bookings until support reactivates it.</span>
        </section>
      )}
      {d.verified && d.servicesWithPrice === 0 && (
        <section className="card" style={{ marginTop: 16 }}>
          <b>Set your prices to start accepting bookings.</b>{" "}
          <Link href="/provider/services">Go to Services &amp; Prices</Link>
        </section>
      )}

      <div className="grid3" style={{ marginTop: 24 }}>
        <StatCard label="New requests" value={String(d.pendingRequests)} />
        <StatCard label="Active bookings" value={String(d.activeBookings)} />
        <StatCard label="Completed" value={String(d.completedBookings)} />
        <StatCard label="Earned today" value={formatNpr(d.earningsToday)} />
        <StatCard label="Earned this month" value={formatNpr(d.earningsMonth)} />
        <StatCard label="Rating" value={d.rating !== null ? `★ ${d.rating} (${d.reviewCount})` : "No reviews yet"} />
      </div>

      {d.unpaidAmount > 0 && (
        <p className="mut" style={{ marginTop: 16 }}>
          {formatNpr(d.unpaidAmount)} from completed bookings is not marked as paid yet. Record cash payments under Requests → Completed.
        </p>
      )}
      <p style={{ marginTop: 16 }}>
        <button className="btn btn-primary" onClick={() => router.push("/provider/requests")}>Open requests</button>
      </p>
    </div>
  );
}
