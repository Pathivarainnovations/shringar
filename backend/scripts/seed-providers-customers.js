// Seed demo providers and customers with realistic Nepal data
// Run with: cd backend && node scripts/seed-providers-customers.js
//
// Creates:
//   5 Providers (salon/freelance) with realistic Kathmandu/Lalitpur data
//   15 Customers with realistic Nepal names, phones, addresses
//   Bookings linking them (each provider gets ≥2 customers, at least 1 customer has multiple providers)

import "../src/env.js";
import {
  db,
  createUser,
  createProvider,
  getProviderByUserId,
  findUserByEmail,
  hashPassword,
  rid,
  now,
  newReferralCode,
  createBooking,
} from "../src/db.js";

const PROVIDERS = [
  {
    email: "salon.thamel@shringar.np",
    name: "Sita Thapa",
    password: "salon123",
    role: "provider",
    // Provider profile
    providerName: "Thamel Beauty Salon",
    type: "salon",
    service: "Haircut and styling",
    area: "Thamel",
    address: "Jyatha Marg, Thamel, Kathmandu 44600",
    lat: 27.7172,
    lng: 85.3128,
    travelRadius: 5,
    travelFee: 200,
    hours: "10:00-20:00",
    priceFrom: 700,
    bio: "Premium salon in the heart of Thamel offering haircuts, facials, and bridal packages.",
    phone: "9841000001",
  },
  {
    email: "glamour.lazimpat@shringar.np",
    name: "Rita Shrestha",
    password: "salon123",
    role: "provider",
    providerName: "Glamour Studio Lazimpat",
    type: "salon",
    service: "Facial",
    area: "Lazimpat",
    address: "Lazimpat Road, Kathmandu 44600",
    lat: 27.7258,
    lng: 85.3206,
    travelRadius: 4,
    travelFee: 150,
    hours: "09:00-19:00",
    priceFrom: 1200,
    bio: "Specialized in facials, skin treatments, and bridal makeup. Certified aestheticians.",
    phone: "9841000002",
  },
  {
    email: "freelance.patan@shringar.np",
    name: "Anita Gurung",
    password: "salon123",
    role: "provider",
    providerName: "Anita's Home Salon",
    type: "freelance",
    service: "Mehendi, both hands",
    area: "Patan",
    address: "Mangal Bazar, Patan, Lalitpur 44700",
    lat: 27.6733,
    lng: 85.3195,
    travelRadius: 8,
    travelFee: 300,
    hours: "10:00-18:00",
    priceFrom: 2000,
    bio: "Freelance mehendi artist with 10+ years experience. Bridal and festival designs.",
    phone: "9841000003",
  },
  {
    email: "elegance.jawalakhel@shringar.np",
    name: "Sunita Karki",
    password: "salon123",
    role: "provider",
    providerName: "Elegance Unisex Salon",
    type: "salon",
    service: "Men's grooming",
    area: "Jawalakhel",
    address: "Jawalakhel Chowk, Lalitpur 44700",
    lat: 27.6689,
    lng: 85.3132,
    travelRadius: 5,
    travelFee: 200,
    hours: "09:00-21:00",
    priceFrom: 600,
    bio: "Unisex salon specializing in men's grooming, haircuts, and beard styling.",
    phone: "9841000004",
  },
  {
    email: "bridal.kupondole@shringar.np",
    name: "Pooja Adhikari",
    password: "salon123",
    role: "provider",
    providerName: "Bridal Bliss Studio",
    type: "salon",
    service: "Bridal makeup",
    area: "Kupondole",
    address: "Kupondole Height, Lalitpur 44700",
    lat: 27.6784,
    lng: 85.3156,
    travelRadius: 6,
    travelFee: 250,
    hours: "10:00-19:00",
    priceFrom: 7000,
    bio: "Exclusive bridal studio offering complete wedding packages with trial sessions.",
    phone: "9841000005",
  },
];

const CUSTOMERS = [
  {
    email: "aashish.rajbhandari@gmail.com",
    name: "Aashish Rajbhandari",
    password: "customer123",
    role: "customer",
    phone: "9843000001",
    address: "Kamaladi, Kathmandu 44600",
  },
  {
    email: "sneha.shah@gmail.com",
    name: "Sneha Shah",
    password: "customer123",
    role: "customer",
    phone: "9843000002",
    address: "New Road, Kathmandu 44600",
  },
  {
    email: "rajan.maharjan@gmail.com",
    name: "Rajan Maharjan",
    password: "customer123",
    role: "customer",
    phone: "9843000003",
    address: "Balkhu, Kathmandu 44600",
  },
  {
    email: "priya.tamang@gmail.com",
    name: "Priya Tamang",
    password: "customer123",
    role: "customer",
    phone: "9843000004",
    address: "Swayambhu, Kathmandu 44600",
  },
  {
    email: "bikash.shrestha@gmail.com",
    name: "Bikash Shrestha",
    password: "customer123",
    role: "customer",
    phone: "9843000005",
    address: "Baneshwor, Kathmandu 44600",
  },
  {
    email: "anjali.gurung@gmail.com",
    name: "Anjali Gurung",
    password: "customer123",
    role: "customer",
    phone: "9843000006",
    address: "Jhamsikhel, Lalitpur 44700",
  },
  {
    email: "sabin.lama@gmail.com",
    name: "Sabin Lama",
    password: "customer123",
    role: "customer",
    phone: "9843000007",
    address: "Patan Dhoka, Lalitpur 44700",
  },
  {
    email: "reetika.poudel@gmail.com",
    name: "Reetika Poudel",
    password: "customer123",
    role: "customer",
    phone: "9843000008",
    address: "Kupandole, Lalitpur 44700",
  },
  {
    email: "nischal.khadka@gmail.com",
    name: "Nischal Khadka",
    password: "customer123",
    role: "customer",
    phone: "9843000009",
    address: "Satdobato, Lalitpur 44700",
  },
  {
    email: "sarika.basnet@gmail.com",
    name: "Sarika Basnet",
    password: "customer123",
    role: "customer",
    phone: "9843000010",
    address: "Lagankhel, Lalitpur 44700",
  },
  {
    email: "manish.thapa@gmail.com",
    name: "Manish Thapa",
    password: "customer123",
    role: "customer",
    phone: "9843000011",
    address: "Boudha, Kathmandu 44600",
  },
  {
    email: "deepika.sharma@gmail.com",
    name: "Deepika Sharma",
    password: "customer123",
    role: "customer",
    phone: "9843000012",
    address: "Maharajgunj, Kathmandu 44600",
  },
  {
    email: "suresh.rai@gmail.com",
    name: "Suresh Rai",
    password: "customer123",
    role: "customer",
    phone: "9843000013",
    address: "Gaushala, Kathmandu 44600",
  },
  {
    email: "kriti.adhikari@gmail.com",
    name: "Kriti Adhikari",
    password: "customer123",
    role: "customer",
    phone: "9843000014",
    address: "Chabahil, Kathmandu 44600",
  },
  {
    email: "prakash.tamrakar@gmail.com",
    name: "Prakash Tamrakar",
    password: "customer123",
    role: "customer",
    phone: "9843000015",
    address: "Balaju, Kathmandu 44600",
  },
];

// Booking assignments: which customers book with which providers
// Each provider gets at least 2 customers, and at least 1 customer has multiple providers
const BOOKING_ASSIGNMENTS = [
  // Provider 0: Thamel Beauty Salon (salon)
  { providerIndex: 0, customerIndices: [0, 1, 2, 10] }, // Aashish, Sneha, Rajan, Manish
  // Provider 1: Glamour Studio Lazimpat (salon)
  { providerIndex: 1, customerIndices: [3, 4, 5, 11] }, // Priya, Bikash, Anjali, Deepika
  // Provider 2: Anita's Home Salon (freelance)
  { providerIndex: 2, customerIndices: [6, 7, 0] }, // Sabin, Reetika, Aashish (Aashish has 2 providers)
  // Provider 3: Elegance Unisex Salon (salon)
  { providerIndex: 3, customerIndices: [8, 9, 12] }, // Nischal, Sarika, Suresh
  // Provider 4: Bridal Bliss Studio (salon)
  { providerIndex: 4, customerIndices: [13, 14, 1, 3] }, // Kriti, Prakash, Sneha, Priya (Sneha & Priya have 2 providers)
];

const SERVICE_MAP = {
  "Haircut and styling": 1,
  "Facial": 2,
  "Bridal makeup": 3,
  "Mehendi, both hands": 4,
  "Men's grooming": 7,
};

function getServiceIds(serviceName) {
  const id = SERVICE_MAP[serviceName] || 1;
  return [id];
}

const run = db.transaction(() => {
  let providerCount = 0;
  let customerCount = 0;
  let bookingCount = 0;

  // ===== CREATE PROVIDERS =====
  const providerIds = [];

  for (const p of PROVIDERS) {
    // Check if user exists
    let user = findUserByEmail.get(p.email);
    let userId;

    if (user) {
      console.log(`  Provider user exists: ${p.email}`);
      userId = user.id;
    } else {
      userId = rid("USR");
      const passwordHash = hashPassword(p.password);
      const referralCode = newReferralCode();

      createUser.run(userId, p.email, p.name, 0, 0, now(), p.role, referralCode);
      db.prepare("UPDATE users SET password_hash = ? WHERE id = ?").run(passwordHash, userId);
      console.log(`  Created provider user: ${p.email}`);
    }

    // Check if provider profile exists
    let provider = getProviderByUserId.get(userId);
    let providerId;

    if (provider) {
      console.log(`  Provider profile exists: ${p.providerName}`);
      providerId = provider.id;
    } else {
      providerId = rid("PRV");
      createProvider.run(
        providerId,
        userId,
        p.providerName,
        p.type,
        p.service,
        p.area,
        p.address,
        p.lat,
        p.lng,
        p.travelRadius,
        p.travelFee,
        1, // verified
        "Seeded demo provider",
        p.hours,
        p.priceFrom,
        p.bio,
        p.phone,
        now()
      );

      // Add service prices for the provider
      const services = db.prepare("SELECT id FROM services").all();
      for (const svc of services) {
        db.prepare(`
          INSERT OR IGNORE INTO provider_services (provider_id, service_id, price, is_active, updated_at)
          VALUES (?, ?, ?, 1, ?)
        `).run(providerId, svc.id, svc.price + 100, now());
      }

      // Add availability (Mon-Fri 10:00-20:00 or per provider hours)
      const [startHour, endHour] = p.hours.split("-").map((t) => t.slice(0, 2));
      for (let day = 1; day <= 5; day++) {
        db.prepare(`
          INSERT OR IGNORE INTO provider_availability (id, provider_id, day_of_week, start_time, end_time, is_active, created_at)
          VALUES (?, ?, ?, ?, ?, 1, ?)
        `).run(rid("AVL"), providerId, day, `${startHour}:00`, `${endHour}:00`, now());
      }

      console.log(`  Created provider profile: ${p.providerName} (${p.area})`);
      providerCount++;
    }

    providerIds.push(providerId);
  }

  // ===== CREATE CUSTOMERS =====
  const customerIds = [];

  for (const c of CUSTOMERS) {
    let user = findUserByEmail.get(c.email);
    let userId;

    if (user) {
      console.log(`  Customer exists: ${c.email}`);
      userId = user.id;
    } else {
      userId = rid("USR");
      const passwordHash = hashPassword(c.password);
      const referralCode = newReferralCode();

      createUser.run(userId, c.email, c.name, 0, 0, now(), c.role, referralCode);
      db.prepare("UPDATE users SET password_hash = ? WHERE id = ?").run(passwordHash, userId);
      console.log(`  Created customer: ${c.email}`);
      customerCount++;
    }

    customerIds.push(userId);
  }

  // ===== CREATE BOOKINGS (linking customers to providers) =====
  for (const assignment of BOOKING_ASSIGNMENTS) {
    const providerId = providerIds[assignment.providerIndex];
    const provider = PROVIDERS[assignment.providerIndex];

    for (const customerIndex of assignment.customerIndices) {
      const customerId = customerIds[customerIndex];
      const serviceIds = getServiceIds(provider.service);

      // Check if booking already exists for this customer-provider pair
      const existingBooking = db.prepare(`
        SELECT 1 FROM bookings WHERE user_id = ? AND provider_id = ? AND status != 'cancelled'
      `).get(customerId, providerId);

      if (existingBooking) {
        console.log(`  Booking exists: customer ${customerIndex} -> provider ${assignment.providerIndex}`);
        continue;
      }

      const bookingId = rid("BKG");
      const createdAt = now();
      const day = "2025-01-15"; // Fixed day for demo

      // Calculate pricing
      const services = db.prepare("SELECT * FROM services WHERE id IN (" + serviceIds.join(",") + ")").all();
      const minutes = services.reduce((sum, s) => sum + s.minutes, 0);
      const servicesTotal = services.reduce((sum, s) => sum + s.price, 0);
      const travelFee = provider.travelFee;
      const discount = 0;
      const total = servicesTotal + travelFee - discount;

      createBooking.run(
        bookingId,
        createdAt,
        JSON.stringify(serviceIds),
        "salon",
        10.5, // 10:30 AM
        "done", // completed bookings for demo
        "paid",
        CUSTOMERS[customerIndex].address,
        day,
        provider.providerName,
        provider.phone,
        null, // coupon
        customerId,
        minutes,
        servicesTotal,
        travelFee,
        discount,
        total,
        providerId
      );

      console.log(`  Created booking: ${CUSTOMERS[customerIndex].name} -> ${provider.providerName}`);
      bookingCount++;
    }
  }

  return { providerCount, customerCount, bookingCount };
});

const result = run();

console.log("\n✅ Seed complete!");
console.log(`   Providers created: ${result.providerCount}`);
console.log(`   Customers created: ${result.customerCount}`);
console.log(`   Bookings created:  ${result.bookingCount}`);

// Summary of relationships
console.log("\n📊 Provider-Customer Relationships:");
for (let i = 0; i < PROVIDERS.length; i++) {
  const providerId = db.prepare("SELECT id FROM providers WHERE user_id = (SELECT id FROM users WHERE email = ?)").get(PROVIDERS[i].email)?.id;
  if (providerId) {
    const customers = db.prepare(`
      SELECT DISTINCT u.name, u.email
      FROM bookings b
      JOIN users u ON u.id = b.user_id
      WHERE b.provider_id = ?
    `).all(providerId);
    console.log(`   ${PROVIDERS[i].providerName}: ${customers.length} customer(s)`);
    for (const c of customers) console.log(`     - ${c.name} (${c.email})`);
  }
}

console.log("\n👥 Customers with multiple providers:");
const multiProviderCustomers = db.prepare(`
  SELECT u.name, u.email, COUNT(DISTINCT b.provider_id) as provider_count,
         GROUP_CONCAT(p.name) as providers
  FROM bookings b
  JOIN users u ON u.id = b.user_id
  JOIN providers p ON p.id = b.provider_id
  GROUP BY u.id
  HAVING provider_count > 1
`).all();
for (const c of multiProviderCustomers) {
  console.log(`   ${c.name} (${c.email}): ${c.provider_count} providers - ${c.providers}`);
}