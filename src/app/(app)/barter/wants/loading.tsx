import { ListSkeleton, Skeleton } from "@/components/ui";

export default function WantsLoading() {
  return (
    <div className="space-y-4">
      <Skeleton className="h-11 w-24" />
      <Skeleton className="h-16 w-full rounded-card" />
      <Skeleton className="h-11 w-full rounded-card" />
      <Skeleton className="h-8 w-2/3 rounded-full" />
      <ListSkeleton count={4} />
    </div>
  );
}
