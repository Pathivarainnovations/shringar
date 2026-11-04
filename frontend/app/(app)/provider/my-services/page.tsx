"use client";

import { useCallback, useEffect, useState } from "react";
import { send } from "@/lib/api";
import { useApi } from "@/lib/hooks";
import { formatNpr } from "@/lib/pricing";
import { EmptyState, Skeleton, StatCard, StatusBadge, ConfirmDialog, useToast } from "@/components/app-shell";
import type { ProviderCustomService, ServiceStatus, TimeSlot, ServiceImage, ApprovalHistory } from "@/lib/custom-service-types";

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

interface ServiceRow extends ProviderCustomService {
  areas_parsed: number[];
  working_days_parsed: number[];
  time_slots_parsed: TimeSlot[];
  additional_charges_parsed: { name: string; amount: number; description?: string }[];
  tags_parsed: string[];
  images: ServiceImage[];
  availability: TimeSlot[];
  approval_history: ApprovalHistory[];
}

function parseJson<T>(field: string | null, fallback: T): T {
  if (!field) return fallback;
  try { return JSON.parse(field); } catch { return fallback; }
}

function parseService(s: ProviderCustomService): ServiceRow {
  return {
    ...s,
    areas_parsed: parseJson(s.areas, []),
    working_days_parsed: parseJson(s.working_days, []),
    time_slots_parsed: parseJson(s.time_slots, []),
    additional_charges_parsed: parseJson(s.additional_charges, []),
    tags_parsed: parseJson(s.tags, []),
    images: s.images || [],
    availability: s.availability || [],
    approval_history: s.approval_history || [],
  };
}

const DAY_NAMES = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export default function ProviderMyServicesPage() {
  const { showToast } = useToast();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<ServiceStatus | "all">("all");
  const [page, setPage] = useState(1);
  const [pageSize] = useState(10);
  const [total, setTotal] = useState(0);
  
  const [confirmAction, setConfirmAction] = useState<{ type: "delete" | "duplicate"; service: ServiceRow } | null>(null);
  const [actionLoading, setActionLoading] = useState(false);
  const [auditNote, setAuditNote] = useState("");

  const { data, error, loading, reload } = useApi<{ services: ProviderCustomService[] }>(
    `/provider/custom-services`
  );

  // Compute stats from data
  const stats = {
    total: data?.services.length ?? 0,
    published: data?.services.filter(s => s.is_published && s.status === "approved").length ?? 0,
    pending_approval: data?.services.filter(s => s.status === "pending_approval").length ?? 0,
    rejected: data?.services.filter(s => s.status === "rejected").length ?? 0,
    draft: data?.services.filter(s => s.status === "draft").length ?? 0,
    suspended: data?.services.filter(s => s.status === "suspended").length ?? 0,
    inactive: data?.services.filter(s => s.status === "inactive").length ?? 0,
  };

  // Filter and paginate
  const filteredServices = (data?.services ?? [])
    .map(parseService)
    .filter(s => {
      if (statusFilter !== "all" && s.status !== statusFilter) return false;
      if (search.trim()) {
        const q = search.toLowerCase();
        if (!s.name.toLowerCase().includes(q) && 
            !s.description?.toLowerCase().includes(q) &&
            !s.tags_parsed.some(t => t.toLowerCase().includes(q))) {
          return false;
        }
      }
      return true;
    })
    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

  const paginatedServices = filteredServices.slice((page - 1) * pageSize, page * pageSize);
  const totalPages = Math.ceil(filteredServices.length / pageSize);

  async function handleAction() {
    if (!confirmAction) return;
    setActionLoading(true);
    try {
      if (confirmAction.type === "delete") {
        const res = await send(`/provider/custom-services/${confirmAction.service.id}`, "DELETE", { note: auditNote });
        if (!res.ok) throw new Error(res.error);
        showToast({ type: "success", title: "Service deleted" });
      } else if (confirmAction.type === "duplicate") {
        const res = await send(`/provider/custom-services/${confirmAction.service.id}/duplicate`, "POST");
        if (!res.ok) throw new Error(res.error);
        showToast({ type: "success", title: "Service duplicated" });
      }
      setAuditNote("");
      setConfirmAction(null);
      reload();
    } catch (e: any) {
      showToast({ type: "error", title: e.message });
    } finally {
      setActionLoading(false);
    }
  }

  async function toggleStatus(service: ServiceRow, active: boolean) {
    const res = await send(`/provider/custom-services/${service.id}/status`, "PATCH", { is_active: active });
    if (!res.ok) return showToast({ type: "error", title: res.error });
    showToast({ type: "success", title: active ? "Service activated" : "Service deactivated" });
    reload();
  }

  async function submitForApproval(service: ServiceRow) {
    const res = await send(`/provider/custom-services/${service.id}`, "PATCH", { submit_for_approval: true });
    if (!res.ok) return showToast({ type: "error", title: res.error });
    showToast({ type: "success", title: "Service submitted for approval" });
    reload();
  }

  const confirmDelete = (service: ServiceRow) => {
    setAuditNote("");
    setConfirmAction({ type: "delete", service });
  };

  const confirmDuplicate = (service: ServiceRow) => {
    setConfirmAction({ type: "duplicate", service });
  };

  const actionTitle = (type: string, service: ServiceRow) => {
    return type === "delete" ? `Delete "${service.name}"` : `Duplicate "${service.name}"`;
  };

  const actionMessage = (type: string, service: ServiceRow) => {
    if (type === "delete") {
      return `Are you sure you want to delete "${service.name}"? This will archive the service. Existing bookings will keep their details.`;
    }
    return `Create a copy of "${service.name}"? The duplicate will be saved as a draft.`;
  };

  if (loading) {
    return (
      <div>
        <h1 className="h1">My Services</h1>
        <p className="sub">Manage your custom services</p>
        {[...Array(4)].map((_, i) => (
          <Skeleton key={i} variant="card" />
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <div>
        <h1 className="h1">My Services</h1>
        <EmptyState title="Could not load services" description={error} action={{ label: "Try again", onClick: reload }} />
      </div>
    );
  }

  return (
    <div>
      <h1 className="h1">My Services</h1>
      <p className="sub">Create, manage, and track your custom services</p>

      {/* Stats */}
      <div className="grid4" style={{ marginTop: 24, gap: 16 }}>
        <StatCard label="Total Services" value={stats.total} />
        <StatCard label="Published" value={stats.published} />
        <StatCard label="Pending Approval" value={stats.pending_approval} />
        <StatCard label="Drafts" value={stats.draft} />
      </div>

      {/* Filters */}
      <section className="card" style={{ marginTop: 16 }}>
        <div className="row" style={{ gap: 16, flexWrap: "wrap", alignItems: "flex-end" }}>
          <div className="fld" style={{ minWidth: 240, flex: 1 }}>
            <label htmlFor="service-search">Search</label>
            <input
              id="service-search"
              placeholder="Search by name, description, or tags..."
              value={search}
              onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            />
          </div>
          <div className="fld">
            <label htmlFor="status-filter">Status</label>
            <select
              id="status-filter"
              value={statusFilter}
              onChange={(e) => { setStatusFilter(e.target.value as ServiceStatus | "all"); setPage(1); }}
            >
              <option value="all">All Statuses</option>
              <option value="draft">Draft</option>
              <option value="pending_approval">Pending Approval</option>
              <option value="approved">Approved</option>
              <option value="rejected">Rejected</option>
              <option value="modification_requested">Modifications Requested</option>
              <option value="suspended">Suspended</option>
              <option value="inactive">Inactive</option>
            </select>
          </div>
        </div>
      </section>

      {/* Services Table */}
      <section className="card" style={{ marginTop: 16 }}>
        {paginatedServices.length === 0 ? (
          <EmptyState
            title={search || statusFilter !== "all" ? "No matching services" : "No custom services yet"}
            description={search || statusFilter !== "all" 
              ? "Try adjusting your filters" 
              : "Create your first custom service to offer unique services to customers."}
            action={search || statusFilter !== "all" ? undefined : { label: "Add Service", onClick: () => window.location.href = "/provider/custom-services/add" }}
          />
        ) : (
          <>
            <div style={{ overflowX: "auto" }}>
              <table className="tbl" style={{ width: "100%" }}>
                <thead>
                  <tr>
                    <th align="left">Service</th>
                    <th align="left">Category</th>
                    <th align="left">Pricing</th>
                    <th align="left">Coverage</th>
                    <th align="left">Status</th>
                    <th align="left">Published</th>
                    <th align="left">Created</th>
                    <th align="left">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {paginatedServices.map((s) => (
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
                              {s.tags_parsed.length > 3 && (
                                <span className="badge" style={{ fontSize: 11 }}>+{s.tags_parsed.length - 3} more</span>
                              )}
                            </div>
                          )}
                        </div>
                      </td>
                      <td>
                        {s.category_id ? (
                          <span>{s.category_id}</span>
                        ) : s.custom_category_name ? (
                          <span>{s.custom_category_name} <span className="mut">(custom)</span></span>
                        ) : (
                          <span className="mut">Uncategorized</span>
                        )}
                      </td>
                      <td>
                        <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                          <strong>{formatNpr(s.price)}</strong>
                          <span className="mut" style={{ fontSize: 12, textTransform: "capitalize" }}>
                            {s.pricing_type.replace("_", " ")}
                          </span>
                          {s.min_price && (
                            <span className="mut" style={{ fontSize: 11 }}>
                              From {formatNpr(s.min_price)}
                            </span>
                          )}
                        </div>
                      </td>
                      <td>
                        <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                          <span className="mut" style={{ fontSize: 12 }}>
                            {s.areas_parsed.length > 0 ? s.areas_parsed.length + " area(s)" : "All areas"}
                          </span>
                          <span className="mut" style={{ fontSize: 11, textTransform: "capitalize" }}>
                            {s.service_type.replace("_", " ")}
                          </span>
                        </div>
                      </td>
                      <td>
                        <StatusBadge status={STATUS_VARIANTS[s.status]} size="sm" />
                        <span style={{ marginLeft: 8 }}>{STATUS_LABELS[s.status]}</span>
                        {s.requires_reapproval && (
                          <span className="badge warning" style={{ marginLeft: 8, fontSize: 11 }}>Needs Reapproval</span>
                        )}
                      </td>
                      <td>
                        <span style={{ 
                          display: "inline-flex", 
                          alignItems: "center", 
                          gap: 6,
                          padding: "4px 8px",
                          borderRadius: 9999,
                          background: s.is_published ? "var(--success-bg)" : "var(--bg)",
                          color: s.is_published ? "var(--success)" : "var(--muted)"
                        }}>
                          {s.is_published ? "🟢 Published" : "⚪ Draft"}
                        </span>
                      </td>
                      <td>{new Date(s.created_at).toLocaleDateString()}</td>
                      <td>
                        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                          <button 
                            className="btn btn-primary btn-sm" 
                            onClick={() => window.location.href = `/provider/custom-services/${s.id}/edit`}
                          >
                            Edit
                          </button>
                          
                          {s.status === "draft" && (
                            <>
                              <button 
                                className="btn btn-outline btn-sm" 
                                onClick={() => submitForApproval(s)}
                              >
                                Submit
                              </button>
                              <button 
                                className="btn btn-outline btn-sm" 
                                onClick={() => confirmDuplicate(s)}
                              >
                                Duplicate
                              </button>
                            </>
                          )}
                          
                          {["approved", "suspended", "inactive", "rejected", "modification_requested"].includes(s.status) && (
                            <>
                              {s.status === "approved" && s.is_published && (
                                <button 
                                  className="btn btn-outline btn-sm" 
                                  onClick={() => toggleStatus(s, false)}
                                >
                                  Unpublish
                                </button>
                              )}
                              {s.status === "approved" && !s.is_published && (
                                <button 
                                  className="btn btn-primary btn-sm" 
                                  onClick={() => toggleStatus(s, true)}
                                >
                                  Publish
                                </button>
                              )}
                              {s.status === "suspended" && (
                                <button 
                                  className="btn btn-primary btn-sm" 
                                  onClick={() => toggleStatus(s, true)}
                                >
                                  Restore
                                </button>
                              )}
                              {s.status === "inactive" && (
                                <button 
                                  className="btn btn-primary btn-sm" 
                                  onClick={() => toggleStatus(s, true)}
                                >
                                  Activate
                                </button>
                              )}
                              {s.status === "rejected" && (
                                <button 
                                  className="btn btn-primary btn-sm" 
                                  onClick={() => submitForApproval(s)}
                                >
                                  Resubmit
                                </button>
                              )}
                              {s.status === "modification_requested" && (
                                <button 
                                  className="btn btn-primary btn-sm" 
                                  onClick={() => submitForApproval(s)}
                                >
                                  Resubmit
                                </button>
                              )}
                              <button 
                                className="btn btn-outline btn-sm" 
                                onClick={() => confirmDelete(s)}
                              >
                                Delete
                              </button>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="row" style={{ justifyContent: "center", marginTop: 16, gap: 8 }}>
                <button 
                  className="btn btn-outline btn-sm" 
                  onClick={() => setPage(p => Math.max(1, p - 1))}
                  disabled={page === 1}
                >
                  Previous
                </button>
                <span style={{ display: "flex", alignItems: "center" }}>
                  Page {page} of {totalPages}
                </span>
                <button 
                  className="btn btn-outline btn-sm" 
                  onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                  disabled={page === totalPages}
                >
                  Next
                </button>
              </div>
            )}
          </>
        )}
      </section>

      {/* Add Service Button */}
      <div style={{ marginTop: 24, textAlign: "center" }}>
        <a href="/provider/custom-services/add" className="btn btn-primary btn-lg">
          + Add New Service
        </a>
      </div>

      {/* Confirmation Dialog */}
      {confirmAction && (
        <ConfirmDialog
          open
          onClose={() => setConfirmAction(null)}
          onConfirm={handleAction}
          title={actionTitle(confirmAction.type, confirmAction.service)}
          message={actionMessage(confirmAction.type, confirmAction.service)}
          confirmLabel={confirmAction.type === "delete" ? "Delete" : "Duplicate"}
          variant="danger"
          loading={actionLoading}
        >
          <div style={{ marginTop: 16 }}>
            <label style={{ display: "block", marginBottom: 8 }}>Audit note (required for delete)</label>
            <textarea
              value={auditNote}
              onChange={(e) => setAuditNote(e.target.value)}
              placeholder="Reason for this action..."
              style={{ width: "100%", minHeight: 80, padding: 8, borderRadius: 4, border: "1px solid var(--line)" }}
              required={confirmAction.type === "delete"}
            />
          </div>
        </ConfirmDialog>
      )}
    </div>
  );
}