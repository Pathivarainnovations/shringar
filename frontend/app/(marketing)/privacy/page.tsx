"use client";

import Nav from "@/components/Nav";
import Footer from "@/components/Footer";
import { useT } from "@/components/i18n";

export default function PrivacyPage() {
  const { t } = useT();
  return (
    <>
      <Nav />
      <main className="wrap">
        <section  style={{ paddingTop: 100 }}>
          <div className="container" style={{ maxWidth: 800 }}>
            <h1 className="h1">{t("privacy.title")}</h1>
            <p className="sub">{t("privacy.sub")}</p>
            <section className="card" style={{ marginTop: 24 }}>
              <h3>1. {t("privacy.1.title")}</h3>
              <p>{t("privacy.1.body")}</p>
            </section>
            <section className="card" style={{ marginTop: 14 }}>
              <h3>2. {t("privacy.2.title")}</h3>
              <p>{t("privacy.2.body")}</p>
            </section>
            <section className="card" style={{ marginTop: 14 }}>
              <h3>3. {t("privacy.3.title")}</h3>
              <p>{t("privacy.3.body")}</p>
            </section>
            <section className="card" style={{ marginTop: 14 }}>
              <h3>4. {t("privacy.4.title")}</h3>
              <p>{t("privacy.4.body")}</p>
            </section>
            <section className="card" style={{ marginTop: 14 }}>
              <h3>5. {t("privacy.5.title")}</h3>
              <p>{t("privacy.5.body")}</p>
            </section>
            <section className="card" style={{ marginTop: 14 }}>
              <h3>6. {t("privacy.6.title")}</h3>
              <p>{t("privacy.6.body")}</p>
            </section>
          </div>
        </section>
      </main>
      <Footer />
    </>
  );
}