"use client";

import { useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { send } from "@/lib/api";
import { useApi, useServiceNames } from "@/lib/hooks";
import { formatNpr, formatHour } from "@/lib/pricing";
import type { Booking } from "@/lib/types";
import { StatusBadge, EmptyState, Skeleton, useToast } from "@/components/app-shell";
import { serviceLabel } from "@/components/BookingBits";

type Method = "cash" | "wallet";

export default function CheckoutPage() {
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const id = params?.id ?? "";
  const { showToast } = useToast();
  const booking = useApi<{ booking: Booking }>(id ? `/bookings/${encodeURIComponent(id)}` : null);
  const wallet = useApi<{ wallet: number }>("/wallet");
  const names = useServiceNames();
  const [method, setMethod] = useState<Method>("cash");
  const [busy, setBusy] = useState(false);

  const b = booking.data?.booking;
  const balance = wallet.data?.wallet ?? 0;

  async function pay() {
    if (!b) return;
    setBusy(true);
    const r = await send(`/bookings/${b.id}/pay`, "POST", { method });
    setBusy(false);
    if (!r.ok) return showToast({ type: "error", title: r.error });
    showToast({ type: "success", title: method === "wallet" ? "Paid from your wallet" : "Cash payment chosen - pay your provider after the service" });
    router.push(`/track/${b.id}`);
  }

  if (booking.loading) {
    return (
      <div>
        <h1 className="h1">Checkout</h1>
        <Skeleton variant="card" />
      </div>
    );
  }
  if (!b) {
    return (
      <div>
        <h1 className="h1">Checkout</h1>
        <EmptyState title="Booking not found" description={booking.error ?? "This booking does not exist or is not yours."} action={{ label: "My bookings", onClick: () => router.push("/client/bookings") }} />
      </div>
    );
  }

  const waiting = b.status === "requested";
  const canPay = b.payStatus !== "paid" && !["cancelled", "requested"].includes(b.status);

  return (
    <div>
      <h1 className="h1">Checkout</h1>
      <p className="sub">{b.id}{b.providerName ? ` • ${b.providerName}` : ""}</p>

      <div className="grid2" style={{ marginTop: 24 }}>
        <section className="card">
          <h3>Booking details</h3>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            <div className="r"><span>Services</span><b>{serviceLabel(b, names)}</b></div>
            <div className="r"><span>Type</span><b>{b.mode === "home" ? "Home service" : "Salon visit"}</b></div>
            <div className="r"><span>When</span><b>{b.day}, {formatHour(b.startHour)}</b></div>
            {b.mode === "home" && <div className="r"><span>Address</span><b>{b.address}</b></div>}
            <div className="r"><span>Status</span><StatusBadge status={b.status} /></div>
            <div className="r"><span>Payment</span><StatusBadge status={b.payStatus} /></div>
          </div>
        </section>

        <section className="card">
          <h3>Price</h3>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            <div className="r"><span>Services</span><b>{formatNpr(b.servicesTotal)}</b></div>
            <div className="r"><span>Travel fee</span><b>{formatNpr(b.travelFee)}</b></div>
            {b.discount > 0 && <div className="r" style={{ color: "var(--success)" }}><span>Discount</span><b>-{formatNpr(b.discount)}</b></div>}
            <div className="r" style={{ borderTop: "1px solid var(--line)", paddingTop: 8, fontSize: "1.25rem" }}><span>Total</span><b>{formatNpr(b.total)}</b></div>
          </div>
        </section>
      </div>

      {waiting && (
        <section className="card" style={{ marginTop: 16 }}>
          <h3>Waiting for a provider</h3>
          <p className="mut">The final price is confirmed when a provider accepts. You can choose how to pay as soon as that happens.</p>
          <button className="btn btn-outline" style={{ marginTop: 12 }} onClick={() => router.push("/client/bookings")}>Back to my bookings</button>
        </section>
      )}

      {canPay && (
        <section className="card" style={{ marginTop: 16, maxWidth: 480 }}>
          <h3>How would you like to pay?</h3>
          <div style={{ display: "flex", flexDirection: "column", gap: 8, margin: "12px 0 16px" }}>
            {([
              ["cash", "Cash to your provider after the service"],
              ["wallet", `Wallet (balance ${formatNpr(balance)})`],
            ] as [Method, string][]).map(([m, label]) => (
              <label key={m} style={{ display: "flex", alignItems: "center", gap: 12, padding: "12px 16px", border: "1px solid", borderRadius: 8, cursor: "pointer", borderColor: method === m ? "var(--gold)" : "var(--line)", background: method === m ? "rgba(184, 240, 60, 0.1)" : "transparent" }}>
                <input type="radio" name="method" value={m} checked={method === m} onChange={() => setMethod(m)} style={{ width: 18, height: 18, accentColor: "var(--gold)" }} />
                <span>{label}</span>
              </label>
            ))}
          </div>
          {method === "wallet" && balance < b.total && <p style={{ color: "var(--rose)", marginBottom: 12 }}>Your wallet balance is too low for this booking.</p>}
          <button className="btn btn-primary" style={{ width: "100%" }} onClick={pay} disabled={busy || (method === "wallet" && balance < b.total)}>
            {busy ? "Processing..." : method === "wallet" ? `Pay ${formatNpr(b.total)} from wallet` : "Confirm cash payment"}
          </button>
        </section>
      )}

      {b.payStatus === "paid" && <p className="mut" style={{ marginTop: 16 }}>This booking is paid. Thank you!</p>}
    </div>
  );
}
