"use client";

import Link from "next/link";
import { useT } from "./i18n";

export default function Footer() {
  const { t } = useT();
  return (
    <footer className="footer section-dark" role="contentinfo">
      <div className="container footer-grid">
        <div className="footer-brand">
          <Link className="logo" href="/">
            Shringar<span>.</span>
          </Link>
          <p className="footer-tagline">{t("footer.tag")}</p>
          <div className="news">
            <input type="email" placeholder="Your email" aria-label="Email for the newsletter" />
            <button className="btn btn-primary">Subscribe</button>
          </div>
        </div>
        <nav className="footer-nav" aria-label="Footer navigation">
          <div className="footer-column">
            <h4 className="footer-heading">{t("footer.help")}</h4>
            <ul>
              <li><Link href="/booking">Book a visit</Link></li>
              <li><Link href="/safety">{t("footer.safety")}</Link></li>
              <li><Link href="/faq">FAQ</Link></li>
              <li><Link href="/account">{t("nav.account")}</Link></li>
            </ul>
          </div>
          <div className="footer-column">
            <h4 className="footer-heading">{t("footer.cols")}</h4>
            <ul>
              <li><Link href="/about">{t("footer.about")}</Link></li>
              <li><Link href="/partner">{t("footer.partner")}</Link></li>
              <li><Link href="/provider">Provider dashboard</Link></li>
              <li><Link href="/admin">Admin panel</Link></li>
            </ul>
          </div>
          <div className="footer-column">
            <h4 className="footer-heading">Legal</h4>
            <ul>
              <li><Link href="/terms">{t("footer.terms")}</Link></li>
              <li><Link href="/privacy">{t("footer.privacy")}</Link></li>
              <li><Link href="/cancellation">{t("footer.cancel")}</Link></li>
            </ul>
          </div>
        </nav>
      </div>
      <div className="footer-bottom">
        <div className="container footer-bottom-inner">
          <p className="copyright">\u00A9 2026 Shringar. All rights reserved.</p>
          <p className="fine-print">Prices include VAT. Travel fee applies to home visits.</p>
        </div>
      </div>
    </footer>
  );
}