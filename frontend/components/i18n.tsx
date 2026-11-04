"use client";

import { createContext, useContext } from "react";
import { t } from "@/lib/i18n";

interface I18nContext {
  t: (key: string) => string;
}

const Ctx = createContext<I18nContext>({ t });

export function I18nProvider({ children }: { children: React.ReactNode }) {
  return <Ctx.Provider value={{ t }}>{children}</Ctx.Provider>;
}

export function useT() {
  return useContext(Ctx);
}