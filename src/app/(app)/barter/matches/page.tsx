import { EmptyState } from "@/components/ui";
import { BackLink } from "@/components/want/BackLink";
import { MatchRow, type ListingMatchData } from "@/components/want/MatchRow";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { pluralize } from "@/lib/format";
import { matchesForMyListings } from "@/lib/matching";

export const metadata = { title: "Matches" };

/**
 * The payoff screen: neighbors whose open wants match something the viewer is
 * already offering.
 *
 * "A neighbor is waiting for the thing you already listed" is the single
 * strongest reason to reopen this app — far stronger than browsing — so every
 * row states who, what, which listing of yours, and why it matched, and then
 * gets out of the way of the Message button.
 */
export default async function MatchesPage() {
  const user = await requireUser();

  const [rows, openListings] = await Promise.all([
    matchesForMyListings(user),
    db.barterListing.count({ where: { ownerId: user.id, status: "OPEN" } }),
  ]);

  // One row per want, keeping the strongest listing — the engine already sorted
  // by score, and the same neighbor repeated three times because you own three
  // ladders reads as spam rather than as three opportunities.
  const seen = new Set<string>();
  const matches: ListingMatchData[] = [];
  for (const row of rows) {
    if (seen.has(row.want.id)) continue;
    seen.add(row.want.id);
    matches.push(row);
  }

  return (
    <div className="space-y-4">
      <BackLink />

      <header>
        <h1 className="text-2xl font-bold">Matches</h1>
        <p className="mt-1 text-sm text-ink-soft">
          Neighbors asking for something you already have listed.
        </p>
      </header>

      {matches.length === 0 ? (
        openListings === 0 ? (
          <EmptyState
            icon="🎯"
            title="Nothing to match yet"
            body="Matches need both halves: something of yours on offer, and a neighbor who asked for it. Put up a tool, a skill, or an hour of help and this screen starts filling itself."
            actionLabel="Post a listing"
            actionHref="/barter/new"
          />
        ) : (
          <EmptyState
            icon="🎯"
            title="No matches right now"
            body={`${pluralize(openListings, "listing")} of yours ${openListings === 1 ? "is" : "are"} up. The moment a neighbor posts a want that fits one, it lands here and in your notifications — nothing to keep checking.`}
            actionLabel="See what neighbors want"
            actionHref="/barter/wants"
          />
        )
      ) : (
        <>
          <div className="rounded-card border border-porch-200 bg-porch-50 p-4">
            <p className="text-sm font-bold text-porch-800">
              <span aria-hidden>🎯</span>{" "}
              {matches.length === 1
                ? "One neighbor is waiting on you"
                : `${matches.length} neighbors are waiting on you`}
            </p>
            <p className="mt-1 text-sm text-ink-soft">
              Each one asked for something you have listed. Every match shows
              why it matched, so you can judge it before you message.
            </p>
          </div>

          <ul className="space-y-3">
            {matches.map((row) => (
              <li key={`${row.listingId}-${row.want.id}`}>
                <MatchRow row={row} />
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}
