export const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";

const PROTECTED_PREFIXES = ["/client", "/provider", "/admin", "/booking", "/checkout", "/track"];
let redirectingToLogin = false;

/**
 * fetch against the backend (cookies included). If a signed-in-only page gets a 401 (expired session),
 * send the visitor to /login?redirect=<current page> exactly once.
 */
export async function api(path: string, init?: RequestInit): Promise<Response> {
  const url = path.startsWith("/api") ? API_URL + path : API_URL + "/api" + path;
  
  // Read the client-accessible session cookie for Authorization header
  const clientCookie = typeof document !== "undefined" 
    ? document.cookie.split("; ").find(c => c.startsWith("sh_session_client="))?.split("=")[1]
    : undefined;
  
  const headers = new Headers(init?.headers);
  if (clientCookie) {
    headers.set("Authorization", `Bearer ${clientCookie}`);
  }
  
  const res = await fetch(url, { credentials: "include", ...init, headers });
  if (
    res.status === 401 &&
    typeof window !== "undefined" &&
    !redirectingToLogin &&
    !/^(\/api)?\/auth\//.test(path) &&
    PROTECTED_PREFIXES.some((p) => window.location.pathname.startsWith(p))
  ) {
    redirectingToLogin = true;
    window.location.assign("/login?redirect=" + encodeURIComponent(window.location.pathname + window.location.search));
  }
  return res;
}

export interface SendResult<T = any> {
  ok: boolean;
  status: number;
  data: T;
  error: string;
}

/** JSON request helper: returns { ok, data, error } instead of throwing, so pages can show the server's message. */
export async function send<T = any>(path: string, method: "POST" | "PUT" | "PATCH" | "DELETE", body?: unknown): Promise<SendResult<T>> {
  try {
    const res = await api(path, {
      method,
      headers: body === undefined ? undefined : { "Content-Type": "application/json" },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    const data = await res.json().catch(() => ({}));
    return { ok: res.ok, status: res.status, data, error: res.ok ? "" : data?.error || "Something went wrong" };
  } catch {
    return { ok: false, status: 0, data: {} as T, error: "Could not reach the server. Check your connection." };
  }
}
