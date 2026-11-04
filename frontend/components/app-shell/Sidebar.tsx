"use client";

import { useAuth } from "@/lib/auth-context";

import Link from "next/link";
import { getNavForRole, getHomePath, type Role } from "@/lib/nav";

interface SidebarProps {
  role: "customer" | "provider" | "admin" | "loading";
  isOpen: boolean;
  onClose: () => void;
  collapsed: boolean;
  onToggleCollapse: () => void;
  pathname: string;
  me: { name: string; email: string; role?: string } | null;
}

export default function Sidebar({
  role,
  isOpen,
  onClose,
  collapsed,
  onToggleCollapse,
  pathname,
  me,
}: SidebarProps) {
  const { logout } = useAuth();
  const navSections = getNavForRole((role === "loading" ? "customer" : role) as Role);
  const firstName = me?.name?.split(" ")[0] || "";

  const getRoleBadgeColor = (r: string) => {
    switch (r) {
      case "admin": return "var(--rose)";
      case "provider": return "var(--gold)";
      case "loading": return "var(--muted)";
      default: return "var(--mint)";
    }
  };

  const getRoleBadgeLabel = (r: string) => {
    switch (r) {
      case "admin": return "Admin";
      case "provider": return "Provider";
      case "loading": return "Loading...";
      default: return "Client";
    }
  };

  const footer = (!collapsed && me) ? (
    <div className="sidebar-footer">
      <div className="user-card">
        <div className="user-avatar" aria-hidden="true">
          {firstName.charAt(0).toUpperCase()}
        </div>
        <div className="user-info">
          <span className="user-name">{firstName}</span>
          <span className="user-email">{me.email}</span>
        </div>
      </div>
      <button
        type="button"
        className="btn btn-outline btn-sm logout-btn"
        onClick={() => {
          onClose();
          logout();
        }}
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
          <polyline points="16 17 21 12 16 7" />
          <line x1="21" y1="12" x2="9" y2="12" />
        </svg>
        <span>Log out</span>
      </button>
    </div>
  ) : null;

  return (
    <aside
      className={`app-sidebar ${isOpen ? "open" : ""} ${collapsed ? "collapsed" : ""}`}
      aria-label="Main navigation"
    >
      <div className="sidebar-header">
        {!collapsed && (
          <Link href={getHomePath((role === "loading" ? "customer" : role) as Role)} className="sidebar-logo" onClick={onClose}>
            <span className="logo-text">Shringar</span>
            <span className="logo-dot" aria-hidden="true" />
          </Link>
        )}
        {!collapsed && (
          <span className="role-badge" style={{ background: getRoleBadgeColor(role) }}>
            {getRoleBadgeLabel(role)}
          </span>
        )}
        <button
          type="button"
          className="sidebar-toggle"
          onClick={onToggleCollapse}
          aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          aria-expanded={!collapsed}
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            {collapsed ? (
              <polyline points="9 18 15 12 9 6" />
            ) : (
              <polyline points="15 18 9 12 15 6" />
            )}
          </svg>
        </button>
      </div>

      <nav className="sidebar-nav" aria-label="App navigation">
        {navSections.map((section) => (
          <div key={section.label} className="nav-section">
            {!collapsed && (
              <span className="nav-section-label">{section.label}</span>
            )}
            <ul role="list">
              {section.items.map((item) => {
                const isActive = pathname === item.href || (item.href !== getHomePath((role === "loading" ? "customer" : role) as Role) && pathname.startsWith(item.href + "/"));
                const badgeCount = typeof item.badge === "string" ? 0 : item.badge || 0;
                return (
                  <li key={item.href}>
                    <Link
                      href={item.href}
                      className={`nav-link ${isActive ? "active" : ""}`}
                      onClick={onClose}
                      aria-current={isActive ? "page" : undefined}
                    >
                      <span className="nav-icon" aria-hidden="true">{item.icon}</span>
                      {!collapsed && <span className="nav-label">{item.label}</span>}
                      {isActive && !collapsed && <span className="active-indicator" aria-hidden="true" />}
                      {!collapsed && badgeCount > 0 && (
                        <span className="nav-badge" aria-label={`${badgeCount} items`}>
                          {badgeCount > 9 ? "9+" : badgeCount}
                        </span>
                      )}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </nav>

      {footer}

    </aside>
  );
}