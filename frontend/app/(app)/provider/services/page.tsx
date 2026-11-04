"use client";

import { useEffect, useState } from "react";
import { send } from "@/lib/api";
import { useApi } from "@/lib/hooks";
import { formatNpr } from "@/lib/pricing";
import { EmptyState, Skeleton, useToast } from "@/components/app-shell";

interface Row {
  id: number;
  name: string;
  minutes: number;
  suggestedPrice: number;
  price: number | null;
  active: boolean;
}

export default function ProviderServicesPage() {
  const { showToast } = useToast();
  const { data, error, loading, reload } = useApi<{ services: Row[] }>("/provider/services");
  const [drafts, setDrafts] = useState<Record<number, string>>({});

  useEffect(() => {
    if (data) setDrafts(Object.fromEntries(data.services.map((s) => [s.id, s.price === null ? "" : String(s.price)])));
  }, [data]);

  async function save(s: Row) {
    const raw = drafts[s.id] ?? "";
    const r = raw === "" ? await send(`/provider/services/${s.id}`, "PUT", { price: null }) : await send(`/provider/services/${s.id}`, "PUT", { price: Number(raw), active: s.active || s.price === null });
    if (!r.ok) return showToast({ type: "error", title: r.error });
    showToast({ type: "success", title: raw === "" ? `${s.name} removed from your menu` : `${s.name} saved` });
    reload();
  }
  async function toggle(s: Row) {
    if (s.price === null) return;
    const r = await send(`/provider/services/${s.id}`, "PUT", { price: s.price, active: !s.active });
    if (!r.ok) return showToast({ type: "error", title: r.error });
    reload();
  }

  return (
    <div>
      <h1 className="h1">Services &amp; prices</h1>
      <p className="sub">Set your own price for each service you offer. Customers who book you are charged your price. Leave a price empty to not offer a service.</p>
      <section className="card" style={{ marginTop: 16 }}>
        {loading ? (
          <Skeleton variant="card" />
        ) : error ? (
          <EmptyState title="Could not load services" description={error} action={{ label: "Try again", onClick: reload }} />
        ) : (data?.services.length ?? 0) === 0 ? (
          <EmptyState title="No services in the catalogue" description="An administrator needs to add services before you can price them." />
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table className="tbl" style={{ width: "100%" }}>
              <thead><tr><th align="left">Service</th><th align="left">Minutes</th><th align="left">Suggested</th><th align="left">Your price (NPR)</th><th /></tr></thead>
              <tbody>
                {data!.services.map((s) => (
                  <tr key={s.id} style={{ opacity: s.price !== null && !s.active ? 0.55 : 1 }}>
                    <td>{s.name}</td>
                    <td>{s.minutes}</td>
                    <td>{formatNpr(s.suggestedPrice)}</td>
                    <td><input aria-label={`Your price for ${s.name}`} inputMode="numeric" value={drafts[s.id] ?? ""} onChange={(e) => setDrafts({ ...drafts, [s.id]: e.target.value.replace(/\D/g, "") })} style={{ width: 120 }} /></td>
                    <td style={{ whiteSpace: "nowrap" }}>
                      <button className="btn btn-primary btn-sm" onClick={() => save(s)} disabled={(drafts[s.id] ?? "") === (s.price === null ? "" : String(s.price))}>Save</button>{" "}
                      {s.price !== null && <button className="btn btn-outline btn-sm" onClick={() => toggle(s)}>{s.active ? "Pause" : "Resume"}</button>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
