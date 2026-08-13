import { ListSkeleton, Skeleton } from "@/components/ui";

export default function MatchesLoading() {
  return (
    <div className="space-y-4">
      <Skeleton className="h-11 w-24" />
      <Skeleton className="h-16 w-full rounded-card" />
      <ListSkeleton count={3} />
    </div>
  );
}
