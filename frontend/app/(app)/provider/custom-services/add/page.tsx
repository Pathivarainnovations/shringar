"use client";

import { useState } from "react";
import { send } from "@/lib/api";
import { useApi } from "@/lib/hooks";
import { useToast } from "@/components/app-shell";
import { useRouter } from "next/navigation";
import type { CreateServiceData, ServiceType, PricingType } from "@/lib/custom-service-types";

const SERVICE_TYPES: { value: ServiceType; label: string }[] = [
  { value: "on_site", label: "On-site (at customer location)" },
  { value: "remote", label: "Remote (online/virtual)" },
  { value: "both", label: "Both on-site and remote" },
];

const PRICING_TYPES: { value: PricingType; label: string }[] = [
  { value: "fixed", label: "Fixed Price" },
  { value: "hourly", label: "Hourly Rate" },
  { value: "daily", label: "Per Day" },
  { value: "per_person", label: "Per Person" },
  { value: "starting_from", label: "Starting From" },
  { value: "custom_quote", label: "Custom Quote" },
];

const DAY_NAMES = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

const CURRENCIES = ["NPR", "USD", "EUR", "GBP"];

export default function AddCustomServicePage() {
  const router = useRouter();
  const { showToast } = useToast();
  
  const { data: categories } = useApi<{ categories: { name: string; image: string }[] }>("/categories");
  const { data: areas } = useApi<{ areas: { id: number; name: string; city: string }[] }>("/admin/areas");

  const [saving, setSaving] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const [form, setForm] = useState<Required<CreateServiceData>>({
    name: "",
    category_id: "",
    custom_category_name: "",
    description: "",
    short_description: "",
    service_type: "on_site",
    pricing_type: "fixed",
    price: 0,
    min_price: 0,
    additional_charges: [],
    currency: "NPR",
    duration_minutes: 0,
    min_booking_duration: 0,
    areas: [],
    available: true,
    working_days: [1, 2, 3, 4, 5],
    time_slots: [],
    booking_notice_hours: 24,
    whats_included: "",
    whats_not_included: "",
    terms_conditions: "",
    cancellation_policy: "",
    tags: [],
    images: [],
    availability: [],
    submit_for_approval: false,
  });

  const [newAdditionalCharge, setNewAdditionalCharge] = useState({ name: "", amount: "", description: "" });
  const [newTimeSlot, setNewTimeSlot] = useState({ day_of_week: 1, start_time: "10:00", end_time: "18:00" });
  const [newAvailabilitySlot, setNewAvailabilitySlot] = useState({ day_of_week: 1, start_time: "10:00", end_time: "18:00" });
  const [newTag, setNewTag] = useState("");
  const [imageUrl, setImageUrl] = useState("");
  const [imageAltText, setImageAltText] = useState("");
  const [isPrimaryImage, setIsPrimaryImage] = useState(false);

  function updateField<K extends keyof CreateServiceData>(key: K, value: CreateServiceData[K]) {
    setForm(prev => ({ ...prev, [key]: value }));
  }

  function addAdditionalCharge() {
    if (!newAdditionalCharge.name || !newAdditionalCharge.amount) return;
    updateField("additional_charges", [
      ...form.additional_charges,
      { name: newAdditionalCharge.name, amount: Number(newAdditionalCharge.amount), description: newAdditionalCharge.description || undefined }
    ]);
    setNewAdditionalCharge({ name: "", amount: "", description: "" });
  }

  function removeAdditionalCharge(index: number) {
    updateField("additional_charges", form.additional_charges.filter((_, i) => i !== index));
  }

  function addTimeSlot() {
    if (!newTimeSlot.start_time || !newTimeSlot.end_time) return;
    const exists = form.time_slots.some(
      t => t.day_of_week === newTimeSlot.day_of_week && t.start_time === newTimeSlot.start_time && t.end_time === newTimeSlot.end_time
    );
    if (exists) return showToast({ type: "error", title: "This time slot already exists" });
    const nowStr = new Date().toISOString();
    updateField("time_slots", [...form.time_slots, { 
      ...newTimeSlot, 
      day_of_week: Number(newTimeSlot.day_of_week),
      id: `ts-${Date.now()}`,
      service_id: "",
      is_active: true,
      created_at: nowStr
    }]);
    setNewTimeSlot({ day_of_week: 1, start_time: "10:00", end_time: "18:00" });
  }

  function removeTimeSlot(index: number) {
    updateField("time_slots", form.time_slots.filter((_, i) => i !== index));
  }

  function addAvailabilitySlot() {
    if (!newAvailabilitySlot.start_time || !newAvailabilitySlot.end_time) return;
    const exists = form.availability.some(
      a => a.day_of_week === newAvailabilitySlot.day_of_week && a.start_time === newAvailabilitySlot.start_time && a.end_time === newAvailabilitySlot.end_time
    );
    if (exists) return showToast({ type: "error", title: "This availability slot already exists" });
    const nowStr = new Date().toISOString();
    updateField("availability", [...form.availability, { 
      ...newAvailabilitySlot, 
      day_of_week: Number(newAvailabilitySlot.day_of_week),
      id: `av-${Date.now()}`,
      service_id: "",
      is_active: true,
      created_at: nowStr
    }]);
    setNewAvailabilitySlot({ day_of_week: 1, start_time: "10:00", end_time: "18:00" });
  }

  function removeAvailabilitySlot(index: number) {
    updateField("availability", form.availability.filter((_, i) => i !== index));
  }

  function addTag() {
    if (!newTag.trim()) return;
    if (form.tags.includes(newTag.trim())) return;
    updateField("tags", [...form.tags, newTag.trim()]);
    setNewTag("");
  }

  function removeTag(tag: string) {
    updateField("tags", form.tags.filter(t => t !== tag));
  }

  function addImage() {
    if (!imageUrl.trim()) return;
    const isFirst = form.images.length === 0;
    const nowStr = new Date().toISOString();
    updateField("images", [
      ...form.images,
      { id: `img-${Date.now()}`, service_id: "", image_url: imageUrl.trim(), alt_text: imageAltText.trim() || form.name, sort_order: form.images.length, is_primary: isFirst || isPrimaryImage, created_at: nowStr }
    ]);
    setImageUrl("");
    setImageAltText("");
    setIsPrimaryImage(false);
  }

  function removeImage(index: number) {
    if (form.images.length === 1) {
      showToast({ type: "error", title: "At least one image is required" });
      return;
    }
    const wasPrimary = form.images[index].is_primary;
    const newImages = form.images.filter((_, i) => i !== index);
    if (wasPrimary && newImages.length > 0) {
      newImages[0].is_primary = true;
    }
    updateField("images", newImages);
  }

  function handleSubmit(action: "draft" | "submit") {
    if (!form.name.trim()) return showToast({ type: "error", title: "Service name is required" });
    if (!form.description.trim()) return showToast({ type: "error", title: "Description is required" });
    if (!form.price || form.price <= 0) return showToast({ type: "error", title: "Valid price is required" });
    if (form.images.length === 0) return showToast({ type: "error", title: "At least one image is required" });

    const data = {
      ...form,
      additional_charges: form.additional_charges,
      areas: form.areas,
      working_days: form.working_days,
      time_slots: form.time_slots,
      tags: form.tags,
      images: form.images,
      availability: form.availability,
      submit_for_approval: action === "submit",
    };

    if (action === "submit") setSubmitting(true); else setSaving(true);

    send("/provider/custom-services", "POST", data).then(res => {
      if (!res.ok) throw new Error(res.error);
      showToast({ type: "success", title: action === "submit" ? "Service submitted for approval" : "Service saved as draft" });
      router.push("/provider/my-services");
    }).catch((e: any) => {
      showToast({ type: "error", title: e.message });
    }).finally(() => {
      setSaving(false);
      setSubmitting(false);
    });
  }

  return (
    <div style={{ maxWidth: 900, margin: "0 auto" }}>
      <h1 className="h1">Add Custom Service</h1>
      <p className="sub">Create a new service offering. Save as draft or submit for approval.</p>

      <form onSubmit={(e) => { e.preventDefault(); handleSubmit("draft"); }}>
        <section className="card" style={{ marginTop: 16 }}>
          <h3>Basic Information</h3>
          <div className="fld" style={{ marginTop: 16 }}>
            <label htmlFor="name">Service Name *</label>
            <input
              id="name"
              value={form.name}
              onChange={(e) => updateField("name", e.target.value)}
              placeholder="e.g., Premium Hair Spa Treatment"
              maxLength={120}
              required
            />
          </div>
          <div className="row" style={{ gap: 16, marginTop: 16, flexWrap: "wrap" }}>
            <div className="fld" style={{ flex: 1, minWidth: 200 }}>
              <label htmlFor="category_id">Category</label>
              <select id="category_id" value={form.category_id} onChange={(e) => updateField("category_id", e.target.value || "")}>
                <option value="">Select from catalogue</option>
                {categories?.categories?.map(c => (
                  <option key={c.name} value={c.name}>{c.name}</option>
                ))}
              </select>
            </div>
            <div className="fld" style={{ flex: 1, minWidth: 200 }}>
              <label htmlFor="custom_category_name">Or Custom Category</label>
              <input
                id="custom_category_name"
                value={form.custom_category_name}
                onChange={(e) => updateField("custom_category_name", e.target.value)}
                placeholder="e.g., Bridal Packages"
                maxLength={60}
              />
            </div>
          </div>
          <div className="fld" style={{ marginTop: 16 }}>
            <label htmlFor="description">Description *</label>
            <textarea
              id="description"
              value={form.description}
              onChange={(e) => updateField("description", e.target.value)}
              placeholder="Describe what this service includes, the process, and what makes it special..."
              rows={5}
              maxLength={5000}
              required
            />
          </div>
          <div className="fld" style={{ marginTop: 16 }}>
            <label htmlFor="short_description">Short Description (for cards/previews)</label>
            <textarea
              id="short_description"
              value={form.short_description}
              onChange={(e) => updateField("short_description", e.target.value)}
              placeholder="Brief summary shown in search results and cards..."
              rows={2}
              maxLength={500}
            />
          </div>
        </section>

        <section className="card" style={{ marginTop: 16 }}>
          <h3>Service Type</h3>
          <div className="row" style={{ gap: 16, marginTop: 16, flexWrap: "wrap" }}>
            {SERVICE_TYPES.map(t => (
              <label key={t.value} style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer" }}>
                <input
                  type="radio"
                  name="service_type"
                  value={t.value}
                  checked={form.service_type === t.value}
                  onChange={() => updateField("service_type", t.value)}
                />
                <span>{t.label}</span>
              </label>
            ))}
          </div>
        </section>

        <section className="card" style={{ marginTop: 16 }}>
          <h3>Pricing</h3>
          <div className="row" style={{ gap: 16, marginTop: 16, flexWrap: "wrap" }}>
            <div className="fld" style={{ flex: 1, minWidth: 200 }}>
              <label htmlFor="pricing_type">Pricing Type *</label>
              <select
                id="pricing_type"
                value={form.pricing_type}
                onChange={(e) => updateField("pricing_type", e.target.value as PricingType)}
              >
                {PRICING_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
              </select>
            </div>
            <div className="fld" style={{ minWidth: 150 }}>
              <label htmlFor="currency">Currency</label>
              <select id="currency" value={form.currency} onChange={(e) => updateField("currency", e.target.value)}>
                {CURRENCIES.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
          </div>
          <div className="row" style={{ gap: 16, marginTop: 16, flexWrap: "wrap" }}>
            <div className="fld" style={{ flex: 1, minWidth: 150 }}>
              <label htmlFor="price">Price *</label>
              <input
                id="price"
                type="number"
                inputMode="numeric"
                min="1"
                value={form.price}
                onChange={(e) => updateField("price", Number(e.target.value) || 0)}
                required
              />
            </div>
            <div className="fld" style={{ minWidth: 150 }}>
              <label htmlFor="min_price">Minimum Price (optional)</label>
              <input
                id="min_price"
                type="number"
                inputMode="numeric"
                min="0"
                value={form.min_price ?? ""}
                onChange={(e) => updateField("min_price", e.target.value ? Number(e.target.value) : 0)}
              />
            </div>
          </div>
          <div className="fld" style={{ marginTop: 16 }}>
            <label>Additional Charges (optional)</label>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 8 }}>
              <input
                placeholder="Charge name"
                value={newAdditionalCharge.name}
                onChange={(e) => setNewAdditionalCharge({ ...newAdditionalCharge, name: e.target.value })}
                style={{ flex: 1, minWidth: 150 }}
              />
              <input
                type="number"
                inputMode="numeric"
                min="0"
                placeholder="Amount"
                value={newAdditionalCharge.amount}
                onChange={(e) => setNewAdditionalCharge({ ...newAdditionalCharge, amount: e.target.value })}
                style={{ width: 100 }}
              />
              <input
                placeholder="Description (optional)"
                value={newAdditionalCharge.description}
                onChange={(e) => setNewAdditionalCharge({ ...newAdditionalCharge, description: e.target.value })}
                style={{ flex: 1, minWidth: 150 }}
              />
              <button type="button" className="btn btn-outline btn-sm" onClick={addAdditionalCharge}>Add</button>
            </div>
            {form.additional_charges.map((charge, i) => (
              <div key={i} className="row" style={{ gap: 8, alignItems: "center", padding: "8px 0", borderTop: "1px solid var(--line)" }}>
                <span style={{ flex: 1 }}><strong>{charge.name}</strong> - {charge.amount} {form.currency}</span>
                {charge.description && <span className="mut" style={{ fontSize: 12 }}>{charge.description}</span>}
                <button type="button" className="btn btn-outline btn-sm" onClick={() => removeAdditionalCharge(i)}>Remove</button>
              </div>
            ))}
          </div>
        </section>

        <section className="card" style={{ marginTop: 16 }}>
          <h3>Duration & Booking Settings</h3>
          <div className="row" style={{ gap: 16, marginTop: 16, flexWrap: "wrap" }}>
            <div className="fld" style={{ minWidth: 150 }}>
              <label htmlFor="duration_minutes">Duration (minutes)</label>
              <input
                id="duration_minutes"
                type="number"
                inputMode="numeric"
                min="1"
                value={form.duration_minutes ?? ""}
                onChange={(e) => updateField("duration_minutes", e.target.value ? Number(e.target.value) : 0)}
              />
            </div>
            <div className="fld" style={{ minWidth: 150 }}>
              <label htmlFor="min_booking_duration">Min Booking Duration (minutes)</label>
              <input
                id="min_booking_duration"
                type="number"
                inputMode="numeric"
                min="1"
                value={form.min_booking_duration ?? ""}
                onChange={(e) => updateField("min_booking_duration", e.target.value ? Number(e.target.value) : 0)}
              />
            </div>
            <div className="fld" style={{ minWidth: 150 }}>
              <label htmlFor="booking_notice_hours">Booking Notice (hours)</label>
              <input
                id="booking_notice_hours"
                type="number"
                inputMode="numeric"
                min="0"
                value={form.booking_notice_hours}
                onChange={(e) => updateField("booking_notice_hours", Number(e.target.value) || 24)}
              />
            </div>
          </div>
        </section>

        <section className="card" style={{ marginTop: 16 }}>
          <h3>Service Coverage</h3>
          <div className="row" style={{ gap: 16, marginTop: 16, flexWrap: "wrap" }}>
            <div className="fld" style={{ flex: 1, minWidth: 200 }}>
              <label>Service Areas</label>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 8 }}>
                {areas?.areas?.map(a => (
                  <label key={a.id} style={{ display: "flex", alignItems: "center", gap: 6, cursor: "pointer", padding: "4px 8px", border: "1px solid var(--line)", borderRadius: 4 }}>
                    <input
                      type="checkbox"
                      checked={form.areas.includes(a.id)}
                      onChange={(e) => updateField("areas", e.target.checked ? [...form.areas, a.id] : form.areas.filter(id => id !== a.id))}
                    />
                    <span>{a.name}, {a.city}</span>
                  </label>
                ))}
              </div>
              <p className="mut" style={{ fontSize: 12, marginTop: 8 }}>Leave empty to serve all areas</p>
            </div>
          </div>
        </section>

        <section className="card" style={{ marginTop: 16 }}>
          <h3>Availability Schedule</h3>
          <div className="fld" style={{ marginTop: 16 }}>
            <label>Working Days</label>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 8 }}>
              {DAY_NAMES.map((day, idx) => (
                <label key={idx} style={{ display: "flex", alignItems: "center", gap: 6, cursor: "pointer", padding: "4px 12px", border: "1px solid var(--line)", borderRadius: 9999, background: form.working_days.includes(idx) ? "var(--primary-bg)" : "transparent" }}>
                  <input
                    type="checkbox"
                    checked={form.working_days.includes(idx)}
                    onChange={(e) => updateField("working_days", e.target.checked ? [...form.working_days, idx] : form.working_days.filter(d => d !== idx))}
                  />
                  <span style={{ fontWeight: form.working_days.includes(idx) ? 600 : 400 }}>{day}</span>
                </label>
              ))}
            </div>
          </div>
          <div className="fld" style={{ marginTop: 16 }}>
            <label>Time Slots (when this service is available)</label>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 8, alignItems: "center" }}>
              <select value={newTimeSlot.day_of_week} onChange={(e) => setNewTimeSlot({ ...newTimeSlot, day_of_week: Number(e.target.value) })} style={{ width: 120 }}>
                {DAY_NAMES.map((d, i) => <option key={i} value={i}>{d}</option>)}
              </select>
              <input type="time" value={newTimeSlot.start_time} onChange={(e) => setNewTimeSlot({ ...newTimeSlot, start_time: e.target.value })} />
              <span>to</span>
              <input type="time" value={newTimeSlot.end_time} onChange={(e) => setNewTimeSlot({ ...newTimeSlot, end_time: e.target.value })} />
              <button type="button" className="btn btn-outline btn-sm" onClick={addTimeSlot}>Add Slot</button>
            </div>
            {form.time_slots.length > 0 && (
              <div style={{ marginTop: 8 }}>
                {form.time_slots.map((slot, i) => (
                  <div key={i} className="row" style={{ gap: 8, alignItems: "center", padding: "8px 0", borderTop: "1px solid var(--line)" }}>
                    <span>{DAY_NAMES[slot.day_of_week]}</span>
                    <strong>{slot.start_time} - {slot.end_time}</strong>
                    <button type="button" className="btn btn-outline btn-sm" onClick={() => removeTimeSlot(i)}>Remove</button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </section>

        <section className="card" style={{ marginTop: 16 }}>
          <h3>Additional Details</h3>
          <div className="fld" style={{ marginTop: 16 }}>
            <label htmlFor="whats_included">What's Included</label>
            <textarea
              id="whats_included"
              value={form.whats_included}
              onChange={(e) => updateField("whats_included", e.target.value)}
              placeholder="List what's included in this service..."
              rows={3}
              maxLength={5000}
            />
          </div>
          <div className="fld" style={{ marginTop: 16 }}>
            <label htmlFor="whats_not_included">What's Not Included</label>
            <textarea
              id="whats_not_included"
              value={form.whats_not_included}
              onChange={(e) => updateField("whats_not_included", e.target.value)}
              placeholder="List what's not included..."
              rows={2}
              maxLength={5000}
            />
          </div>
          <div className="fld" style={{ marginTop: 16 }}>
            <label htmlFor="terms_conditions">Terms & Conditions</label>
            <textarea
              id="terms_conditions"
              value={form.terms_conditions}
              onChange={(e) => updateField("terms_conditions", e.target.value)}
              placeholder="Any terms and conditions for this service..."
              rows={3}
              maxLength={5000}
            />
          </div>
          <div className="fld" style={{ marginTop: 16 }}>
            <label htmlFor="cancellation_policy">Cancellation Policy</label>
            <textarea
              id="cancellation_policy"
              value={form.cancellation_policy}
              onChange={(e) => updateField("cancellation_policy", e.target.value)}
              placeholder="Describe your cancellation and refund policy..."
              rows={2}
              maxLength={5000}
            />
          </div>
          <div className="fld" style={{ marginTop: 16 }}>
            <label>Tags / Keywords</label>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 8, alignItems: "center" }}>
              <input
                placeholder="Add a tag"
                value={newTag}
                onChange={(e) => setNewTag(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), addTag())}
                style={{ flex: 1, minWidth: 150 }}
              />
              <button type="button" className="btn btn-outline btn-sm" onClick={addTag}>Add</button>
            </div>
            {form.tags.length > 0 && (
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 8 }}>
                {form.tags.map(tag => (
                  <span key={tag} className="badge" style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
                    {tag}
                    <button type="button" onClick={() => removeTag(tag)} style={{ background: "none", border: "none", cursor: "pointer", padding: 0, color: "inherit" }}>✕</button>
                  </span>
                ))}
              </div>
            )}
          </div>
        </section>

        <section className="card" style={{ marginTop: 16 }}>
          <h3>Images</h3>
          <p className="mut" style={{ marginTop: 8, fontSize: 13 }}>Add at least one image. The first image will be used as the primary image.</p>
          <div className="fld" style={{ marginTop: 16 }}>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center", marginBottom: 16 }}>
              <input
                placeholder="Image URL"
                value={imageUrl}
                onChange={(e) => setImageUrl(e.target.value)}
                style={{ flex: 1, minWidth: 250 }}
              />
              <input
                placeholder="Alt text (optional)"
                value={imageAltText}
                onChange={(e) => setImageAltText(e.target.value)}
                style={{ minWidth: 150 }}
              />
              <label style={{ display: "flex", alignItems: "center", gap: 6, cursor: "pointer" }}>
                <input
                  type="checkbox"
                  checked={isPrimaryImage}
                  onChange={(e) => setIsPrimaryImage(e.target.checked)}
                />
                <span>Primary</span>
              </label>
              <button type="button" className="btn btn-primary" onClick={addImage}>Add Image</button>
            </div>
            {form.images.map((img, i) => (
              <div key={i} className="row" style={{ gap: 12, alignItems: "center", padding: "8px 0", borderTop: "1px solid var(--line)" }}>
                <img src={img.image_url} alt={img.alt_text || form.name} style={{ width: 60, height: 60, objectFit: "cover", borderRadius: 4 }} />
                <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 4 }}>
                  <span className="mut" style={{ fontSize: 12 }}>{img.alt_text || "No alt text"}</span>
                  <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12 }}>
                    <input
                      type="radio"
                      name={`primary-new`}
                      checked={img.is_primary}
                      onChange={() => updateField("images", form.images.map((im, idx) => ({ ...im, is_primary: idx === i })))}
                    />
                    Primary
                  </label>
                </div>
                <button type="button" className="btn btn-outline btn-sm" onClick={() => removeImage(i)}>Remove</button>
              </div>
            ))}
          </div>
        </section>

        <section className="card" style={{ marginTop: 16 }}>
          <h3>Service-Specific Availability (optional)</h3>
          <p className="mut" style={{ marginTop: 8, fontSize: 13 }}>Override general availability for this specific service. Leave empty to use your general schedule.</p>
          <div className="fld" style={{ marginTop: 16 }}>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center", marginBottom: 8 }}>
              <select value={newAvailabilitySlot.day_of_week} onChange={(e) => setNewAvailabilitySlot({ ...newAvailabilitySlot, day_of_week: Number(e.target.value) })} style={{ width: 120 }}>
                {DAY_NAMES.map((d, i) => <option key={i} value={i}>{d}</option>)}
              </select>
              <input type="time" value={newAvailabilitySlot.start_time} onChange={(e) => setNewAvailabilitySlot({ ...newAvailabilitySlot, start_time: e.target.value })} />
              <span>to</span>
              <input type="time" value={newAvailabilitySlot.end_time} onChange={(e) => setNewAvailabilitySlot({ ...newAvailabilitySlot, end_time: e.target.value })} />
              <button type="button" className="btn btn-outline btn-sm" onClick={addAvailabilitySlot}>Add Slot</button>
            </div>
            {form.availability.map((slot, i) => (
              <div key={i} className="row" style={{ gap: 8, alignItems: "center", padding: "8px 0", borderTop: "1px solid var(--line)" }}>
                <span>{DAY_NAMES[slot.day_of_week]}</span>
                <strong>{slot.start_time} - {slot.end_time}</strong>
                <button type="button" className="btn btn-outline btn-sm" onClick={() => removeAvailabilitySlot(i)}>Remove</button>
              </div>
            ))}
          </div>
        </section>

        <div className="row" style={{ justifyContent: "flex-end", gap: 12, marginTop: 24, paddingTop: 16, borderTop: "1px solid var(--line)" }}>
          <button type="button" className="btn btn-outline btn-lg" onClick={() => handleSubmit("draft")} disabled={saving}>
            {saving ? "Saving..." : "Save as Draft"}
          </button>
          <button type="button" className="btn btn-primary btn-lg" onClick={() => handleSubmit("submit")} disabled={submitting}>
            {submitting ? "Submitting..." : "Submit for Approval"}
          </button>
        </div>
      </form>
    </div>
  );
}