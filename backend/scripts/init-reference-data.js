// One-time (re-runnable) setup: loads the REFERENCE data the app needs to function.
//
//   cd backend
//   node scripts/init-reference-data.js
//
// What it loads and why
//   - service categories  : the tiles shown on the landing page (name + image path)
//   - service catalogue   : the services customers can book, with a suggested price and duration
//   - areas               : the cities/neighbourhoods providers can say they serve
// What it never does: create users, providers, bookings, reviews, coupons, notifications or any other activity.
//
// It is idempotent: running it again adds only what is missing and never changes or deletes existing rows,
// so admin edits (renamed services, changed prices, deactivated areas) are preserved.
// Everything here is editable afterwards under Admin -> Catalogue.
import "../src/env.js";
import { db } from "../src/db.js";

const CATEGORIES = [
  ["Haircut", "/asset-4.jpg"],
  ["Facial", "/asset-5.jpg"],
  ["Bridal", "/asset-6.jpg"],
  ["Mehendi", "/asset-7.jpg"],
  ["Nails", "/asset-8.jpg"],
  ["Waxing", "/asset-9.jpg"],
  ["Men's grooming", "/asset-10.jpg"],
  ["Festival packages", "/asset-11.jpg"],
];

// [name, minutes, suggested price in NPR]
const SERVICES = [
  ["Haircut and styling", 45, 900],
  ["Facial", 60, 1500],
  ["Bridal makeup", 150, 8000],
  ["Mehendi, both hands", 90, 2500],
  ["Manicure and pedicure", 75, 1400],
  ["Waxing, full legs", 40, 1000],
  ["Men's grooming", 40, 700],
  ["Hair spa", 60, 1800],
];

// [area, city]
const AREAS = [
  ["Jawalakhel", "Lalitpur"],
  ["Kupondole", "Lalitpur"],
  ["Patan", "Lalitpur"],
  ["New Baneshwor", "Kathmandu"],
  ["Thamel", "Kathmandu"],
  ["Lazimpat", "Kathmandu"],
];

const counts = { categories: [0, 0], services: [0, 0], areas: [0, 0] };

const run = db.transaction(() => {
  for (const [name, image] of CATEGORIES) {
    const info = db.prepare("INSERT OR IGNORE INTO categories (name, image) VALUES (?, ?)").run(name, image);
    counts.categories[info.changes ? 0 : 1]++;
  }
  for (const [name, minutes, price] of SERVICES) {
    const exists = db.prepare("SELECT 1 FROM services WHERE lower(name) = lower(?)").get(name);
    if (exists) { counts.services[1]++; continue; }
    db.prepare("INSERT INTO services (name, minutes, price) VALUES (?, ?, ?)").run(name, minutes, price);
    counts.services[0]++;
  }
  for (const [name, city] of AREAS) {
    const info = db.prepare("INSERT OR IGNORE INTO areas (name, city, active) VALUES (?, ?, 1)").run(name, city);
    counts.areas[info.changes ? 0 : 1]++;
  }
});

run();
console.log("Reference data ready (added / already present):");
for (const [k, [added, present]] of Object.entries(counts)) console.log(`  ${k.padEnd(11)} ${added} / ${present}`);
