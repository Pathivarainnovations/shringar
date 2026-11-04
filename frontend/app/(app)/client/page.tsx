"use client";

import { useRouter } from "next/navigation";
import Link from "next/link";
import { useRoleApi, useServiceNames } from "@/lib/hooks";
import { formatNpr } from "@/lib/pricing";
import type { Booking } from "@/lib/types";
import { EmptyState, Skeleton, StatCard } from "@/components/app-shell";
import { BookingHeader } from "@/components/BookingBits";

export default function ClientHome() {
  const router = useRouter();
  const me = useRoleApi<{ user: { name: string; wallet: number } | null }>("/auth/me", ["customer", "provider", "admin"]);
  const bookings = useRoleApi<{ bookings: Booking[] }>("/bookings", ["customer"], 15000);
  const offers = useRoleApi<{ offers: unknown[] }>("/offers", ["customer"], 15000);
  const names = useServiceNames();

  const list = bookings.data?.bookings ?? [];
  const active = list.filter((b) => ["requested", "accepted", "on_the_way", "arrived", "in_progress"].includes(b.status));
  const completed = list.filter((b) => b.status === "done").length;
  const firstName = me.data?.user?.name?.split(" ")[0];

  return (
    <div>
      <h1 className="h1">{firstName ? `Welcome back, ${firstName}` : "Welcome back"}</h1>
      <p className="sub">Your bookings, offers and wallet at a glance.</p>

      <div className="grid3" style={{ marginTop: 24 }}>
        <StatCard label="Active bookings" value={bookings.loading ? "—" : String(active.length)} />
        <StatCard label="Completed" value={bookings.loading ? "—" : String(completed)} />
        <StatCard label="Wallet" value={me.data?.user ? formatNpr(me.data.user.wallet) : "—"} />
      </div>

      {(offers.data?.offers.length ?? 0) > 0 && (
        <section className="card" style={{ marginTop: 16 }}>
          <b>
            You have {offers.data!.offers.length} counter-offer{offers.data!.offers.length === 1 ? "" : "s"} waiting.
          </b>{" "}
          <Link href="/client/offers">Review offers</Link>
        </section>
      )}

      <section className="card" style={{ marginTop: 16 }}>
        <h3>Active bookings</h3>
        {bookings.loading ? (
          <Skeleton variant="card" />
        ) : bookings.error ? (
          <EmptyState title="Could not load your bookings" description={bookings.error} action={{ label: "Try again", onClick: bookings.reload }} />
        ) : active.length === 0 ? (
          <EmptyState title="No active bookings" description="Book a stylist to your home or at a salon." action={{ label: "Book a service", onClick: () => router.push("/booking") }} />
        ) : (
          <div style={{ display: "grid", gap: 12 }}>
            {active.slice(0, 5).map((b) => (
              <Link key={b.id} href={b.status === "requested" ? "/client/bookings" : `/track/${b.id}`} className="card" style={{ padding: 16, display: "block" }}>
                <BookingHeader b={b} names={names} who={b.providerName || "Waiting for a provider"} />
              </Link>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
