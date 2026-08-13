// Date-header grouping for the events calendar. Kept beside EventCard so the
// "Today / Tomorrow / Sat, Mar 8" wording stays in one place.
import { formatEventDate } from "@/lib/format";

export type DayGroup<T> = { key: string; label: string; events: T[] };

function startOfDay(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

/** Whole days between two dates, DST-safe (a day can be 23 or 25 hours long). */
function daysApart(from: Date, to: Date): number {
  return Math.round(
    (startOfDay(to).getTime() - startOfDay(from).getTime()) / 86_400_000
  );
}

export function eventDayLabel(date: Date, now: Date = new Date()): string {
  const diff = daysApart(now, date);
  if (diff === 0) return "Today";
  if (diff === 1) return "Tomorrow";
  return formatEventDate(date);
}

/**
 * Collapses a start-time-ascending list into consecutive day buckets. Expects
 * the sorted order getUpcomingEvents() already returns, so a single pass is
 * enough and the groups come out in calendar order.
 */
export function groupEventsByDay<T extends { startsAt: Date }>(
  events: T[],
  now: Date = new Date()
): DayGroup<T>[] {
  const groups: DayGroup<T>[] = [];

  for (const event of events) {
    const key = startOfDay(event.startsAt).toDateString();
    const current = groups[groups.length - 1];

    if (current && current.key === key) {
      current.events.push(event);
    } else {
      groups.push({
        key,
        label: eventDayLabel(event.startsAt, now),
        events: [event],
      });
    }
  }

  return groups;
}
