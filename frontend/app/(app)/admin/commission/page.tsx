"use client";

import { useState } from "react";
import { send } from "@/lib/api";
import { useApi } from "@/lib/hooks";
import { formatNpr } from "@/lib/pricing";
import { EmptyState, Skeleton, StatCard, useToast } from "@/components/app-shell";

interface Row {
  id: string;
  name: string;
  verified: number;
  bookings: number;
  gross: number;
  commission: number;
  cashCommission: number;
  walletEarning: number;
  settled: number;
  balance: number;
}
interface Data {
  rate: number;
  totals: { gross: number; commission: number; cashCommission: number; walletEarning: number; settled: number; balance: number };
  providers: Row[];
}

export default function AdminCommissionPage() {
  const { showToast } = useToast();
  const { data, error, loading, reload } = useApi<Data>("/admin/commission");
  const history = useApi<{ settlements: { id: string; provider_name: string; amount: number; note: string | null; created_at: string }[] }>("/admin/settlements");
  const [amounts, setAmounts] = useState<Record<string, string>>({});

  async function settle(p: Row) {
    const direction = p.balance > 0 ? "provider_paid" : "platform_paid";
    const amount = Number(amounts[p.id] ?? Math.abs(p.balance));
    const who = direction === "provider_paid" ? `${p.name} paid the platform` : `the platform paid ${p.name}`;
    if (!window.confirm(`Record that ${who} ${formatNpr(amount)}?`)) return;
    const r = await send("/admin/settlements", "POST", { providerId: p.id, direction, amount });
    if (!r.ok) return showToast({ type: "error", title: r.error });
    showToast({ type: "success", title: "Settlement recorded" });
    setAmounts({ ...amounts, [p.id]: "" });
    reload();
    history.reload();
  }

  return (
    <div>
      <h1 className="h1">Commission settlement</h1>
      <p className="sub">
        Commission rate {data ? `${data.rate}%` : ""} (change it under Settings). On cash bookings the provider owes the platform; on wallet bookings the platform owes the provider.
      </p>
      {loading ? <Skeleton variant="card" count={2} /> : error || !data ? (
        <EmptyState title="Could not load commission data" description={error ?? undefined} action={{ label: "Try again", onClick: reload }} />
      ) : (
        <>
          <div className="grid3" style={{ marginTop: 24 }}>
            <StatCard label="Commission earned" value={formatNpr(data.totals.commission)} />
            <StatCard label="Settled so far" value={formatNpr(data.totals.settled)} />
            <StatCard label="Net outstanding" value={formatNpr(data.totals.balance)} />
          </div>
          <section className="card" style={{ marginTop: 16 }}>
            <h3>Providers</h3>
            {data.providers.length === 0 ? (
              <EmptyState title="Nothing to settle" description="Completed bookings and settlements appear here." />
            ) : (
              <div style={{ overflowX: "auto" }}>
                <table className="tbl" style={{ width: "100%" }}>
                  <thead><tr><th align="left">Provider</th><th align="right">Bookings</th><th align="right">Commission</th><th align="right">Owes platform (cash)</th><th align="right">Platform owes (wallet)</th><th align="right">Settled</th><th align="right">Balance</th><th /></tr></thead>
                  <tbody>
                    {data.providers.map((p) => (
                      <tr key={p.id}>
                        <td>{p.name}</td><td align="right">{p.bookings}</td><td align="right">{formatNpr(p.commission)}</td>
                        <td align="right">{formatNpr(p.cashCommission)}</td><td align="right">{formatNpr(p.walletEarning)}</td><td align="right">{formatNpr(p.settled)}</td>
                        <td align="right"><b>{p.balance > 0 ? `${formatNpr(p.balance)} due from provider` : p.balance < 0 ? `${formatNpr(-p.balance)} due to provider` : "Settled"}</b></td>
                        <td style={{ whiteSpace: "nowrap" }}>
                          {p.balance !== 0 && (
                            <>
                              <input aria-label={`Amount for ${p.name}`} inputMode="numeric" style={{ width: 100 }} placeholder={String(Math.abs(p.balance))} value={amounts[p.id] ?? ""} onChange={(e) => setAmounts({ ...amounts, [p.id]: e.target.value.replace(/\D/g, "") })} />{" "}
                              <button className="btn btn-primary btn-sm" onClick={() => settle(p)}>Record</button>
                            </>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
          <section className="card" style={{ marginTop: 16 }}>
            <h3>Settlement history</h3>
            {(history.data?.settlements.length ?? 0) === 0 ? (
              <EmptyState title="No settlements recorded" />
            ) : (
              <ul style={{ listStyle: "none", padding: 0, margin: 0 }}>
                {history.data!.settlements.map((s) => (
                  <li key={s.id} className="r" style={{ justifyContent: "space-between", padding: "6px 0", borderBottom: "1px solid var(--line)" }}>
                    <span>{new Date(s.created_at).toLocaleDateString()} • {s.provider_name} • {s.amount > 0 ? "paid the platform" : "was paid by the platform"}{s.note ? ` • ${s.note}` : ""}</span>
                    <b>{formatNpr(Math.abs(s.amount))}</b>
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
