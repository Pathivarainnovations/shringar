"use client";

import { useCallback, useEffect, useState } from "react";
import { api, send } from "@/lib/api";
import { formatNpr } from "@/lib/pricing";
import { EmptyState, Skeleton, StatusBadge, StatCard, useToast, ConfirmDialog } from "@/components/app-shell";
import type { ProviderCustomService, ServiceStatus, TimeSlot } from "@/lib/custom-service-types";

const STATUS_LABELS: Record<ServiceStatus, string> = {
  draft: "Draft",
  pending_approval: "Pending",
  approved: "Approved",
  rejected: "Rejected",
  suspended: "Suspended",
  inactive: "Inactive",
  modification_requested: "Modifications",
};

const STATUS_VARIANTS: Record<ServiceStatus, "active" | "pending" | "verified" | "paid" | "cancelled"> = {
  draft: "pending",
  pending_approval: "pending",
  approved: "active",
  rejected: "cancelled",
  suspended: "cancelled",
  inactive: "pending",
  modification_requested: "pending",
};

interface AdminService extends ProviderCustomService {
  provider_name: string;
  provider_type: string;
  provider_email: string;
  areas_parsed: number[];
  working_days_parsed: number[];
  time_slots_parsed: TimeSlot[];
  additional_charges_parsed: { name: string; amount: number; description?: string }[];
  tags_parsed: string[];
  images: { id: string; service_id: string; image_url: string; alt_text: string; sort_order: number; is_primary: boolean; created_at: string }[];
  availability: { id: string; service_id: string; day_of_week: number; start_time: string; end_time: string; is_active: boolean; created_at: string }[];
}

function parseJson<T>(field: string | null, fallback: T): T {
  if (!field) return fallback;
  try { return JSON.parse(field); } catch { return fallback; }
}

function parseService(s: ProviderCustomService & { provider_name?: string; provider_type?: string; provider_email?: string }): AdminService {
  return {
    ...s,
    provider_name: s.provider_name || "",
    provider_type: s.provider_type || "",
    provider_email: s.provider_email || "",
    areas_parsed: parseJson(s.areas, []),
    working_days_parsed: parseJson(s.working_days, []),
    time_slots_parsed: parseJson(s.time_slots, []),
    additional_charges_parsed: parseJson(s.additional_charges, []),
    tags_parsed: parseJson(s.tags, []),
    images: s.images || [],
    availability: s.availability || [],
  };
}

const json = { "Content-Type": "application/json" };

export default function AdminProviderServicesPage() {
  const { showToast } = useToast();
  const [loading, setLoading] = useState(true);
  const [services, setServices] = useState<AdminService[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize] = useState(10);
  const [statusFilter, setStatusFilter] = useState<ServiceStatus | "all">("all");
  const [search, setSearch] = useState("");
  const [providerFilter, setProviderFilter] = useState("");
  
  const [viewingService, setViewingService] = useState<AdminService | null>(null);
  const [confirmAction, setConfirmAction] = useState<{ type: string; service: AdminService; action: "approve" | "reject" | "suspend" | "restore" | "publish" | "unpublish" | "delete" } | null>(null);
  const [auditNote, setAuditNote] = useState("");
  const [actionLoading, setActionLoading] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (statusFilter !== "all") params.set("status", statusFilter);
      if (search.trim()) params.set("search", search.trim());
      if (providerFilter.trim()) params.set("providerId", providerFilter.trim());
      params.set("limit", String(pageSize));
      params.set("offset", String((page - 1) * pageSize));
      
      const res = await api(`/admin/provider-services?${params.toString()}`);
      const data = await res.json();
      setServices(data.services.map(parseService));
      setTotal(data.total);
    } catch {
      showToast({ type: "error", title: "Could not load services" });
    } finally {
      setLoading(false);
    }
  }, [statusFilter, search, providerFilter, page, pageSize, showToast]);

  useEffect(() => { load(); }, [load]);

  async function handleAction() {
    if (!confirmAction) return;
    setActionLoading(true);
    try {
      const { service, action } = confirmAction;
      let endpoint = "";
      let method: "POST" | "PATCH" | "DELETE" = "PATCH";
      let body: Record<string, any> = {};
      
      switch (action) {
        case "approve":
          endpoint = `/admin/provider-services/${service.id}/approve`;
          body = { publish_immediately: true, admin_notes: auditNote };
          break;
        case "reject":
          endpoint = `/admin/provider-services/${service.id}/reject`;
          body = { rejection_reason: auditNote };
          break;
        case "suspend":
          endpoint = `/admin/provider-services/${service.id}/suspend`;
          body = { reason: auditNote };
          break;
        case "restore":
          endpoint = `/admin/provider-services/${service.id}/restore`;
          break;
        case "publish":
          endpoint = `/admin/provider-services/${service.id}/publish`;
          body = { is_published: true };
          break;
        case "unpublish":
          endpoint = `/admin/provider-services/${service.id}/publish`;
          body = { is_published: false };
          break;
        case "delete":
          endpoint = `/admin/provider-services/${service.id}`;
          method = "DELETE";
          body = { note: auditNote };
          break;
      }
      
      const res = await send(endpoint, method, body);
      if (!res.ok) throw new Error(res.error);
      
      showToast({ type: "success", title: `Service ${action}d` });
      setAuditNote("");
      setConfirmAction(null);
      load();
    } catch (e: any) {
      showToast({ type: "error", title: e.message });
    } finally {
      setActionLoading(false);
    }
  }

  const openConfirm = (action: "approve" | "reject" | "suspend" | "restore" | "publish" | "unpublish" | "delete", service: AdminService) => {
    setAuditNote("");
    setConfirmAction({ type: action, service, action });
  };

  const actionTitle = (action: string, service: AdminService) => {
    const titles: Record<string, string> = {
      approve: `Approve "${service.name}"`,
      reject: `Reject "${service.name}"`,
      suspend: `Suspend "${service.name}"`,
      restore: `Restore "${service.name}"`,
      publish: `Publish "${service.name}"`,
      unpublish: `Unpublish "${service.name}"`,
      delete: `Delete "${service.name}"`,
    };
    return titles[action] || action;
  };

  const actionMessage = (action: string, service: AdminService) => {
    const messages: Record<string, string> = {
      approve: `Approve and publish "${service.name}" by ${service.provider_name}? The service will become available to customers immediately.`,
      reject: `Reject "${service.name}"? The provider will be notified with your reason.`,
      suspend: `Suspend "${service.name}"? The service will be hidden from customers but retained in the system.`,
      restore: `Restore "${service.name}"? The service will become active again.`,
      publish: `Publish "${service.name}"? It will appear in the customer marketplace.`,
      unpublish: `Unpublish "${service.name}"? It will be hidden from customers but remain approved.`,
      delete: `Permanently delete "${service.name}"? This action cannot be undone. All related data will be removed.`,
    };
    return messages[action] || `Are you sure you want to ${action} this service?`;
  };

  const actionRequiresNote = (action: string) => ["reject", "suspend", "delete"].includes(action);

  if (loading) {
    return (
      <div>
        <h1 className="h1">Provider Services</h1>
        <p className="sub">Review and approve provider-created services</p>
        {[...Array(3)].map((_, i) => (
          <Skeleton key={i} variant="card" />
        ))}
      </div>
    );
  }

  const stats = {
    total: services.length,
    draft: services.filter(s => s.status === "draft").length,
    pending_approval: services.filter(s => s.status === "pending_approval").length,
    approved: services.filter(s => s.status === "approved").length,
    rejected: services.filter(s => s.status === "rejected").length,
    suspended: services.filter(s => s.status === "suspended").length,
    inactive: services.filter(s => s.status === "inactive").length,
    published: services.filter(s => s.is_published && s.status === "approved").length,
  };

  return (
    <div>
      <h1 className="h1">Provider Services</h1>
      <p className="sub">Review and manage provider-created custom services</p>

      {/* Stats */}
      <div className="grid4" style={{ marginTop: 24, gap: 16 }}>
        <StatCard label="Total" value={total} />
        <StatCard label="Pending" value={stats.pending_approval} />
        <StatCard label="Approved" value={stats.approved} />
        <StatCard label="Published" value={stats.published} />
      </div>

      {/* Filters */}
      <section className="card" style={{ marginTop: 16 }}>
        <div className="row" style={{ gap: 16, flexWrap: "wrap", alignItems: "flex-end" }}>
          <div className="fld" style={{ minWidth: 240, flex: 1 }}>
            <label htmlFor="admin-search">Search</label>
            <input id="admin-search" placeholder="Service name, description..." value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }} />
          </div>
          <div className="fld">
            <label htmlFor="admin-status">Status</label>
            <select id="admin-status" value={statusFilter} onChange={(e) => { setStatusFilter(e.target.value as ServiceStatus | "all"); setPage(1); }}>
              <option value="all">All</option>
              <option value="pending_approval">Pending Approval</option>
              <option value="approved">Approved</option>
              <option value="rejected">Rejected</option>
              <option value="suspended">Suspended</option>
              <option value="draft">Draft</option>
              <option value="inactive">Inactive</option>
              <option value="modification_requested">Modifications</option>
            </select>
          </div>
        </div>
      </section>

      {/* Services Table */}
      <section className="card" style={{ marginTop: 16 }}>
        {services.length === 0 ? (
          <EmptyState title="No services found" description="Try adjusting your filters" />
        ) : (
          <>
            <div style={{ overflowX: "auto" }}>
              <table className="tbl" style={{ width: "100%" }}>
                <thead>
                  <tr>
                    <th align="left">Service</th>
                    <th align="left">Provider</th>
                    <th align="left">Category</th>
                    <th align="left">Price</th>
                    <th align="left">Status</th>
                    <th align="left">Published</th>
                    <th align="left">Submitted</th>
                    <th align="left">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {services.map((s) => (
                    <tr key={s.id}>
                      <td>
                        <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                          <strong>{s.name}</strong>
                          {s.short_description && <span className="mut" style={{ fontSize: 12 }}>{s.short_description}</span>}
                          {s.tags_parsed.length > 0 && (
                            <div style={{ display: "flex", gap: 4, marginTop: 4, flexWrap: "wrap" }}>
                              {s.tags_parsed.slice(0, 3).map(tag => (
                                <span key={tag} className="badge" style={{ fontSize: 11 }}>{tag}</span>
                              ))}
                              {s.tags_parsed.length > 3 && <span className="badge" style={{ fontSize: 11 }}>+{s.tags_parsed.length - 3}</span>}
                            </div>
                          )}
                        </div>
                      </td>
                      <td>
                        <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                          <strong>{s.provider_name}</strong>
                          <span className="mut" style={{ fontSize: 12 }}>{s.provider_type} • {s.provider_email}</span>
                        </div>
                      </td>
                      <td>
                        {s.category_id ? s.category_id : s.custom_category_name ? `${s.custom_category_name} (custom)` : <span className="mut">Uncategorized</span>}
                      </td>
                      <td>{formatNpr(s.price)}</td>
                      <td>
                        <StatusBadge status={STATUS_VARIANTS[s.status]} size="sm" />
                        <span style={{ marginLeft: 8 }}>{STATUS_LABELS[s.status]}</span>
                        {s.requires_reapproval && <span className="badge warning" style={{ marginLeft: 8, fontSize: 11 }}>Needs Reapproval</span>}
                      </td>
                      <td>
                        <span style={{ 
                          display: "inline-flex", alignItems: "center", gap: 6,
                          padding: "4px 8px", borderRadius: 9999,
                          background: s.is_published ? "var(--success-bg)" : "var(--bg)",
                          color: s.is_published ? "var(--success)" : "var(--muted)"
                        }}>
                          {s.is_published ? "🟢 Yes" : "⚪ No"}
                        </span>
                      </td>
                      <td>{s.submitted_at ? new Date(s.submitted_at).toLocaleDateString() : <span className="mut">—</span>}</td>
                      <td>
                        <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
                          <button className="btn btn-outline btn-sm" onClick={() => setViewingService(s)}>View</button>
                          
                          {s.status === "pending_approval" && (
                            <>
                              <button className="btn btn-primary btn-sm" onClick={() => openConfirm("approve", s)}>Approve</button>
                              <button className="btn btn-danger btn-sm" onClick={() => openConfirm("reject", s)}>Reject</button>
                              <button className="btn btn-outline btn-sm" onClick={() => openConfirm("reject", s)}>Request Changes</button>
                            </>
                          )}
                          
                          {s.status === "approved" && (
                            <>
                              {s.is_published ? (
                                <button className="btn btn-outline btn-sm" onClick={() => openConfirm("unpublish", s)}>Unpublish</button>
                              ) : (
                                <button className="btn btn-primary btn-sm" onClick={() => openConfirm("publish", s)}>Publish</button>
                              )}
                              <button className="btn btn-danger btn-sm" onClick={() => openConfirm("suspend", s)}>Suspend</button>
                            </>
                          )}
                          
                          {s.status === "suspended" && (
                            <button className="btn btn-primary btn-sm" onClick={() => openConfirm("restore", s)}>Restore</button>
                          )}
                          
                          {["rejected", "inactive", "draft"].includes(s.status) && (
                            <button className="btn btn-danger btn-sm" onClick={() => openConfirm("delete", s)}>Delete</button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            {Math.ceil(total / pageSize) > 1 && (
              <div className="row" style={{ justifyContent: "center", marginTop: 16, gap: 8 }}>
                <button className="btn btn-outline btn-sm" onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}>Previous</button>
                <span style={{ display: "flex", alignItems: "center" }}>Page {page} of {Math.ceil(total / pageSize)}</span>
                <button className="btn btn-outline btn-sm" onClick={() => setPage(p => Math.min(Math.ceil(total / pageSize), p + 1))} disabled={page >= Math.ceil(total / pageSize)}>Next</button>
              </div>
            )}
          </>
        )}
      </section>

      {/* View Service Modal */}
      {viewingService && (
        <ConfirmDialog
          open
          onClose={() => setViewingService(null)}
          onConfirm={() => {}}
          title={viewingService.name}
          message="Service details:"
          confirmLabel="Close"
          variant="primary"
        >
          <div style={{ maxWidth: 600 }}>
            <p><strong>Provider:</strong> {viewingService.provider_name} ({viewingService.provider_type})</p>
            <p><strong>Email:</strong> {viewingService.provider_email}</p>
            <p><strong>Category:</strong> {viewingService.category_id || viewingService.custom_category_name || "Uncategorized"}</p>
            <p><strong>Price:</strong> {formatNpr(viewingService.price)} ({viewingService.pricing_type.replace("_", " ")})</p>
            <p><strong>Type:</strong> {viewingService.service_type.replace("_", " ")}</p>
            <p><strong>Areas:</strong> {viewingService.areas_parsed.length > 0 ? viewingService.areas_parsed.length + " area(s)" : "All areas"}</p>
            <p><strong>Description:</strong></p>
            <div style={{ whiteSpace: "pre-wrap", maxHeight: 200, overflow: "auto", padding: 12, background: "var(--bg)", borderRadius: 4, border: "1px solid var(--line)" }}>
              {viewingService.description || "No description"}
            </div>
            {viewingService.images?.length > 0 && (
              <div style={{ marginTop: 16 }}>
                <p><strong>Images:</strong></p>
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                  {viewingService.images.map(img => (
                    <img key={img.id} src={img.image_url} alt={img.alt_text || viewingService.name} style={{ width: 100, height: 100, objectFit: "cover", borderRadius: 4, border: img.is_primary ? "2px solid var(--primary)" : "1px solid var(--line)" }} />
                  ))}
                </div>
              </div>
            )}
            {viewingService.whats_included && (
              <p style={{ marginTop: 16 }}><strong>Included:</strong> {viewingService.whats_included}</p>
            )}
            {viewingService.cancellation_policy && (
              <p><strong>Cancellation:</strong> {viewingService.cancellation_policy}</p>
            )}
          </div>
          <button className="btn btn-primary" onClick={() => setViewingService(null)}>Close</button>
        </ConfirmDialog>
      )}

      {/* Action Confirmation Dialog */}
      {confirmAction && (
        <ConfirmDialog
          open
          onClose={() => setConfirmAction(null)}
          onConfirm={handleAction}
          title={actionTitle(confirmAction.action, confirmAction.service)}
          message={actionMessage(confirmAction.action, confirmAction.service)}
          confirmLabel={confirmAction.action === "delete" ? "Delete permanently" : confirmAction.action.charAt(0).toUpperCase() + confirmAction.action.slice(1)}
          variant="danger"
          loading={actionLoading}
        >
          <div style={{ marginTop: 16 }}>
            <label style={{ display: "block", marginBottom: 8 }}>
              Audit note {actionRequiresNote(confirmAction.action) ? "(required)" : "(optional)"}
            </label>
            <textarea
              value={auditNote}
              onChange={(e) => setAuditNote(e.target.value)}
              placeholder="Reason for this action..."
              style={{ width: "100%", minHeight: 80, padding: 8, borderRadius: 4, border: "1px solid var(--line)" }}
              required={actionRequiresNote(confirmAction.action)}
            />
          </div>
        </ConfirmDialog>
      )}
    </div>
  );
}