"use client";

import { useEffect, useState } from "react";
import { send } from "@/lib/api";
import { useApi } from "@/lib/hooks";
import { Skeleton, useToast } from "@/components/app-shell";

const FIELDS: { key: string; label: string; hint: string; max: number }[] = [
  { key: "commission_rate", label: "Platform commission (%)", hint: "Charged on the service amount of each completed booking. Applies to bookings completed after you change it.", max: 50 },
  { key: "first_booking_discount_pct", label: "First-booking discount (%)", hint: "Given to a customer's first booking. Set 0 to turn it off.", max: 100 },
  { key: "referral_credit", label: "Referral credit (NPR)", hint: "Wallet credit for a friend who signs up with a referral code, and for the referrer once that friend completes a booking.", max: 100000 },
  { key: "default_travel_fee", label: "Default home-visit travel fee (NPR)", hint: "Used for open requests before a provider with their own fee accepts.", max: 100000 },
];

export default function AdminSettingsPage() {
  const { showToast } = useToast();
  const { data, loading, error } = useApi<{ settings: Record<string, number> }>("/admin/settings");
  const [values, setValues] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (data) setValues(Object.fromEntries(Object.entries(data.settings).map(([k, v]) => [k, String(v)])));
  }, [data]);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    const r = await send("/admin/settings", "PUT", Object.fromEntries(Object.entries(values).map(([k, v]) => [k, Number(v)])));
    setBusy(false);
    showToast(r.ok ? { type: "success", title: "Settings saved" } : { type: "error", title: r.error });
  }

  return (
    <div>
      <h1 className="h1">Settings</h1>
      <p className="sub">Platform-wide values. Changes apply immediately.</p>
      <form className="card" style={{ marginTop: 16, maxWidth: 560 }} onSubmit={save}>
        {loading ? <Skeleton variant="card" /> : error ? <p className="mut">{error}</p> : (
          <>
            {FIELDS.map((f) => (
              <div className="fld" key={f.key}>
                <label htmlFor={f.key}>{f.label}</label>
                <input id={f.key} inputMode="decimal" value={values[f.key] ?? ""} onChange={(e) => setValues({ ...values, [f.key]: e.target.value.replace(/[^\d.]/g, "") })} required aria-describedby={`${f.key}-hint`} />
                <small id={`${f.key}-hint`} className="mut">{f.hint} (0 to {f.max})</small>
              </div>
            ))}
            <button className="btn btn-primary" type="submit" disabled={busy}>{busy ? "Saving..." : "Save settings"}</button>
          </>
        )}
      </form>
    </div>
  );
}
