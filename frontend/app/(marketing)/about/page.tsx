"use client";

import Nav from "@/components/Nav";
import Footer from "@/components/Footer";
import Link from "next/link";
import { useT } from "@/components/i18n";

export default function AboutPage() {
  const { t } = useT();
  return (
    <>
      <Nav />
      <main className="wrap">
        <section  style={{ paddingTop: 100 }}>
          <div className="container" style={{ maxWidth: 800 }}>
            <h1 className="h1">{t("about.title")}</h1>
            <p className="sub">{t("about.sub")}</p>
            <section className="card" style={{ marginTop: 24 }}>
              <h3>{t("about.missionTitle")}</h3>
              <p>{t("about.mission")}</p>
            </section>
            <section className="card" style={{ marginTop: 14 }}>
              <h3>{t("about.valuesTitle")}</h3>
              <ul>
                <li>{t("about.value1")}</li>
                <li>{t("about.value2")}</li>
                <li>{t("about.value3")}</li>
                <li>{t("about.value4")}</li>
              </ul>
            </section>
            <p style={{ marginTop: 20 }}>
              <Link className="btn btn-primary" href="/booking">
                {t("hero.explore")}
              </Link>
            </p>
          </div>
        </section>
      </main>
      <Footer />
    </>
  );
}