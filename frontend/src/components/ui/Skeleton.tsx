interface SkeletonProps {
  lines?: number;
  className?: string;
}

export function SkeletonLines({ lines = 3, className = "" }: SkeletonProps) {
  return (
    <div className={`space-y-3 ${className}`} aria-hidden="true">
      {Array.from({ length: lines }, (_, i) => (
        <div
          key={i}
          className="skeleton"
          style={{ height: 16, width: `${Math.max(40, 100 - i * 15)}%` }}
        />
      ))}
    </div>
  );
}

export function SkeletonBlock({ height = 24, width = "100%", className = "" }: { height?: number; width?: string | number; className?: string }) {
  return <div className={`skeleton ${className}`} style={{ height, width }} aria-hidden="true" />;
}

/** A card-shaped skeleton used while the passport loads. */
export function CardSkeleton() {
  return (
    <div className="card" aria-hidden="true">
      <div className="flex items-center justify-between mb-4">
        <SkeletonBlock width={160} height={22} />
        <SkeletonBlock width={64} height={64} />
      </div>
      <div className="space-y-3">
        <SkeletonBlock width={140} />
        <SkeletonBlock width={200} />
        <SkeletonBlock width={110} />
        <SkeletonBlock />
        <SkeletonBlock width="75%" />
      </div>
    </div>
  );
}
