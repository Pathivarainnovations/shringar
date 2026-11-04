"use client";

import { useEffect, useState } from "react";
import { send } from "@/lib/api";
import { useApi } from "@/lib/hooks";
import { formatNpr } from "@/lib/pricing";
import { FormField, Skeleton, useToast } from "@/components/app-shell";

interface Me {
  name: string;
  email: string;
  wallet: number;
  hasPassword: boolean;
  createdAt: string;
}

export default function ClientProfilePage() {
  const { showToast } = useToast();
  const me = useApi<{ user: Me | null }>("/auth/me");
  const [name, setName] = useState("");
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (me.data?.user) setName(me.data.user.name);
  }, [me.data]);

  const user = me.data?.user;

  async function saveName(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    const r = await send("/profile", "PATCH", { name });
    setBusy(false);
    showToast(r.ok ? { type: "success", title: "Profile saved" } : { type: "error", title: r.error });
    if (r.ok) me.reload();
  }

  async function savePassword(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    const r = await send("/profile/password", "PATCH", { currentPassword: current, newPassword: next });
    setBusy(false);
    if (!r.ok) return showToast({ type: "error", title: r.error });
    showToast({ type: "success", title: "Password updated" });
    setCurrent("");
    setNext("");
    me.reload();
  }

  async function signOutEverywhere() {
    await send("/auth/logout-all", "POST");
    window.location.assign("/login");
  }

  if (me.loading || !user) {
    return (
      <div>
        <h1 className="h1">Profile</h1>
        <Skeleton variant="card" />
      </div>
    );
  }

  return (
    <div>
      <h1 className="h1">Profile</h1>
      <p className="sub">Member since {new Date(user.createdAt).toLocaleDateString()} • Wallet {formatNpr(user.wallet)}</p>
      <div className="grid2" style={{ marginTop: 24 }}>
        <form className="card" onSubmit={saveName}>
          <h3>Your details</h3>
          <FormField label="Name" value={name} onChange={(e) => setName(e.target.value)} required maxLength={80} />
          <FormField label="Email" type="email" value={user.email} disabled hint="Your email is how you sign in and cannot be changed here." />
          <button className="btn btn-primary" type="submit" disabled={busy || name.trim().length < 2}>Save</button>
        </form>

        <form className="card" onSubmit={savePassword}>
          <h3>{user.hasPassword ? "Change password" : "Set a password"}</h3>
          {user.hasPassword && <FormField label="Current password" type="password" value={current} onChange={(e) => setCurrent(e.target.value)} autoComplete="current-password" required />}
          <FormField label="New password" type="password" value={next} onChange={(e) => setNext(e.target.value)} autoComplete="new-password" hint="At least 8 characters" required />
          <button className="btn btn-primary" type="submit" disabled={busy || next.length < 8}>{user.hasPassword ? "Update password" : "Set password"}</button>
          <hr style={{ margin: "16px 0", border: 0, borderTop: "1px solid var(--line)" }} />
          <button type="button" className="btn btn-outline btn-sm" onClick={signOutEverywhere}>Sign out of all devices</button>
        </form>
      </div>
    </div>
  );
}
