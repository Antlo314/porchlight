"use client";

import Link from "next/link";
import { useEffect, useRef, useTransition } from "react";
import { Badge, Stars, VerifiedMark } from "@/components/ui";
import { truncate } from "@/lib/format";
import { BUSINESS_CATEGORY_META } from "@/lib/validators";
import {
  recordBoostClick,
  recordBoostImpressions,
} from "@/app/(app)/services/actions";
import { BusinessLogo } from "./BusinessLogo";
import type { DirectoryBusiness } from "./types";

function boostBadge(business: DirectoryBusiness) {
  if (business.hasLiveBoost && business.poolFunded) {
    return (
      <Badge className="bg-pine-500/10 text-pine-700">🔦 Ad-Boost Pool</Badge>
    );
  }
  if (business.hasLiveBoost) {
    return <Badge className="bg-porch-100 text-porch-800">Boosted</Badge>;
  }
  return <Badge className="bg-porch-100 text-porch-800">Featured</Badge>;
}

/**
 * The rotating featured rail. Businesses land here from a FEATURED
 * subscription or from a live AdBoost — including the pool-funded boosts
 * Porchlight buys for well-reviewed verified businesses.
 *
 * Impressions are counted once per mount, clicks once per tap, so the owner
 * dashboard reports delivery the business can actually check.
 */
export function FeaturedStrip({
  businesses,
}: {
  businesses: DirectoryBusiness[];
}) {
  const [, startTransition] = useTransition();
  const loggedRef = useRef<string>("");

  const boostedIds = businesses
    .filter((b) => b.hasLiveBoost)
    .map((b) => b.id)
    .sort();
  const boostKey = boostedIds.join(",");

  useEffect(() => {
    if (!boostKey || loggedRef.current === boostKey) return;
    loggedRef.current = boostKey;
    void recordBoostImpressions(boostKey.split(","));
  }, [boostKey]);

  if (businesses.length === 0) return null;

  return (
    <section aria-label="Featured businesses">
      <div className="mb-2 flex items-center justify-between">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-ink-soft">
          Featured nearby
        </h2>
        {/* -mr-3 offsets the padding, so the label stays flush right while the
            tap target reaches 44px. */}
        <Link
          href="/business/pricing"
          className="-mr-3 inline-flex min-h-11 items-center rounded-xl px-3 text-xs font-semibold text-porch-700 active:bg-porch-50"
        >
          How this works
        </Link>
      </div>

      <div className="no-scrollbar -mx-4 flex snap-x snap-mandatory gap-3 overflow-x-auto px-4 pb-1">
        {businesses.map((b) => {
          const meta = BUSINESS_CATEGORY_META[b.category];
          return (
            <Link
              key={b.id}
              href={`/services/${b.id}`}
              onClick={() => {
                if (!b.hasLiveBoost) return;
                startTransition(() => {
                  void recordBoostClick(b.id);
                });
              }}
              className="block w-[15.5rem] shrink-0 snap-start rounded-card border border-porch-200 bg-card p-3 transition-transform duration-100 active:scale-[0.99]"
            >
              <div className="flex items-start justify-between gap-2">
                <BusinessLogo
                  name={b.name}
                  category={b.category}
                  logoUrl={b.logoUrl}
                />
                {boostBadge(b)}
              </div>
              <div className="mt-2 flex items-center gap-1.5">
                <h3 className="truncate font-semibold">{b.name}</h3>
                {b.verified && <VerifiedMark label="Verified by Porchlight" />}
              </div>
              <p className="mt-0.5 text-xs text-ink-soft">
                <span aria-hidden>{meta.icon}</span> {meta.label}
              </p>
              <div className="mt-1">
                <Stars rating={b.avgRating} count={b.reviewCount} />
              </div>
              <p className="mt-1.5 text-sm leading-snug text-ink-soft">
                {truncate(b.description, 78)}
              </p>
            </Link>
          );
        })}
      </div>
    </section>
  );
}
