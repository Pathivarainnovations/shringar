"use client";

import { useEffect, useState } from "react";
import { send } from "@/lib/api";
import { useApi } from "@/lib/hooks";
import { Skeleton, useToast } from "@/components/app-shell";

interface Day {
  dayOfWeek: number;
  start: string;
  end: string;
  active: boolean;
}

const NAMES = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const blank = (): Day[] => NAMES.map((_, i) => ({ dayOfWeek: i, start: "10:00", end: "18:00", active: false }));

export default function ProviderAvailabilityPage() {
  const { showToast } = useToast();
  const { data, loading, error } = useApi<{ days: Day[] }>("/provider/availability");
  const [days, setDays] = useState<Day[]>(blank());
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!data) return;
    const next = blank();
    for (const d of data.days) next[d.dayOfWeek] = d;
    setDays(next);
  }, [data]);

  const patch = (i: number, p: Partial<Day>) => setDays((all) => all.map((d, k) => (k === i ? { ...d, ...p } : d)));

  async function save() {
    const bad = days.find((d) => d.active && d.start >= d.end);
    if (bad) return showToast({ type: "error", title: `${NAMES[bad.dayOfWeek]}: start time must be before end time` });
    setBusy(true);
    const r = await send("/provider/availability", "PUT", { days: days.filter((d) => d.active) });
    setBusy(false);
    showToast(r.ok ? { type: "success", title: "Availability saved" } : { type: "error", title: r.error });
  }

  return (
    <div>
      <h1 className="h1">Availability</h1>
      <p className="sub">The days and hours you take bookings.</p>
      <section className="card" style={{ marginTop: 16 }}>
        {loading ? (
          <Skeleton variant="card" />
        ) : error ? (
          <p className="mut">{error}</p>
        ) : (
          <>
            <div style={{ display: "grid", gap: 8 }}>
              {days.map((d, i) => (
                <div key={i} className="row" style={{ gap: 12, flexWrap: "wrap", alignItems: "center" }}>
                  <label style={{ display: "flex", alignItems: "center", gap: 8, width: 140 }}>
                    <input type="checkbox" checked={d.active} onChange={(e) => patch(i, { active: e.target.checked })} />
                    {NAMES[i]}
                  </label>
                  <input type="time" aria-label={`${NAMES[i]} start`} value={d.start} disabled={!d.active} onChange={(e) => patch(i, { start: e.target.value })} />
                  <span>to</span>
                  <input type="time" aria-label={`${NAMES[i]} end`} value={d.end} disabled={!d.active} onChange={(e) => patch(i, { end: e.target.value })} />
                </div>
              ))}
            </div>
            <button className="btn btn-primary" style={{ marginTop: 16 }} onClick={save} disabled={busy}>{busy ? "Saving..." : "Save availability"}</button>
          </>
        )}
      </section>
    </div>
  );
}
