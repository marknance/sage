export function SkeletonCard() {
  return (
    <div className="bg-surface rounded-xl border border-border p-5 animate-pulse">
      <div className="h-5 bg-border rounded w-3/4 mb-3" />
      <div className="h-3 bg-border rounded w-1/2 mb-4" />
      <div className="h-3 bg-border rounded w-full mb-2" />
      <div className="h-3 bg-border rounded w-5/6" />
    </div>
  );
}

export function SkeletonGrid() {
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {Array.from({ length: 6 }).map((_, i) => (
        <SkeletonCard key={i} />
      ))}
    </div>
  );
}

export function Spinner() {
  return (
    <div className="min-h-screen bg-background flex items-center justify-center">
      <svg className="w-8 h-8 animate-spin text-primary" viewBox="0 0 24 24" fill="none">
        <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" strokeDasharray="31.4" strokeLinecap="round" />
      </svg>
    </div>
  );
}
