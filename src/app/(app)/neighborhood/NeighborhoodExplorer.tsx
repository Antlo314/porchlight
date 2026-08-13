"use client";

import { useMemo, useState } from "react";
import { EmptyState, Input, SectionHeading } from "@/components/ui";
import { pluralize } from "@/lib/format";
import { FollowButton } from "./FollowButton";

export type ExploreNeighborhood = {
  id: string;
  name: string;
  city: string;
  county: string;
  memberCount: number;
  following: boolean;
};

type CityGroup = { city: string; items: ExploreNeighborhood[] };

/**
 * Georgia is a short list — every neighborhood ships in the first payload and
 * the search filters in memory, so typing never waits on a round trip.
 * The server hands them over already sorted by city then name, so grouping is
 * a single pass that preserves that order.
 */
function groupByCity(items: ExploreNeighborhood[]): CityGroup[] {
  const groups: CityGroup[] = [];
  for (const item of items) {
    const current = groups[groups.length - 1];
    if (current && current.city === item.city) current.items.push(item);
    else groups.push({ city: item.city, items: [item] });
  }
  return groups;
}

export function NeighborhoodExplorer({
  neighborhoods,
}: {
  neighborhoods: ExploreNeighborhood[];
}) {
  const [query, setQuery] = useState("");

  const groups = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return groupByCity(neighborhoods);
    return groupByCity(
      neighborhoods.filter(
        (n) =>
          n.name.toLowerCase().includes(q) ||
          n.city.toLowerCase().includes(q) ||
          n.county.toLowerCase().includes(q)
      )
    );
  }, [neighborhoods, query]);

  const followingCount = useMemo(
    () => neighborhoods.filter((n) => n.following).length,
    [neighborhoods]
  );

  const matchCount = groups.reduce((sum, g) => sum + g.items.length, 0);

  if (neighborhoods.length === 0) {
    return (
      <EmptyState
        icon="🗺️"
        title="Yours is the only block so far"
        body="Porchlight is still lighting up Georgia. More neighborhoods land here as they open."
      />
    );
  }

  return (
    <div className="space-y-4">
      <div>
        <Input
          type="search"
          inputMode="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search neighborhoods or cities"
          aria-label="Search neighborhoods or cities"
          autoComplete="off"
        />
        <p className="mt-1.5 px-1 text-xs text-ink-soft">
          {query.trim()
            ? `${pluralize(matchCount, "match", "matches")} in Georgia`
            : `${pluralize(neighborhoods.length, "neighborhood")} across Georgia · following ${followingCount}`}
        </p>
      </div>

      {matchCount === 0 ? (
        <EmptyState
          icon="🔎"
          title="No matches"
          body={`Nothing in Georgia matches "${query.trim()}". Try a city like Savannah or Athens.`}
        />
      ) : (
        <div className="space-y-6">
          {groups.map((group) => (
            <section key={group.city}>
              <SectionHeading
                title={group.city}
                action={
                  <span className="text-xs text-ink-soft">
                    {pluralize(group.items.length, "area")}
                  </span>
                }
              />
              <ul className="space-y-2">
                {group.items.map((n) => (
                  <li
                    key={n.id}
                    className="flex items-center justify-between gap-3 rounded-card border border-line bg-card p-3"
                  >
                    <div className="min-w-0">
                      <p className="truncate font-semibold">{n.name}</p>
                      <p className="mt-0.5 text-xs text-ink-soft">
                        {n.county} County ·{" "}
                        {pluralize(n.memberCount, "neighbor")}
                      </p>
                    </div>
                    <FollowButton
                      neighborhoodId={n.id}
                      name={n.name}
                      initialFollowing={n.following}
                    />
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}
