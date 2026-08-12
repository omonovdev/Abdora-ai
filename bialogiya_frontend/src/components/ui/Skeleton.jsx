import { cn } from '../../utils/cn';

// Skeletons mirror the shape of the content they stand in for, so the layout
// does not shift when data lands.
export function Skeleton({ className }) {
  return (
    <div
      aria-hidden="true"
      className={cn('animate-pulse rounded-lg bg-gray-200/70 dark:bg-gray-700/50 motion-reduce:animate-none', className)}
    />
  );
}

export function StatTileSkeleton({ count = 4 }) {
  return (
    <>
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="card">
          <Skeleton className="h-3 w-20" />
          <Skeleton className="mt-3 h-7 w-28" />
          <Skeleton className="mt-2 h-3 w-16" />
        </div>
      ))}
    </>
  );
}

export function RowSkeleton({ count = 5 }) {
  return (
    <>
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="card flex items-center gap-3">
          <Skeleton className="h-10 w-10 flex-shrink-0 rounded-xl" />
          <div className="flex-1 space-y-2">
            <Skeleton className="h-3.5 w-2/5" />
            <Skeleton className="h-3 w-1/4" />
          </div>
          <Skeleton className="h-6 w-16 rounded-full" />
        </div>
      ))}
    </>
  );
}
