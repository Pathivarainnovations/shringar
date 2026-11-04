"use client";

interface StatusBadgeProps {
  status: string;
  size?: "sm" | "md" | "lg";
}

const STATUS_CONFIG: Record<string, { label: string; className: string }> = {
  requested: { label: "Requested", className: "status-requested" },
  accepted: { label: "Accepted", className: "status-accepted" },
  on_the_way: { label: "On the way", className: "status-on-the-way" },
  arrived: { label: "Arrived", className: "status-arrived" },
  in_progress: { label: "In progress", className: "status-in-progress" },
  done: { label: "Done", className: "status-done" },
  completed: { label: "Completed", className: "status-completed" },
  cash_received: { label: "Cash received", className: "status-cash-received" },
  cancelled: { label: "Cancelled", className: "status-cancelled" },
  unpaid: { label: "Unpaid", className: "status-unpaid" },
  paid: { label: "Paid", className: "status-paid" },
  cash_due: { label: "Cash due", className: "status-cash-due" },
  pending: { label: "Pending", className: "status-pending" },
  approved: { label: "Approved", className: "status-approved" },
  rejected: { label: "Rejected", className: "status-rejected" },
  open: { label: "Open", className: "status-open" },
  under_review: { label: "Under review", className: "status-under-review" },
  resolved: { label: "Resolved", className: "status-resolved" },
  active: { label: "Active", className: "status-active" },
  false_alarm: { label: "False alarm", className: "status-false-alarm" },
  verified: { label: "Verified", className: "status-verified" },
  unverified: { label: "Unverified", className: "status-unverified" },
};

export default function StatusBadge({ status, size = "md" }: StatusBadgeProps) {
  const config = STATUS_CONFIG[status] || { label: status.replace(/_/g, " "), className: "status-default" };
  const sizeClass = size === "sm" ? "badge-sm" : size === "lg" ? "badge-lg" : "";

  return (
    <span className={`status-badge ${config.className} ${sizeClass}`} aria-label={config.label}>
      {config.label}
    </span>
  );
}