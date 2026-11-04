"use client";

import type { Booking } from "@/lib/types";
import { formatHour, formatNpr } from "@/lib/pricing";
import { StatusBadge } from "@/components/app-shell";

export const LIVE_STATUSES = ["on_the_way", "arrived", "in_progress"];

export function serviceLabel(b: Booking, names?: Map<number, string>): string {
  if (b.services?.length) return b.services.map((s) => s.name).join(", ");
  return b.serviceIds.map((id) => names?.get(id) ?? `Service ${id}`).join(", ");
}

/** One-line summary block used by the booking lists on every role. */
export function BookingHeader({ b, names, who }: { b: Booking; names?: Map<number, string>; who?: string }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
      <div style={{ minWidth: 0 }}>
        <b>{serviceLabel(b, names)}</b>
        <div className="mut" style={{ fontSize: "0.8125rem", marginTop: 2 }}>
          {b.id} • {b.day} {formatHour(b.startHour)} • {b.mode === "home" ? "Home visit" : "Salon visit"}
          {who ? ` • ${who}` : ""}
        </div>
      </div>
      <div style={{ textAlign: "right" }}>
        <StatusBadge status={b.status} size="sm" />
        <div style={{ marginTop: 4 }}>
          <b>{formatNpr(b.total)}</b>
          {b.payStatus !== "unpaid" && b.status !== "cancelled" && (
            <span style={{ marginLeft: 6 }}>
              <StatusBadge status={b.payStatus} size="sm" />
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
