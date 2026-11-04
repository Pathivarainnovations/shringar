"use client";

import { useEffect, useRef, useState } from "react";
import "maplibre-gl/dist/maplibre-gl.css";

export interface MapMarker {
  id: string;
  lat: number;
  lng: number;
  title?: string; // shown on hover
  popup?: string; // plain text (never HTML)
}

const STYLE_URL = "https://tiles.openfreemap.org/styles/liberty"; // OpenFreeMap: free, no API key
const DEFAULT_CENTER: [number, number] = [85.324, 27.7172]; // Kathmandu

/** One MapLibre map that shows the given markers and keeps them in sync. */
export default function LiveMap({ markers, height = 360 }: { markers: MapMarker[]; height?: number }) {
  const container = useRef<HTMLDivElement>(null);
  const mapRef = useRef<any>(null);
  const libRef = useRef<any>(null);
  const markerRefs = useRef(new Map<string, any>());
  const [ready, setReady] = useState(false);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const mod: any = await import("maplibre-gl");
        const lib = mod.default ?? mod;
        if (cancelled || !container.current) return;
        try {
          lib.setWorkerUrl("/maplibre-gl-csp-worker.js"); // CSP-safe worker served from /public
        } catch {
          /* older builds do not need it */
        }
        const map = new lib.Map({ container: container.current, style: STYLE_URL, center: DEFAULT_CENTER, zoom: 12, attributionControl: { compact: true } });
        map.addControl(new lib.NavigationControl({ showCompass: false }), "top-right");
        map.on("load", () => !cancelled && setReady(true));
        libRef.current = lib;
        mapRef.current = map;
        setReady(true);
      } catch {
        if (!cancelled) setFailed(true);
      }
    })();
    return () => {
      cancelled = true;
      markerRefs.current.forEach((m) => m.remove());
      markerRefs.current.clear();
      mapRef.current?.remove();
      mapRef.current = null;
    };
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    const lib = libRef.current;
    if (!map || !lib) return;
    const wanted = new Set(markers.map((m) => m.id));
    markerRefs.current.forEach((marker, id) => {
      if (!wanted.has(id)) {
        marker.remove();
        markerRefs.current.delete(id);
      }
    });
    for (const m of markers) {
      const existing = markerRefs.current.get(m.id);
      if (existing) {
        existing.setLngLat([m.lng, m.lat]);
        continue;
      }
      const el = document.createElement("div");
      el.style.cssText = "width:28px;height:28px;border-radius:50%;background:#C6F24E;border:4px solid #0E3B2C;box-shadow:0 2px 8px rgba(0,0,0,.3)";
      if (m.title) el.title = m.title;
      const marker = new lib.Marker({ element: el }).setLngLat([m.lng, m.lat]);
      if (m.popup) marker.setPopup(new lib.Popup({ offset: 18 }).setText(m.popup));
      marker.addTo(map);
      markerRefs.current.set(m.id, marker);
    }
    if (markers.length === 1) map.easeTo({ center: [markers[0].lng, markers[0].lat], duration: 600 });
    else if (markers.length > 1) {
      const b = new lib.LngLatBounds();
      markers.forEach((m) => b.extend([m.lng, m.lat]));
      map.fitBounds(b, { padding: 60, maxZoom: 15, duration: 600 });
    }
  }, [markers, ready]);

  if (failed) return <div className="mut" style={{ padding: 24, textAlign: "center" }}>The map could not be loaded.</div>;
  return <div ref={container} style={{ height, width: "100%", borderRadius: 12, overflow: "hidden" }} aria-label="Map" />;
}
