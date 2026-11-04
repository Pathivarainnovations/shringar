"use client";

import { useParams } from "next/navigation";
import { useApi } from "@/lib/hooks";
import { formatHour } from "@/lib/pricing";
import LiveMap from "@/components/maps/LiveMap";

interface TripPayload {
  booking: { id: string; status: string; day: string; startHour: number; providerName: string };
  tracking: { lat: number; lng: number; etaMinutes: number | null; updatedAt: string } | null;
}

// Public page behind a trip-share link: status and the provider's last position only.
export default function SharedTripPage() {
  const params = useParams<{ token: string }>();
  const { data, error, loading } = useApi<TripPayload>(params?.token ? `/trip/${encodeURIComponent(params.token)}` : null, 8000);

  return (
    <main className="wrap" style={{ paddingTop: 48, maxWidth: 720, margin: "0 auto" }}>
      <h1 className="h1">Shared trip</h1>
      {loading ? (
        <p className="mut">Loading…</p>
      ) : error || !data ? (
        <p className="mut">{error ?? "This link is invalid or has expired."}</p>
      ) : (
        <>
          <p className="sub">
            {data.booking.providerName || "Your contact's provider"} • {data.booking.day} {formatHour(data.booking.startHour)} • status: {data.booking.status.replace(/_/g, " ")}
          </p>
          <section className="card" style={{ marginTop: 16 }}>
            {data.tracking ? (
              <>
                <LiveMap markers={[{ id: "p", lat: data.tracking.lat, lng: data.tracking.lng, popup: data.booking.providerName }]} />
                <p className="mut" style={{ marginTop: 8 }}>
                  {data.tracking.etaMinutes !== null ? `About ${data.tracking.etaMinutes} min away • ` : ""}Updated {new Date(data.tracking.updatedAt).toLocaleTimeString()}
                </p>
              </>
            ) : (
              <p className="mut">Waiting for the provider&apos;s location...</p>
            )}
          </section>
        </>
      )}
    </main>
  );
}
