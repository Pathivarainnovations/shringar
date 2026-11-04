"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { EmptyState } from "@/components/app-shell";

export default function AdminError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  const router = useRouter();

  useEffect(() => {
    console.error("[admin] Error:", error);
  }, [error]);

  return (
    <div style={{ padding: 24 }}>
      <EmptyState
        title="Something went wrong"
        description={error.message}
        action={{
          label: "Try again",
          onClick: () => {
            reset();
            router.refresh();
          }
        }}
      />
    </div>
  );
}