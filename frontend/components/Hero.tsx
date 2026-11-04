"use client";

import { useT } from "./i18n";

export default function Hero() {
  const { t } = useT();
  return (
    <section className="hero" aria-labelledby="hero-title">
      <div className="hero-content">
        <span className="hero-chip">{t("hero.cashNote")}</span>
        <h1 id="hero-title" className="hero-title">{t("hero.title")}</h1>
        <p className="hero-sub">{t("hero.sub")}</p>
        <div className="hero-actions">
          <a className="btn btn-primary btn-lg" href="#services">
            {t("hero.explore")}
          </a>
          <a className="btn btn-outline btn-lg" href="#booking">
            {t("hero.bookNow")}
          </a>
        </div>
        <div className="hero-trust">
          <span>{t("hero.trust1")}</span>
          <span className="trust-separator" aria-hidden="true">•</span>
          <span>{t("hero.trust2")}</span>
          <span className="trust-separator" aria-hidden="true">•</span>
          <span>{t("hero.trust3")}</span>
        </div>
      </div>
    </section>
  );
}