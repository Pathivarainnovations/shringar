"use client";

import { ReactNode } from "react";

interface StatCardProps {
  label: string;
  value: ReactNode;
  trend?: { value: string; positive: boolean };
  icon?: ReactNode;
}

export default function StatCard({ label, value, trend, icon }: StatCardProps) {
  return (
    <div className="stat-card">
      <div className="stat-header">
        <span className="stat-label">{label}</span>
        {icon && <span className="stat-icon" aria-hidden="true">{icon}</span>}
      </div>
      <div className="stat-value">{value}</div>
      {trend && (
        <div className={`stat-trend ${trend.positive ? "positive" : "negative"}`}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
            {trend.positive ? (
              <polyline points="23 6 13.5 15.5 8.5 10.5" />
            ) : (
              <polyline points="1 18 10.5 10.5 15.5 15.5" />
            )}
          </svg>
          {trend.value}
        </div>
      )}
    </div>
  );
}