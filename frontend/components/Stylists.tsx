"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { api } from "@/lib/api";
import type { ProviderSummary } from "@/lib/types";
import { useT } from "./i18n";

export default function Stylists() {
  const { t } = useT();
  const [providers, setProviders] = useState<ProviderSummary[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [faved, setFaved] = useState<string[]>([]);
  const [msg, setMsg] = useState<string | null>(null);
  const track = useRef<HTMLDivElement>(null);

  useEffect(() => {
    api("/providers")
      .then((r) => r.json())
      .then((d) => setProviders(Array.isArray(d.providers) ? d.providers : []))
      .catch(() => {})
      .finally(() => setLoaded(true));
    api("/auth/me")
      .then((r) => r.json())
      .then((d) => d.user && setFaved(d.user.favorites ?? []))
      .catch(() => {});
  }, []);

  const scroll = (dx: number) => track.current?.scrollBy({ left: dx, behavior: "smooth" });

  async function fav(name: string) {
    const isFav = faved.includes(name);
    const res = await api("/favorites", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, action: isFav ? "remove" : "add" }),
    });
    if (!res.ok) {
      setMsg("Login required to save favorites");
      return;
    }
    setFaved((f) => (isFav ? f.filter((x) => x !== name) : [...f, name]));
    setMsg(null);
  }

  return (
    <section id="stylists">
      <div className="head">
        <div>
          <h2>{t("stylists.heading")}</h2>
          <p className="sub">Verified providers, rated by customers.</p>
        </div>
        {providers.length > 0 && (
          <div className="arrows">
            <button aria-label="Previous" onClick={() => scroll(-290)}>
              ←
            </button>
            <button aria-label="Next" onClick={() => scroll(290)}>
              →
            </button>
          </div>
        )}
      </div>

      {loaded && providers.length === 0 ? (
        <div className="empty-state" style={{ textAlign: "center", padding: 40 }}>
          <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="var(--muted)" strokeWidth="1.5" aria-hidden="true">
            <circle cx="12" cy="8" r="4" />
            <path d="M4 21c0-4 4-6 8-6s8 2 8 6" />
          </svg>
          <p className="mut">No verified providers have joined yet.</p>
          <Link className="btn gold" href="/partner">
            Become a provider
          </Link>
        </div>
      ) : (
        <div className="track" ref={track}>
          {providers.map((p) => (
            <div className="sc" key={p.id}>
              <div className="av">{p.name.charAt(0)}</div>
              <h3 style={{ fontSize: "1.2rem" }}>{p.name}</h3>
              <p>{p.service}</p>
              <p>
                {p.rating !== null ? `★ ${p.rating} (${p.reviewCount})` : "New"} • {p.area}
              </p>
              {p.priceFrom !== null && (
                <p>
                  <b style={{ color: "var(--ink)" }}>From NPR {p.priceFrom.toLocaleString("en-US")}</b>
                </p>
              )}
              <div className="row">
                <Link className="btn gold" href={`/booking?provider=${encodeURIComponent(p.id)}`}>
                  {t("stylists.view")}
                </Link>
                <button className="chip" aria-pressed={faved.includes(p.name)} onClick={() => fav(p.name)}>
                  {faved.includes(p.name) ? "♥" : "♡"}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
      {msg && <p style={{ color: "var(--rose)" }}>{msg}</p>}
    </section>
  );
}
