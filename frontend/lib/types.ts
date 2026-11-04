export type Mode = "home" | "salon";

export type BookingStatus = "requested" | "accepted" | "on_the_way" | "arrived" | "in_progress" | "done" | "cancelled";

export type PayStatus = "unpaid" | "paid" | "cash_due";

export interface Service {
  id: number;
  name: string;
  minutes: number;
  price: number;
  // Custom service fields
  source?: 'catalogue' | 'custom';
  short_description?: string;
  service_type?: 'on_site' | 'remote' | 'both';
  pricing_type?: 'fixed' | 'hourly' | 'daily' | 'per_person' | 'starting_from' | 'custom_quote';
  min_price?: number;
  currency?: string;
  duration_minutes?: number;
  min_booking_duration?: number;
  areas?: number[];
  working_days?: number[];
  time_slots?: { day_of_week: number; start_time: string; end_time: string }[];
  booking_notice_hours?: number;
  whats_included?: string;
  whats_not_included?: string;
  terms_conditions?: string;
  cancellation_policy?: string;
  tags?: string[];
  additional_charges?: { name: string; amount: number; description?: string }[];
}

export interface ServiceCategory {
  name: string;
  image: string;
}

export interface Pricing {
  minutes: number;
  servicesTotal: number;
  travelFee: number;
  discount: number;
  total: number;
}

export interface BookingRequest {
  serviceIds: number[];
  mode: Mode;
  startHour: number;
}

export interface Booking extends Pricing, BookingRequest {
  id: string;
  createdAt: string;
  status: BookingStatus;
  payStatus: PayStatus;
  address: string;
  day: string;
  providerName: string;
  providerPhone: string;
  couponCode: string | null;
  userId: string | null;
  providerId?: string | null;
  area?: string | null;
  paidMethod?: "cash" | "wallet" | null;
  staffId?: string | null;
  offerAmount?: number | null;
  commissionAmount?: number | null;
  providerEarning?: number | null;
  completedAt?: string | null;
  cancelledBy?: string | null;
  cancelReason?: string | null;
  reviewed?: boolean;
  customerName?: string;
  services?: { id: number; name: string }[];
  counterOffers?: { id: string; providerId: string; providerName: string; amount: number; createdAt: string }[];
  // provider request view
  direct?: boolean;
  yourPrice?: number | null;
  missingPrices?: string[];
  myCounter?: number | null;
}

export interface ProviderSummary {
  id: string;
  name: string;
  type: "salon" | "freelance";
  service: string;
  area: string;
  hours: string | null;
  priceFrom: number | null;
  bio: string | null;
  travelRadius: number;
  travelFee: number;
  rating: number | null; // null until the provider has real reviews
  reviewCount: number;
}

export interface Area {
  id: number;
  name: string;
  city: string;
}

export interface ServicePackage {
  id: string;
  name: string;
  description: string | null;
  service_ids: string; // JSON array of service ids
  price: number;
  discount_pct: number;
  image: string | null;
  is_active: number;
}
