import { CardSkeleton, Skeleton } from "@/components/ui";

export default function PostDetailLoading() {
  return (
    <div className="space-y-4">
      <Skeleton className="h-5 w-32" />
      <CardSkeleton />
      <div className="flex gap-2">
        <Skeleton className="h-11 flex-1 rounded-card" />
        <Skeleton className="h-11 flex-1 rounded-card" />
        <Skeleton className="h-11 flex-1 rounded-card" />
      </div>
      <Skeleton className="h-4 w-24" />
      <CardSkeleton />
    </div>
  );
}
