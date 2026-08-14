// Display metadata for the barter vertical that isn't already in
// @/lib/validators (status vocabularies and ledger reasons live in
// prisma/schema.prisma comments; these maps turn them into human copy).
import {
  BARTER_CATEGORY_LABELS,
  BARTER_KIND_META,
  type BarterCategoryValue,
  type BarterKindValue,
} from "@/lib/validators";

/** Safe lookup — `kind` comes back from SQLite as a plain string. */
export function kindMeta(kind: string) {
  return BARTER_KIND_META[kind as BarterKindValue] ?? BARTER_KIND_META.GOODS;
}

export function categoryLabel(category: string) {
  return (
    BARTER_CATEGORY_LABELS[category as BarterCategoryValue] ??
    BARTER_CATEGORY_LABELS.OTHER
  );
}

type StatusMeta = { label: string; className: string };

export const LISTING_STATUS_META: Record<string, StatusMeta> = {
  OPEN: { label: "Open", className: "bg-emerald-100 text-emerald-800" },
  PENDING: { label: "Trade in progress", className: "bg-amber-100 text-amber-800" },
  COMPLETED: { label: "Completed", className: "bg-pine-500/10 text-pine-700" },
  WITHDRAWN: { label: "Withdrawn", className: "bg-line text-ink-soft" },
};

export const OFFER_STATUS_META: Record<string, StatusMeta> = {
  PENDING: { label: "Waiting on a reply", className: "bg-amber-100 text-amber-800" },
  ACCEPTED: { label: "Accepted", className: "bg-emerald-100 text-emerald-800" },
  DECLINED: { label: "Declined", className: "bg-line text-ink-soft" },
  COMPLETED: { label: "Completed", className: "bg-pine-500/10 text-pine-700" },
  CANCELLED: { label: "Withdrawn", className: "bg-line text-ink-soft" },
};

export function listingStatusMeta(status: string): StatusMeta {
  return LISTING_STATUS_META[status] ?? LISTING_STATUS_META.OPEN;
}

export function offerStatusMeta(status: string): StatusMeta {
  return OFFER_STATUS_META[status] ?? OFFER_STATUS_META.PENDING;
}

/** TradeCreditEntry.reason → human copy for the ledger screen. */
export const CREDIT_REASON_LABELS: Record<string, string> = {
  SIGNUP_BONUS: "Welcome bonus",
  TRADE_EARNED: "Trade completed",
  TRADE_SPENT: "Spent on a trade",
  COMMUNITY_REWARD: "Community reward",
  GAME_REWARD: "Games",
  WEEKLY_PRIZE: "Ember's Quilt weekly",
  INVITE_BONUS: "Invite bonus",
  ADJUSTMENT: "Balance adjustment",
};

export function creditReasonLabel(reason: string): string {
  return CREDIT_REASON_LABELS[reason] ?? "Credit update";
}

/**
 * The neighborhood convention for TIME listings: one hour of help is worth
 * 10 Porch Credits. Kept here so the create form and the offer composer
 * quote the same number.
 */
export const CREDITS_PER_HOUR = 10;

export function creditsToHours(credits: number): string {
  const hours = credits / CREDITS_PER_HOUR;
  return Number.isInteger(hours) ? String(hours) : hours.toFixed(1);
}
