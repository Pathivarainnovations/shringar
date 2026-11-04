"use client";
import { api } from "@/lib/api";

import { useEffect, useState } from "react";
import ReviewStar from "./ReviewStar";

interface PublicReview {
  id: string;
  stars: number;
  text: string;
  author: string;
  target: string;
}

export default function Reviews() {
  const [reviews, setReviews] = useState<PublicReview[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api("/reviews")
      .then((r) => r.json())
      .then((d) => {
        if (Array.isArray(d.reviews) && d.reviews.length >= 3) {
          setReviews(d.reviews);
        }
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <section id="reviews"  aria-labelledby="reviews-title">
        <div className="container">
          <header className="section-header section-header--center">
            <h2 id="reviews-title" className="section-title">Customer Reviews</h2>
            <p className="section-subtitle">Real experiences from real customers</p>
          </header>
          <div className="reviews-grid">
            {[1, 2, 3].map((i) => (
              <article key={i} className="review-card">
                <div className="review-skeleton"></div>
                <div className="review-skeleton"></div>
                <div className="review-skeleton short"></div>
                <div className="review-author-skeleton"></div>
              </article>
            ))}
          </div>
        </div>
      </section>
    );
  }

  if (reviews.length < 3) {
    return null;
  }

  return (
    <section id="reviews"  aria-labelledby="reviews-title">
      <div className="container">
        <header className="section-header section-header--center">
          <h2 id="reviews-title" className="section-title">Customer Reviews</h2>
          <p className="section-subtitle">Real experiences from real customers</p>
        </header>
        <div className="reviews-grid">
          {reviews.map((r) => (
            <article key={r.id} className="review-card">
              <div className="review-stars" aria-label={`${r.stars} out of 5 stars`}>
                {[...Array(5)].map((_, i) => (
                  <ReviewStar key={i} filled={i < r.stars} />
                ))}
              </div>
              <p className="review-text">{r.text}</p>
              <div className="review-author">
                <div className="author-avatar" aria-hidden="true">
                  {r.author?.charAt(0) || "U"}
                </div>
                <div className="author-info">
                  <span className="author-name">{r.author}</span>
                  <span className="author-service">{r.target}</span>
                </div>
              </div>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}