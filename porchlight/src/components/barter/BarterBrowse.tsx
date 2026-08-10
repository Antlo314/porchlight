"use client";

import { useMemo, useState } from "react";
import { Button, ChipRow, EmptyState, SegmentedControl } from "@/components/ui";
import { pluralize } from "@/lib/format";
import {
  BARTER_CATEGORY_LABELS,
  BARTER_KIND_META,
  BarterKind,
  type BarterCategoryValue,
  type BarterKindValue,
} from "@/lib/validators";
import { ListingCard, type ListingCardData } from "./ListingCard";

type KindFilter = "ALL" | BarterKindValue;

const KIND_OPTIONS: { value: KindFilter; label: string; icon?: string }[] = [
  { value: "ALL", label: "All" },
  ...BarterKind.options.map((kind) => ({
    value: kind as KindFilter,
    label: BARTER_KIND_META[kind].label,
    icon: BARTER_KIND_META[kind].icon,
  })),
];

const ALL_CATEGORIES = Object.keys(
  BARTER_CATEGORY_LABELS
) as BarterCategoryValue[];

export function BarterBrowse({ listings }: { listings: ListingCardData[] }) {
  const [kind, setKind] = useState<KindFilter>("ALL");
  const [category, setCategory] = useState<BarterCategoryValue | null>(null);

  // Only surface categories that actually have something in them, so no tap
  // ever leads to an empty shelf.
  const categoryOptions = useMemo(() => {
    const present = new Set(listings.map((l) => l.category));
    return ALL_CATEGORIES.filter((c) => present.has(c)).map((c) => ({
      value: c,
      label: BARTER_CATEGORY_LABELS[c],
    }));
  }, [listings]);

  const filtered = useMemo(
    () =>
      listings.filter(
        (l) =>
          (kind === "ALL" || l.kind === kind) &&
          (category === null || l.category === category)
      ),
    [listings, kind, category]
  );

  if (listings.length === 0) {
    return (
      <EmptyState
        icon="🤝"
        title="No trades on the block yet"
        body="Porch Credits work best when someone goes first. Offer a tool, a skill, or an hour of help."
        actionLabel="Post the first trade"
        actionHref="/barter/new"
      />
    );
  }

  return (
    <div className="space-y-3">
      <SegmentedControl
        options={KIND_OPTIONS}
        value={kind}
        onChange={setKind}
      />

      {categoryOptions.length > 1 && (
        <ChipRow
          options={categoryOptions}
          value={category}
          onChange={setCategory}
        />
      )}

      <p className="text-xs font-semibold uppercase tracking-wide text-ink-soft">
        {pluralize(filtered.length, "open trade")}
      </p>

      {filtered.length === 0 ? (
        <div>
          <EmptyState
            icon="🔍"
            title="Nothing here yet"
            body="No open trades match that filter. Try another kind or category."
          />
          <div className="px-6">
            <Button
              variant="secondary"
              size="lg"
              onClick={() => {
                setKind("ALL");
                setCategory(null);
              }}
            >
              Clear filters
            </Button>
          </div>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((listing) => (
            <ListingCard key={listing.id} listing={listing} />
          ))}
        </div>
      )}
    </div>
  );
}
