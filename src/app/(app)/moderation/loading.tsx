import { ListSkeleton, Skeleton } from "@/components/ui";

export default function ModerationLoading() {
  return (
    <div className="space-y-4">
      <Skeleton className="h-7 w-40" />
      <Skeleton className="h-4 w-56" />
      <Skeleton className="h-11 w-full rounded-card" />
      <ListSkeleton count={3} />
    </div>
  );
}
