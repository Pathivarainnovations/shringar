"use client";

import { useState } from "react";
import { send } from "@/lib/api";
import { useApi } from "@/lib/hooks";
import { ConfirmDialog, EmptyState, Skeleton, useToast } from "@/components/app-shell";

interface Member {
  id: string;
  name: string;
  email: string | null;
  specialty: string | null;
  active: boolean;
}

export default function ProviderStaffPage() {
  const { showToast } = useToast();
  const { data, error, loading, reload } = useApi<{ staff: Member[] }>("/provider/staff");
  const [form, setForm] = useState({ name: "", specialty: "", email: "" });
  const [deleting, setDeleting] = useState<Member | null>(null);

  async function add(e: React.FormEvent) {
    e.preventDefault();
    const r = await send("/provider/staff", "POST", form);
    if (!r.ok) return showToast({ type: "error", title: r.error });
    setForm({ name: "", specialty: "", email: "" });
    reload();
  }
  async function toggle(m: Member) {
    const r = await send(`/provider/staff/${m.id}`, "PATCH", { active: !m.active });
    if (!r.ok) return showToast({ type: "error", title: r.error });
    reload();
  }
  async function remove() {
    if (!deleting) return;
    const r = await send(`/provider/staff/${deleting.id}`, "DELETE");
    setDeleting(null);
    if (!r.ok) return showToast({ type: "error", title: r.error });
    reload();
  }

  return (
    <div>
      <h1 className="h1">Staff</h1>
      <p className="sub">Team members you can assign to bookings (salons only).</p>
      {error && /salon/i.test(error) ? (
        <EmptyState title="Staff is for salons" description="Freelance providers work on their own, so there is nothing to manage here." />
      ) : (
        <div className="grid2" style={{ marginTop: 16, alignItems: "start" }}>
          <section className="card">
            <h3>Team</h3>
            {loading ? (
              <Skeleton variant="text" count={3} />
            ) : error ? (
              <EmptyState title="Could not load staff" description={error} action={{ label: "Try again", onClick: reload }} />
            ) : (data?.staff.length ?? 0) === 0 ? (
              <EmptyState title="No staff yet" description="Add the people who work at your salon." />
            ) : (
              <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "grid", gap: 8 }}>
                {data!.staff.map((m) => (
                  <li key={m.id} className="card" style={{ padding: 12, opacity: m.active ? 1 : 0.6 }}>
                    <b>{m.name}</b> <span className="mut">{m.specialty ?? ""}</span>
                    <div className="row" style={{ gap: 8, marginTop: 8 }}>
                      <button className="btn btn-outline btn-sm" onClick={() => toggle(m)}>{m.active ? "Set inactive" : "Set active"}</button>
                      <button className="btn btn-outline btn-sm" onClick={() => setDeleting(m)}>Remove</button>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </section>
          <form className="card" onSubmit={add}>
            <h3>Add a team member</h3>
            <div className="fld"><label htmlFor="st-name">Name</label><input id="st-name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} maxLength={80} required /></div>
            <div className="fld"><label htmlFor="st-spec">Speciality</label><input id="st-spec" value={form.specialty} onChange={(e) => setForm({ ...form, specialty: e.target.value })} maxLength={80} /></div>
            <div className="fld"><label htmlFor="st-email">Email (optional)</label><input id="st-email" type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} maxLength={120} /></div>
            <button className="btn btn-primary" type="submit" disabled={!form.name.trim()}>Add member</button>
          </form>
        </div>
      )}
      <ConfirmDialog open={deleting !== null} onClose={() => setDeleting(null)} onConfirm={remove} title="Remove this team member?" message={`${deleting?.name ?? "They"} will no longer be available to assign.`} confirmLabel="Remove" variant="danger" />
    </div>
  );
}
