"use client";

interface SkeletonProps {
  variant?: "text" | "circular" | "rectangular" | "card";
  width?: string | number;
  height?: string | number;
  className?: string;
  count?: number;
}

export default function Skeleton({ variant = "text", width, height, className, count = 1 }: SkeletonProps) {
  const baseStyle: React.CSSProperties = {
    background: "linear-gradient(90deg, var(--line) 25%, var(--muted) 50%, var(--line) 75%)",
    backgroundSize: "200% 100%",
    animation: "shimmer 1.5s infinite",
    borderRadius: variant === "circular" ? "50%" : variant === "text" ? "4px" : "8px",
    width: typeof width === "number" ? `${width}px` : width || (variant === "text" ? "100%" : "auto"),
    height: typeof height === "number" ? `${height}px` : height || (variant === "text" ? "1rem" : variant === "circular" ? "40px" : "120px"),
  };

  return (
    <>
      <style jsx>{`
        @keyframes shimmer {
          0% { background-position: 200% 0; }
          100% { background-position: -200% 0; }
        }
      `}</style>
      {[...Array(count)].map((_, i) => (
        <div key={i} className={className} style={baseStyle} aria-hidden="true" />
      ))}
    </>
  );
}