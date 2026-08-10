import { Skeleton } from "@/components/ui";

export default function NotificationsLoading() {
  return (
    <div className="space-y-3">
      <Skeleton className="h-6 w-40" />
      {Array.from({ length: 6 }, (_, i) => (
        <div
          key={i}
          className="flex items-start gap-3 rounded-card border border-line bg-card p-3"
        >
          <Skeleton className="h-10 w-10 rounded-full" />
          <div className="flex-1 space-y-2">
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-3 w-24" />
          </div>
        </div>
      ))}
    </div>
  );
}
