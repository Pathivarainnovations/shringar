// Seed demo users: one admin, one customer, one provider
// Run with: cd backend && node scripts/seed-users.js
//
// Creates:
//   admin@example.com    / admin123     (role: admin)
//   customer@example.com / customer123  (role: customer)
//   provider@example.com / provider123  (role: provider, with provider profile)

import "../src/env.js";
import { db, createUser, createProvider, getProviderByUserId, hashPassword, rid, now, newReferralCode } from "../src/db.js";

const DEMO_USERS = [
  { email: "admin@example.com", name: "Admin User", password: "admin123", role: "admin" },
  { email: "customer@example.com", name: "Demo Customer", password: "customer123", role: "customer" },
  { email: "provider@example.com", name: "Demo Provider", password: "provider123", role: "provider" },
];

const run = db.transaction(() => {
  for (const u of DEMO_USERS) {
    const existing = db.prepare("SELECT 1 FROM users WHERE email = ?").get(u.email);
    if (existing) {
      console.log(`  ${u.role.padEnd(10)} ${u.email} already exists`);
      continue;
    }

    const userId = rid("USR");
    const passwordHash = hashPassword(u.password);
    const referralCode = newReferralCode();

    createUser.run(userId, u.email, u.name, 0, 0, now(), u.role, referralCode);
    db.prepare("UPDATE users SET password_hash = ? WHERE id = ?").run(passwordHash, userId);

    console.log(`  ${u.role.padEnd(10)} created: ${u.email} (password: ${u.password})`);
  }

  // Create provider profile for the provider user
  const providerUser = db.prepare("SELECT id FROM users WHERE email = ?").get("provider@example.com");
  if (providerUser) {
    const existingProvider = getProviderByUserId.get(providerUser.id);
    if (!existingProvider) {
      const providerId = rid("PRV");
      createProvider.run(
        providerId,
        providerUser.id,
        "Demo Salon",
        "salon",
        "Haircut",
        "Thamel",
        "123 Thamel Road, Kathmandu",
        27.7172,
        85.324,
        5,
        200,
        1,
        "Demo verification",
        "10:00-20:00",
        700,
        "Demo salon for testing",
        "9841000001",
        now()
      );

      // Add some service prices for the provider
      const services = db.prepare("SELECT id FROM services").all();
      for (const svc of services) {
        db.prepare(`
          INSERT OR IGNORE INTO provider_services (provider_id, service_id, price, is_active, updated_at)
          VALUES (?, ?, ?, 1, ?)
        `).run(providerId, svc.id, svc.price + 100, now()); // slightly higher than suggested price
      }

      // Add availability (Mon-Fri 10:00-20:00)
      for (let day = 1; day <= 5; day++) {
        db.prepare(`
          INSERT OR IGNORE INTO provider_availability (id, provider_id, day_of_week, start_time, end_time, is_active, created_at)
          VALUES (?, ?, ?, '10:00', '20:00', 1, ?)
        `).run(rid("AVL"), providerId, day, now());
      }

      console.log(`  provider   profile created: Demo Salon (Thamel)`);
    } else {
      console.log(`  provider   profile already exists`);
    }
  }
});

run();
console.log("\nDemo users ready!");
console.log("  Admin:    admin@example.com    / admin123");
console.log("  Customer: customer@example.com / customer123");
console.log("  Provider: provider@example.com / provider123");