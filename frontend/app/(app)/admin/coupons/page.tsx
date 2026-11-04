"use client";

import { useState } from "react";
import { send } from "@/lib/api";
import { useApi } from "@/lib/hooks";
import { formatNpr } from "@/lib/pricing";
import { EmptyState, Skeleton, StatusBadge, useToast } from "@/components/app-shell";

interface Coupon {
  code: string;
  percent: number;
  min: number;
  active: number;
  used_count: number;
}

export default function AdminCouponsPage() {
  const { showToast } = useToast();
  const { data, error, loading, reload } = useApi<{ coupons: Coupon[] }>("/admin/coupons");
  const [form, setForm] = useState({ code: "", percent: "10", min: "" });

  async function create(e: React.FormEvent) {
    e.preventDefault();
    const r = await send("/admin/coupons", "POST", { code: form.code, percent: Number(form.percent), min: form.min === "" ? 0 : Number(form.min) });
    if (!r.ok) return showToast({ type: "error", title: r.error });
    showToast({ type: "success", title: "Coupon created" });
    setForm({ code: "", percent: "10", min: "" });
    reload();
  }
  async function toggle(c: Coupon) {
    const r = await send(`/admin/coupons/${encodeURIComponent(c.code)}`, "PATCH", { active: !c.active });
    if (!r.ok) return showToast({ type: "error", title: r.error });
    reload();
  }
  async function remove(c: Coupon) {
    if (!window.confirm(`Delete coupon ${c.code}?`)) return;
    const r = await send(`/admin/coupons/${encodeURIComponent(c.code)}`, "DELETE");
    if (!r.ok) return showToast({ type: "error", title: r.error });
    reload();
  }

  return (
    <div>
      <h1 className="h1">Coupons &amp; campaigns</h1>
      <p className="sub">Platform-wide discount codes. Providers manage their own codes under Promotions.</p>
      <div className="grid2" style={{ marginTop: 16, alignItems: "start" }}>
        <section className="card">
          <h3>Coupons</h3>
          {loading ? <Skeleton variant="text" count={3} /> : error ? (
            <EmptyState title="Could not load coupons" description={error} action={{ label: "Try again", onClick: reload }} />
          ) : (data?.coupons.length ?? 0) === 0 ? (
            <EmptyState title="No coupons yet" description="Create a code customers can use at booking." />
          ) : (
            <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "grid", gap: 8 }}>
              {data!.coupons.map((c) => (
                <li key={c.code} className="card" style={{ padding: 12, opacity: c.active ? 1 : 0.6 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", gap: 8, flexWrap: "wrap" }}>
                    <b>{c.code} • {c.percent}% off</b>
                    <StatusBadge status={c.active ? "active" : "unpaid"} size="sm" />
                  </div>
                  <div className="mut" style={{ fontSize: "0.8125rem" }}>{c.min > 0 ? `Min ${formatNpr(c.min)} • ` : ""}Used {c.used_count} time{c.used_count === 1 ? "" : "s"}</div>
                  <div className="row" style={{ gap: 8, marginTop: 8 }}>
                    <button className="btn btn-outline btn-sm" onClick={() => toggle(c)}>{c.active ? "Deactivate" : "Activate"}</button>
                    <button className="btn btn-outline btn-sm" onClick={() => remove(c)}>Delete</button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>
        <form className="card" onSubmit={create}>
          <h3>New coupon</h3>
          <div className="fld"><label htmlFor="cp-code">Code</label><input id="cp-code" value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value.toUpperCase() })} placeholder="e.g. SPRING10" maxLength={40} required /></div>
          <div className="fld"><label htmlFor="cp-pct">Discount (%)</label><input id="cp-pct" inputMode="numeric" value={form.percent} onChange={(e) => setForm({ ...form, percent: e.target.value.replace(/\D/g, "") })} required /></div>
          <div className="fld"><label htmlFor="cp-min">Minimum services total (NPR, optional)</label><input id="cp-min" inputMode="numeric" value={form.min} onChange={(e) => setForm({ ...form, min: e.target.value.replace(/\D/g, "") })} /></div>
          <button className="btn btn-primary" type="submit" disabled={!form.code || !form.percent}>Create coupon</button>
        </form>
      </div>
    </div>
  );
}
