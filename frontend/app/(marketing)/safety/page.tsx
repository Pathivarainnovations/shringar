"use client";

import Nav from "@/components/Nav";
import Footer from "@/components/Footer";
import { useT } from "@/components/i18n";

const ITEMS = [
  { title: "safety.verified", copy: "safety.verifiedc" },
  { title: "safety.women", copy: "safety.womenc" },
  { title: "safety.sos", copy: "safety.sosc" },
  { title: "safety.masked", copy: "safety.maskedc" },
];

export default function SafetyPage() {
  const { t } = useT();
  return (
    <>
      <Nav />
      <main className="wrap">
        <section className="section-dark" id="safety" aria-labelledby="safety-title">
          <div className="container">
            <header className="section-header section-header--center">
              <h2 id="safety-title" className="section-title">{t("safety.title")}</h2>
              <p className="section-subtitle">{t("safety.sub")}</p>
            </header>
            <div className="safe">
              {ITEMS.map((i) => (
                <div key={i.title} >
                  <h3>{t(i.title)}</h3>
                  <p>{t(i.copy)}</p>
                </div>
              ))}
            </div>
          </div>
        </section>
      </main>
      <Footer />
    </>
  );
}