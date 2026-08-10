import { ListSkeleton, Skeleton } from "@/components/ui";

export default function ServicesLoading() {
  return (
    <div className="space-y-4">
      <div>
        <Skeleton className="h-7 w-40" />
        <Skeleton className="mt-2 h-4 w-56" />
      </div>
      <Skeleton className="h-20 w-full rounded-card" />
      <div className="flex gap-2">
        <Skeleton className="h-8 w-24 rounded-full" />
        <Skeleton className="h-8 w-20 rounded-full" />
        <Skeleton className="h-8 w-28 rounded-full" />
      </div>
      <div className="flex gap-3">
        <Skeleton className="h-44 w-[15.5rem] shrink-0 rounded-card" />
        <Skeleton className="h-44 w-[15.5rem] shrink-0 rounded-card" />
      </div>
      <ListSkeleton count={4} />
    </div>
  );
}
