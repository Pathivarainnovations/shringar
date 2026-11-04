"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { EmptyState, Skeleton, StatusBadge } from "@/components/app-shell";

export default function AdminProvidersPage() {
  const [apps, setApps] = useState<any[]>([]);
  const [providers, setProviders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<"pending" | "approved">("pending");

  useEffect(() => {
    api("/admin/applications")
      .then((r) => r.json())
      .then((d) => {
        setApps(d.apps ?? []);
      })
      .catch(() => {});
    api("/admin/providers")
      .then((r) => r.json())
      .then((d) => setProviders(d.providers ?? []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  async function decide(app: any, status: "approved" | "rejected") {
    try {
      const res = await api(`/admin/applications/${encodeURIComponent(app.id)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        alert(d.error || "Failed to update application");
        return;
      }
      setApps((l) => l.map((x) => (x.id === app.id ? { ...x, status } : x)));
      if (status === "approved") {
        api("/admin/providers").then((r) => r.json()).then((d) => setProviders(d.providers ?? [])).catch(() => {});
      }
    } catch {
      alert("Failed to update application");
    }
  }

  if (loading) {
    return (
      <div>
        <h1 className="h1">Providers</h1>
        <div style={{ display: "flex", gap: 8, marginTop: 16 }}>
          <button className={`btn ${activeTab === "pending" ? "btn-primary" : "btn-outline"}`} onClick={() => setActiveTab("pending")}>Pending ({apps.filter(a => a.status === "pending").length})</button>
          <button className={`btn ${activeTab === "approved" ? "btn-primary" : "btn-outline"}`} onClick={() => setActiveTab("approved")}>Approved ({providers.length})</button>
        </div>
        {[...Array(5)].map((_, i) => <Skeleton key={i} variant="card" />)}
      </div>
    );
  }

  return (
    <div>
      <h1 className="h1">Providers</h1>
      <p className="sub">Manage provider applications and approved providers.</p>

      <div style={{ display: "flex", gap: 8, marginTop: 16 }}>
        <button className={`btn ${activeTab === "pending" ? "btn-primary" : "btn-outline"}`} onClick={() => setActiveTab("pending")}>Pending ({apps.filter(a => a.status === "pending").length})</button>
        <button className={`btn ${activeTab === "approved" ? "btn-primary" : "btn-outline"}`} onClick={() => setActiveTab("approved")}>Approved ({providers.length})</button>
      </div>

      {activeTab === "pending" ? (
        <section className="card" style={{ marginTop: 16 }}>
          <h3>Pending Applications</h3>
          {apps.filter(a => a.status === "pending").length === 0 ? (
            <EmptyState title="No pending applications" description="New provider applications will appear here" />
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              {apps.filter(a => a.status === "pending").map((a) => (
                <div key={a.id} className="r" style={{ flexWrap: "wrap", padding: "16px 0", borderBottom: "1px solid var(--line)" }}>
                  <div>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", marginBottom: 4 }}>
                      <b>{a.name}</b>
                      <StatusBadge status={a.type} size="sm" />
                      <StatusBadge status={a.service} size="sm" />
                    </div>
                    <small className="mut">Area: {a.area} • Phone: {a.phone} • ID: {a.id_note}</small>
                  </div>
                  <div className="row">
                    <button className="btn btn-primary btn-sm" onClick={() => decide(a, "approved")}>Approve</button>
                    <button className="btn btn-outline btn-sm" onClick={() => decide(a, "rejected")}>Reject</button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      ) : (
        <section className="card" style={{ marginTop: 16 }}>
          <h3>Approved Providers</h3>
          {providers.length === 0 ? (
            <EmptyState title="No approved providers" description="Approved providers will appear here" />
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              {providers.map((p) => (
                <div key={p.id} className="r" style={{ flexWrap: "wrap", padding: "16px 0", borderBottom: "1px solid var(--line)" }}>
                  <div>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", marginBottom: 4 }}>
                      <b>{p.name}</b>
                      <StatusBadge status={p.type} size="sm" />
                      <StatusBadge status={p.service} size="sm" />
                    </div>
                    <small className="mut">Area: {p.area} • {p.verified ? "Active" : "Suspended"} • Rating: {p.rating !== null ? `★ ${p.rating}` : "no reviews yet"} • Travel: {p.travel_radius}km / NPR {p.travel_fee}</small>
                  </div>
                  <div className="row">
                    <a href={`/admin/providers/${p.id}`} className="chip">View</a>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      )}
    </div>
  );
}