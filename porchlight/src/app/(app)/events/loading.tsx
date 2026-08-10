import { ListSkeleton, Skeleton } from "@/components/ui";

export default function EventsLoading() {
  return (
    <div className="space-y-4">
      <Skeleton className="h-7 w-44" />
      <Skeleton className="h-4 w-20" />
      <ListSkeleton count={3} />
      <Skeleton className="h-4 w-24" />
      <ListSkeleton count={2} />
    </div>
  );
}
