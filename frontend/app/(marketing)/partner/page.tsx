"use client";
import Nav from "@/components/Nav";
import PartnerApplyForm from "@/components/PartnerApplyForm";
import Footer from "@/components/Footer";

export default function PartnerPage() {
  return (
    <>
      <Nav />
      <main className="wrap" style={{ paddingTop: 72 }}>
        <h1 className="h1">Become a partner</h1>
        <p className="sub">
          "grow your bookings with Shringar — 15% commission per booking, staff tools, promotions for Dashain-Tihar, and"
          commission details
        </p>
        <div className="pdp">
          <div>
            <section className="card">
              <h3>Why partner with us</h3>
              <ul>
                <li>Verified badge after ID and licence check</li>
                <li>Suited for salons and independent beauticians alike</li>
                <li>Set your travel radius and travel fee for home services</li>
                <li>Earnings dashboard, payout history, commission details</li>
                <li>Staff management for multi-stylist salons</li>
                <li>Customer notes: hair type, allergies, preferences</li>
                <li>Create your own promotions</li>
              </ul>
            </section>
            <section className="card" style={{ marginTop: 14 }}>
              <h3>How approval works</h3>
              <p>
                1. Apply here → 2. Verification call + document check (citizenship, licence) → 3. Verified badge + training → 4. You appear in search and get bookings.
              </p>
            </section>
          </div>
          <PartnerApplyForm />
        </div>
      </main>
      <Footer />
    </>
  );
}
