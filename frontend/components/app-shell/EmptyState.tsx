"use client";

import { ReactNode } from "react";

interface EmptyStateProps {
  icon?: ReactNode;
  title: string;
  description?: string;
  action?: { label: string; onClick: () => void; variant?: "primary" | "outline" };
  className?: string;
}

export default function EmptyState({ icon, title, description, action, className }: EmptyStateProps) {
  return (
    <div className={`empty-state ${className || ""}`} role="status">
      {icon && <div className="empty-icon" aria-hidden="true">{icon}</div>}
      <h3 className="empty-title">{title}</h3>
      {description && <p className="empty-description">{description}</p>}
      {action && (
        <button
          className={`btn ${action.variant === "outline" ? "btn-outline" : "btn-primary"}`}
          onClick={action.onClick}
        >
          {action.label}
        </button>
      )}
    </div>
  );
}