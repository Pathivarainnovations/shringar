"use client";

import { useState } from "react";
import { send } from "@/lib/api";
import { useApi } from "@/lib/hooks";
import { formatNpr } from "@/lib/pricing";
import { ConfirmDialog, EmptyState, Skeleton, useToast } from "@/components/app-shell";

interface Promo {
  id: string;
  code: string;
  percent: number;
  minAmount: number;
  maxUses: number | null;
  usedCount: number;
  expiresAt: string | null;
  active: boolean;
}

export default function ProviderPromotionsPage() {
  const { showToast } = useToast();
  const { data, error, loading, reload } = useApi<{ promotions: Promo[] }>("/provider/promotions");
  const [form, setForm] = useState({ code: "", percent: "10", minAmount: "", maxUses: "", expiresAt: "" });
  const [deleting, setDeleting] = useState<Promo | null>(null);

  async function create(e: React.FormEvent) {
    e.preventDefault();
    const r = await send("/provider/promotions", "POST", {
      code: form.code,
      percent: Number(form.percent),
      minAmount: form.minAmount === "" ? 0 : Number(form.minAmount),
      maxUses: form.maxUses === "" ? null : Number(form.maxUses),
      expiresAt: form.expiresAt || undefined,
    });
    if (!r.ok) return showToast({ type: "error", title: r.error });
    showToast({ type: "success", title: "Promotion created" });
    setForm({ code: "", percent: "10", minAmount: "", maxUses: "", expiresAt: "" });
    reload();
  }
  async function toggle(p: Promo) {
    const r = await send(`/provider/promotions/${p.id}`, "PATCH", { active: !p.active });
    if (!r.ok) return showToast({ type: "error", title: r.error });
    reload();
  }
  async function remove() {
    if (!deleting) return;
    const r = await send(`/provider/promotions/${deleting.id}`, "DELETE");
    setDeleting(null);
    if (!r.ok) return showToast({ type: "error", title: r.error });
    reload();
  }

  return (
    <div>
      <h1 className="h1">Promotions</h1>
      <p className="sub">Discount codes customers can use when they book you. A code applies when it gives a bigger discount than the first-booking offer.</p>
      <div className="grid2" style={{ marginTop: 16, alignItems: "start" }}>
        <section className="card">
          <h3>Your promotions</h3>
          {loading ? (
            <Skeleton variant="text" count={3} />
          ) : error ? (
            <EmptyState title="Could not load promotions" description={error} action={{ label: "Try again", onClick: reload }} />
          ) : (data?.promotions.length ?? 0) === 0 ? (
            <EmptyState title="No promotions yet" description="Create a code to attract new customers." />
          ) : (
            <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "grid", gap: 8 }}>
              {data!.promotions.map((p) => (
                <li key={p.id} className="card" style={{ padding: 12, opacity: p.active ? 1 : 0.6 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", gap: 8, flexWrap: "wrap" }}>
                    <b>{p.code} • {p.percent}% off</b>
                    <span className="mut">Used {p.usedCount}{p.maxUses ? ` of ${p.maxUses}` : ""}</span>
                  </div>
                  <div className="mut" style={{ fontSize: "0.8125rem" }}>
                    {p.minAmount > 0 ? `Min ${formatNpr(p.minAmount)} • ` : ""}{p.expiresAt ? `Expires ${new Date(p.expiresAt).toLocaleDateString()}` : "No expiry"}
                  </div>
                  <div className="row" style={{ gap: 8, marginTop: 8 }}>
                    <button className="btn btn-outline btn-sm" onClick={() => toggle(p)}>{p.active ? "Pause" : "Resume"}</button>
                    <button className="btn btn-outline btn-sm" onClick={() => setDeleting(p)}>Delete</button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>

        <form className="card" onSubmit={create}>
          <h3>New promotion</h3>
          <div className="fld"><label htmlFor="pr-code">Code</label><input id="pr-code" value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value.toUpperCase() })} placeholder="e.g. WELCOME10" maxLength={30} required /></div>
          <div className="fld"><label htmlFor="pr-pct">Discount (%)</label><input id="pr-pct" inputMode="numeric" value={form.percent} onChange={(e) => setForm({ ...form, percent: e.target.value.replace(/\D/g, "") })} required /></div>
          <div className="fld"><label htmlFor="pr-min">Minimum services total (NPR, optional)</label><input id="pr-min" inputMode="numeric" value={form.minAmount} onChange={(e) => setForm({ ...form, minAmount: e.target.value.replace(/\D/g, "") })} /></div>
          <div className="fld"><label htmlFor="pr-max">Maximum uses (optional)</label><input id="pr-max" inputMode="numeric" value={form.maxUses} onChange={(e) => setForm({ ...form, maxUses: e.target.value.replace(/\D/g, "") })} /></div>
          <div className="fld"><label htmlFor="pr-exp">Expires (optional)</label><input id="pr-exp" type="date" value={form.expiresAt} onChange={(e) => setForm({ ...form, expiresAt: e.target.value })} /></div>
          <button className="btn btn-primary" type="submit" disabled={!form.code || !form.percent}>Create promotion</button>
        </form>
      </div>
      <ConfirmDialog open={deleting !== null} onClose={() => setDeleting(null)} onConfirm={remove} title="Delete this promotion?" message={`Customers will no longer be able to use ${deleting?.code ?? "this code"}.`} confirmLabel="Delete" variant="danger" />
    </div>
  );
}
