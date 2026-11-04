import { vi } from "vitest";
import React from "react";
import { render } from "@testing-library/react";
import { ToastProvider } from "@/components/app-shell/Toast";

export const BASE = `${process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4177"}/api`;
export const nav = { push: vi.fn(), replace: vi.fn(), params: {} as Record<string, string> };

interface ApiResponse {
  status: number;
  data: unknown;
}

interface OtpResponse { devCode: string }

/** Minimal cookie-aware fetch so the real `api()` helper works inside jsdom. */
export class Session {
  cookie = "";
  async call(method: string, path: string, body?: unknown): Promise<ApiResponse> {
    const r = await realFetch(BASE + path, { method, headers: { "Content-Type": "application/json", Origin: "http://localhost:3000", Cookie: this.cookie }, body: body === undefined ? undefined : JSON.stringify(body) });
    const sc = r.headers.get("set-cookie"); if (sc) this.cookie = sc.split(";")[0];
    return { status: r.status, data: await r.json().catch(() => ({})) };
  }
  /** Make every api() call from a rendered page run as this user. */
  install() {
    setCurrentSession(this);
  }
}
let current: Session | null = null;
function setCurrentSession(session: Session) { current = session; }
const realFetch = globalThis.fetch.bind(globalThis);
globalThis.fetch = ((url: string | URL | Request, init: RequestInit = {}) =>
  // jsdom's AbortSignal is not accepted by Node's fetch, so it is dropped (pages still work; requests just aren't cancelled).
  realFetch(url, { ...init, signal: undefined, headers: { ...(init.headers || {}), ...(current ? { Cookie: current.cookie } : {}), Origin: "http://localhost:3000" } })) as typeof fetch;
export const uniq = (p = "u") => `${p}${Date.now()}${Math.floor(Math.random() * 1e5)}@example.com`;

export async function signUp(email: string, name: string) {
  const s = new Session();
  const a = await s.call("POST", "/auth/signup", { email });
  await s.call("POST", "/auth/signup/verify", { email, code: (a.data as OtpResponse).devCode, name, password: "password123" });
  return s;
}
export async function adminSession() {
  const s = new Session();
  const a = await s.call("POST", "/auth/request-otp", { email: "owner@example.com" });
  await s.call("POST", "/auth/verify-otp", { email: "owner@example.com", code: (a.data as OtpResponse).devCode });
  return s;
}
export const renderPage = (ui: React.ReactElement) => render(<ToastProvider>{ui}</ToastProvider>);
