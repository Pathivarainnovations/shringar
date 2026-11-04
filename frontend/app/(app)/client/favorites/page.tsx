"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { send } from "@/lib/api";
import { useApi } from "@/lib/hooks";
import type { ProviderSummary } from "@/lib/types";
import { EmptyState, Skeleton, useToast } from "@/components/app-shell";

export default function ClientFavoritesPage() {
  const router = useRouter();
  const { showToast } = useToast();
  const favs = useApi<{ favorites: { name: string }[] }>("/favorites");
  const providers = useApi<{ providers: ProviderSummary[] }>("/providers");

  async function remove(name: string) {
    const r = await send("/favorites", "POST", { name, action: "remove" });
    if (!r.ok) return showToast({ type: "error", title: r.error });
    favs.reload();
  }

  const byName = new Map((providers.data?.providers ?? []).map((p) => [p.name, p]));
  const names = (favs.data?.favorites ?? []).map((f) => f.name);

  return (
    <div>
      <h1 className="h1">Favorites</h1>
      <p className="sub">Providers you saved.</p>
      <div style={{ display: "grid", gap: 12, marginTop: 16 }}>
        {favs.loading ? (
          <Skeleton variant="card" />
        ) : favs.error ? (
          <EmptyState title="Could not load favorites" description={favs.error} action={{ label: "Try again", onClick: favs.reload }} />
        ) : names.length === 0 ? (
          <EmptyState title="No favorites yet" description="Tap the heart on a provider to save them here." action={{ label: "Browse providers", onClick: () => router.push("/#stylists") }} />
        ) : (
          names.map((name) => {
            const p = byName.get(name);
            return (
              <div key={name} className="card" style={{ padding: 16, display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap", alignItems: "center" }}>
                <div>
                  <b>{name}</b>
                  <div className="mut">{p ? `${p.service} • ${p.area}${p.rating !== null ? ` • ★ ${p.rating}` : ""}` : "No longer available"}</div>
                </div>
                <div className="row" style={{ gap: 8 }}>
                  {p && <Link className="btn btn-primary btn-sm" href={`/booking?provider=${encodeURIComponent(p.id)}`}>Book</Link>}
                  <button className="btn btn-outline btn-sm" onClick={() => remove(name)}>Remove</button>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
