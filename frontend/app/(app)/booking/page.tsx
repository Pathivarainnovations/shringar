"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { api } from "@/lib/api";
import { formatNpr } from "@/lib/pricing";
import type { Area, Pricing, ProviderSummary, Service } from "@/lib/types";
import { FormField, EmptyState, useToast } from "@/components/app-shell";

type Mode = "home" | "salon";
type PriceQuote = Pricing & { couponApplied?: boolean };

export default function BookingPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { showToast } = useToast();

  const [services, setServices] = useState<Service[]>([]);
  const [providers, setProviders] = useState<ProviderSummary[]>([]);
  const [areas, setAreas] = useState<Area[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [offered, setOffered] = useState<{ id: number; price: number }[] | null>(null);

  const [mode, setMode] = useState<Mode>("home");
  const [selectedServices, setSelectedServices] = useState<number[]>([]);
  const [providerId, setProviderId] = useState("");
  const [area, setArea] = useState("");
  const [startHour, setStartHour] = useState(11);
  const [address, setAddress] = useState("");
  const [day, setDay] = useState("Today");
  const [couponCode, setCouponCode] = useState("");
  const [isOffer, setIsOffer] = useState(false);
  const [offerAmount, setOfferAmount] = useState(0);
  const [pricing, setPricing] = useState<PriceQuote | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const preset = searchParams.get("provider");
    if (preset) setProviderId(preset);
  }, [searchParams]);

  useEffect(() => {
    Promise.all([
      api("/services").then((r) => r.json()),
      api("/providers").then((r) => r.json()),
      api("/areas").then((r) => r.json()),
    ])
      .then(([s, p, a]) => {
        setServices(Array.isArray(s.services) ? s.services : []);
        setProviders(Array.isArray(p.providers) ? p.providers : []);
        setAreas(Array.isArray(a.areas) ? a.areas : []);
      })
      .catch(() => showToast({ type: "error", title: "Could not load services" }))
      .finally(() => setLoaded(true));
  }, []);

  // A salon visit needs a salon; a home visit can name a provider or leave it open.
  const eligibleProviders = providers.filter((p) => (mode === "salon" ? p.type === "salon" : true));
  const providerValid = !providerId || eligibleProviders.some((p) => p.id === providerId);
  const effectiveProviderId = providerValid ? providerId : "";

  // With a provider chosen, show only what they offer, at their own prices.
  useEffect(() => {
    if (!effectiveProviderId) {
      setOffered(null);
      return;
    }
    let cancelled = false;
    api(`/providers/${encodeURIComponent(effectiveProviderId)}/services`)
      .then((r) => r.json())
      .then((d) => {
        if (cancelled) return;
        const list = Array.isArray(d.services) ? d.services : [];
        setOffered(list);
        
        // Merge custom services into the services array so they appear in visibleServices
        const customServices = list.filter((s: any) => s.source === 'custom');
        if (customServices.length > 0) {
          setServices(prev => {
            // Remove any existing custom services with the same IDs
            const filtered = prev.filter(s => !customServices.some((cs: any) => cs.id === s.id));
            // Add new custom services with proper Service type
            const newServices = customServices.map((cs: any) => ({
              id: cs.id,
              name: cs.name,
              minutes: cs.duration_minutes ?? 0,
              price: cs.price,
              source: 'custom' as const,
              short_description: cs.short_description,
              service_type: cs.service_type,
              pricing_type: cs.pricing_type,
              min_price: cs.min_price,
              currency: cs.currency,
              duration_minutes: cs.duration_minutes,
              min_booking_duration: cs.min_booking_duration,
              areas: cs.areas,
              working_days: cs.working_days,
              time_slots: cs.time_slots,
              booking_notice_hours: cs.booking_notice_hours,
              whats_included: cs.whats_included,
              whats_not_included: cs.whats_not_included,
              terms_conditions: cs.terms_conditions,
              cancellation_policy: cs.cancellation_policy,
              tags: cs.tags,
              additional_charges: cs.additional_charges,
            }));
            return [...filtered, ...newServices];
          });
        }
        
        setSelectedServices((prev) => prev.filter((id) => list.some((s: { id: number }) => s.id === id)));
      })
      .catch(() => !cancelled && setOffered([]));
    return () => {
      cancelled = true;
    };
  }, [effectiveProviderId]);
  const priceOf = (s: Service & { source?: string; pricing_type?: string; min_price?: number; currency?: string; minutes?: number; duration_minutes?: number; service_type?: string }) => {
    // For custom services, check if it has a provider price in offered
    const offeredPrice = offered?.find((o) => o.id === s.id)?.price;
    if (offeredPrice !== undefined) return offeredPrice;
    // For custom services without provider price, use the service's own price
    if (s.source === 'custom') return s.price;
    return s.price;
  };
  
  const getServiceMinutes = (s: Service & { minutes?: number; duration_minutes?: number }) => 
    s.duration_minutes ?? s.minutes ?? 0;
  
  const isCustomService = (s: Service & { source?: string }) => s.source === 'custom';
  
  const getPricingLabel = (s: Service & { pricing_type?: string; min_price?: number; price: number }) => {
    if (!isCustomService(s)) return formatNpr(s.price);
    switch (s.pricing_type) {
      case 'fixed': return formatNpr(s.price);
      case 'starting_from': return `From ${formatNpr(s.min_price ?? s.price)}`;
      case 'hourly': return `${formatNpr(s.price)}/hr`;
      case 'daily': return `${formatNpr(s.price)}/day`;
      case 'per_person': return `${formatNpr(s.price)}/person`;
      case 'custom_quote': return 'Custom Quote';
      default: return formatNpr(s.price);
    }
  };
  
  const getServiceLabel = (s: Service & { source?: string; minutes?: number; duration_minutes?: number }) => {
    const mins = s.duration_minutes ?? s.minutes ?? 0;
    return isCustomService(s) ? `${getPricingLabel(s)} • ${mins} min` : `${formatNpr(s.price)} • ${mins} min`;
  };
  
  const visibleServices = (offered 
    ? services.filter((s) => offered.some((o) => o.id === s.id)) 
    : services
  ).filter((s) => {
    if (!isCustomService(s)) return true;
    // Filter custom services based on mode and service_type
    if (s.service_type === 'remote' && mode === 'salon') return false;
    if (s.service_type === 'on_site' && mode === 'home') return false;
    return true;
  });

  // The server prices everything (catalogue, travel fee, coupon, first-booking discount).
  useEffect(() => {
    if (!selectedServices.length) {
      setPricing(null);
      return;
    }
    const ctl = new AbortController();
    const timer = setTimeout(() => {
      api("/bookings/price", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          serviceIds: selectedServices,
          mode,
          couponCode: couponCode.trim() || undefined,
          providerId: effectiveProviderId || undefined,
        }),
        signal: ctl.signal,
      })
        .then((r) => (r.ok ? r.json() : null))
        .then((d) => setPricing(d as PriceQuote | null))
        .catch(() => {});
    }, 250);
    return () => {
      clearTimeout(timer);
      ctl.abort();
    };
  }, [selectedServices, mode, couponCode, effectiveProviderId]);

  const toggleService = (id: number) =>
    setSelectedServices((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedServices.length) return showToast({ type: "error", title: "Add at least one service" });
    if (mode === "home" && !address.trim()) return showToast({ type: "error", title: "Address is required for home service" });
    if (mode === "home" && !area) return showToast({ type: "error", title: "Choose your area" });
    if (mode === "salon" && !effectiveProviderId) return showToast({ type: "error", title: "Choose a salon" });
    if (isOffer && !(offerAmount > 0)) return showToast({ type: "error", title: "Enter an offer amount above zero" });

    setLoading(true);
    try {
      const res = await api("/bookings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          serviceIds: selectedServices,
          mode,
          startHour,
          address: mode === "salon" ? "At salon" : address.trim(),
          area: mode === "home" ? area : undefined,
          day,
          couponCode: couponCode.trim() || undefined,
          providerId: effectiveProviderId || undefined,
          isOffer,
          offerAmount: isOffer ? offerAmount : undefined,
        }),
      });
      if (res.status === 401) {
        router.push("/login?redirect=" + encodeURIComponent("/booking"));
        return;
      }
      const d = await res.json();
      if (!res.ok) throw new Error(d.error || "Booking failed");
      router.push(`/checkout/${d.booking.id}`);
    } catch (err) {
      showToast({ type: "error", title: err instanceof Error ? err.message : "Booking failed" });
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit}>
      <h1 className="h1">Book a Service</h1>
      <p className="sub">Select your services, choose home or salon, and pick a time.</p>

      <section className="card" style={{ marginTop: 24 }}>
        <h3>Service Type</h3>
        <div className="tog" role="radiogroup" aria-label="Service type">
          <button type="button" role="radio" aria-checked={mode === "home"} className={mode === "home" ? "active" : ""} onClick={() => setMode("home")}>
            Home Service
          </button>
          <button type="button" role="radio" aria-checked={mode === "salon"} className={mode === "salon" ? "active" : ""} onClick={() => setMode("salon")}>
            Salon Visit
          </button>
        </div>
      </section>

      <section className="card" style={{ marginTop: 16 }}>
        <h3>Services</h3>
        {loaded && visibleServices.length === 0 ? (
          <EmptyState
            title={offered ? "This provider has no available services" : "No services available yet"}
            description={offered ? "This provider hasn't published any services yet." : "An administrator needs to set up the service catalogue first."}
          />
        ) : (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))", gap: 12 }}>
            {visibleServices.map((svc) => {
              const selected = selectedServices.includes(svc.id);
              const isCustom = isCustomService(svc);
              const mins = getServiceMinutes(svc);
              return (
                <button
                  key={svc.id}
                  type="button"
                  aria-pressed={selected}
                  className={`r card ${selected ? "active" : ""}`}
                  style={{
                    padding: 16,
                    textAlign: "left",
                    border: selected ? "2px solid var(--gold)" : "1px solid var(--line)",
                    background: selected ? "rgba(184, 240, 60, 0.1)" : "var(--surface)",
                    cursor: "pointer",
                    justifyContent: "space-between",
                  }}
                  onClick={() => toggleService(svc.id)}
                >
                  <div>
                    <b>{svc.name}</b>
                    {isCustom && svc.short_description && (
                      <p className="mut" style={{ marginTop: 4, fontSize: "0.75rem" }}>{svc.short_description}</p>
                    )}
                    <div className="mut" style={{ marginTop: 4, display: "flex", gap: 16, fontSize: "0.8125rem" }}>
                      <span>{getServiceMinutes(svc)} min</span>
                      <span>{getPricingLabel(svc)}</span>
                    </div>
                    {isCustom && svc.service_type && (
                      <div className="mut" style={{ marginTop: 2, fontSize: "0.7rem" }}>
                        <span style={{ background: "var(--gold)", color: "var(--gold-text)", padding: "2px 6px", borderRadius: 4, fontSize: "0.65rem" }}>
                          {svc.service_type === 'on_site' ? 'On-site' : svc.service_type === 'remote' ? 'Remote' : 'Both'}
                        </span>
                      </div>
                    )}
                  </div>
                  {selected && (
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="var(--gold)" strokeWidth="3" aria-hidden="true">
                      <polyline points="20 6 9 17 4 12" />
                    </svg>
                  )}
                </button>
              );
            })}
          </div>
        )}
      </section>

      <section className="card" style={{ marginTop: 16 }}>
        <h3>{mode === "salon" ? "Choose a salon" : "Choose a provider (optional)"}</h3>
        {loaded && eligibleProviders.length === 0 ? (
          <EmptyState
            title={mode === "salon" ? "No salons have joined yet" : "No providers have joined yet"}
            description={mode === "home" ? "You can still send an open request to providers in your area." : "Try a home visit instead, or check back soon."}
          />
        ) : (
          <div className="fld">
            <label htmlFor="provider">{mode === "salon" ? "Salon" : "Provider"}</label>
            <select id="provider" value={effectiveProviderId} onChange={(e) => setProviderId(e.target.value)}>
              <option value="">{mode === "salon" ? "Select a salon" : "Any provider in my area"}</option>
              {eligibleProviders.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name} — {p.area}
                  {p.rating !== null ? ` — ★ ${p.rating}` : ""}
                </option>
              ))}
            </select>
          </div>
        )}
      </section>

      <section className="card" style={{ marginTop: 16 }}>
        <h3>Date &amp; Time</h3>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
          <FormField label="Day" value={day} onChange={(e) => setDay(e.target.value)} />
          <FormField label="Start Hour" type="number" min={9} max={18} step={0.5} value={startHour} onChange={(e) => setStartHour(Number(e.target.value))} />
        </div>
      </section>

      {mode === "home" && (
        <section className="card" style={{ marginTop: 16 }}>
          <h3>Address</h3>
          <div className="fld">
            <label htmlFor="area">Area</label>
            <select id="area" value={area} onChange={(e) => setArea(e.target.value)}>
              <option value="">{areas.length ? "Choose your area" : "No areas available yet"}</option>
              {areas.map((a) => (
                <option key={a.id} value={a.name}>
                  {a.name}, {a.city}
                </option>
              ))}
            </select>
          </div>
          <FormField label="Address" value={address} onChange={(e) => setAddress(e.target.value)} placeholder="Enter your full address" />
        </section>
      )}

      {mode === "home" && (
        <section className="card" style={{ marginTop: 16 }}>
          <h3>Offer Your Price (Optional)</h3>
          <label style={{ display: "flex", alignItems: "center", gap: 12, cursor: "pointer", marginBottom: 12 }}>
            <input type="checkbox" checked={isOffer} onChange={(e) => setIsOffer(e.target.checked)} className="checkbox-input" />
            <span className="checkbox-custom" aria-hidden="true">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                <polyline points="20 6 9 17 4 12" />
              </svg>
            </span>
            <span>I want to name my price</span>
          </label>
          {isOffer && (
            <FormField label="Your Offer Amount (NPR)" type="number" min={1} value={offerAmount || ""} onChange={(e) => setOfferAmount(Number(e.target.value))} placeholder="Enter amount in NPR" />
          )}
        </section>
      )}

      <section className="card" style={{ marginTop: 16 }}>
        <h3>Coupon Code</h3>
        <FormField label="Coupon" value={couponCode} onChange={(e) => setCouponCode(e.target.value.toUpperCase())} placeholder="Enter code (if you have one)" />
      </section>

      <section className="card" style={{ marginTop: 16 }}>
        <h3>Price Summary</h3>
        {pricing ? (
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            <div className="r"><span>Services</span><b>{formatNpr(pricing.servicesTotal)}</b></div>
            <div className="r"><span>Travel Fee</span><b>{formatNpr(pricing.travelFee)}</b></div>
            {pricing.discount > 0 && (
              <div className="r" style={{ color: "var(--success)" }}><span>Discount</span><b>-{formatNpr(pricing.discount)}</b></div>
            )}
            <div className="r" style={{ borderTop: "1px solid var(--line)", paddingTop: 8, fontSize: "1.125rem" }}>
              <span>Total</span><b>{formatNpr(pricing.total)}</b>
            </div>
            <p className="mut" style={{ marginTop: 8 }}>Payment: Cash after service</p>
          </div>
        ) : (
          <EmptyState title="Select services to see pricing" description="Choose at least one service above" />
        )}
      </section>

      <div className="row" style={{ marginTop: 16, justifyContent: "flex-end" }}>
        <button type="submit" className="btn btn-primary btn-lg" disabled={loading || !selectedServices.length} style={{ minWidth: 200 }}>
          {loading ? "Booking..." : "Send Booking Request"}
        </button>
      </div>
    </form>
  );
}
