"use client";

import Nav from "@/components/Nav";
import Footer from "@/components/Footer";
import { useT } from "@/components/i18n";

export default function CancellationPage() {
  const { t } = useT();
  return (
    <>
      <Nav />
      <main className="wrap">
        <section  style={{ paddingTop: 100 }}>
          <div className="container" style={{ maxWidth: 800 }}>
            <h1 className="h1">{t("cancellation.title")}</h1>
            <p className="sub">{t("cancellation.sub")}</p>
            <section className="card" style={{ marginTop: 24 }}>
              <h3>{t("cancellation.1.title")}</h3>
              <p>{t("cancellation.1.body")}</p>
            </section>
            <section className="card" style={{ marginTop: 14 }}>
              <h3>{t("cancellation.2.title")}</h3>
              <p>{t("cancellation.2.body")}</p>
            </section>
            <section className="card" style={{ marginTop: 14 }}>
              <h3>{t("cancellation.3.title")}</h3>
              <p>{t("cancellation.3.body")}</p>
            </section>
            <section className="card" style={{ marginTop: 14 }}>
              <h3>{t("cancellation.4.title")}</h3>
              <p>{t("cancellation.4.body")}</p>
            </section>
            <section className="card" style={{ marginTop: 14 }}>
              <h3>{t("cancellation.5.title")}</h3>
              <p>{t("cancellation.5.body")}</p>
            </section>
            <section className="card" style={{ marginTop: 14 }}>
              <h3>{t("cancellation.6.title")}</h3>
              <p>{t("cancellation.6.body")}</p>
            </section>
          </div>
        </section>
      </main>
      <Footer />
    </>
  );
}