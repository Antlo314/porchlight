// Profile-only display helpers. Anything reusable across verticals belongs in
// @/lib/format instead — these two are specific to the profile screens.

/** "March 2024" — the join-date line under a neighbor's name. */
export function joinDateLabel(date: Date | string): string {
  const d = typeof date === "string" ? new Date(date) : date;
  if (Number.isNaN(d.getTime())) return "a while back";
  return d.toLocaleDateString("en-US", { month: "long", year: "numeric" });
}

/** First name only, for buttons like "Message Maya". */
export function firstName(name: string): string {
  return name.trim().split(/\s+/)[0] || name;
}
