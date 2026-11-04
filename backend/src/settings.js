// Platform settings: admin-editable values stored in the `settings` table.
// The defaults below are configuration defaults (not sample data); an admin can change them.
import { getAllSettingRows, upsertSetting, now } from "./db.js";

export const SETTING_DEFS = {
  commission_rate: { default: 15, min: 0, max: 50, label: "Platform commission (%)" },
  first_booking_discount_pct: { default: 20, min: 0, max: 100, label: "First-booking discount (%)" },
  referral_credit: { default: 300, min: 0, max: 100000, label: "Referral credit (NPR)" },
  default_travel_fee: { default: 250, min: 0, max: 100000, label: "Default home-visit travel fee (NPR)" },
};

export function getSettings() {
  const stored = Object.fromEntries(getAllSettingRows.all().map((r) => [r.key, Number(r.value)]));
  const out = {};
  for (const [key, def] of Object.entries(SETTING_DEFS)) {
    out[key] = Number.isFinite(stored[key]) ? stored[key] : def.default;
  }
  return out;
}

export const getSetting = (key) => getSettings()[key];

/** Validates and saves. Returns { settings } or { error }. Unknown keys are rejected. */
export function saveSettings(patch) {
  if (!patch || typeof patch !== "object" || Array.isArray(patch)) return { error: "Invalid settings" };
  const entries = Object.entries(patch);
  for (const [key, raw] of entries) {
    const def = SETTING_DEFS[key];
    if (!def) return { error: `Unknown setting: ${key}` };
    const n = typeof raw === "number" ? raw : typeof raw === "string" && raw.trim() !== "" ? Number(raw) : NaN;
    if (!Number.isFinite(n) || n < def.min || n > def.max) {
      return { error: `${def.label} must be a number between ${def.min} and ${def.max}` };
    }
  }
  const ts = now();
  for (const [key, raw] of entries) upsertSetting.run(key, String(Number(raw)), ts);
  return { settings: getSettings() };
}
