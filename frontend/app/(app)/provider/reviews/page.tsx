"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { EmptyState, Skeleton } from "@/components/app-shell";

interface Review {
  id: string;
  bookingId: string | null;
  stars: number;
  text: string;
  author: string;
  createdAt: string;
}

export default function ProviderReviewsPage() {
  const [loading, setLoading] = useState(true);
  const [reviews, setReviews] = useState<Review[]>([]);
  const [rating, setRating] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api("/provider/reviews")
      .then(async (r) => {
        const d = await r.json();
        if (!r.ok) throw new Error(d.error || "Could not load reviews");
        setReviews(d.reviews ?? []);
        setRating(d.rating ?? null);
      })
      .catch((e) => setError(e instanceof Error ? e.message : "Could not load reviews"))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div>
      <h1 className="h1">Reviews</h1>
      <p className="sub">
        What clients said about completed bookings
        {rating !== null ? ` — average ★ ${rating} from ${reviews.length} review${reviews.length === 1 ? "" : "s"}` : ""}.
      </p>

      <section className="card" style={{ marginTop: 24 }}>
        <h3>All Reviews</h3>
        {loading ? (
          <Skeleton variant="card" />
        ) : error ? (
          <EmptyState title="Could not load reviews" description={error} />
        ) : reviews.length === 0 ? (
          <EmptyState title="No reviews yet" description="Complete bookings to receive reviews from clients" />
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            {reviews.map((r) => (
              <div key={r.id} className="card" style={{ padding: 16 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
                  <b>Booking {r.bookingId}</b>
                  <span style={{ color: "#F5B301" }} aria-label={`${r.stars} out of 5 stars`}>
                    {"★".repeat(r.stars)}
                    {"☆".repeat(5 - r.stars)}
                  </span>
                </div>
                {r.text && <p style={{ marginBottom: 4 }}>&ldquo;{r.text}&rdquo;</p>}
                <small className="mut">
                  — {r.author} • {new Date(r.createdAt).toLocaleDateString()}
                </small>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
