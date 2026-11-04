"use client";

import { ReactNode } from "react";

interface Tab {
  id: string;
  label: string;
  icon?: ReactNode;
  count?: number;
  disabled?: boolean;
}

interface TabsProps {
  tabs: readonly Tab[];
  activeTab: string;
  onChange: (tabId: string) => void;
  className?: string;
  style?: React.CSSProperties;
  variant?: "line" | "pills" | "enclosed";
}

export default function Tabs({ tabs, activeTab, onChange, className, variant = "line" }: TabsProps) {
  return (
    <div className={`tabs tabs-${variant} ${className || ""}`} role="tablist" aria-label="Tabs">
      {tabs.map((tab) => (
        <button
          key={tab.id}
          role="tab"
          aria-selected={activeTab === tab.id}
          aria-controls={`panel-${tab.id}`}
          id={`tab-${tab.id}`}
          className={`tab ${activeTab === tab.id ? "active" : ""} ${tab.disabled ? "disabled" : ""}`}
          onClick={() => !tab.disabled && onChange(tab.id)}
          disabled={tab.disabled}
        >
          {tab.icon && <span className="tab-icon" aria-hidden="true">{tab.icon}</span>}
          <span className="tab-label">{tab.label}</span>
          {tab.count !== undefined && tab.count > 0 && (
            <span className="tab-count" aria-label={`${tab.count} items`}>{tab.count}</span>
          )}
        </button>
      ))}
      {variant === "line" && (
        <div className="tab-indicator" style={{ width: "0" }} aria-hidden="true" />
      )}
    </div>
  );
}

interface TabPanelProps {
  id: string;
  activeTab: string;
  children: ReactNode;
  className?: string;
}

export function TabPanel({ id, activeTab, children, className }: TabPanelProps) {
  if (activeTab !== id) return null;
  return (
    <div
      role="tabpanel"
      id={`panel-${id}`}
      aria-labelledby={`tab-${id}`}
      className={`tab-panel ${className || ""}`}
      tabIndex={0}
    >
      {children}
    </div>
  );
}