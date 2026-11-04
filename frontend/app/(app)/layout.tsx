"use client";

import { Suspense } from "react";
import AppShell from "@/components/app-shell/AppShell";
import { I18nProvider } from "@/components/i18n";
import { ToastProvider } from "@/components/app-shell/Toast";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <I18nProvider>
      <ToastProvider>
        <AppShell>
          <Suspense fallback={null}>
            {children}
          </Suspense>
        </AppShell>
      </ToastProvider>
    </I18nProvider>
  );
}
