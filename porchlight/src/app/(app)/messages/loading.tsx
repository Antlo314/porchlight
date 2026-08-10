import { Skeleton } from "@/components/ui";

export default function MessagesLoading() {
  return (
    <div>
      <div className="mb-2 mt-6 first:mt-0">
        <Skeleton className="h-4 w-24" />
      </div>
      <ul className="space-y-2">
        {Array.from({ length: 6 }, (_, i) => (
          <li
            key={i}
            className="flex min-h-16 items-center gap-3 rounded-card border border-line bg-card p-3"
          >
            <Skeleton className="h-10 w-10 rounded-full" />
            <div className="min-w-0 flex-1">
              <Skeleton className="h-4 w-32" />
              <Skeleton className="mt-2 h-3 w-48" />
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
