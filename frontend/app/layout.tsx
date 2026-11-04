import type { Metadata } from "next";
import { Plus_Jakarta_Sans } from "next/font/google";
import "./globals.css";
import { I18nProvider } from "@/components/i18n";
import { Suspense } from "react";
import { AuthProvider } from "@/lib/auth-context";

const plusJakarta = Plus_Jakarta_Sans({
  variable: "--font-plus-jakarta",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
});

export const metadata: Metadata = {
  title: "Shringar — Beauty at your door or at the salon",
  description:
    "Book a verified stylist to come to your home, or reserve a seat at a salon near you in Kathmandu and Lalitpur. Pay cash after service.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={plusJakarta.variable}>
      <body>
        <AuthProvider>
          <I18nProvider>
            <Suspense fallback={<nav className="fnav" aria-label="Main" style={{ opacity: 0 }}><div className="logo">Shringar.</div></nav>}>
              {children}
            </Suspense>
          </I18nProvider>
        </AuthProvider>
      </body>
    </html>
  );
}