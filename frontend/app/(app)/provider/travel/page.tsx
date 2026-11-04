"use client";

import { useEffect, useState } from "react";
import { send } from "@/lib/api";
import { useApi } from "@/lib/hooks";
import type { Area } from "@/lib/types";
import { FormField, Skeleton, useToast } from "@/components/app-shell";

interface Profile {
  provider: { area: string; travel_radius: number; travel_fee: number; type: string };
}

export default function ProviderTravelPage() {
  const { showToast } = useToast();
  const profile = useApi<Profile>("/provider/profile");
  const areas = useApi<{ areas: Area[] }>("/areas");
  const [area, setArea] = useState("");
  const [radius, setRadius] = useState("");
  const [fee, setFee] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const p = profile.data?.provider;
    if (!p) return;
    setArea(p.area);
    setRadius(String(p.travel_radius));
    setFee(String(p.travel_fee));
  }, [profile.data]);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    const r = await send("/provider/profile", "POST", { area, travelRadius: Number(radius), travelFee: Number(fee) });
    setBusy(false);
    showToast(r.ok ? { type: "success", title: "Travel settings saved" } : { type: "error", title: r.error });
  }

  return (
    <div>
      <h1 className="h1">Travel settings</h1>
      <p className="sub">Where you work and what you charge for home visits. Requests come from customers in your area.</p>
      <form className="card" style={{ marginTop: 16, maxWidth: 480 }} onSubmit={save}>
        {profile.loading ? (
          <Skeleton variant="card" />
        ) : (
          <>
            <div className="fld">
              <label htmlFor="tv-area">Your area</label>
              <select id="tv-area" value={area} onChange={(e) => setArea(e.target.value)} required>
                {!areas.data?.areas.some((a) => a.name === area) && area && <option value={area}>{area}</option>}
                {(areas.data?.areas ?? []).map((a) => <option key={a.id} value={a.name}>{a.name}, {a.city}</option>)}
              </select>
            </div>
            <FormField label="Travel radius (km)" type="number" min={1} max={200} value={radius} onChange={(e) => setRadius(e.target.value)} required />
            <FormField label="Travel fee for home visits (NPR)" type="number" min={0} max={100000} value={fee} onChange={(e) => setFee(e.target.value)} required />
            <button className="btn btn-primary" type="submit" disabled={busy}>{busy ? "Saving..." : "Save"}</button>
          </>
        )}
      </form>
    </div>
  );
}
