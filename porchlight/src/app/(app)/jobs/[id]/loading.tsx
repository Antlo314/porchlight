import { CardSkeleton, Skeleton } from "@/components/ui";

export default function JobDetailLoading() {
  return (
    <div className="space-y-4">
      <Skeleton className="h-6 w-28" />
      <Skeleton className="h-6 w-32 rounded-full" />
      <Skeleton className="h-8 w-4/5" />
      <Skeleton className="h-4 w-2/3" />
      <div className="space-y-2">
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-3/4" />
      </div>
      <Skeleton className="h-28 w-full rounded-card" />
      <CardSkeleton />
    </div>
  );
}
