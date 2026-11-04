"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { api } from "./api";
import { useAuth } from "./auth-context";

export interface ApiState<T> {
  data: T | null;
  error: string | null;
  loading: boolean;
  reload: () => Promise<void>;
}

/** GET a backend path (pass null to skip). Optionally re-poll every `pollMs`. */
export function useApi<T = any>(path: string | null, pollMs?: number): ApiState<T> {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(path !== null);
  const alive = useRef(true);

  const load = useCallback(async () => {
    if (path === null) return;
    try {
      const res = await api(path);
      const body = await res.json().catch(() => ({}));
      if (!alive.current) return;
      if (!res.ok) {
        setError(body?.error || "Could not load this page");
      } else {
        setData(body);
        setError(null);
      }
    } catch {
      if (alive.current) setError("Could not reach the server. Check your connection.");
    } finally {
      if (alive.current) setLoading(false);
    }
  }, [path]);

  useEffect(() => {
    alive.current = true;
    setLoading(path !== null);
    load();
    if (!pollMs || path === null) return () => { alive.current = false; };
    const timer = setInterval(load, pollMs);
    return () => {
      alive.current = false;
      clearInterval(timer);
    };
  }, [load, pollMs, path]);

  return { data, error, loading, reload: load };
}

/** Role-guarded API call. Only fetches if user's role matches allowedRoles. */
export function useRoleApi<T = any>(
  path: string | null,
  allowedRoles: ("customer" | "provider" | "admin")[],
  pollMs?: number
): ApiState<T> {
  const { user } = useAuth();
  const hasAccess = user && allowedRoles.includes(user.role as "customer" | "provider" | "admin");
  const effectivePath = hasAccess ? path : null;
  return useApi<T>(effectivePath, pollMs);
}

/** id -> name for the service catalogue. */
export function useServiceNames(): Map<number, string> {
  const { data } = useApi<{ services: { id: number; name: string }[] }>("/services");
  return new Map((data?.services ?? []).map((s) => [s.id, s.name]));
}
