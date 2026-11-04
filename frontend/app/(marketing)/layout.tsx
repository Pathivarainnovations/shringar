import type { Metadata } from "next";
import { I18nProvider } from "@/components/i18n";
import { Suspense } from "react";

export const metadata: Metadata = {
  title: "Shringar — Beauty at your door or at the salon",
  description:
    "Book a verified stylist to come to your home, or reserve a seat at a salon near you in Kathmandu and Lalitpur. Pay cash after service.",
};

export default function MarketingLayout({ children }: { children: React.ReactNode }) {
  return (
    <I18nProvider>
      <Suspense fallback={<nav className="fnav" aria-label="Main" style={{ opacity: 0 }}><div className="logo">Shringar.</div></nav>}>
        {children}
      </Suspense>
    </I18nProvider>
  );
}