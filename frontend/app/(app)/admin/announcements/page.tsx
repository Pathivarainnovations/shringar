"use client";

import { useState } from "react";
import { send } from "@/lib/api";
import { useApi } from "@/lib/hooks";
import { EmptyState, Skeleton, useToast } from "@/components/app-shell";

interface Announcement {
  id: string;
  title: string;
  body: string;
  audience: string;
  recipients: number;
  created_at: string;
}

export default function AdminAnnouncementsPage() {
  const { showToast } = useToast();
  const { data, error, loading, reload } = useApi<{ announcements: Announcement[] }>("/admin/announcements");
  const [form, setForm] = useState({ title: "", body: "", audience: "all" });
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!window.confirm(`Send this to ${form.audience === "all" ? "all customers and providers" : form.audience}?`)) return;
    setBusy(true);
    const r = await send<{ recipients: number }>("/admin/announcements", "POST", form);
    setBusy(false);
    if (!r.ok) return showToast({ type: "error", title: r.error });
    showToast({ type: "success", title: `Sent to ${r.data.recipients} user${r.data.recipients === 1 ? "" : "s"}` });
    setForm({ title: "", body: "", audience: "all" });
    reload();
  }

  return (
    <div>
      <h1 className="h1">Announcements</h1>
      <p className="sub">Send a notification to every customer, every provider, or everyone.</p>
      <div className="grid2" style={{ marginTop: 16, alignItems: "start" }}>
        <form className="card" onSubmit={submit}>
          <h3>New announcement</h3>
          <div className="fld"><label htmlFor="an-aud">Send to</label>
            <select id="an-aud" value={form.audience} onChange={(e) => setForm({ ...form, audience: e.target.value })}>
              <option value="all">Customers and providers</option><option value="customers">Customers only</option><option value="providers">Providers only</option>
            </select></div>
          <div className="fld"><label htmlFor="an-title">Title</label><input id="an-title" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} maxLength={120} required /></div>
          <div className="fld"><label htmlFor="an-body">Message</label><textarea id="an-body" rows={4} value={form.body} onChange={(e) => setForm({ ...form, body: e.target.value })} maxLength={1000} required /></div>
          <button className="btn btn-primary" type="submit" disabled={busy || !form.title.trim() || !form.body.trim()}>{busy ? "Sending..." : "Send announcement"}</button>
        </form>
        <section className="card">
          <h3>Sent</h3>
          {loading ? <Skeleton variant="text" count={3} /> : error ? (
            <EmptyState title="Could not load announcements" description={error} action={{ label: "Try again", onClick: reload }} />
          ) : (data?.announcements.length ?? 0) === 0 ? (
            <EmptyState title="Nothing sent yet" description="Announcements you send appear here." />
          ) : (
            <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "grid", gap: 8 }}>
              {data!.announcements.map((a) => (
                <li key={a.id} className="card" style={{ padding: 12 }}>
                  <b>{a.title}</b>
                  <div className="mut" style={{ fontSize: "0.8125rem" }}>{new Date(a.created_at).toLocaleString()} • {a.audience} • {a.recipients} recipient{a.recipients === 1 ? "" : "s"}</div>
                  <p style={{ marginTop: 4 }}>{a.body}</p>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </div>
  );
}
