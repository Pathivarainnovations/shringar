"use client";

import { useEffect, useState } from "react";
import { send } from "@/lib/api";
import { useApi } from "@/lib/hooks";
import { FormField, Skeleton, StatusBadge, TextareaField, useToast } from "@/components/app-shell";

interface Provider {
  name: string;
  type: string;
  service: string;
  area: string;
  address: string | null;
  phone: string | null;
  hours: string | null;
  bio: string | null;
  verified: number;
  rating: number | null;
  review_count: number;
}

export default function ProviderProfilePage() {
  const { showToast } = useToast();
  const profile = useApi<{ provider: Provider }>("/provider/profile");
  const [f, setF] = useState({ name: "", service: "", address: "", phone: "", hours: "", bio: "" });
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const p = profile.data?.provider;
    if (p) setF({ name: p.name, service: p.service, address: p.address ?? "", phone: p.phone ?? "", hours: p.hours ?? "", bio: p.bio ?? "" });
  }, [profile.data]);

  const p = profile.data?.provider;
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => setF({ ...f, [k]: e.target.value });

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    const r = await send("/provider/profile", "POST", f);
    setBusy(false);
    showToast(r.ok ? { type: "success", title: "Profile saved" } : { type: "error", title: r.error });
    if (r.ok) profile.reload();
  }
  async function savePassword(e: React.FormEvent) {
    e.preventDefault();
    const r = await send("/profile/password", "PATCH", { currentPassword: current, newPassword: next });
    if (!r.ok) return showToast({ type: "error", title: r.error });
    showToast({ type: "success", title: "Password updated" });
    setCurrent("");
    setNext("");
  }

  if (profile.loading || !p) {
    return (
      <div>
        <h1 className="h1">Profile &amp; verification</h1>
        <Skeleton variant="card" />
      </div>
    );
  }

  return (
    <div>
      <h1 className="h1">Profile &amp; verification</h1>
      <p className="sub">
        <StatusBadge status={p.verified ? "verified" : "unverified"} size="sm" /> {p.type === "salon" ? "Salon" : "Freelance"} • {p.area}
        {p.rating !== null ? ` • ★ ${p.rating} (${p.review_count})` : " • no reviews yet"}
      </p>
      <div className="grid2" style={{ marginTop: 24, alignItems: "start" }}>
        <form className="card" onSubmit={save}>
          <h3>Public profile</h3>
          <FormField label="Business name" value={f.name} onChange={set("name")} required maxLength={80} />
          <FormField label="Main service" value={f.service} onChange={set("service")} required maxLength={120} />
          <FormField label="Phone" type="tel" value={f.phone} onChange={set("phone")} maxLength={20} />
          <FormField label="Address" value={f.address} onChange={set("address")} maxLength={300} />
          <FormField label="Working hours" value={f.hours} onChange={set("hours")} placeholder="e.g. Sun-Fri 10am-6pm" maxLength={120} />
          <TextareaField label="About you" value={f.bio} onChange={set("bio")} maxLength={1000} rows={4} />
          <button className="btn btn-primary" type="submit" disabled={busy}>{busy ? "Saving..." : "Save profile"}</button>
        </form>
        <form className="card" onSubmit={savePassword}>
          <h3>Password</h3>
          <FormField label="Current password" type="password" value={current} onChange={(e) => setCurrent(e.target.value)} autoComplete="current-password" />
          <FormField label="New password" type="password" value={next} onChange={(e) => setNext(e.target.value)} autoComplete="new-password" hint="At least 8 characters" />
          <button className="btn btn-primary" type="submit" disabled={next.length < 8}>Update password</button>
        </form>
      </div>
    </div>
  );
}
