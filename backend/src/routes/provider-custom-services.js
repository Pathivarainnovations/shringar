// Provider Custom Services API (mounted at /api/provider/custom-services)
import { Router } from "express";
import {
  db, rid, now, getProviderByUserId, getProviderCustomServiceById, getProviderCustomServices,
  createProviderCustomService, updateProviderCustomService, updateProviderCustomServiceStatus,
  deleteProviderCustomService, getProviderCustomServiceImages, createProviderServiceImage,
  updateProviderServiceImage, deleteProviderServiceImage, setPrimaryProviderServiceImage,
  getProviderServiceAvailability, createProviderServiceAvailability, updateProviderServiceAvailability,
  deleteProviderServiceAvailability, deleteAllProviderServiceAvailability,
  createProviderServiceApprovalHistory, getProviderServiceApprovalHistory,
  getProviderServiceTags, createProviderServiceTag, deleteProviderServiceTags,
} from "../db.js";
import { requireRole, cleanText, positiveInt, nonNegInt } from "../http.js";

const router = Router();
router.use(requireRole("provider"));
router.use((req, res, next) => {
  const provider = getProviderByUserId.get(req.user.id);
  if (!provider) return res.status(404).json({ error: "No provider profile found for this account" });
  req.provider = provider;
  next();
});

/* ---------------- Helper: parse JSON fields ---------------- */
function parseJsonField(field) {
  if (!field) return [];
  try { return JSON.parse(field); } catch { return []; }
}

function stringifyJson(value) {
  if (!value || !value.length) return null;
  return JSON.stringify(value);
}

/* ---------------- Service CRUD ---------------- */

// Get all custom services for this provider
router.get("/", (req, res) => {
  const rows = getProviderCustomServices.all(req.provider.id);
  const services = rows.map(s => ({
    ...s,
    areas: parseJsonField(s.areas),
    working_days: parseJsonField(s.working_days),
    time_slots: parseJsonField(s.time_slots),
    additional_charges: parseJsonField(s.additional_charges),
    tags: getProviderServiceTags.all(s.id).map(t => t.tag),
    images: getProviderCustomServiceImages.all(s.id),
    availability: getProviderServiceAvailability.all(s.id),
    approval_history: getProviderServiceApprovalHistory.all(s.id),
  }));
  res.json({ services });
});

// Get single custom service
router.get("/:id", (req, res) => {
  const service = getProviderCustomServiceById.get(req.params.id);
  if (!service || service.provider_id !== req.provider.id) {
    return res.status(404).json({ error: "Service not found" });
  }
  const areas = parseJsonField(service.areas);
  const workingDays = parseJsonField(service.working_days);
  const timeSlots = parseJsonField(service.time_slots);
  const additionalCharges = parseJsonField(service.additional_charges);
  const tags = getProviderServiceTags.all(service.id).map(t => t.tag);
  const images = getProviderCustomServiceImages.all(service.id);
  const availability = getProviderServiceAvailability.all(service.id);
  const approvalHistory = getProviderServiceApprovalHistory.all(service.id);
  res.json({ service: { ...service, areas, working_days: workingDays, time_slots: timeSlots, additional_charges: additionalCharges, tags, images, availability, approval_history: approvalHistory } });
});

// Create new custom service
router.post("/", (req, res) => {
  const b = req.body ?? {};
  const serviceId = rid("PCS");
  
  // Validate required fields
  const name = cleanText(b.name, 120);
  if (!name) return res.status(400).json({ error: "Service name is required" });
  
  const description = cleanText(b.description, 5000);
  const shortDescription = cleanText(b.short_description, 500);
  
  const serviceType = b.service_type || "on_site";
  if (!["on_site", "remote", "both"].includes(serviceType)) {
    return res.status(400).json({ error: "Invalid service type" });
  }
  
  const pricingType = b.pricing_type || "fixed";
  if (!["fixed", "hourly", "daily", "per_person", "starting_from", "custom_quote"].includes(pricingType)) {
    return res.status(400).json({ error: "Invalid pricing type" });
  }
  
  const price = positiveInt(b.price);
  if (!price || price < 0) return res.status(400).json({ error: "Valid price is required" });
  
  const minPrice = b.min_price !== undefined && b.min_price !== "" ? positiveInt(b.min_price) : null;
  if (minPrice !== null && minPrice > price) {
    return res.status(400).json({ error: "Minimum price cannot exceed the main price" });
  }
  
  const additionalCharges = stringifyJson(b.additional_charges || []);
  const currency = b.currency || "NPR";
  const durationMinutes = b.duration_minutes ? positiveInt(b.duration_minutes) : null;
  const minBookingDuration = b.min_booking_duration ? positiveInt(b.min_booking_duration) : null;
  const areas = stringifyJson(b.areas || []);
  const available = b.available === false ? 0 : 1;
  const workingDays = stringifyJson(b.working_days || []);
  const timeSlots = stringifyJson(b.time_slots || []);
  const bookingNoticeHours = nonNegInt(b.booking_notice_hours ?? 24);
  
  const whatsIncluded = cleanText(b.whats_included, 5000);
  const whatsNotIncluded = cleanText(b.whats_not_included, 5000);
  const termsConditions = cleanText(b.terms_conditions, 5000);
  const cancellationPolicy = cleanText(b.cancellation_policy, 5000);
  const tags = stringifyJson(b.tags || []);
  
  const status = b.submit_for_approval ? "pending_approval" : "draft";
  const submittedAt = b.submit_for_approval ? now() : null;
  const isPublished = 0;
  const requiresReapproval = 0;
  const categoryId = b.category_id ? cleanText(b.category_id, 60) : null;
  const customCategoryName = b.custom_category_name ? cleanText(b.custom_category_name, 60) : null;
  
  const createdAt = now();
  const updatedAt = now();
  
  db.transaction(() => {
    createProviderCustomService.run(
      serviceId, req.provider.id, categoryId, customCategoryName, name, description, shortDescription,
      serviceType, pricingType, price, minPrice, additionalCharges, currency,
      durationMinutes, minBookingDuration, areas, available, workingDays, timeSlots,
      bookingNoticeHours, whatsIncluded, whatsNotIncluded, termsConditions,
      cancellationPolicy, tags, status, requiresReapproval, isPublished,
      createdAt, updatedAt
    );
    
    // Handle images
    if (Array.isArray(b.images)) {
      b.images.forEach((img, idx) => {
        const imgId = rid("IMG");
        createProviderServiceImage.run(
          imgId, serviceId, img.image_url, img.alt_text || "", idx,
          idx === 0 ? 1 : 0, createdAt
        );
      });
    }
    
    // Handle availability
    if (Array.isArray(b.availability)) {
      b.availability.forEach(avail => {
        const availId = rid("AVA");
        createProviderServiceAvailability.run(
          availId, serviceId, avail.day_of_week, avail.start_time, avail.end_time,
          avail.is_active === false ? 0 : 1, createdAt
        );
      });
    }
    
    // Handle tags
    if (Array.isArray(b.tags)) {
      b.tags.forEach(tag => {
        const cleanTag = cleanText(tag, 50);
        if (cleanTag) createProviderServiceTag.run(serviceId, cleanTag);
      });
    }
    
    // Log approval history if submitted
    if (status === "pending_approval") {
      createProviderServiceApprovalHistory.run(
        rid("APH"), serviceId, "submitted", null, null, "draft", "pending_approval", now()
      );
    }
  })();
  
  res.status(201).json({ service: { id: serviceId, ...b, status, submitted_at: submittedAt, created_at: createdAt, updated_at: updatedAt } });
});

// Update custom service
router.patch("/:id", (req, res) => {
  const service = getProviderCustomServiceById.get(req.params.id);
  if (!service || service.provider_id !== req.provider.id) {
    return res.status(404).json({ error: "Service not found" });
  }
  
  const b = req.body ?? {};
  const previousStatus = service.status;
  
  // Validate fields
  const name = b.name === undefined ? service.name : cleanText(b.name, 120);
  if (!name) return res.status(400).json({ error: "Service name is required" });
  
  const description = b.description === undefined ? service.description : cleanText(b.description, 5000);
  const shortDescription = b.short_description === undefined ? service.short_description : cleanText(b.short_description, 500);
  
  const serviceType = b.service_type === undefined ? service.service_type : b.service_type;
  if (serviceType && !["on_site", "remote", "both"].includes(serviceType)) {
    return res.status(400).json({ error: "Invalid service type" });
  }
  
  const pricingType = b.pricing_type === undefined ? service.pricing_type : b.pricing_type;
  if (pricingType && !["fixed", "hourly", "daily", "per_person", "starting_from", "custom_quote"].includes(pricingType)) {
    return res.status(400).json({ error: "Invalid pricing type" });
  }
  
  const price = b.price === undefined ? service.price : positiveInt(b.price);
  if (price !== undefined && (!price || price < 0)) return res.status(400).json({ error: "Valid price is required" });
  
  const minPrice = b.min_price === undefined ? service.min_price : (b.min_price !== "" && b.min_price !== null ? positiveInt(b.min_price) : null);
  if (minPrice !== null && minPrice > price) {
    return res.status(400).json({ error: "Minimum price cannot exceed the main price" });
  }
  
  const additionalCharges = b.additional_charges === undefined ? service.additional_charges : stringifyJson(b.additional_charges || []);
  const currency = b.currency === undefined ? service.currency : (b.currency || "NPR");
  const durationMinutes = b.duration_minutes === undefined ? service.duration_minutes : (b.duration_minutes ? positiveInt(b.duration_minutes) : null);
  const minBookingDuration = b.min_booking_duration === undefined ? service.min_booking_duration : (b.min_booking_duration ? positiveInt(b.min_booking_duration) : null);
  const areas = b.areas === undefined ? service.areas : stringifyJson(b.areas || []);
  const available = b.available === undefined ? service.available : (b.available === false ? 0 : 1);
  const workingDays = b.working_days === undefined ? service.working_days : stringifyJson(b.working_days || []);
  const timeSlots = b.time_slots === undefined ? service.time_slots : stringifyJson(b.time_slots || []);
  const bookingNoticeHours = b.booking_notice_hours === undefined ? service.booking_notice_hours : nonNegInt(b.booking_notice_hours ?? 24);
  
  const whatsIncluded = b.whats_included === undefined ? service.whats_included : cleanText(b.whats_included, 5000);
  const whatsNotIncluded = b.whats_not_included === undefined ? service.whats_not_included : cleanText(b.whats_not_included, 5000);
  const termsConditions = b.terms_conditions === undefined ? service.terms_conditions : cleanText(b.terms_conditions, 5000);
  const cancellationPolicy = b.cancellation_policy === undefined ? service.cancellation_policy : cleanText(b.cancellation_policy, 5000);
  const tags = b.tags === undefined ? service.tags : stringifyJson(b.tags || []);
  
  const categoryId = b.category_id === undefined ? service.category_id : (b.category_id ? cleanText(b.category_id, 60) : null);
  const customCategoryName = b.custom_category_name === undefined ? service.custom_category_name : (b.custom_category_name ? cleanText(b.custom_category_name, 60) : null);
  
  // Handle status changes
  let status = service.status;
  let submittedAt = service.submitted_at;
  let requiresReapproval = service.requires_reapproval;
  
  if (b.submit_for_approval && status === "draft") {
    status = "pending_approval";
    submittedAt = now();
  } else if (b.submit_for_approval && status === "rejected") {
    status = "pending_approval";
    submittedAt = now();
  } else if (status === "approved" && (b.name || b.description || b.price || b.service_type || b.pricing_type)) {
    // Significant changes to approved service require reapproval
    requiresReapproval = 1;
  }
  
  const isPublished = b.is_published === undefined ? service.is_published : (b.is_published ? 1 : 0);
  const publishedAt = isPublished && !service.is_published ? now() : service.published_at;
  
  const updatedAt = now();
  
  db.transaction(() => {
    updateProviderCustomService.run(
      categoryId, customCategoryName, name, description, shortDescription,
      serviceType, pricingType, price, minPrice, additionalCharges, currency,
      durationMinutes, minBookingDuration, areas, available, workingDays, timeSlots,
      bookingNoticeHours, whatsIncluded, whatsNotIncluded, termsConditions,
      cancellationPolicy, tags, status, requiresReapproval, isPublished,
      updatedAt, service.id, req.provider.id
    );
    
    // Handle images if provided
    if (Array.isArray(b.images)) {
      // Delete existing images
      const existingImages = getProviderCustomServiceImages.all(service.id);
      existingImages.forEach(img => deleteProviderServiceImage.run(img.id, service.id));
      
      // Add new images
      b.images.forEach((img, idx) => {
        const imgId = rid("IMG");
        createProviderServiceImage.run(
          imgId, service.id, img.image_url, img.alt_text || "", idx,
          idx === 0 ? 1 : 0, now()
        );
      });
    }
    
    // Handle availability if provided
    if (Array.isArray(b.availability)) {
      deleteAllProviderServiceAvailability.run(service.id);
      b.availability.forEach(avail => {
        const availId = rid("AVA");
        createProviderServiceAvailability.run(
          availId, service.id, avail.day_of_week, avail.start_time, avail.end_time,
          avail.is_active === false ? 0 : 1, now()
        );
      });
    }
    
    // Handle tags if provided
    if (Array.isArray(b.tags)) {
      deleteProviderServiceTags.run(service.id);
      b.tags.forEach(tag => {
        const cleanTag = cleanText(tag, 50);
        if (cleanTag) createProviderServiceTag.run(service.id, cleanTag);
      });
    }
    
    // Log approval history if status changed
    if (status !== previousStatus) {
      createProviderServiceApprovalHistory.run(
        rid("APH"), service.id, status === "pending_approval" ? "submitted" : "updated",
        null, b.admin_notes || null, previousStatus, status, now()
      );
    }
  })();
  
  res.json({ ok: true, service: { ...service, ...b, status, submitted_at: submittedAt, updated_at: updatedAt, requires_reapproval: requiresReapproval, is_published: isPublished, published_at: publishedAt } });
});

// Activate/Deactivate service
router.patch("/:id/status", (req, res) => {
  const service = getProviderCustomServiceById.get(req.params.id);
  if (!service || service.provider_id !== req.provider.id) {
    return res.status(404).json({ error: "Service not found" });
  }
  
  const { is_active } = req.body;
  if (typeof is_active !== "boolean") {
    return res.status(400).json({ error: "is_active must be a boolean" });
  }
  
  const newStatus = is_active ? "approved" : "inactive";
  if (service.status === "pending_approval") {
    return res.status(400).json({ error: "Cannot change status of service pending approval" });
  }
  
  const updatedAt = now();
  updateProviderCustomServiceStatus.run(newStatus, updatedAt, null, null, null, service.id);
  
  createProviderServiceApprovalHistory.run(
    rid("APH"), service.id, is_active ? "restored" : "suspended",
    null, null, service.status, newStatus, now()
  );
  
  res.json({ ok: true, status: newStatus });
});

// Delete custom service (soft delete)
router.delete("/:id", (req, res) => {
  const service = getProviderCustomServiceById.get(req.params.id);
  if (!service || service.provider_id !== req.provider.id) {
    return res.status(404).json({ error: "Service not found" });
  }
  
  // Check for existing bookings
  const bookings = db.prepare(`SELECT COUNT(*) as count FROM bookings WHERE provider_id = ? AND status IN ('requested', 'accepted', 'on_the_way', 'arrived', 'in_progress')`).get(req.provider.id);
  
  const deletedAt = now();
  deleteProviderCustomService.run(deletedAt, req.user.id, deletedAt, service.id, req.provider.id);
  
  createProviderServiceApprovalHistory.run(
    rid("APH"), service.id, "deleted", null, null, service.status, "inactive", now()
  );
  
  res.json({ ok: true });
});

// Duplicate custom service
router.post("/:id/duplicate", (req, res) => {
  const service = getProviderCustomServiceById.get(req.params.id);
  if (!service || service.provider_id !== req.provider.id) {
    return res.status(404).json({ error: "Service not found" });
  }
  
  const newServiceId = rid("PCS");
  const createdAt = now();
  const updatedAt = now();
  
  db.transaction(() => {
    createProviderCustomService.run(
      newServiceId, req.provider.id, service.category_id, service.custom_category_name,
      service.name + " (Copy)", service.description, service.short_description,
      service.service_type, service.pricing_type, service.price, service.min_price,
      service.additional_charges, service.currency,
      service.duration_minutes, service.min_booking_duration, service.areas,
      0, // available = 0 (draft)
      service.working_days, service.time_slots, service.booking_notice_hours,
      service.whats_included, service.whats_not_included, service.terms_conditions,
      service.cancellation_policy, service.tags,
      "draft", 0, 0, createdAt, updatedAt
    );
    
    // Copy images
    const images = getProviderCustomServiceImages.all(service.id);
    images.forEach((img, idx) => {
      const imgId = rid("IMG");
      createProviderServiceImage.run(imgId, newServiceId, img.image_url, img.alt_text, idx, idx === 0 ? 1 : 0, createdAt);
    });
    
    // Copy availability
    const availability = getProviderServiceAvailability.all(service.id);
    availability.forEach(avail => {
      const availId = rid("AVA");
      createProviderServiceAvailability.run(availId, newServiceId, avail.day_of_week, avail.start_time, avail.end_time, avail.is_active, createdAt);
    });
    
    // Copy tags
    const tags = getProviderServiceTags.all(service.id);
    tags.forEach(t => createProviderServiceTag.run(newServiceId, t.tag));
  })();
  
  res.status(201).json({ service: { id: newServiceId, name: service.name + " (Copy)", status: "draft", created_at: createdAt } });
});

/* ---------------- Images ---------------- */

router.post("/:id/images", (req, res) => {
  const service = getProviderCustomServiceById.get(req.params.id);
  if (!service || service.provider_id !== req.provider.id) {
    return res.status(404).json({ error: "Service not found" });
  }
  
  const { image_url, alt_text, is_primary } = req.body;
  if (!image_url) return res.status(400).json({ error: "image_url is required" });
  
  const existingImages = getProviderCustomServiceImages.all(service.id);
  const sortOrder = existingImages.length;
  
  const imgId = rid("IMG");
  const createdAt = now();
  
  createProviderServiceImage.run(imgId, service.id, image_url, alt_text || "", sortOrder, is_primary ? 1 : 0, createdAt);
  
  if (is_primary) {
    setPrimaryProviderServiceImage.run(imgId, service.id);
  }
  
  res.status(201).json({ image: { id: imgId, service_id: service.id, image_url, alt_text, sort_order: sortOrder, is_primary: is_primary ? 1 : 0, created_at: createdAt } });
});

router.patch("/:id/images/:imageId", (req, res) => {
  const service = getProviderCustomServiceById.get(req.params.id);
  if (!service || service.provider_id !== req.provider.id) {
    return res.status(404).json({ error: "Service not found" });
  }
  
  const { image_url, alt_text, sort_order, is_primary } = req.body;
  const image = db.prepare(`SELECT * FROM provider_service_images WHERE id = ? AND service_id = ?`).get(req.params.imageId, service.id);
  if (!image) return res.status(404).json({ error: "Image not found" });
  
  const newImageUrl = image_url === undefined ? image.image_url : image_url;
  const newAltText = alt_text === undefined ? image.alt_text : (alt_text || "");
  const newSortOrder = sort_order === undefined ? image.sort_order : sort_order;
  const newIsPrimary = is_primary === undefined ? image.is_primary : (is_primary ? 1 : 0);
  
  updateProviderServiceImage.run(newImageUrl, newAltText, newSortOrder, newIsPrimary, req.params.imageId, service.id);
  
  if (is_primary) {
    setPrimaryProviderServiceImage.run(req.params.imageId, service.id);
  }
  
  res.json({ ok: true });
});

router.delete("/:id/images/:imageId", (req, res) => {
  const service = getProviderCustomServiceById.get(req.params.id);
  if (!service || service.provider_id !== req.provider.id) {
    return res.status(404).json({ error: "Service not found" });
  }
  
  const image = db.prepare(`SELECT * FROM provider_service_images WHERE id = ? AND service_id = ?`).get(req.params.imageId, service.id);
  if (!image) return res.status(404).json({ error: "Image not found" });
  
  // Don't allow deleting the primary image if it's the only one
  const count = db.prepare(`SELECT COUNT(*) as c FROM provider_service_images WHERE service_id = ?`).get(service.id).c;
  if (count === 1 && image.is_primary) {
    return res.status(400).json({ error: "Cannot delete the only image. Add another image first." });
  }
  
  deleteProviderServiceImage.run(req.params.imageId, service.id);
  
  // If deleted image was primary, make another one primary
  if (image.is_primary) {
    const nextImage = db.prepare(`SELECT id FROM provider_service_images WHERE service_id = ? ORDER BY sort_order LIMIT 1`).get(service.id);
    if (nextImage) setPrimaryProviderServiceImage.run(nextImage.id, service.id);
  }
  
  res.json({ ok: true });
});

/* ---------------- Availability ---------------- */

router.post("/:id/availability", (req, res) => {
  const service = getProviderCustomServiceById.get(req.params.id);
  if (!service || service.provider_id !== req.provider.id) {
    return res.status(404).json({ error: "Service not found" });
  }
  
  const { day_of_week, start_time, end_time } = req.body;
  if (!Number.isInteger(day_of_week) || day_of_week < 0 || day_of_week > 6) {
    return res.status(400).json({ error: "day_of_week must be 0-6" });
  }
  if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(start_time) || !/^([01]\d|2[0-3]):[0-5]\d$/.test(end_time)) {
    return res.status(400).json({ error: "Times must be in HH:MM format" });
  }
  if (start_time >= end_time) return res.status(400).json({ error: "Start time must be before end time" });
  
  const existing = db.prepare(`SELECT 1 FROM provider_service_availability WHERE service_id = ? AND day_of_week = ? AND start_time = ? AND end_time = ?`).get(service.id, day_of_week, start_time, end_time);
  if (existing) return res.status(409).json({ error: "This time slot already exists" });
  
  const availId = rid("AVA");
  const createdAt = now();
  
  createProviderServiceAvailability.run(availId, service.id, day_of_week, start_time, end_time, 1, createdAt);
  
  res.status(201).json({ availability: { id: availId, service_id: service.id, day_of_week, start_time, end_time, is_active: 1, created_at: createdAt } });
});

router.patch("/:id/availability/:availId", (req, res) => {
  const service = getProviderCustomServiceById.get(req.params.id);
  if (!service || service.provider_id !== req.provider.id) {
    return res.status(404).json({ error: "Service not found" });
  }
  
  const { start_time, end_time, is_active } = req.body;
  const avail = db.prepare(`SELECT * FROM provider_service_availability WHERE id = ? AND service_id = ?`).get(req.params.availId, service.id);
  if (!avail) return res.status(404).json({ error: "Availability slot not found" });
  
  const newStart = start_time === undefined ? avail.start_time : start_time;
  const newEnd = end_time === undefined ? avail.end_time : end_time;
  const newActive = is_active === undefined ? avail.is_active : (is_active ? 1 : 0);
  
  if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(newStart) || !/^([01]\d|2[0-3]):[0-5]\d$/.test(newEnd)) {
    return res.status(400).json({ error: "Times must be in HH:MM format" });
  }
  if (newStart >= newEnd) return res.status(400).json({ error: "Start time must be before end time" });
  
  updateProviderServiceAvailability.run(newStart, newEnd, newActive, req.params.availId, service.id);
  res.json({ ok: true });
});

router.delete("/:id/availability/:availId", (req, res) => {
  const service = getProviderCustomServiceById.get(req.params.id);
  if (!service || service.provider_id !== req.provider.id) {
    return res.status(404).json({ error: "Service not found" });
  }
  
  const avail = db.prepare(`SELECT * FROM provider_service_availability WHERE id = ? AND service_id = ?`).get(req.params.availId, service.id);
  if (!avail) return res.status(404).json({ error: "Availability slot not found" });
  
  deleteProviderServiceAvailability.run(req.params.availId, service.id);
  res.json({ ok: true });
});

export default router;