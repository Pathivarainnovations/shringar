"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { send } from "@/lib/api";
import { useRoleApi } from "@/lib/hooks";
import { formatNpr } from "@/lib/pricing";
import { EmptyState, Skeleton, useToast } from "@/components/app-shell";

interface CounterOffer {
  id: string;
  bookingId: string;
  providerName: string;
  amount: number;
  originalAmount: number;
}

export default function ClientOffersPage() {
  const router = useRouter();
  const { showToast } = useToast();
  const { data, error, loading, reload } = useRoleApi<{ offers: CounterOffer[] }>("/offers", ["customer"], 15000);
  const [busy, setBusy] = useState<string | null>(null);

  async function answer(o: CounterOffer, status: "accepted" | "rejected") {
    setBusy(o.id);
    const r = await send(`/offers/${o.id}`, "PATCH", { status });
    setBusy(null);
    if (!r.ok) return showToast({ type: "error", title: r.error });
    showToast({ type: "success", title: status === "accepted" ? "Offer accepted - your booking is confirmed" : "Offer declined" });
    if (status === "accepted") router.push(`/checkout/${o.bookingId}`);
    else reload();
  }

  return (
    <div>
      <h1 className="h1">Offers</h1>
      <p className="sub">Providers can counter the price you named. Accept one to confirm your booking.</p>
      <div style={{ display: "grid", gap: 12, marginTop: 16 }}>
        {loading ? (
          <Skeleton variant="card" />
        ) : error ? (
          <EmptyState title="Could not load offers" description={error} action={{ label: "Try again", onClick: reload }} />
        ) : (data?.offers.length ?? 0) === 0 ? (
          <EmptyState title="No offers waiting" description="When a provider counters your price, it shows up here." action={{ label: "Book a service", onClick: () => router.push("/booking") }} />
        ) : (
          data!.offers.map((o) => (
            <div key={o.id} className="card" style={{ padding: 16 }}>
              <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
                <div>
                  <b>{o.providerName}</b>
                  <div className="mut">Booking {o.bookingId} • your price {formatNpr(o.originalAmount)}</div>
                </div>
                <b style={{ fontSize: "1.25rem" }}>{formatNpr(o.amount)}</b>
              </div>
              <div className="row" style={{ gap: 8, marginTop: 12 }}>
                <button className="btn btn-primary btn-sm" disabled={busy === o.id} onClick={() => answer(o, "accepted")}>Accept</button>
                <button className="btn btn-outline btn-sm" disabled={busy === o.id} onClick={() => answer(o, "rejected")}>Decline</button>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
