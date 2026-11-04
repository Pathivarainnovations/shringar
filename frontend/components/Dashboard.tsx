import Link from "next/link";

// Marketing section for providers. Deliberately contains no figures: real numbers live in the
// signed-in provider dashboard, where they come from the database.
export default function Dashboard() {
  return (
    <section id="dashboard">
      <h2>A dashboard for stylists and salons</h2>
      <p className="sub">Accept requests, track earnings and manage your day in one place.</p>
      <ul style={{ marginTop: 16, paddingLeft: 20, lineHeight: 1.8 }}>
        <li>See new booking requests and accept, decline or counter them</li>
        <li>Set your own services, prices, hours and travel radius</li>
        <li>Follow your earnings and commission as bookings are completed</li>
      </ul>
      <p style={{ marginTop: 16 }}>
        <Link className="btn gold" href="/partner">
          Apply to become a provider
        </Link>
      </p>
    </section>
  );
}
