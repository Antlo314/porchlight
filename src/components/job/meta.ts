// Display metadata for the reverse service marketplace.
//
// A job's `category` reuses BusinessCategory so a request and the pros who can
// answer it are matched on the same vocabulary. SQLite has no enums, so both
// `category` and `status` come back as plain strings and are narrowed here
// before they index a metadata map — an unknown value from an older row falls
// back instead of crashing a render.
import {
  BUSINESS_CATEGORY_META,
  BusinessCategory,
  type BusinessCategoryValue,
} from "@/lib/validators";

export type JobStatusValue = "OPEN" | "FULFILLED" | "CLOSED";

export function toJobCategory(raw: string): BusinessCategoryValue {
  return raw in BUSINESS_CATEGORY_META
    ? (raw as BusinessCategoryValue)
    : "OTHER";
}

export function jobCategoryMeta(raw: string): { label: string; icon: string } {
  return BUSINESS_CATEGORY_META[toJobCategory(raw)];
}

export function toJobStatus(raw: string): JobStatusValue {
  return raw === "FULFILLED" || raw === "CLOSED" ? raw : "OPEN";
}

export const JOB_STATUS_META: Record<
  JobStatusValue,
  { label: string; className: string }
> = {
  OPEN: { label: "Open", className: "bg-pine-500/10 text-pine-700" },
  FULFILLED: { label: "Fulfilled", className: "bg-porch-100 text-porch-800" },
  CLOSED: { label: "Closed", className: "bg-line text-ink-soft" },
};

/** Every category, in the order the Zod enum declares them. */
export const JOB_CATEGORY_OPTIONS = BusinessCategory.options.map((value) => ({
  value,
  label: BUSINESS_CATEGORY_META[value].label,
  icon: BUSINESS_CATEGORY_META[value].icon,
}));

/** Average of a review set, or null when a pro has no reviews yet. */
export function averageRating(ratings: { rating: number }[]): number | null {
  if (ratings.length === 0) return null;
  return ratings.reduce((sum, r) => sum + r.rating, 0) / ratings.length;
}
