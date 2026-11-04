"use client";

import { useEffect, useState, Suspense } from "react";
import { useRouter, usePathname } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import Skeleton from "./Skeleton";
import { ROLE_HOME } from "@/lib/roles";

export default function AuthGuard({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const { user, loading } = useAuth();

  useEffect(() => {
    if (!user) return;
    const role = user.role ?? "customer";
    const allowedPrefix = ROLE_HOME[role as keyof typeof ROLE_HOME];
    if (allowedPrefix && !pathname.startsWith(allowedPrefix)) {
      router.replace(allowedPrefix);
      router.refresh();
    }
  }, [user, pathname, router]);

  // Render children immediately with skeleton while loading, to satisfy instant navigation
  // Redirect to login happens in AuthProvider
  return (
    <>
      {loading ? (
        <Suspense fallback={<Skeleton variant="card" count={3} />}>
          {children}
        </Suspense>
      ) : (
        children
      )}
    </>
  );
}