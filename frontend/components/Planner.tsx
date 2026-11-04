"use client";
import { api } from "@/lib/api";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { formatHour, formatNpr } from "@/lib/pricing";
import type { Area, Booking, Pricing, ProviderSummary, Service, ServicePackage } from "@/lib/types";
import { useT } from "./i18n";

const EMPTY_PRICING: Pricing = { minutes: 0, servicesTotal: 0, travelFee: 0, discount: 0, total: 0 };

export default function Planner() {
  const { t } = useT();
  const router = useRouter();
  const [plan, setPlan] = useState<number[]>([]);
  const [home, setHome] = useState(true);
  const [services, setServices] = useState<Service[]>([]);
  const [templates, setTemplates] = useState<{ name: string; ids: number[] }[]>([]);
  const [areas, setAreas] = useState<Area[]>([]);
  const [area, setArea] = useState("");
  const [salons, setSalons] = useState<ProviderSummary[]>([]);
  const [salonId, setSalonId] = useState("");
  const [loaded, setLoaded] = useState(false);
  const [pricing, setPricing] = useState<Pricing>(EMPTY_PRICING);
  const [start, setStart] = useState(11);
  const [day, setDay] = useState("Today");
  const [address, setAddress] = useState("");
  const [over, setOver] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    Promise.all([
      api("/services").then((r) => r.json()),
      api("/packages").then((r) => r.json()),
      api("/areas").then((r) => r.json()),
      api("/providers?type=salon").then((r) => r.json()),
    ])
      .then(([s, p, a, sal]) => {
        setSalons(Array.isArray(sal.providers) ? sal.providers : []);
        setServices(Array.isArray(s.services) ? s.services : []);
        setAreas(Array.isArray(a.areas) ? a.areas : []);
        const pk: ServicePackage[] = Array.isArray(p.packages) ? p.packages : [];
        setTemplates(
          pk
            .filter((x) => x.is_active)
            .map((x) => ({ name: x.name, ids: JSON.parse(x.service_ids) as number[] }))
        );
      })
      .catch(() => {})
      .finally(() => setLoaded(true));
  }, []);

  // Prices always come from the server (catalogue prices, travel fee, first-booking discount).
  useEffect(() => {
    if (!plan.length) {
      setPricing(EMPTY_PRICING);
      return;
    }
    const ctl = new AbortController();
    const timer = setTimeout(() => {
      api("/bookings/price", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ serviceIds: plan, mode: home ? "home" : "salon", providerId: !home && salonId ? salonId : undefined }),
        signal: ctl.signal,
      })
        .then((r) => (r.ok ? r.json() : null))
        .then((d) => d && setPricing(d as Pricing))
        .catch(() => {});
    }, 200);
    return () => {
      clearTimeout(timer);
      ctl.abort();
    };
  }, [plan, home, salonId]);

  const add = (id: number) => setPlan((p) => [...p, id]);
  const move = (k: number, d: number) =>
    setPlan((p) => {
      const j = k + d;
      if (j < 0 || j >= p.length) return p;
      const n = [...p];
      [n[k], n[j]] = [n[j], n[k]];
      return n;
    });

  async function request() {
    if (!plan.length) {
      setNote(t("planner.addServiceFirst"));
      return;
    }
    setBusy(true);
    setNote(null);
    if (home && !address.trim()) {
      setNote(t("planner.enterAddress"));
      setBusy(false);
      return;
    }
    if (!home && !salonId) {
      setNote("Choose a salon for your visit");
      setBusy(false);
      return;
    }
    if (home && !area) {
      setNote("Choose your area so nearby providers can see the request");
      setBusy(false);
      return;
    }
    try {
      const res = await api("/bookings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          serviceIds: plan,
          mode: home ? "home" : "salon",
          startHour: start,
          address: home ? address.trim() : "At salon",
          area: home ? area : undefined,
          providerId: !home ? salonId : undefined,
          day,
        }),
      });
      if (res.status === 401) {
        router.push("/login?redirect=" + encodeURIComponent("/#studio"));
        return;
      }
      const data = (await res.json()) as { booking?: Booking; error?: string };
      if (!res.ok || !data.booking) throw new Error(data.error || "Booking failed");
      setNote(`${t("planner.requestSent")} ${data.booking.id}. ${t("planner.goingToCheckout")}`);
      router.push(`/checkout/${data.booking.id}`);
    } catch (e) {
      setNote(e instanceof Error ? e.message : t("planner.requestFailed"));
    }
    setBusy(false);
  }

  return (
    <section id="studio"  aria-labelledby="studio-title">
      <div className="container">
        <header className="section-header">
          <h2 id="studio-title" className="section-title">{t("studio.title")}</h2>
          <p className="section-subtitle">{t("studio.sub")}</p>
        </header>
        <div className="chips" aria-label={t("planner.templates")}>
          {templates.map(({ name, ids }) => (
            <button className="chip" key={name} onClick={() => setPlan(ids)}>
              {t("planner.startFrom")} {name}
            </button>
          ))}
          <button className="chip" onClick={() => setPlan([])}>
            {t("planner.clearPlan")}
          </button>
        </div>
        <div className="studio">
          <div className="pnl">
            <h3>{t("planner.services")}</h3>
            <div className="pal">
              {loaded && services.length === 0 && (
                <p className="mut">No services have been set up yet. Please check back soon.</p>
              )}
              {services.map((s) => (
                <div
                  className="svc"
                  key={s.id}
                  draggable
                  onDragStart={(e) => e.dataTransfer.setData("text/plain", String(s.id))}
                >
                  <div>
                    <b>{s.name}</b>
                    <small>
                      {s.minutes} min • {formatNpr(s.price)}
                    </small>
                  </div>
                  <button className="mini" aria-label={`${t("planner.add")} ${s.name}`} onClick={() => add(s.id)}>
                    +
                  </button>
                </div>
              ))}
            </div>
          </div>

          <div className="pnl">
            <h3>{t("planner.yourPlan")}</h3>
            <div className="chips">
              <button className="chip" id="mHome" aria-pressed={home} onClick={() => setHome(true)}>
                {t("planner.atHome")}
              </button>
              <button className="chip" id="mSalon" aria-pressed={!home} onClick={() => setHome(false)}>
                {t("planner.atSalon")}
              </button>
            </div>
            <div
              className={`drop${over ? " over" : ""}`}
              aria-label={t("planner.dropZone")}
              onDragOver={(e) => {
                e.preventDefault();
                setOver(true);
              }}
              onDragLeave={() => setOver(false)}
              onDrop={(e) => {
                e.preventDefault();
                setOver(false);
                const id = parseInt(e.dataTransfer.getData("text/plain"), 10);
                if (!Number.isNaN(id)) add(id);
              }}
            >
              {plan.length === 0 && <div className="empty">{t("planner.emptyDropZone")}</div>}
              {plan.map((id, k) => {
                const svc = services.find((s) => s.id === id);
                return (
                  <div className="item" key={`${id}-${k}`}>
                    <div>
                      <b>{svc ? svc.name : "Unknown service"}</b>
                      <small>
                        {svc ? `${svc.minutes} min • ${formatNpr(svc.price)}` : ""}
                      </small>
                    </div>
                    <button data-a="u" aria-label={t("planner.moveUp")} onClick={() => move(k, -1)}>
                      ↑
                    </button>
                    <button data-a="d" aria-label={t("planner.moveDown")} onClick={() => move(k, 1)}>
                      ↓
                    </button>
                    <button
                      data-a="x"
                      aria-label={t("planner.remove")}
                      onClick={() => setPlan((p) => p.filter((_, i) => i !== k))}
                    >
                      ✕
                    </button>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="pnl">
            <h3>{t("planner.summary")}</h3>
            <div className="r">
              <span>{t("planner.totalTime")}</span>
              <b>{pricing.minutes} min</b>
            </div>
            <div className="r">
              <span>{t("planner.servicesTotal")}</span>
              <b>{formatNpr(pricing.servicesTotal)}</b>
            </div>
            <div className="r">
              <span>{t("planner.travelFee")}</span>
              <b>{formatNpr(pricing.travelFee)}</b>
            </div>
            <div className="r">
              <span>{t("planner.discount")}</span>
              <b>− {formatNpr(pricing.discount)}</b>
            </div>
            <div className="r">
              <span>{t("planner.paymentNote")}</span>
              <b style={{ color: "var(--accent)" }}>{t("planner.cashAfterService")}</b>
            </div>
            <div className="tot">{formatNpr(pricing.total)}</div>
            <label htmlFor="start">
              {t("planner.startTime")}: <output>{formatHour(start)}</output>
            </label>
            <input
              id="start"
              type="range"
              min={9}
              max={18}
              step={0.5}
              value={start}
              onChange={(e) => setStart(Number(e.target.value))}
            />
            <p id="endT" style={{ color: "var(--muted)", margin: "6px 0 0" }}>
              {plan.length
                ? `${t("planner.finishesAround")} ${formatHour(start + pricing.minutes / 60)}`
                : t("planner.addServiceToSeeTime")}
            </p>
            <div className="fld" style={{ marginTop: 10 }}>
              <label htmlFor="pday">{t("planner.when")}</label>
              <select id="pday" value={day} onChange={(e) => setDay(e.target.value)}>
                <option>Today</option>
                <option>Tomorrow</option>
                <option>This week</option>
              </select>
            </div>
            {!home && (
              <div className="fld">
                <label htmlFor="psalon">Salon</label>
                <select id="psalon" value={salonId} onChange={(e) => setSalonId(e.target.value)}>
                  <option value="">{salons.length ? "Choose a salon" : "No salons have joined yet"}</option>
                  {salons.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name} — {s.area}
                    </option>
                  ))}
                </select>
              </div>
            )}
            {home && (
              <div className="fld">
                <label htmlFor="parea">Area</label>
                <select id="parea" value={area} onChange={(e) => setArea(e.target.value)}>
                  <option value="">{areas.length ? "Choose your area" : "No areas available yet"}</option>
                  {areas.map((a) => (
                    <option key={a.id} value={a.name}>
                      {a.name}, {a.city}
                    </option>
                  ))}
                </select>
              </div>
            )}
            {home && (
              <div className="fld">
                <label htmlFor="paddr">{t("planner.address")}</label>
                <input
                  id="paddr"
                  placeholder={t("finder.addrPh")}
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                />
              </div>
            )}
            {note && (
              <p style={{ color: note.startsWith("Request sent") ? "var(--gold)" : "var(--rose)", margin: "8px 0 0" }}>
                {note}
              </p>
            )}
            <button className="btn btn-primary" style={{ width: "100%", marginTop: 14 }} onClick={request} disabled={busy}>
              {busy ? t("planner.sending") : t("planner.requestBooking")}
            </button>
          </div>
        </div>
      </div>
    </section>
  );
}