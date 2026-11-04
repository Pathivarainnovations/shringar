"use client";

import { createContext, useContext, useEffect, useState, useCallback, ReactNode } from "react";
import { api } from "./api";
import { useRouter } from "next/navigation";

interface Me {
  name: string;
  email: string;
  wallet: number;
  role?: string;
  providerId?: string;
}

interface AuthContextType {
  user: Me | null;
  loading: boolean;
  reload: () => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const router = useRouter();
  const [user, setUser] = useState<Me | null>(null);
  const [loading, setLoading] = useState(true);

  const reload = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api("/auth/me");
      if (res.status === 401) {
        setUser(null);
        setLoading(false);
        return;
      }
      const d = await res.json();
      if (!d.user) {
        setUser(null);
      } else {
        setUser(d.user);
      }
    } catch {
      setUser(null);
    } finally {
      setLoading(false);
    }
  }, []);

  const logout = useCallback(async () => {
    try {
      await api("/auth/logout", { method: "POST" });
    } catch {
      // ignore
    }
    setUser(null);
    setLoading(false);
    router.push("/login");
    router.refresh();
  }, [router]);

  useEffect(() => {
    reload();
  }, [reload]);

  return (
    <AuthContext.Provider value={{ user, loading, reload, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}