// Public (no sign-in) read-only data: services, categories, areas, packages, providers, reviews, config.
import { Router } from "express";
import {
  db, getAllServices, getCategories, getAreas, getAllPackages,
  getAllProviders, getProviderById, getProviderRating,
} from "../db.js";
import { getSettings } from "../settings.js";

const router = Router();

export const publicProvider = (p) => {
  const { rating, review_count } = getProviderRating.get(p.id);
  const fromPrice = db.prepare(`SELECT MIN(price) AS p FROM provider_services WHERE provider_id = ? AND is_active = 1`).get(p.id).p;
  return {
    id: p.id,
    name: p.name,
    type: p.type,
    service: p.service,
    area: p.area,
    hours: p.hours || null,
    priceFrom: fromPrice ?? null, // lowest of the provider's own prices; null until they set prices
    bio: p.bio || null,
    travelRadius: p.travel_radius,
    travelFee: p.travel_fee,
    rating: rating ?? null, // null until the provider has real reviews
    reviewCount: review_count,
  };
};

router.get("/services", (_req, res) => res.json({ services: getAllServices.all() }));
router.get("/categories", (_req, res) => res.json({ categories: getCategories.all() }));
router.get("/areas", (_req, res) => res.json({ areas: getAreas.all().map((a) => ({ id: a.id, name: a.name, city: a.city })) }));

router.get("/config", (_req, res) => {
  const s = getSettings();
  res.json({ firstBookingDiscountPct: s.first_booking_discount_pct, referralCredit: s.referral_credit });
});

router.get("/packages", (_req, res) => res.json({ packages: getAllPackages.all().filter((p) => p.is_active) }));
router.get("/providers", (req, res) => {
  const type = req.query.type === "salon" || req.query.type === "freelance" ? req.query.type : null;
  const area = typeof req.query.area === "string" ? req.query.area.trim() : "";
  const providers = getAllProviders.all()
    .filter((p) => (!type || p.type === type) && (!area || p.area === area))
    .map(publicProvider);
  res.json({ providers });
});

// The services one provider offers, at that provider's own prices.
router.get("/providers/:id/services", (req, res) => {
  const p = getProviderById.get(req.params.id);
  if (!p || !p.verified) return res.status(404).json({ error: "Provider not found" });
  
  // Get catalogue services with provider prices
  const catalogueRows = db.prepare(
    `SELECT s.id, s.name, s.minutes, ps.price, s.minutes as duration_minutes, 'catalogue' as source
      FROM provider_services ps JOIN services s ON s.id = ps.service_id
      WHERE ps.provider_id = ? AND ps.is_active = 1 ORDER BY s.id`
  ).all(p.id);
  
  // Get approved and published custom services
  const customRows = db.prepare(
    `SELECT pcs.id, pcs.name, pcs.short_description as description, pcs.duration_minutes, pcs.price, pcs.pricing_type, pcs.min_price, pcs.currency, pcs.service_type, pcs.min_booking_duration, pcs.areas, pcs.working_days, pcs.time_slots, pcs.booking_notice_hours, pcs.whats_included, pcs.whats_not_included, pcs.terms_conditions, pcs.cancellation_policy, pcs.tags, pcs.additional_charges, pcs.service_type, 'custom' as source
      FROM provider_custom_services pcs
      WHERE pcs.provider_id = ? AND pcs.status = 'approved' AND pcs.is_published = 1 AND pcs.available = 1
      ORDER BY pcs.created_at DESC`
  ).all(p.id);
  
  // Parse JSON fields for custom services
  const customServices = customRows.map(c => ({
    ...c,
    areas: c.areas ? JSON.parse(c.areas) : [],
    working_days: c.working_days ? JSON.parse(c.working_days) : [],
    time_slots: c.time_slots ? JSON.parse(c.time_slots) : [],
    additional_charges: c.additional_charges ? JSON.parse(c.additional_charges) : [],
    tags: c.tags ? JSON.parse(c.tags) : [],
  }));
  
  // Combine catalogue and custom services
  const allServices = [...catalogueRows, ...customServices];
  
  res.json({ services: allServices });
});

router.get("/reviews", (_req, res) => {
  const rows = db.prepare(`SELECT id, stars, text, author, target, created_at FROM reviews WHERE text <> '' ORDER BY created_at DESC LIMIT 12`).all();
  res.json({ reviews: rows.map((r) => ({ id: r.id, stars: r.stars, text: r.text, author: r.author, target: r.target, createdAt: r.created_at })) });
});

export default router;
