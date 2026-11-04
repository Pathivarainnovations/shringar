interface ReviewStarProps {
  filled: boolean;
}

export default function ReviewStar({ filled }: ReviewStarProps) {
  return (
    <span aria-hidden className="star" style={{ color: filled ? "var(--accent)" : "var(--line)" }}>
      ★
    </span>
  );
}