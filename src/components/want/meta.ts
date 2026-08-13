// Display metadata for the wants half of barter.
//
// Deliberately self-contained: every file in this folder is pulled into client
// components, and the wants UI must never reach into the listings vertical for
// a label. The vocabularies themselves still come from @/lib/validators — this
// module only turns them into human copy.
import type { MatchReason } from "@/lib/matching";
import {
  BARTER_CATEGORY_LABELS,
  BARTER_KIND_META,
  type BarterCategoryValue,
  type BarterKindValue,
} from "@/lib/validators";

/** Safe lookup — `kind` comes back from the database as a plain String column. */
export function wantKindMeta(kind: string) {
  return BARTER_KIND_META[kind as BarterKindValue] ?? BARTER_KIND_META.GOODS;
}

export function wantCategoryLabel(category: string): string {
  return (
    BARTER_CATEGORY_LABELS[category as BarterCategoryValue] ??
    BARTER_CATEGORY_LABELS.OTHER
  );
}

/** Want.status — mirrors wantStatusSchema in @/lib/validators. */
export type WantStatusValue = "OPEN" | "FULFILLED" | "CLOSED";

export const WANT_STATUS_META: Record<
  WantStatusValue,
  { label: string; className: string }
> = {
  OPEN: { label: "Looking", className: "bg-pine-500/10 text-pine-700" },
  FULFILLED: { label: "Found it", className: "bg-emerald-100 text-emerald-800" },
  CLOSED: { label: "Closed", className: "bg-line text-ink-soft" },
};

export function toWantStatus(status: string): WantStatusValue {
  return status === "FULFILLED" || status === "CLOSED" ? status : "OPEN";
}

/**
 * Why the app thinks these two halves fit — as short phrases a member can
 * check against their own judgement.
 *
 * This matters more than the score. "matches on: ladder" is verifiable in a
 * glance, so a member who sees it trusts the next suggestion too; an
 * unexplained match that misses once teaches them to ignore the feature
 * forever. The score itself is never shown: a number nobody can audit reads as
 * a claim, and the words read as evidence.
 */
export function matchReasons(match: MatchReason, category: string): string[] {
  const out: string[] = [];
  if (match.sharedWords.length > 0) {
    out.push(`matches on: ${match.sharedWords.join(", ")}`);
  }
  if (match.sameCategory) {
    out.push(`both tagged ${wantCategoryLabel(category)}`);
  }
  return out;
}

/** "Maya Ellis" → "Maya". Buttons read better addressed to a person. */
export function firstName(name: string): string {
  const first = name.trim().split(/\s+/)[0];
  return first && first.length > 0 ? first : name;
}
