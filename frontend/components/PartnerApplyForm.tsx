"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { api } from "@/lib/api";
import type { Area, ServiceCategory } from "@/lib/types";
import { useT } from "./i18n";

type Applicant = "unknown" | "guest" | "signed-in";

// The one provider-application form (used on the landing page and on /partner).
// Applying needs an account so an approved application is linked to a real person.
export default function PartnerApplyForm() {
  const { t } = useT();
  const [who, setWho] = useState<Applicant>("unknown");
  const [areas, setAreas] = useState<Area[]>([]);
  const [categories, setCategories] = useState<ServiceCategory[]>([]);
  const [form, setForm] = useState({ type: "freelance", name: "", phone: "", service: "", area: "", idNote: "" });
  const [msg, setMsg] = useState<{ kind: "success" | "error"; text: string } | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    api("/auth/me")
      .then((r) => r.json())
      .then((d) => setWho(d.user ? "signed-in" : "guest"))
      .catch(() => setWho("guest"));
    api("/areas").then((r) => r.json()).then((d) => setAreas(Array.isArray(d.areas) ? d.areas : [])).catch(() => {});
    api("/categories").then((r) => r.json()).then((d) => setCategories(Array.isArray(d.categories) ? d.categories : [])).catch(() => {});
  }, []);

  const set = (k: keyof typeof form, v: string) => setForm((f) => ({ ...f, [k]: v }));

  async function apply(e: React.FormEvent) {
    e.preventDefault();
    setMsg(null);
    setBusy(true);
    try {
      const res = await api("/partner/apply", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const d = await res.json();
      if (res.status === 401) {
        setWho("guest");
        throw new Error("Please sign in first, then submit your application.");
      }
      if (!res.ok) throw new Error(d.error || "Could not submit application");
      setMsg({ kind: "success", text: d.message || "Application submitted." });
      setForm({ type: "freelance", name: "", phone: "", service: "", area: "", idNote: "" });
    } catch (err) {
      setMsg({ kind: "error", text: err instanceof Error ? err.message : "Could not submit application. Please try again." });
    } finally {
      setBusy(false);
    }
  }

  if (who === "guest") {
    return (
      <section className="card">
        <h3>{t("partner.applicationTitle")}</h3>
        <p className="mut">Create an account or sign in first, so we can link your application to you and notify you when it is reviewed.</p>
        <Link className="btn btn-primary" href={`/login?redirect=${encodeURIComponent("/partner")}`}>
          Sign in to apply
        </Link>
        {msg && <p style={{ color: "var(--rose)", marginTop: 12 }}>{msg.text}</p>}
      </section>
    );
  }

  return (
    <form className="card" onSubmit={apply}>
      <h3>{t("partner.applicationTitle")}</h3>
      <div className="chips" style={{ marginBottom: 12 }}>
        <button type="button" className="chip" aria-pressed={form.type === "salon"} onClick={() => set("type", "salon")}>
          {t("partner.salon")}
        </button>
        <button type="button" className="chip" aria-pressed={form.type === "freelance"} onClick={() => set("type", "freelance")}>
          {t("partner.freelance")}
        </button>
      </div>
      <div className="fld">
        <label htmlFor="pa-name">{t("partner.name")}</label>
        <input id="pa-name" value={form.name} onChange={(e) => set("name", e.target.value)} maxLength={80} required />
      </div>
      <div className="fld">
        <label htmlFor="pa-phone">{t("partner.phone")}</label>
        <input id="pa-phone" inputMode="tel" placeholder="98XXXXXXXX" value={form.phone} onChange={(e) => set("phone", e.target.value.replace(/[^\d+\-()\s]/g, ""))} maxLength={20} required />
      </div>
      <div className="fld">
        <label htmlFor="pa-service">{t("partner.service")}</label>
        {categories.length > 0 ? (
          <select id="pa-service" value={form.service} onChange={(e) => set("service", e.target.value)} required>
            <option value="">Choose your main service</option>
            {categories.map((c) => (
              <option key={c.name} value={c.name}>{c.name}</option>
            ))}
          </select>
        ) : (
          <input id="pa-service" value={form.service} onChange={(e) => set("service", e.target.value)} maxLength={120} required />
        )}
      </div>
      <div className="fld">
        <label htmlFor="pa-area">{t("partner.area")}</label>
        {areas.length > 0 ? (
          <select id="pa-area" value={form.area} onChange={(e) => set("area", e.target.value)} required>
            <option value="">Choose your area</option>
            {areas.map((a) => (
              <option key={a.id} value={a.name}>{a.name}, {a.city}</option>
            ))}
          </select>
        ) : (
          <input id="pa-area" placeholder={t("partner.areaPh")} value={form.area} onChange={(e) => set("area", e.target.value)} maxLength={60} required />
        )}
      </div>
      <div className="fld">
        <label htmlFor="pa-id">{t("partner.idNote")}</label>
        <input id="pa-id" placeholder="e.g. CTZ 15-02-71-07891" value={form.idNote} onChange={(e) => set("idNote", e.target.value)} maxLength={500} required />
      </div>
      <button className="btn btn-primary" type="submit" style={{ width: "100%", marginTop: 8 }} disabled={busy || who === "unknown"}>
        {busy ? "Submitting…" : t("partner.submit")}
      </button>
      {msg && (
        <p role="status" style={{ color: msg.kind === "success" ? "var(--gold)" : "var(--rose)", marginTop: 12 }}>
          {msg.text}
        </p>
      )}
    </form>
  );
}
