// Admin Provider Services Approval API (mounted at /api/admin/provider-services)
import { Router } from "express";
import {
  db, rid, now, getProviderById, getProviderCustomServiceById, getAllProviderCustomServices,
  getPendingApprovalServices, getApprovedPublishedServices, updateProviderCustomServiceStatus,
  getProviderCustomServiceImages, getProviderServiceAvailability, getProviderServiceApprovalHistory,
  getProviderServiceTags, createProviderServiceApprovalHistory,
} from "../db.js";
import { requireAdmin, cleanText } from "../http.js";

const router = Router();
router.use(requireAdmin);

const limitOf = (v, def = 100, max = 500) => Math.min(max, Math.max(1, Number(v) || def));

/* ---------------- Provider Custom Services Overview ---------------- */

// Get all provider custom services with filters
router.get("/", (req, res) => {
  const status = ["draft", "pending_approval", "approved", "rejected", "suspended", "inactive"].includes(req.query.status) 
    ? req.query.status : "";
  const providerId = cleanText(req.query.providerId, 40);
  const search = cleanText(req.query.search, 120);
  
  let where = [];
  let args = [];
  
  if (status) { where.push(`pcs.status = ?`); args.push(status); }
  if (providerId) { where.push(`pcs.provider_id = ?`); args.push(providerId); }
  if (search) { 
    where.push(`(pcs.name LIKE ? OR pcs.description LIKE ?)`); 
    args.push(`%${search}%`, `%${search}%`); 
  }
  
  const clause = where.length ? `WHERE ${where.join(" AND ")}` : "";
  
  const total = db.prepare(`SELECT COUNT(*) AS n FROM provider_custom_services pcs ${clause}`).get(...args).n;
  
  const rows = db.prepare(`
    SELECT pcs.*, p.name as provider_name, p.type as provider_type, u.email as provider_email
    FROM provider_custom_services pcs
    JOIN providers p ON p.id = pcs.provider_id
    JOIN users u ON u.id = p.user_id
    ${clause}
    ORDER BY pcs.created_at DESC LIMIT ? OFFSET ?
  `).all(...args, limitOf(req.query.limit, 100, 200), Math.max(0, Number(req.query.offset) || 0));
  
  const services = rows.map(s => ({
    ...s,
    areas: s.areas ? JSON.parse(s.areas) : [],
    working_days: s.working_days ? JSON.parse(s.working_days) : [],
    time_slots: s.time_slots ? JSON.parse(s.time_slots) : [],
    additional_charges: s.additional_charges ? JSON.parse(s.additional_charges) : [],
    tags: getProviderServiceTags.all(s.id).map(t => t.tag),
    images: getProviderCustomServiceImages.all(s.id),
    availability: getProviderServiceAvailability.all(s.id),
  }));
  
  res.json({ total, services });
});

// Get pending approval services (for quick access)
router.get("/pending", (req, res) => {
  const rows = getPendingApprovalServices.all();
  const services = rows.map(s => ({
    ...s,
    areas: s.areas ? JSON.parse(s.areas) : [],
    working_days: s.working_days ? JSON.parse(s.working_days) : [],
    time_slots: s.time_slots ? JSON.parse(s.time_slots) : [],
    additional_charges: s.additional_charges ? JSON.parse(s.additional_charges) : [],
    tags: getProviderServiceTags.all(s.id).map(t => t.tag),
    images: getProviderCustomServiceImages.all(s.id),
    availability: getProviderServiceAvailability.all(s.id),
  }));
  res.json({ services });
});

// Get approved and published services (for marketplace)
router.get("/marketplace", (req, res) => {
  const categoryId = cleanText(req.query.category, 60);
  const areaId = cleanText(req.query.area, 60);
  const minPrice = Number(req.query.minPrice) || 0;
  const maxPrice = Number(req.query.maxPrice) || 10000000;
  const search = cleanText(req.query.search, 120);
  
  let where = [];
  let args = [];
  
  if (categoryId) { where.push(`pcs.category_id = ?`); args.push(categoryId); }
  if (areaId) { 
    where.push(`json_valid(pcs.areas) AND json_extract(pcs.areas, '$') LIKE ?`); 
    args.push(`%${areaId}%`); 
  }
  if (search) { 
    where.push(`(pcs.name LIKE ? OR pcs.description LIKE ?)`); 
    args.push(`%${search}%`, `%${search}%`); 
  }
  where.push(`pcs.price BETWEEN ? AND ?`); args.push(minPrice, maxPrice);
  
  const clause = where.length ? `WHERE ${where.join(" AND ")}` : "";
  
  const rows = db.prepare(`
    SELECT pcs.*, p.name as provider_name, p.type as provider_type, p.area as provider_area,
           u.email as provider_email, u.id as user_id
    FROM provider_custom_services pcs
    JOIN providers p ON p.id = pcs.provider_id
    JOIN users u ON u.id = p.user_id
    ${clause}
    ORDER BY pcs.published_at DESC LIMIT ?
  `).all(...args, limitOf(req.query.limit, 50, 100));
  
  const services = rows.map(s => ({
    ...s,
    areas: s.areas ? JSON.parse(s.areas) : [],
    working_days: s.working_days ? JSON.parse(s.working_days) : [],
    time_slots: s.time_slots ? JSON.parse(s.time_slots) : [],
    additional_charges: s.additional_charges ? JSON.parse(s.additional_charges) : [],
    tags: getProviderServiceTags.all(s.id).map(t => t.tag),
    images: getProviderCustomServiceImages.all(s.id),
    availability: getProviderServiceAvailability.all(s.id),
  }));
  
  res.json({ services });
});

// Get single provider custom service
router.get("/:id", (req, res) => {
  const service = getProviderCustomServiceById.get(req.params.id);
  if (!service) return res.status(404).json({ error: "Service not found" });
  
  const provider = getProviderById.get(service.provider_id);
  const images = getProviderCustomServiceImages.all(service.id);
  const availability = getProviderServiceAvailability.all(service.id);
  const approvalHistory = getProviderServiceApprovalHistory.all(service.id);
  const tags = getProviderServiceTags.all(service.id).map(t => t.tag);
  
  res.json({ 
    service: { 
      ...service, 
      areas: service.areas ? JSON.parse(service.areas) : [],
      working_days: service.working_days ? JSON.parse(service.working_days) : [],
      time_slots: service.time_slots ? JSON.parse(service.time_slots) : [],
      additional_charges: service.additional_charges ? JSON.parse(service.additional_charges) : [],
      tags, images, availability, approval_history: approvalHistory,
      provider 
    } 
  });
});

/* ---------------- Approval Actions ---------------- */

// Approve service
router.patch("/:id/approve", (req, res) => {
  const service = getProviderCustomServiceById.get(req.params.id);
  if (!service) return res.status(404).json({ error: "Service not found" });
  if (service.status !== "pending_approval") {
    return res.status(400).json({ error: `Service is ${service.status}, not pending approval` });
  }
  
  const { publish_immediately = true } = req.body;
  const updatedAt = now();
  const approvedAt = now();
  const isPublished = publish_immediately ? 1 : 0;
  const publishedAt = publish_immediately ? now() : null;
  
  db.transaction(() => {
    updateProviderCustomServiceStatus.run("approved", updatedAt, req.user.id, approvedAt, null, service.id);
    
    if (publish_immediately) {
      db.prepare(`UPDATE provider_custom_services SET is_published = 1, published_at = ? WHERE id = ?`).run(publishedAt, service.id);
    }
    
    createProviderServiceApprovalHistory.run(
      rid("APH"), service.id, "approved", req.user.id, req.body.admin_notes || null,
      service.status, "approved", now()
    );
  })();
  
  // Notify provider
  const provider = getProviderById.get(service.provider_id);
  if (provider) {
    db.prepare(`INSERT INTO notifications (id, user_id, type, title, message, data, is_read, created_at) VALUES (?, ?, ?, ?, ?, ?, 0, ?)`)
      .run(rid("NOTIF"), provider.user_id, "service_approved", "Service Approved",
        `Your service "${service.name}" has been approved${publish_immediately ? " and published" : ""}.`,
        JSON.stringify({ serviceId: service.id, publish_immediately }), now());
  }
  
  res.json({ ok: true, service: { ...service, status: "approved", is_published: isPublished, approved_at: approvedAt, published_at: publishedAt } });
});

// Reject service
router.patch("/:id/reject", (req, res) => {
  const service = getProviderCustomServiceById.get(req.params.id);
  if (!service) return res.status(404).json({ error: "Service not found" });
  if (service.status !== "pending_approval") {
    return res.status(400).json({ error: `Service is ${service.status}, not pending approval` });
  }
  
  const reason = cleanText(req.body?.rejection_reason, 1000);
  if (!reason) return res.status(400).json({ error: "Rejection reason is required" });
  
  const updatedAt = now();
  
  db.transaction(() => {
    updateProviderCustomServiceStatus.run("rejected", updatedAt, req.user.id, null, reason, service.id);
    
    createProviderServiceApprovalHistory.run(
      rid("APH"), service.id, "rejected", req.user.id, reason,
      service.status, "rejected", now()
    );
  })();
  
  // Notify provider
  const provider = getProviderById.get(service.provider_id);
  if (provider) {
    db.prepare(`INSERT INTO notifications (id, user_id, type, title, message, data, is_read, created_at) VALUES (?, ?, ?, ?, ?, ?, 0, ?)`)
      .run(rid("NOTIF"), provider.user_id, "service_rejected", "Service Not Approved",
        `Your service "${service.name}" was not approved. Reason: ${reason}`,
        JSON.stringify({ serviceId: service.id, reason }), now());
  }
  
  res.json({ ok: true, service: { ...service, status: "rejected", rejection_reason: reason } });
});

// Request modification
router.patch("/:id/request-modification", (req, res) => {
  const service = getProviderCustomServiceById.get(req.params.id);
  if (!service) return res.status(404).json({ error: "Service not found" });
  if (service.status !== "pending_approval") {
    return res.status(400).json({ error: `Service is ${service.status}, not pending approval` });
  }
  
  const notes = cleanText(req.body?.admin_notes, 1000);
  if (!notes) return res.status(400).json({ error: "Modification notes are required" });
  
  const updatedAt = now();
  
  db.transaction(() => {
    updateProviderCustomServiceStatus.run("rejected", updatedAt, req.user.id, null, notes, service.id);
    // Use a special status for modification requested
    db.prepare(`UPDATE provider_custom_services SET status = 'modification_requested', updated_at = ? WHERE id = ?`).run(updatedAt, service.id);
    
    createProviderServiceApprovalHistory.run(
      rid("APH"), service.id, "modification_requested", req.user.id, notes,
      service.status, "modification_requested", now()
    );
  })();
  
  // Notify provider
  const provider = getProviderById.get(service.provider_id);
  if (provider) {
    db.prepare(`INSERT INTO notifications (id, user_id, type, title, message, data, is_read, created_at) VALUES (?, ?, ?, ?, ?, ?, 0, ?)`)
      .run(rid("NOTIF"), provider.user_id, "service_modification_requested", "Modifications Requested",
        `Admin has requested modifications to your service "${service.name}". Please review and resubmit.`,
        JSON.stringify({ serviceId: service.id, notes }), now());
  }
  
  res.json({ ok: true, service: { ...service, status: "modification_requested", rejection_reason: notes } });
});

// Suspend service
router.patch("/:id/suspend", (req, res) => {
  const service = getProviderCustomServiceById.get(req.params.id);
  if (!service) return res.status(404).json({ error: "Service not found" });
  if (service.status !== "approved") {
    return res.status(400).json({ error: `Only approved services can be suspended` });
  }
  
  const reason = cleanText(req.body?.reason, 1000);
  const updatedAt = now();
  
  db.transaction(() => {
    updateProviderCustomServiceStatus.run("suspended", updatedAt, req.user.id, null, reason || "Suspended by admin", service.id);
    
    createProviderServiceApprovalHistory.run(
      rid("APH"), service.id, "suspended", req.user.id, reason,
      service.status, "suspended", now()
    );
  })();
  
  // Notify provider
  const provider = getProviderById.get(service.provider_id);
  if (provider) {
    db.prepare(`INSERT INTO notifications (id, user_id, type, title, message, data, is_read, created_at) VALUES (?, ?, ?, ?, ?, ?, 0, ?)`)
      .run(rid("NOTIF"), provider.user_id, "service_suspended", "Service Suspended",
        `Your service "${service.name}" has been suspended.${reason ? ` Reason: ${reason}` : ""}`,
        JSON.stringify({ serviceId: service.id, reason }), now());
  }
  
  res.json({ ok: true, service: { ...service, status: "suspended", rejection_reason: reason } });
});

// Restore suspended service
router.patch("/:id/restore", (req, res) => {
  const service = getProviderCustomServiceById.get(req.params.id);
  if (!service) return res.status(404).json({ error: "Service not found" });
  if (service.status !== "suspended") {
    return res.status(400).json({ error: `Only suspended services can be restored` });
  }
  
  const updatedAt = now();
  
  db.transaction(() => {
    updateProviderCustomServiceStatus.run("approved", updatedAt, req.user.id, service.approved_at, null, service.id);
    
    createProviderServiceApprovalHistory.run(
      rid("APH"), service.id, "restored", req.user.id, null,
      service.status, "approved", now()
    );
  })();
  
  // Notify provider
  const provider = getProviderById.get(service.provider_id);
  if (provider) {
    db.prepare(`INSERT INTO notifications (id, user_id, type, title, message, data, is_read, created_at) VALUES (?, ?, ?, ?, ?, ?, 0, ?)`)
      .run(rid("NOTIF"), provider.user_id, "service_restored", "Service Restored",
        `Your service "${service.name}" has been restored and is now active.`,
        JSON.stringify({ serviceId: service.id }), now());
  }
  
  res.json({ ok: true, service: { ...service, status: "approved", rejection_reason: null } });
});

// Publish/Unpublish service
router.patch("/:id/publish", (req, res) => {
  const service = getProviderCustomServiceById.get(req.params.id);
  if (!service) return res.status(404).json({ error: "Service not found" });
  if (service.status !== "approved") {
    return res.status(400).json({ error: `Only approved services can be published` });
  }
  
  const { is_published } = req.body;
  if (typeof is_published !== "boolean") {
    return res.status(400).json({ error: "is_published must be a boolean" });
  }
  
  const updatedAt = now();
  const publishedAt = is_published ? now() : null;
  
  db.prepare(`UPDATE provider_custom_services SET is_published = ?, published_at = ?, updated_at = ? WHERE id = ?`)
    .run(is_published ? 1 : 0, publishedAt, updatedAt, service.id);
  
  createProviderServiceApprovalHistory.run(
    rid("APH"), service.id, is_published ? "published" : "unpublished", req.user.id, null,
    service.status, service.status, now()
  );
  
  res.json({ ok: true, service: { ...service, is_published: is_published ? 1 : 0, published_at: publishedAt } });
});

// Delete service (admin hard delete)
router.delete("/:id", (req, res) => {
  const service = getProviderCustomServiceById.get(req.params.id);
  if (!service) return res.status(404).json({ error: "Service not found" });
  
  // Hard delete - removes all related data
  db.transaction(() => {
    // Delete related records first
    db.prepare(`DELETE FROM provider_service_images WHERE service_id = ?`).run(service.id);
    db.prepare(`DELETE FROM provider_service_availability WHERE service_id = ?`).run(service.id);
    db.prepare(`DELETE FROM provider_service_tags WHERE service_id = ?`).run(service.id);
    db.prepare(`DELETE FROM provider_service_approval_history WHERE service_id = ?`).run(service.id);
    // Delete the service
    db.prepare(`DELETE FROM provider_custom_services WHERE id = ?`).run(service.id);
  })();
  
  res.json({ ok: true });
});

/* ---------------- Statistics ---------------- */

router.get("/stats/summary", (req, res) => {
  const one = (sql, ...a) => db.prepare(sql).get(...a);
  
  const stats = {
    total: one(`SELECT COUNT(*) AS n FROM provider_custom_services`).n,
    draft: one(`SELECT COUNT(*) AS n FROM provider_custom_services WHERE status = 'draft'`).n,
    pending_approval: one(`SELECT COUNT(*) AS n FROM provider_custom_services WHERE status = 'pending_approval'`).n,
    approved: one(`SELECT COUNT(*) AS n FROM provider_custom_services WHERE status = 'approved'`).n,
    rejected: one(`SELECT COUNT(*) AS n FROM provider_custom_services WHERE status = 'rejected'`).n,
    suspended: one(`SELECT COUNT(*) AS n FROM provider_custom_services WHERE status = 'suspended'`).n,
    inactive: one(`SELECT COUNT(*) AS n FROM provider_custom_services WHERE status = 'inactive'`).n,
    published: one(`SELECT COUNT(*) AS n FROM provider_custom_services WHERE is_published = 1 AND status = 'approved'`).n,
    providers_with_services: one(`SELECT COUNT(DISTINCT provider_id) AS n FROM provider_custom_services`).n,
  };
  
  res.json({ stats });
});

export default router;