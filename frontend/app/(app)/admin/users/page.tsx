"use client";

import { useState } from "react";
import { useApi } from "@/lib/hooks";
import { formatNpr } from "@/lib/pricing";
import { EmptyState, Skeleton, StatusBadge, ConfirmDialog } from "@/components/app-shell";

interface UserRow {
  id: string;
  name: string;
  email: string;
  role: string;
  wallet: number;
  bookings: number;
  status: string;
  createdAt: string;
}

type PendingAction = { type: "suspend" | "activate" | "delete"; user: UserRow } | null;

export default function AdminUsersPage() {
  const [q, setQ] = useState("");
  const [role, setRole] = useState("");
  const [pendingAction, setPendingAction] = useState<PendingAction>(null);
  const [auditNote, setAuditNote] = useState<string>("");
  const [actionLoading, setActionLoading] = useState(false);

  const params = new URLSearchParams();
  if (q.trim()) params.set("q", q.trim());
  if (role) params.set("role", role);
  const { data, error, loading, reload } = useApi<{ total: number; users: UserRow[] }>(`/admin/users?${params.toString()}`);

  const handleAction = async () => {
    if (!pendingAction) return;
    setActionLoading(true);
    try {
      if (pendingAction.type === "delete") {
        await fetch(`/api/admin/users/${pendingAction.user.id}`, {
          method: "DELETE",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ note: auditNote }),
        });
      } else {
        await fetch(`/api/admin/users/${pendingAction.user.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: pendingAction.type, note: auditNote }),
        });
      }
      setAuditNote("");
      setPendingAction(null);
      reload();
    } catch {
      // error handled by useApi
    } finally {
      setActionLoading(false);
    }
  };

  const confirmAction = (type: "suspend" | "activate" | "delete", user: UserRow) => {
    setAuditNote("");
    setPendingAction({ type, user });
  };

  const getActionButtons = (user: UserRow) => {
    const isSelf = typeof window !== "undefined" && user.id === (document.cookie.match(/session=([^;]+)/)?.[1] ? "current" : "");
    const buttons = [];
    if (user.status === "active") {
      buttons.push(<button key="suspend" className="btn btn-sm btn-outline" onClick={() => confirmAction("suspend", user)}>Suspend</button>);
      buttons.push(<button key="delete" className="btn btn-sm btn-danger" onClick={() => confirmAction("delete", user)}>Delete</button>);
    } else if (user.status === "suspended") {
      buttons.push(<button key="activate" className="btn btn-sm btn-primary" onClick={() => confirmAction("activate", user)}>Activate</button>);
      buttons.push(<button key="delete" className="btn btn-sm btn-danger" onClick={() => confirmAction("delete", user)}>Delete</button>);
    } else if (user.status === "deleted") {
      buttons.push(<span key="deleted" className="badge danger">Deleted</span>);
    }
    return <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>{buttons}</div>;
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "active": return <StatusBadge status="active" size="sm" />;
      case "suspended": return <StatusBadge status="pending" size="sm" />;
      case "deleted": return <StatusBadge status="cancelled" size="sm" />;
      default: return <StatusBadge status="pending" size="sm" />;
    }
  };

  const actionTitle = (type: string, user: UserRow) => {
    switch (type) {
      case "suspend": return `Suspend ${user.name}`;
      case "activate": return `Activate ${user.name}`;
      case "delete": return `Delete ${user.name}`;
      default: return "";
    }
  };

  const actionMessage = (type: string, user: UserRow) => {
    switch (type) {
      case "suspend": return `Are you sure you want to suspend ${user.name} (${user.email})? They will not be able to sign in or book services.`;
      case "activate": return `Are you sure you want to reactivate ${user.name} (${user.email})? They will regain full access.`;
      case "delete": return `Are you sure you want to permanently delete ${user.name} (${user.email})? This action cannot be undone. All their data will be marked as deleted.`;
      default: return "";
    }
  };

  return (
    <div>
      <h1 className="h1">Users</h1>
      <p className="sub">{data ? `${data.total} account${data.total === 1 ? "" : "s"}` : "All accounts"}</p>
      <div className="row" style={{ gap: 12, flexWrap: "wrap", marginTop: 16 }}>
        <div className="fld" style={{ minWidth: 240 }}>
          <label htmlFor="user-q">Search name or email</label>
          <input id="user-q" value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
        <div className="fld">
          <label htmlFor="user-role">Role</label>
          <select id="user-role" value={role} onChange={(e) => setRole(e.target.value)}>
            <option value="">All</option>
            <option value="customer">Customers</option>
            <option value="provider">Providers</option>
            <option value="admin">Admins</option>
          </select>
        </div>
      </div>
      <section className="card" style={{ marginTop: 8 }}>
        {loading ? <Skeleton variant="card" /> : error ? (
          <EmptyState title="Could not load users" description={error} action={{ label: "Try again", onClick: reload }} />
        ) : (data?.users.length ?? 0) === 0 ? (
          <EmptyState title="No users found" description="Try a different search." />
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table className="tbl" style={{ width: "100%" }}>
              <thead><tr><th align="left">Name</th><th align="left">Email</th><th align="left">Role</th><th align="left">Status</th><th align="right">Bookings</th><th align="right">Wallet</th><th align="left">Joined</th><th align="left">Actions</th></tr></thead>
              <tbody>
                {data!.users.map((u) => (
                  <tr key={u.id}>
                    <td>{u.name}</td>
                    <td>{u.email}</td>
                    <td><StatusBadge status={u.role === "admin" ? "active" : u.role === "provider" ? "verified" : "paid"} size="sm" /> {u.role}</td>
                    <td>{getStatusBadge(u.status)} {u.status}</td>
                    <td align="right">{u.bookings}</td>
                    <td align="right">{formatNpr(u.wallet)}</td>
                    <td>{new Date(u.createdAt).toLocaleDateString()}</td>
                    <td>{getActionButtons(u)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
      {pendingAction && (
        <ConfirmDialog
          open
          onClose={() => setPendingAction(null)}
          onConfirm={handleAction}
          title={actionTitle(pendingAction.type, pendingAction.user)}
          message={actionMessage(pendingAction.type, pendingAction.user)}
          confirmLabel={pendingAction.type === "delete" ? "Delete permanently" : pendingAction.type === "suspend" ? "Suspend" : "Activate"}
          variant="danger"
          loading={actionLoading}
        >
          <div style={{ marginTop: 16 }}>
            <label style={{ display: "block", marginBottom: 8 }}>Audit note (required for delete, optional otherwise)</label>
            <textarea
              value={auditNote}
              onChange={(e) => setAuditNote(e.target.value)}
              placeholder="Reason for this action..."
              style={{ width: "100%", minHeight: 80, padding: 8, borderRadius: 4, border: "1px solid var(--line)" }}
              required={pendingAction.type === "delete"}
            />
          </div>
        </ConfirmDialog>
      )}
    </div>
  );
}
