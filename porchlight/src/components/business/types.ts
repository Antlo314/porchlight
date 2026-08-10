// Shared shapes for the business/monetization vertical. Server pages build
// these plain objects so client components never receive Prisma model
// instances (Dates and Decimals don't cross the RSC boundary cleanly).
import {
  BUSINESS_CATEGORY_META,
  type BusinessCategoryValue,
  type PlanValue,
} from "@/lib/validators";

/** Why a business appears in the featured strip. */
export type FeaturedReason = "PLAN" | "BOOST";

export type DirectoryBusiness = {
  id: string;
  name: string;
  category: BusinessCategoryValue;
  description: string;
  logoUrl: string | null;
  verified: boolean;
  avgRating: number | null;
  reviewCount: number;
  plan: PlanValue;
  /** null when the business is neither on FEATURED nor currently boosted. */
  featuredReason: FeaturedReason | null;
  /** A live boost exists right now (startsAt <= now <= endsAt). */
  hasLiveBoost: boolean;
  /** That live boost is paid for by the Ad-Boost Pool, not the business. */
  poolFunded: boolean;
};

export type ServiceListingRow = {
  id: string;
  title: string;
  description: string;
  priceInfo: string | null;
  status: "ACTIVE" | "PAUSED";
};

/** Uniform result shape every action in this vertical returns to the client. */
export type ActionResult =
  | { ok: true }
  | { ok: false; error: string; upgradeRequired?: boolean };

/**
 * The DB stores enum-likes as plain strings (SQLite has no enums), so anything
 * read back has to be narrowed before it can index a display-metadata map.
 */
export function toBusinessCategory(raw: string): BusinessCategoryValue {
  return raw in BUSINESS_CATEGORY_META
    ? (raw as BusinessCategoryValue)
    : "OTHER";
}

export function toPlan(raw: string | null | undefined): PlanValue {
  return raw === "LOCAL_PRO" || raw === "FEATURED" ? raw : "FREE";
}

export function toListingStatus(raw: string): "ACTIVE" | "PAUSED" {
  return raw === "PAUSED" ? "PAUSED" : "ACTIVE";
}

/** Average of a review set, or null when there are no reviews yet. */
export function averageRating(ratings: { rating: number }[]): number | null {
  if (ratings.length === 0) return null;
  return ratings.reduce((sum, r) => sum + r.rating, 0) / ratings.length;
}

/** `tel:` needs digits only (a leading + is allowed for international). */
export function telHref(phone: string): string {
  const cleaned = phone.replace(/[^\d+]/g, "");
  return `tel:${cleaned}`;
}

export function websiteLabel(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
}
