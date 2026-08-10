// Chat-specific day bucketing for the date dividers between message groups.
// (Generic date/time formatting lives in @/lib/format — reuse that first.)

const DAY_MS = 86_400_000;

function startOfDay(d: Date): number {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
}

/** Stable key for "which calendar day is this message on", in local time. */
export function dayKey(iso: string): string {
  const d = new Date(iso);
  return `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`;
}

export function dayLabel(iso: string): string {
  const d = new Date(iso);
  const now = new Date();
  const diffDays = Math.round((startOfDay(now) - startOfDay(d)) / DAY_MS);

  if (diffDays === 0) return "Today";
  if (diffDays === 1) return "Yesterday";
  if (diffDays > 1 && diffDays < 7) {
    return d.toLocaleDateString("en-US", { weekday: "long" });
  }
  return d.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    ...(d.getFullYear() === now.getFullYear() ? {} : { year: "numeric" }),
  });
}

/** Consecutive messages from one sender break into a new bubble group after this gap. */
export const GROUP_GAP_MS = 30 * 60 * 1000;

export function sameGroupWindow(aIso: string, bIso: string): boolean {
  return (
    Math.abs(new Date(bIso).getTime() - new Date(aIso).getTime()) < GROUP_GAP_MS
  );
}
