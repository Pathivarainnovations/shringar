import Link from "next/link";
import { FAQS } from "@/lib/content";
import Nav from "@/components/Nav";
import Footer from "@/components/Footer";

export const metadata = { title: "FAQ — Shringar" };

export default function FaqPage() {
  return (
    <>
      <Nav />
      <main className="wrap" style={{ paddingTop: 72 }}>
        <h1 className="h1">Frequently asked questions</h1>
        <p className="sub">Payments, cancellations, coverage and getting started.</p>
        {FAQS.map((f) => (
          <details key={f.q}>
            <summary>{f.q}</summary>
            <p>{f.a}</p>
          </details>
        ))}
        <details>
          <summary>How does offer-your-price work?</summary>
          <p>
            For home services you name your price. Nearby stylists see it and accept, or send a counter-offer that you can
            accept instantly.
          </p>
        </details>
        <details>
          <summary>Are providers verified?</summary>
          <p>
            Yes — citizenship ID, certificates and background checks before approval, and a verified badge is shown on
            every profile.
          </p>
        </details>
        <p style={{ marginTop: 20 }}>
          <Link className="btn" href="/safety">
            Read our safety promise
          </Link>
        </p>
      </main>
      <Footer />
    </>
  );
}
