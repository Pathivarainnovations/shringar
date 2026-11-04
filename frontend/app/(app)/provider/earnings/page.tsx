"use client";

import { useApi } from "@/lib/hooks";
import { formatNpr } from "@/lib/pricing";
import { EmptyState, Skeleton, StatCard, StatusBadge } from "@/components/app-shell";

interface Earnings {
  ledger: { bookings: number; gross: number; commission: number; earning: number; unpaid: number };
  bookings: { id: string; completedAt: string; total: number; commission: number; earning: number; payStatus: string; paidMethod: string | null }[];
}

export default function ProviderEarningsPage() {
  const { data, error, loading, reload } = useApi<Earnings>("/provider/earnings");
  return (
    <div>
      <h1 className="h1">Earnings</h1>
      <p className="sub">Completed bookings, the platform commission and what you keep.</p>
      {loading ? (
        <Skeleton variant="card" count={2} />
      ) : error || !data ? (
        <EmptyState title="Could not load earnings" description={error ?? undefined} action={{ label: "Try again", onClick: reload }} />
      ) : (
        <>
          <div className="grid3" style={{ marginTop: 24 }}>
            <StatCard label="You keep" value={formatNpr(data.ledger.earning)} />
            <StatCard label="Commission" value={formatNpr(data.ledger.commission)} />
            <StatCard label="Total billed" value={formatNpr(data.ledger.gross)} />
          </div>
          <section className="card" style={{ marginTop: 16 }}>
            <h3>Completed bookings</h3>
            {data.bookings.length === 0 ? (
              <EmptyState title="No earnings yet" description="Earnings appear here when you complete a booking." />
            ) : (
              <div style={{ overflowX: "auto" }}>
                <table className="tbl" style={{ width: "100%" }}>
                  <thead><tr><th align="left">Booking</th><th align="left">Date</th><th align="right">Total</th><th align="right">Commission</th><th align="right">You keep</th><th align="left">Payment</th></tr></thead>
                  <tbody>
                    {data.bookings.map((b) => (
                      <tr key={b.id}>
                        <td>{b.id}</td>
                        <td>{new Date(b.completedAt).toLocaleDateString()}</td>
                        <td align="right">{formatNpr(b.total)}</td>
                        <td align="right">{formatNpr(b.commission)}</td>
                        <td align="right"><b>{formatNpr(b.earning)}</b></td>
                        <td><StatusBadge status={b.payStatus} size="sm" /> {b.paidMethod ?? ""}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        </>
      )}
    </div>
  );
}
