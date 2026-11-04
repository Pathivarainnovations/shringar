"use client";

import { useEffect, useRef, useState } from "react";
import { api } from "@/lib/api";

/**
 * Provider side of live tracking: while `active`, watches the device position and posts it to the backend
 * (at most once every 5 seconds). Real GPS needs a phone/browser with location permission.
 */
export default function LocationSender({ bookingId, active }: { bookingId: string; active: boolean }) {
  const [state, setState] = useState<"idle" | "sharing" | "denied" | "unsupported" | "error">("idle");
  const lastSent = useRef(0);

  useEffect(() => {
    if (!active) {
      setState("idle");
      return;
    }
    if (typeof navigator === "undefined" || !navigator.geolocation) {
      setState("unsupported");
      return;
    }
    setState("sharing");
    const watchId = navigator.geolocation.watchPosition(
      async (pos) => {
        const now = Date.now();
        if (now - lastSent.current < 5000) return;
        lastSent.current = now;
        try {
          const res = await api("/tracking/location", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ bookingId, lat: pos.coords.latitude, lng: pos.coords.longitude }),
          });
          setState(res.ok ? "sharing" : "error");
        } catch {
          setState("error");
        }
      },
      (err) => setState(err.code === err.PERMISSION_DENIED ? "denied" : "error"),
      { enableHighAccuracy: true, maximumAge: 5000, timeout: 20000 }
    );
    return () => navigator.geolocation.clearWatch(watchId);
  }, [active, bookingId]);

  if (!active) return null;
  const text = {
    idle: "",
    sharing: "Sharing your live location with the customer",
    denied: "Location permission is blocked. Allow location in your browser settings so the customer can follow you.",
    unsupported: "This device cannot share a location.",
    error: "Could not send your location. Retrying...",
  }[state];
  return <p className="mut" role="status" style={{ marginTop: 8, color: state === "sharing" ? "var(--success)" : "var(--rose)" }}>{text}</p>;
}
