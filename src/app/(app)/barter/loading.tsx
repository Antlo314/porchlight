import { ListSkeleton, Skeleton } from "@/components/ui";

export default function BarterLoading() {
  return (
    <div className="space-y-4">
      <Skeleton className="h-28 w-full rounded-card" />
      <Skeleton className="h-12 w-full rounded-card" />
      <Skeleton className="h-11 w-full rounded-card" />
      <ListSkeleton count={4} />
    </div>
  );
}
