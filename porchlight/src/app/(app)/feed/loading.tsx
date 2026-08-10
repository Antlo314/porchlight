import { ListSkeleton, Skeleton } from "@/components/ui";

// Widths are literal class names so Tailwind's scanner can see them.
const CHIP_WIDTHS = ["w-20", "w-24", "w-20", "w-28", "w-24"];

export default function FeedLoading() {
  return (
    <div className="space-y-3">
      <div className="-mx-4 flex gap-2 overflow-hidden px-4 pb-1">
        {CHIP_WIDTHS.map((w, i) => (
          <Skeleton key={i} className={`h-8 shrink-0 rounded-full ${w}`} />
        ))}
      </div>
      <ListSkeleton count={4} />
    </div>
  );
}
