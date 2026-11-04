"use client";

import type { ReactNode } from "react";

export type Role = "customer" | "provider" | "admin";

export interface NavItem {
  href: string;
  label: string;
  icon: ReactNode;
  roles?: Role[];
  badge?: number | string;
  section?: string;
}

export interface NavSection {
  label: string;
  items: NavItem[];
}

export const NAV_SECTIONS: Record<Role, NavSection[]> = {
  customer: [
    {
      label: "Main",
      items: [
        { href: "/client", label: "Overview", icon: HomeIcon(), section: "Main" },
        { href: "/booking", label: "Book a service", icon: CalendarPlusIcon(), section: "Main" },
      ],
    },
    {
      label: "My Activity",
      items: [
        { href: "/client/bookings", label: "My bookings", icon: CalendarIcon(), section: "My Activity" },
        { href: "/client/offers", label: "Offers", icon: TagIcon(), section: "My Activity", badge: "pending" },
        { href: "/client/messages", label: "Messages", icon: ChatIcon(), section: "My Activity", badge: "unread" },
        { href: "/client/favorites", label: "Favorites", icon: HeartIcon(), section: "My Activity" },
        { href: "/client/rewards", label: "Rewards", icon: GiftIcon(), section: "My Activity" },
        { href: "/client/safety", label: "Safety", icon: ShieldIcon(), section: "My Activity" },
      ],
    },
    {
      label: "Account",
      items: [
        { href: "/client/notifications", label: "Notifications", icon: BellIcon(), section: "Account", badge: "unread" },
        { href: "/client/profile", label: "Profile", icon: UserIcon(), section: "Account" },
        { href: "/client/support", label: "Support", icon: HelpIcon(), section: "Account" },
      ],
    },
  ],
  provider: [
    {
      label: "Main",
      items: [
        { href: "/provider", label: "Overview", icon: HomeIcon(), section: "Main" },
        { href: "/provider/requests", label: "Requests", icon: InboxIcon(), section: "Main", badge: "pending" },
      ],
    },
    {
      label: "Services",
      items: [
        { href: "/provider/my-services", label: "My Services", icon: ScissorsIcon(), section: "Services" },
        { href: "/provider/services", label: "Catalogue Prices", icon: CurrencyIcon(), section: "Services" },
        { href: "/provider/availability", label: "Availability", icon: ClockIcon(), section: "Services" },
        { href: "/provider/travel", label: "Travel Settings", icon: MapPinIcon(), section: "Services" },
      ],
    },
    {
      label: "Manage",
      items: [
        { href: "/provider/messages", label: "Messages", icon: ChatIcon(), section: "Manage", badge: "unread" },
        { href: "/provider/staff", label: "Staff", icon: UsersIcon(), section: "Manage" },
        { href: "/provider/promotions", label: "Promotions", icon: MegaphoneIcon(), section: "Manage" },
        { href: "/provider/reviews", label: "Reviews", icon: StarIcon(), section: "Manage" },
      ],
    },
    {
      label: "Money",
      items: [
        { href: "/provider/earnings", label: "Earnings", icon: CurrencyIcon(), section: "Money" },
        { href: "/provider/payouts", label: "Payouts", icon: BankIcon(), section: "Money" },
      ],
    },
    {
      label: "Account",
      items: [
        { href: "/provider/profile", label: "Profile & Verification", icon: UserIcon(), section: "Account" },
        { href: "/provider/notifications", label: "Notifications", icon: BellIcon(), section: "Account", badge: "unread" },
      ],
    },
  ],
  admin: [
    {
      label: "Main",
      items: [
        { href: "/admin", label: "Overview", icon: HomeIcon(), section: "Main" },
        { href: "/admin/bookings", label: "Bookings", icon: CalendarIcon(), section: "Main" },
        { href: "/admin/live-map", label: "Live Map", icon: MapIcon(), section: "Main" },
      ],
    },
{
        label: "Manage",
        items: [
          { href: "/admin/providers", label: "Providers", icon: UsersIcon(), section: "Manage", badge: "pending" },
          { href: "/admin/users", label: "Users", icon: UserIcon(), section: "Manage" },
          { href: "/admin/disputes", label: "Disputes", icon: GavelIcon(), section: "Manage", badge: "open" },
          { href: "/admin/provider-services", label: "Provider Services", icon: ScissorsIcon(), section: "Manage" },
          { href: "/admin/catalogue", label: "Catalogue", icon: ScissorsIcon(), section: "Manage" },
          { href: "/admin/coupons", label: "Coupons & Campaigns", icon: TagIcon(), section: "Manage" },
          { href: "/admin/announcements", label: "Announcements", icon: MegaphoneIcon(), section: "Manage" },
        ],
      },
    {
      label: "Money",
      items: [
        { href: "/admin/commission", label: "Commission Settlement", icon: CurrencyIcon(), section: "Money" },
        { href: "/admin/reports", label: "Reports", icon: ChartIcon(), section: "Money" },
      ],
    },
    {
      label: "Settings",
      items: [
        { href: "/admin/settings", label: "Settings", icon: SettingsIcon(), section: "Account" },
      ],
    },
  ],
};

export function getNavForRole(role: Role): NavSection[] {
  return NAV_SECTIONS[role] || NAV_SECTIONS.customer;
}

export function getFlatNavForRole(role: Role): NavItem[] {
  return getNavForRole(role).flatMap((s) => s.items);
}

export const HOME_PATH: Record<Role, string> = {
  customer: "/client",
  provider: "/provider",
  admin: "/admin",
};

export const AREA_ACCESS: Record<string, Role[]> = {
  "/client": ["customer", "provider", "admin"],
  "/provider": ["provider", "admin"],
  "/admin": ["admin"],
  "/track": ["customer", "provider", "admin"],
  "/booking": ["customer", "provider", "admin"],
};

export function canAccessPath(pathname: string, role: Role): boolean {
  for (const [prefix, roles] of Object.entries(AREA_ACCESS)) {
    if (pathname.startsWith(prefix)) {
      return roles.includes(role);
    }
  }
  return true;
}

export function getHomePath(role: Role): string {
  return HOME_PATH[role] || "/";
}

export function canAccessBooking(
  user: { id: string; name: string; role: string } | null,
  booking: { user_id: string; provider_name: string }
): boolean {
  if (!user) return false;
  if (user.role === "admin") return true;
  if (booking.user_id === user.id) return true;
  if (booking.provider_name === user.name) return true;
  return false;
}

function HomeIcon(): React.ReactNode {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
      <polyline points="9 22 9 12 15 12 15 22" />
    </svg>
  );
}

function CalendarIcon(): React.ReactNode {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
      <line x1="16" y1="2" x2="16" y2="6" />
      <line x1="8" y1="2" x2="8" y2="6" />
      <line x1="3" y1="10" x2="21" y2="10" />
    </svg>
  );
}

function CalendarPlusIcon(): React.ReactNode {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
      <line x1="16" y1="2" x2="16" y2="6" />
      <line x1="8" y1="2" x2="8" y2="6" />
      <line x1="3" y1="10" x2="21" y2="10" />
      <line x1="12" y1="8" x2="12" y2="16" />
      <line x1="8" y1="12" x2="16" y2="12" />
    </svg>
  );
}

function TagIcon(): React.ReactNode {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z" />
      <line x1="7" y1="7" x2="7.01" y2="7" />
    </svg>
  );
}

function ChatIcon(): React.ReactNode {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
    </svg>
  );
}

function HeartIcon(): React.ReactNode {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M20.84 4.61a5.5 5.5 0 0 1 0 7.78l-12 12a5.5 5.5 0 0 1-7.78 0l-12-12a5.5 5.5 0 0 1 0-7.78l12-12a5.5 5.5 0 0 1 7.78 0z" />
    </svg>
  );
}

function GiftIcon(): React.ReactNode {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <polyline points="20 12 20 22 4 22 4 12" />
      <rect x="2" y="7" width="20" height="5" />
      <line x1="12" y1="22" x2="12" y2="7" />
      <path d="M12 7H7.5a2.5 2.5 0 0 1 0-5C11 2 12 7 12 7z" />
      <path d="M12 7H16.5a2.5 2.5 0 0 0 0-5C13 2 12 7 12 7z" />
    </svg>
  );
}

function ShieldIcon(): React.ReactNode {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
    </svg>
  );
}

function BellIcon(): React.ReactNode {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
      <path d="M13.73 21a2 2 0 0 1-3.46 0" />
    </svg>
  );
}

function UserIcon(): React.ReactNode {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
      <circle cx="12" cy="7" r="4" />
    </svg>
  );
}

function HelpIcon(): React.ReactNode {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="12" cy="12" r="10" />
      <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3" />
      <line x1="12" y1="17" x2="12.01" y2="17" />
    </svg>
  );
}

function InboxIcon(): React.ReactNode {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <polyline points="22 12 16 12 14 15 10 15 8 12 2 12" />
      <path d="M5.45 5.11L2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z" />
    </svg>
  );
}

function CurrencyIcon(): React.ReactNode {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <line x1="12" y1="1" x2="12" y2="23" />
      <path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
    </svg>
  );
}

function BankIcon(): React.ReactNode {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect x="2" y="3" width="20" height="18" rx="2" />
      <line x1="12" y1="9" x2="12" y2="21" />
    </svg>
  );
}

function UsersIcon(): React.ReactNode {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
      <path d="M16 3.13a4 4 0 0 1 0 7.75" />
    </svg>
  );
}

function ScissorsIcon(): React.ReactNode {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="6" cy="6" r="3" />
      <circle cx="6" cy="18" r="3" />
      <line x1="20" y1="4" x2="8.12" y2="15.88" />
      <line x1="14.47" y1="14.47" x2="20" y2="20" />
      <line x1="8.12" y1="8.12" x2="12" y2="12" />
    </svg>
  );
}

function ClockIcon(): React.ReactNode {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="12" cy="12" r="10" />
      <polyline points="12 6 12 12 16 14" />
    </svg>
  );
}

function MapPinIcon(): React.ReactNode {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
      <circle cx="12" cy="10" r="3" />
    </svg>
  );
}

function MegaphoneIcon(): React.ReactNode {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M3 11l18-5v12L3 14v-3z" />
      <path d="M11.6 16.8a3 3 0 1 1-5.8 1.6" />
    </svg>
  );
}

function StarIcon(): React.ReactNode {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
    </svg>
  );
}

function MapIcon(): React.ReactNode {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <polygon points="3 6 9 3 15 6 21 3 21 18 15 21 9 18 3 21 3 6" />
      <line x1="9" y1="3" x2="9" y2="18" />
      <line x1="15" y1="6" x2="15" y2="21" />
    </svg>
  );
}

function GavelIcon(): React.ReactNode {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M14.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4 10.5-10.5a2.12 2.12 0 0 1 3 3z" />
      <path d="m16 16 6-6" />
    </svg>
  );
}

function ChartIcon(): React.ReactNode {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <line x1="18" y1="20" x2="18" y2="10" />
      <line x1="12" y1="20" x2="12" y2="4" />
      <line x1="6" y1="20" x2="6" y2="14" />
    </svg>
  );
}

function SettingsIcon(): React.ReactNode {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" />
    </svg>
  );
}