"use client";

import Nav from "@/components/Nav";
import Footer from "@/components/Footer";
import Link from "next/link";
import { useT } from "@/components/i18n";

export default function TermsPage() {
  const { t } = useT();
  return (
    <>
      <Nav />
      <main className="wrap">
        <section  style={{ paddingTop: 100 }}>
          <div className="container" style={{ maxWidth: 800 }}>
            <h1 className="h1">{t("terms.title")}</h1>
            <p className="sub">{t("terms.sub")}</p>
            <section className="card" style={{ marginTop: 24 }}>
              <h3>1. {t("terms.1.title")}</h3>
              <p>{t("terms.1.body")}</p>
            </section>
            <section className="card" style={{ marginTop: 14 }}>
              <h3>2. {t("terms.2.title")}</h3>
              <p>{t("terms.2.body")}</p>
            </section>
            <section className="card" style={{ marginTop: 14 }}>
              <h3>3. {t("terms.3.title")}</h3>
              <p>{t("terms.3.body")}</p>
            </section>
            <section className="card" style={{ marginTop: 14 }}>
              <h3>4. {t("terms.4.title")}</h3>
              <p>{t("terms.4.body")}</p>
            </section>
            <section className="card" style={{ marginTop: 14 }}>
              <h3>5. {t("terms.5.title")}</h3>
              <p>{t("terms.5.body")}</p>
            </section>
            <p style={{ marginTop: 20 }}>
              <Link className="btn btn-primary" href="/faq">
                {t("terms.seeFaq")}
              </Link>
            </p>
          </div>
        </section>
      </main>
      <Footer />
    </>
  );
}