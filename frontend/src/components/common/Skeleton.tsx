interface SkeletonProps {
  className?: string;
}

export function Skeleton({ className = "" }: SkeletonProps) {
  return (
    <div
      className={`animate-pulse rounded-app bg-surface-2 ${className}`}
      aria-hidden="true"
    />
  );
}