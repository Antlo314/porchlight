import { ListSkeleton, Skeleton } from "@/components/ui";

export default function JobsLoading() {
  return (
    <div className="space-y-4">
      <Skeleton className="h-12 w-48" />
      <Skeleton className="h-24 w-full rounded-card" />
      <Skeleton className="h-14 w-full rounded-card" />
      <Skeleton className="h-8 w-full rounded-full" />
      <ListSkeleton count={4} />
    </div>
  );
}
