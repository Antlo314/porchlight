import { Skeleton } from "@/components/ui";

export default function NeighborhoodLoading() {
  return (
    <div className="space-y-4">
      <Skeleton className="h-32 w-full rounded-card" />
      <Skeleton className="h-28 w-full rounded-card" />
      <Skeleton className="h-12 w-full rounded-card" />
      <Skeleton className="h-4 w-32" />
      <div className="space-y-2">
        {Array.from({ length: 6 }, (_, i) => (
          <Skeleton key={i} className="h-16 w-full rounded-card" />
        ))}
      </div>
    </div>
  );
}
