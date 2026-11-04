"use client";

import { useState, useEffect } from "react";
import { ReactNode } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import Sidebar from "./Sidebar";
import Topbar from "./Topbar";
import { getFlatNavForRole, getHomePath } from "@/lib/nav";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";

interface Me {
  name: string;
  email: string;
  wallet: number;
  role?: string;
  providerId?: string;
}

interface AppShellProps {
  children: ReactNode;
}

export default function AppShell({ children }: AppShellProps) {
  const pathname = usePathname();
  const router = useRouter();
  const { user, loading, logout } = useAuth();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);

  const role = (user?.role ?? "loading") as "customer" | "provider" | "admin" | "loading";
  const me = user;

  const loadUnreadCount = async () => {
    try {
      const r = await api("/notifications");
      const d = await r.json();
      const notifications = d.notifications || [];
      setUnreadCount(notifications.filter((n: any) => !n.is_read).length);
    } catch {}
  };

  useEffect(() => {
    loadUnreadCount();
  }, []);

  useEffect(() => {
    setSidebarOpen(false);
  }, [pathname]);

  return (
    <div className="app-shell">
      <Sidebar
        role={role}
        isOpen={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
        collapsed={sidebarCollapsed}
        onToggleCollapse={() => setSidebarCollapsed(!sidebarCollapsed)}
        pathname={pathname}
        me={me}
      />
      <div className="app-main" style={{ marginLeft: sidebarCollapsed ? 72 : 240 }}>
        <Topbar
          role={role}
          onMenuClick={() => setSidebarOpen(true)}
          collapsed={sidebarCollapsed}
          unreadCount={unreadCount}
          setUnreadCount={setUnreadCount}
          me={me}
          onSwitchToClient={() => router.push("/client")}
        />
        <main className="app-content" style={{ padding: 24, maxWidth: 1280, margin: "0 auto" }}>
          {children}
        </main>
      </div>
      {sidebarOpen && (
        <div
          className="sidebar-overlay"
          onClick={() => setSidebarOpen(false)}
          aria-hidden={!sidebarOpen}
        />
      )}
      <BottomTabBar role={role} pathname={pathname} />
    </div>
  );
}

function BottomTabBar({ role, pathname }: { role: "customer" | "provider" | "admin" | "loading"; pathname: string }) {
  if (role === "loading") return null;
  const navItems = getFlatNavForRole(role);
  const topItems = navItems.slice(0, 4);

  return (
    <nav className="bottom-tab-bar" aria-label="Mobile navigation">
      {topItems.map((item) => {
        const isActive = pathname === item.href || (item.href !== getHomePath(role) && pathname.startsWith(item.href + "/"));
        return (
          <Link
            key={item.href}
            href={item.href}
            className={`bottom-tab-item ${isActive ? "active" : ""}`}
            aria-current={isActive ? "page" : undefined}
          >
            <span className="bottom-tab-icon" aria-hidden="true">{item.icon}</span>
            <span>{item.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}