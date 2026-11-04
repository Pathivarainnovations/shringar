"use client";

import { api } from "@/lib/api";

import { useState, useRef, useEffect } from "react";
import Link from "next/link";
import { useRouter, usePathname } from "next/navigation";
import { useAuth } from "@/lib/auth-context";

interface TopbarProps {
  role: "customer" | "provider" | "admin" | "loading";
  onMenuClick: () => void;
  collapsed: boolean;
  unreadCount: number;
  setUnreadCount: (count: number | ((prev: number) => number)) => void;
  me: { name: string; email: string; role?: string; providerId?: string } | null;
  onSwitchToClient: () => void;
}

export default function Topbar({
  role,
  onMenuClick,
  collapsed,
  unreadCount,
  setUnreadCount,
  me,
  onSwitchToClient,
}: TopbarProps) {
  const router = useRouter();
  const pathname = usePathname();
  const { logout } = useAuth();
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const [notifications, setNotifications] = useState<any[]>([]);
  const [loadingNotifications, setLoadingNotifications] = useState(false);
  const notificationsRef = useRef<HTMLDivElement>(null);
  const userMenuRef = useRef<HTMLDivElement>(null);

  const firstName = me?.name?.split(" ")[0] || "";
  const pageTitle = getPageTitle(pathname);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (notificationsRef.current && !notificationsRef.current.contains(event.target as Node)) {
        setNotificationsOpen(false);
      }
      if (userMenuRef.current && !userMenuRef.current.contains(event.target as Node)) {
        setUserMenuOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const loadNotifications = async () => {
    setLoadingNotifications(true);
    try {
      const r = await api("/notifications");
      const d = await r.json();
      setNotifications(d.notifications || []);
    } catch {}
    setLoadingNotifications(false);
  };

  useEffect(() => {
    if (notificationsOpen) {
      loadNotifications();
    }
  }, [notificationsOpen]);

  const markNotificationRead = async (id: string) => {
    try {
      await api(`/notifications/${id}/read`, { method: "PATCH" });
      setNotifications((prev) => prev.map((n) => (n.id === id ? { ...n, is_read: true } : n)));
      setUnreadCount((prev) => Math.max(0, prev - 1));
    } catch {}
  };

  return (
    <header className="app-topbar">
      <div className="topbar-left">
        <button
          type="button"
          className="hamburger-btn"
          onClick={onMenuClick}
          aria-label="Open menu"
          aria-expanded={false}
        >
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <line x1="3" y1="6" x2="21" y2="6" />
            <line x1="3" y1="12" x2="21" y2="12" />
            <line x1="3" y1="18" x2="21" y2="18" />
          </svg>
        </button>
        <p className="page-title">{pageTitle}</p>
      </div>

      <div className="topbar-center" />

      <div className="topbar-right">
        <div className="topbar-actions">
          {/* Notifications */}
          <div className="relative" ref={notificationsRef}>
            <button
              type="button"
              className="icon-btn"
              onClick={() => setNotificationsOpen(!notificationsOpen)}
              aria-label={`Notifications${unreadCount > 0 ? `, ${unreadCount} unread` : ""}`}
              aria-expanded={notificationsOpen}
              aria-haspopup="true"
            >
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
                <path d="M13.73 21a2 2 0 0 1-3.46 0" />
              </svg>
              {unreadCount > 0 && (
                <span className="notification-badge" aria-label={`${unreadCount} unread notifications`}>
                  {unreadCount > 9 ? "9+" : unreadCount}
                </span>
              )}
            </button>
            {notificationsOpen && (
              <div className="dropdown notifications-dropdown" role="menu">
                <div className="dropdown-header">
                  <h3>Notifications</h3>
                  <button className="btn-link" onClick={() => router.push("/client/notifications")}>
                    View all
                  </button>
                </div>
                <div className="dropdown-body">
                  {loadingNotifications ? (
                    <p className="empty-state">Loading notifications...</p>
                  ) : notifications.length === 0 ? (
                    <p className="empty-state">No notifications</p>
                  ) : (
                    notifications.slice(0, 5).map((n) => (
                      <Link
                        key={n.id}
                        href={n.data?.bookingId ? `/track/${n.data.bookingId}` : "/client/notifications"}
                        className="dropdown-item"
                        onClick={() => {
                          setNotificationsOpen(false);
                          markNotificationRead(n.id);
                        }}
                        role="menuitem"
                      >
                        <span className="notification-icon" aria-hidden="true">
                          {n.type === "booking" && <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="4" width="18" height="18" rx="2" /><line x1="16" y1="2" x2="16" y2="6" /><line x1="8" y1="2" x2="8" y2="6" /><line x1="3" y1="10" x2="21" y2="10" /></svg>}
                          {n.type === "offer" && <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z" /><line x1="7" y1="7" x2="7.01" y2="7" /></svg>}
                          {n.type === "message" && <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" /></svg>}
                          {n.type === "payment" && <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="12" y1="1" x2="12" y2="23" /><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" /></svg>}
                          {n.type === "default" && <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" /><path d="M13.73 21a2 2 0 0 1-3.46 0" /></svg>}
                        </span>
                        <div className="notification-content">
                          <span className="notification-title">{n.title}</span>
                          <span className="notification-message">{n.message}</span>
                        </div>
                        {!n.is_read && <span className="notification-dot" aria-hidden="true" />}
                      </Link>
                    ))
                  )}
                </div>
              </div>
            )}
          </div>

          {/* User Menu */}
          <div className="relative" ref={userMenuRef}>
            <button
              type="button"
              className="user-menu-btn"
              onClick={() => setUserMenuOpen(!userMenuOpen)}
              aria-label={`Account menu for ${firstName}`}
              aria-expanded={userMenuOpen}
              aria-haspopup="true"
            >
              <div className="user-avatar" aria-hidden="true">
                {firstName.charAt(0).toUpperCase()}
              </div>
              {!collapsed && <span className="user-name">{firstName}</span>}
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <polyline points="18 15 12 9 6 15" />
              </svg>
            </button>
            {userMenuOpen && (
              <div className="dropdown user-dropdown" role="menu">
                <div className="dropdown-header">
                  <div className="user-card-small">
                    <div className="user-avatar" aria-hidden="true">{firstName.charAt(0).toUpperCase()}</div>
                    <div>
                      <span className="user-name">{me?.name}</span>
                      <span className="user-email-small">{me?.email}</span>
                    </div>
                  </div>
                </div>
                <div className="dropdown-divider" />
                <Link href="/client/profile" className="dropdown-item" onClick={() => setUserMenuOpen(false)} role="menuitem">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                    <circle cx="12" cy="7" r="4" />
                  </svg>
                  Profile
                </Link>
                {(role !== "loading" && (role === "admin" || role === "provider")) && (
                  <button className="dropdown-item" onClick={onSwitchToClient} role="menuitem">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M21 12V7H5V7M16 7l-4-4-4 4M12 17v4" />
                    </svg>
                    Switch to Client view
                  </button>
                )}
                <div className="dropdown-divider" />
                <button className="dropdown-item logout-item" onClick={logout} role="menuitem">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
                    <polyline points="16 17 21 12 16 7" />
                    <line x1="21" y1="12" x2="9" y2="12" />
                  </svg>
                  Log out
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </header>
  );
}

function getPageTitle(pathname: string): string {
  const titles: Record<string, string> = {
    "/client": "Overview",
    "/client/bookings": "My Bookings",
    "/client/offers": "Offers",
    "/client/messages": "Messages",
    "/client/favorites": "Favorites",
    "/client/rewards": "Rewards",
    "/client/safety": "Safety",
    "/client/notifications": "Notifications",
    "/client/profile": "Profile",
    "/client/support": "Support",
    "/provider": "Overview",
    "/provider/requests": "Requests",
    "/provider/messages": "Messages",
    "/provider/earnings": "Earnings",
    "/provider/payouts": "Payouts",
    "/provider/staff": "Staff",
    "/provider/services": "Services & Prices",
    "/provider/availability": "Availability",
    "/provider/travel": "Travel Settings",
    "/provider/promotions": "Promotions",
    "/provider/reviews": "Reviews",
    "/provider/profile": "Profile & Verification",
    "/provider/notifications": "Notifications",
    "/admin": "Overview",
    "/admin/bookings": "All Bookings",
    "/admin/live-map": "Live Map",
    "/admin/providers": "Providers",
    "/admin/catalogue": "Catalogue",
    "/admin/users": "Users",
    "/admin/disputes": "Disputes",
    "/admin/coupons": "Coupons & Campaigns",
    "/admin/commission": "Commission Settlement",
    "/admin/reports": "Reports",
    "/admin/announcements": "Announcements",
    "/admin/settings": "Settings",
    "/track": "Live Tracking",
    "/booking": "Book a Service",
  };

  if (titles[pathname]) return titles[pathname];

  for (const [path, title] of Object.entries(titles)) {
    if (path !== "/client" && path !== "/provider" && path !== "/admin" && pathname.startsWith(path + "/")) {
      return title;
    }
  }

  return "Dashboard";
}