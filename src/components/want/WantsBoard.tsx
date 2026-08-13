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
import { WantCard, type WantCardData, type WantMatchSummary } from "./WantCard";

export type BoardWant = WantCardData & { myMatch?: WantMatchSummary };

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

/**
 * The wants board.
 *
 * Wants the viewer can personally fill are floated to the top, ahead of
 * recency. Everything else here is browsing; those rows are a trade waiting on
 * one tap, and burying them under a newer want nobody can answer wastes the
 * only genuinely useful thing on the screen.
 */
export function WantsBoard({ wants }: { wants: BoardWant[] }) {
  const [kind, setKind] = useState<KindFilter>("ALL");
  const [category, setCategory] = useState<BarterCategoryValue | null>(null);

  // Only surface categories that actually have something in them, so no tap
  // ever leads to an empty shelf.
  const categoryOptions = useMemo(() => {
    const present = new Set(wants.map((want) => want.category));
    return ALL_CATEGORIES.filter((c) => present.has(c)).map((c) => ({
      value: c,
      label: BARTER_CATEGORY_LABELS[c],
    }));
  }, [wants]);

  const ordered = useMemo(
    () =>
      // Array.sort is stable, so within each group the server's recency order
      // survives untouched.
      [...wants].sort(
        (a, b) => Number(Boolean(b.myMatch)) - Number(Boolean(a.myMatch))
      ),
    [wants]
  );

  const filtered = useMemo(
    () =>
      ordered.filter(
        (want) =>
          (kind === "ALL" || want.kind === kind) &&
          (category === null || want.category === category)
      ),
    [ordered, kind, category]
  );

  const fillable = filtered.filter((want) => want.myMatch).length;

  if (wants.length === 0) {
    return (
      <EmptyState
        icon="🙋"
        title="Nobody has asked yet"
        body="A want is the half of a trade most boards never record. Post what you need and neighbors who already have it get told — no waiting for them to happen to browse."
        actionLabel="Post the first want"
        actionHref="/barter/wants/new"
      />
    );
  }

  return (
    <div className="space-y-3">
      <SegmentedControl options={KIND_OPTIONS} value={kind} onChange={setKind} />

      {categoryOptions.length > 1 && (
        <ChipRow
          options={categoryOptions}
          value={category}
          onChange={setCategory}
        />
      )}

      <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
        <p className="text-xs font-semibold uppercase tracking-wide text-ink-soft">
          {pluralize(filtered.length, "open want")}
        </p>
        {fillable > 0 && (
          <p className="text-xs font-bold uppercase tracking-wide text-porch-700">
            <span aria-hidden>🎯</span> You can fill {fillable}
          </p>
        )}
      </div>

      {filtered.length === 0 ? (
        <div>
          <EmptyState
            icon="🔍"
            title="Nothing here yet"
            body="No open wants match that filter. Try another kind or category."
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
        <ul className="space-y-3">
          {filtered.map((want) => (
            <li key={want.id}>
              <WantCard want={want} myMatch={want.myMatch} />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
