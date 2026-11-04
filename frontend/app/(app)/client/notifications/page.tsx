"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { EmptyState, Skeleton, Tabs, StatusBadge } from "@/components/app-shell";

const NOTIF_TABS = [
  { id: "all", label: "All" },
  { id: "unread", label: "Unread" },
] as const;

export default function ClientNotificationsPage() {
  const [notifications, setNotifications] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("all");

  useEffect(() => {
    api("/notifications")
      .then((r) => r.json())
      .then((d) => {
        setNotifications(d.notifications ?? []);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  const filtered = activeTab === "unread" ? notifications.filter((n) => !n.is_read) : notifications;

  const markRead = async (id: string) => {
    try {
      await api(`/notifications/${id}/read`, { method: "PATCH" });
      setNotifications((list) => list.map((n) => (n.id === id ? { ...n, is_read: true } : n)));
    } catch {}
  };

  const markAllRead = async () => {
    try {
      await api("/notifications/read-all", { method: "PATCH" });
      setNotifications((list) => list.map((n) => ({ ...n, is_read: true })));
    } catch {}
  };

  if (loading) {
    return (
      <div>
        <h1 className="h1">Notifications</h1>
        <Tabs tabs={NOTIF_TABS} activeTab={activeTab} onChange={setActiveTab} />
        {[...Array(5)].map((_, i) => <Skeleton key={i} variant="card" />)}
      </div>
    );
  }

  return (
    <div>
      <h1 className="h1">Notifications</h1>
      <Tabs tabs={NOTIF_TABS} activeTab={activeTab} onChange={setActiveTab} style={{ marginTop: 16 }} />

      <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 16 }}>
        <button className="btn btn-outline btn-sm" onClick={markAllRead} disabled={filtered.every((n) => n.is_read)}>
          Mark all as read
        </button>
      </div>

      {filtered.length === 0 ? (
        <EmptyState
          icon={<svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" /><path d="M13.73 21a2 2 0 0 1-3.46 0" /></svg>}
          title={activeTab === "unread" ? "No unread notifications" : "No notifications"}
          description="You're all caught up!"
        />
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {filtered.map((n) => (
            <div key={n.id} className={`card ${!n.is_read ? "unread" : ""}`} style={{ padding: 16, borderLeft: !n.is_read ? "4px solid var(--gold)" : "none" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12 }}>
                <div style={{ flex: 1 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", marginBottom: 4 }}>
                    <b>{n.title}</b>
                    <StatusBadge status={n.type} size="sm" />
                  </div>
                  <p className="mut" style={{ marginBottom: 8 }}>{n.message}</p>
                  <small className="mut">{new Date(n.created_at).toLocaleString()}</small>
                </div>
                {!n.is_read && (
                  <button className="chip" onClick={() => markRead(n.id)}>Mark Read</button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}