"use client";
import { useT } from "./i18n";
import PartnerApplyForm from "./PartnerApplyForm";

export default function Partner() {
  const { t } = useT();

  return (
    <section id="partners" className="section-white">
      <div className="container">
        <header className="section-header">
          <h2 className="section-title">{t("partner.title")}</h2>
          <p className="section-subtitle">{t("partner.sub")}</p>
        </header>
        <div className="pdp">
          <div>
            <section className="card">
              <h3>{t("partner.whyTitle")}</h3>
              <ul>
                <li>{t("partner.why1")}</li>
                <li>{t("partner.why2")}</li>
                <li>{t("partner.why3")}</li>
                <li>{t("partner.why4")}</li>
                <li>{t("partner.why5")}</li>
                <li>{t("partner.why6")}</li>
                <li>{t("partner.why7")}</li>
              </ul>
            </section>
            <section className="card" style={{ marginTop: 14 }}>
              <h3>{t("partner.approvalTitle")}</h3>
              <p>{t("partner.approvalDesc")}</p>
            </section>
          </div>
          <PartnerApplyForm />
        </div>
      </div>
    </section>
  );
}