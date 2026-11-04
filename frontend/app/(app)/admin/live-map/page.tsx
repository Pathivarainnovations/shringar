"use client";

import { send } from "@/lib/api";
import { useApi } from "@/lib/hooks";
import { EmptyState, Skeleton, StatusBadge, useToast } from "@/components/app-shell";
import LiveMap, { type MapMarker } from "@/components/maps/LiveMap";

interface Live {
  bookingId: string;
  providerName: string;
  lat: number;
  lng: number;
  status: string;
  etaMinutes: number | null;
  updatedAt: string;
  address: string;
}
interface Sos {
  id: string;
  bookingId: string;
  customerName: string | null;
  providerName: string | null;
  lat: number;
  lng: number;
  status: string;
  createdAt: string;
}

export default function AdminLiveMapPage() {
  const { showToast } = useToast();
  const live = useApi<{ locations: Live[] }>("/admin/live-locations", 8000);
  const sos = useApi<{ alerts: Sos[] }>("/admin/sos", 15000);

  const locations = live.data?.locations ?? [];
  const markers: MapMarker[] = locations.map((l) => ({ id: l.bookingId, lat: l.lat, lng: l.lng, title: l.providerName, popup: `${l.providerName} • ${l.status.replace(/_/g, " ")} • ${l.bookingId}` }));

  async function resolve(a: Sos, status: "resolved" | "false_alarm") {
    const r = await send(`/sos/${a.id}`, "PATCH", { status });
    if (!r.ok) return showToast({ type: "error", title: r.error });
    sos.reload();
  }

  return (
    <div>
      <h1 className="h1">Live map</h1>
      <p className="sub">Providers currently on their way, at the door or in service.</p>

      {(sos.data?.alerts ?? []).some((a) => a.status === "active") && (
        <section className="card" style={{ marginTop: 16, borderColor: "var(--rose)" }}>
          <h3>Active SOS alerts</h3>
          {sos.data!.alerts.filter((a) => a.status === "active").map((a) => (
            <div key={a.id} className="r" style={{ justifyContent: "space-between", flexWrap: "wrap", gap: 8, padding: "8px 0" }}>
              <span><b>{a.customerName ?? "Customer"}</b> with {a.providerName || "provider"} • {a.bookingId} • {new Date(a.createdAt).toLocaleTimeString()} • {a.lat.toFixed(4)}, {a.lng.toFixed(4)}</span>
              <span style={{ whiteSpace: "nowrap" }}>
                <button className="btn btn-primary btn-sm" onClick={() => resolve(a, "resolved")}>Resolved</button>{" "}
                <button className="btn btn-outline btn-sm" onClick={() => resolve(a, "false_alarm")}>False alarm</button>
              </span>
            </div>
          ))}
        </section>
      )}

      <section className="card" style={{ marginTop: 16 }}>
        {live.loading ? (
          <Skeleton variant="card" />
        ) : live.error ? (
          <EmptyState title="Could not load locations" description={live.error} action={{ label: "Try again", onClick: live.reload }} />
        ) : (
          <>
            <LiveMap markers={markers} height={420} />
            {locations.length === 0 ? (
              <p className="mut" style={{ marginTop: 12 }}>No provider is sharing a live location right now.</p>
            ) : (
              <table className="tbl" style={{ width: "100%", marginTop: 12 }}>
                <thead><tr><th align="left">Provider</th><th align="left">Booking</th><th align="left">Status</th><th align="left">ETA</th><th align="left">Updated</th></tr></thead>
                <tbody>
                  {locations.map((l) => (
                    <tr key={l.bookingId}>
                      <td>{l.providerName}</td><td>{l.bookingId}</td><td><StatusBadge status={l.status} size="sm" /></td>
                      <td>{l.etaMinutes !== null ? `${l.etaMinutes} min` : "—"}</td><td>{new Date(l.updatedAt).toLocaleTimeString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </>
        )}
      </section>
    </div>
  );
}
