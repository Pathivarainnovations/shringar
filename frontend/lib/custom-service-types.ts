// Type definitions for Provider Custom Services

export type ServiceType = "on_site" | "remote" | "both";
export type PricingType = "fixed" | "hourly" | "daily" | "per_person" | "starting_from" | "custom_quote";
export type ServiceStatus = "draft" | "pending_approval" | "approved" | "rejected" | "suspended" | "inactive" | "modification_requested";

export interface AdditionalCharge {
  name: string;
  amount: number;
  description?: string;
}

export interface TimeSlot {
  id: string;
  service_id: string;
  day_of_week: number; // 0-6
  start_time: string; // HH:MM
  end_time: string; // HH:MM
  is_active: boolean;
  created_at: string;
}

export interface ServiceImage {
  id: string;
  service_id: string;
  image_url: string;
  alt_text: string;
  sort_order: number;
  is_primary: boolean;
  created_at: string;
}

export type ApprovalAction = "submitted" | "approved" | "rejected" | "modification_requested" | "suspended" | "restored" | "published" | "unpublished" | "updated" | "deleted" | "request_modification";

export interface ApprovalHistory {
  id: string;
  service_id: string;
  action: ApprovalAction;
  admin_id: string | null;
  admin_notes: string | null;
  previous_status: string;
  new_status: string;
  created_at: string;
}

export interface ProviderCustomService {
  id: string;
  provider_id: string;
  category_id: string | null;
  custom_category_name: string | null;
  name: string;
  description: string | null;
  short_description: string | null;
  service_type: ServiceType;
  pricing_type: PricingType;
  price: number;
  min_price: number | null;
  additional_charges: string | null; // JSON
  currency: string;
  duration_minutes: number | null;
  min_booking_duration: number | null;
  areas: string | null; // JSON
  available: number;
  working_days: string | null; // JSON
  time_slots: string | null; // JSON
  booking_notice_hours: number;
  whats_included: string | null;
  whats_not_included: string | null;
  terms_conditions: string | null;
  cancellation_policy: string | null;
  tags: string | null; // JSON
  status: ServiceStatus;
  rejection_reason: string | null;
  approved_by: string | null;
  approved_at: string | null;
  submitted_at: string | null;
  requires_reapproval: number;
  is_published: number;
  published_at: string | null;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
  deleted_by: string | null;
  
  // Computed/joined fields
  areas_parsed?: number[];
  working_days_parsed?: number[];
  time_slots_parsed?: TimeSlot[];
  additional_charges_parsed?: AdditionalCharge[];
  tags_parsed?: string[];
  images?: ServiceImage[];
  availability?: TimeSlot[];
  approval_history?: ApprovalHistory[];
  provider_name?: string;
  provider_type?: string;
  provider_email?: string;
}

export interface ProviderCustomServiceSummary {
  total: number;
  published: number;
  pending_approval: number;
  rejected: number;
  draft: number;
  suspended: number;
  inactive: number;
}

export interface CreateServiceData {
  name: string;
  category_id: string;
  custom_category_name: string;
  description: string;
  short_description: string;
  service_type: ServiceType;
  pricing_type: PricingType;
  price: number;
  min_price: number;
  additional_charges: AdditionalCharge[];
  currency: string;
  duration_minutes: number;
  min_booking_duration: number;
  areas: number[];
  available: boolean;
  working_days: number[];
  time_slots: TimeSlot[];
  booking_notice_hours: number;
  whats_included: string;
  whats_not_included: string;
  terms_conditions: string;
  cancellation_policy: string;
  tags: string[];
  images: ServiceImage[];
  availability: TimeSlot[];
  submit_for_approval: boolean;
}

export interface UpdateServiceData extends Partial<CreateServiceData> {
  is_published?: boolean;
}

export interface AdminApprovalAction {
  action: "approve" | "reject" | "request_modification" | "suspend" | "restore" | "publish" | "unpublish";
  rejection_reason?: string;
  admin_notes?: string;
  publish_immediately?: boolean;
  is_published?: boolean;
  reason?: string;
}