"use client";

import { useApi } from "@/lib/hooks";
import { formatNpr } from "@/lib/pricing";
import { EmptyState, Skeleton, StatCard } from "@/components/app-shell";

interface Payouts {
  ledger: { cashCommission: number; walletEarning: number; settled: number; balance: number };
  owes: "provider" | "platform" | "none";
  settlements: { id: string; amount: number; direction: string; note: string | null; createdAt: string }[];
}

export default function ProviderPayoutsPage() {
  const { data, error, loading, reload } = useApi<Payouts>("/provider/payouts");
  return (
    <div>
      <h1 className="h1">Payouts</h1>
      <p className="sub">Cash bookings: you collect the money and owe the platform its commission. Wallet bookings: the platform holds the money and owes you your share.</p>
      {loading ? (
        <Skeleton variant="card" count={2} />
      ) : error || !data ? (
        <EmptyState title="Could not load payouts" description={error ?? undefined} action={{ label: "Try again", onClick: reload }} />
      ) : (
        <>
          <div className="grid3" style={{ marginTop: 24 }}>
            <StatCard label="Commission on cash bookings" value={formatNpr(data.ledger.cashCommission)} />
            <StatCard label="Owed to you (wallet bookings)" value={formatNpr(data.ledger.walletEarning)} />
            <StatCard
              label={data.owes === "provider" ? "You owe the platform" : data.owes === "platform" ? "The platform owes you" : "Balance"}
              value={formatNpr(Math.abs(data.ledger.balance))}
            />
          </div>
          <section className="card" style={{ marginTop: 16 }}>
            <h3>Settlement history</h3>
            {data.settlements.length === 0 ? (
              <EmptyState title="No settlements yet" description="When support records a payment between you and the platform, it appears here." />
            ) : (
              <ul style={{ listStyle: "none", padding: 0, margin: 0 }}>
                {data.settlements.map((s) => (
                  <li key={s.id} className="r" style={{ justifyContent: "space-between", padding: "8px 0", borderBottom: "1px solid var(--line)" }}>
                    <span>{new Date(s.createdAt).toLocaleDateString()} • {s.direction === "you_paid_platform" ? "You paid the platform" : "Platform paid you"}{s.note ? ` • ${s.note}` : ""}</span>
                    <b>{formatNpr(s.amount)}</b>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </>
      )}
    </div>
  );
}
