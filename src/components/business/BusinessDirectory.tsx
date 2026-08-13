"use client";

import { useMemo, useState } from "react";
import { ChipRow, EmptyState, SectionHeading } from "@/components/ui";
import {
  BUSINESS_CATEGORY_META,
  type BusinessCategoryValue,
} from "@/lib/validators";
import { pluralize } from "@/lib/format";
import { BusinessCard } from "./BusinessCard";
import { FeaturedStrip } from "./FeaturedStrip";
import type { DirectoryBusiness } from "./types";

const CATEGORY_ORDER = Object.keys(
  BUSINESS_CATEGORY_META
) as BusinessCategoryValue[];

/**
 * Services directory: featured rail on top, then everyone. Filtering happens
 * on the client so tapping a chip is instant — the whole neighborhood's
 * business list is small enough to ship in one payload.
 */
export function BusinessDirectory({
  featured,
  businesses,
}: {
  featured: DirectoryBusiness[];
  businesses: DirectoryBusiness[];
}) {
  const [category, setCategory] = useState<BusinessCategoryValue | null>(null);

  // Only offer chips for categories that actually have a business behind them,
  // so no tap ever leads to an empty result.
  const options = useMemo(() => {
    const present = new Set(businesses.map((b) => b.category));
    return CATEGORY_ORDER.filter((c) => present.has(c)).map((c) => ({
      value: c,
      label: BUSINESS_CATEGORY_META[c].label,
    }));
  }, [businesses]);

  const visibleFeatured = useMemo(
    () => (category ? featured.filter((b) => b.category === category) : featured),
    [featured, category]
  );

  const visible = useMemo(
    () =>
      category ? businesses.filter((b) => b.category === category) : businesses,
    [businesses, category]
  );

  return (
    <div className="space-y-4">
      {options.length > 1 && (
        <ChipRow options={options} value={category} onChange={setCategory} />
      )}

      <FeaturedStrip businesses={visibleFeatured} />

      <div>
        <SectionHeading
          title={
            category
              ? BUSINESS_CATEGORY_META[category].label
              : "All neighborhood businesses"
          }
          action={
            visible.length > 0 ? (
              <span className="text-xs text-ink-soft">
                {pluralize(visible.length, "business", "businesses")}
              </span>
            ) : undefined
          }
        />
        {visible.length === 0 ? (
          <EmptyState
            icon="🛠️"
            title={
              category
                ? `No ${BUSINESS_CATEGORY_META[category].label.toLowerCase()} yet`
                : "No businesses listed yet"
            }
            body={
              category
                ? "Nobody nearby has listed in this category. Know someone? Tell them listing is free."
                : "Be the first business on your block. Listing on Porchlight is free."
            }
            actionLabel="List a business"
            actionHref="/business/new"
          />
        ) : (
          <div className="space-y-3">
            {visible.map((b) => (
              <BusinessCard key={b.id} business={b} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
