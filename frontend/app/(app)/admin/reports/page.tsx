"use client";

import { useState } from "react";
import { useApi } from "@/lib/hooks";
import { formatNpr } from "@/lib/pricing";
import { EmptyState, Skeleton, StatCard } from "@/components/app-shell";

interface Report {
  days: number;
  series: { date: string; bookings: number; completed: number; gross: number; commission: number }[];
  topProviders: { id: string; name: string; completed: number; gross: number }[];
  topServices: { id: number; name: string; bookings: number }[];
}

export default function AdminReportsPage() {
  const [days, setDays] = useState(30);
  const { data, error, loading, reload } = useApi<Report>(`/admin/reports?days=${days}`);
  const total = (k: "bookings" | "completed" | "gross" | "commission") => (data?.series ?? []).reduce((n, d) => n + d[k], 0);

  return (
    <div>
      <h1 className="h1">Reports</h1>
      <p className="sub">Bookings, revenue and top performers for the selected period.</p>
      <div className="fld" style={{ maxWidth: 200, marginTop: 16 }}>
        <label htmlFor="rp-days">Period</label>
        <select id="rp-days" value={days} onChange={(e) => setDays(Number(e.target.value))}>
          <option value={7}>Last 7 days</option>
          <option value={30}>Last 30 days</option>
          <option value={90}>Last 90 days</option>
        </select>
      </div>
      {loading ? <Skeleton variant="card" count={2} /> : error || !data ? (
        <EmptyState title="Could not load the report" description={error ?? undefined} action={{ label: "Try again", onClick: reload }} />
      ) : (
        <>
          <div className="grid3" style={{ marginTop: 16 }}>
            <StatCard label="Bookings made" value={String(total("bookings"))} />
            <StatCard label="Completed" value={String(total("completed"))} />
            <StatCard label="Billed" value={formatNpr(total("gross"))} />
            <StatCard label="Commission" value={formatNpr(total("commission"))} />
          </div>
          <div className="grid2" style={{ marginTop: 16, alignItems: "start" }}>
            <section className="card">
              <h3>Top providers</h3>
              {data.topProviders.length === 0 ? <EmptyState title="No completed bookings in this period" /> : (
                <table className="tbl" style={{ width: "100%" }}>
                  <thead><tr><th align="left">Provider</th><th align="right">Completed</th><th align="right">Billed</th></tr></thead>
                  <tbody>{data.topProviders.map((p) => <tr key={p.id}><td>{p.name}</td><td align="right">{p.completed}</td><td align="right">{formatNpr(p.gross)}</td></tr>)}</tbody>
                </table>
              )}
            </section>
            <section className="card">
              <h3>Most booked services</h3>
              {data.topServices.length === 0 ? <EmptyState title="No bookings in this period" /> : (
                <table className="tbl" style={{ width: "100%" }}>
                  <thead><tr><th align="left">Service</th><th align="right">Bookings</th></tr></thead>
                  <tbody>{data.topServices.map((s) => <tr key={s.id}><td>{s.name}</td><td align="right">{s.bookings}</td></tr>)}</tbody>
                </table>
              )}
            </section>
          </div>
          <section className="card" style={{ marginTop: 16 }}>
            <h3>Day by day</h3>
            <div style={{ overflowX: "auto", maxHeight: 360 }}>
              <table className="tbl" style={{ width: "100%" }}>
                <thead><tr><th align="left">Date</th><th align="right">Bookings</th><th align="right">Completed</th><th align="right">Billed</th><th align="right">Commission</th></tr></thead>
                <tbody>
                  {[...data.series].reverse().map((d) => (
                    <tr key={d.date}><td>{d.date}</td><td align="right">{d.bookings}</td><td align="right">{d.completed}</td><td align="right">{formatNpr(d.gross)}</td><td align="right">{formatNpr(d.commission)}</td></tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        </>
      )}
    </div>
  );
}
