"use client";

import { useState } from "react";
import { send } from "@/lib/api";
import { useRoleApi } from "@/lib/hooks";
import { EmptyState, FormField, Skeleton, useToast } from "@/components/app-shell";

interface TripShare {
  id: string;
  bookingId: string;
  sharedWith: string;
  expiresAt: string;
}

export default function ClientSafetyPage() {
  const { showToast } = useToast();
  const contacts = useRoleApi<{ contacts: string[] }>("/safety/contacts", ["customer"]);
  const shares = useRoleApi<{ tripShares: TripShare[] }>("/trip-shares", ["customer"]);
  const [phone, setPhone] = useState("");

  async function add(e: React.FormEvent) {
    e.preventDefault();
    const r = await send("/safety/contacts", "POST", { phone });
    if (!r.ok) return showToast({ type: "error", title: r.error });
    setPhone("");
    contacts.reload();
  }
  async function remove(p: string) {
    const r = await send("/safety/contacts", "DELETE", { phone: p });
    if (!r.ok) return showToast({ type: "error", title: r.error });
    contacts.reload();
  }

  return (
    <div>
      <h1 className="h1">Safety</h1>
      <p className="sub">Emergency contacts and trips you shared. During a service you can send an SOS from the tracking page.</p>
      <div className="grid2" style={{ marginTop: 24 }}>
        <section className="card">
          <h3>Emergency contacts</h3>
          {contacts.loading ? (
            <Skeleton variant="text" count={2} />
          ) : (contacts.data?.contacts.length ?? 0) === 0 ? (
            <EmptyState title="No emergency contacts" description="Add up to 5 people we can reach in an emergency." />
          ) : (
            <ul style={{ listStyle: "none", padding: 0, margin: 0 }}>
              {contacts.data!.contacts.map((c) => (
                <li key={c} className="r" style={{ justifyContent: "space-between", padding: "6px 0" }}>
                  <span>{c}</span>
                  <button className="btn btn-outline btn-sm" onClick={() => remove(c)}>Remove</button>
                </li>
              ))}
            </ul>
          )}
          <form onSubmit={add} style={{ marginTop: 12 }}>
            <FormField label="Phone number" type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="98XXXXXXXX" required />
            <button className="btn btn-primary" type="submit" disabled={!phone.trim()}>Add contact</button>
          </form>
        </section>

        <section className="card">
          <h3>Shared trips</h3>
          {shares.loading ? (
            <Skeleton variant="text" count={2} />
          ) : (shares.data?.tripShares.length ?? 0) === 0 ? (
            <EmptyState title="No shared trips" description="Open a booking that is under way and tap “Create share link”." />
          ) : (
            <ul style={{ listStyle: "none", padding: 0, margin: 0 }}>
              {shares.data!.tripShares.map((s) => (
                <li key={s.id} className="r" style={{ justifyContent: "space-between", padding: "6px 0" }}>
                  <span>{s.sharedWith} • {s.bookingId}</span>
                  <span className="mut">{new Date(s.expiresAt) > new Date() ? `until ${new Date(s.expiresAt).toLocaleString()}` : "expired"}</span>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </div>
  );
}
