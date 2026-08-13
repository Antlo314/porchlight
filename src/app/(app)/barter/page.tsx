import Link from "next/link";
import { Fab } from "@/components/ui";
import { BarterBrowse } from "@/components/barter/BarterBrowse";
import { BarterNav } from "@/components/barter/BarterNav";
import { CreditBalanceCard } from "@/components/barter/CreditBalanceCard";
import { requireUser } from "@/lib/auth";
import { creditBalance } from "@/lib/credits";
import { db } from "@/lib/db";
import { matchesForMyListings } from "@/lib/matching";
import { visibleNeighborhoodIds } from "@/lib/visibility";

export const metadata = { title: "Barter" };

/**
 * The barter hub, organised around the three things a member can do:
 * offer what they have, say what they need, and act on what the app matched.
 *
 * The matches row is deliberately first and loudest. Browsing is what people
 * do when they're bored; "a neighbor is waiting for the thing you listed" is
 * what brings them back.
 */
export default async function BarterPage() {
  const user = await requireUser();
  const neighborhoodIds = await visibleNeighborhoodIds(user);

  const [listings, balance, pendingOnMyListings, matches, openWants] =
    await Promise.all([
      db.barterListing.findMany({
        where: { neighborhoodId: { in: neighborhoodIds }, status: "OPEN" },
        orderBy: { createdAt: "desc" },
        take: 60,
        include: {
          owner: { select: { id: true, name: true, avatarUrl: true } },
        },
      }),
      creditBalance(user.id),
      db.barterOffer.count({
        where: { status: "PENDING", listing: { ownerId: user.id } },
      }),
      matchesForMyListings(user),
      db.want.count({
        where: {
          status: "OPEN",
          neighborhoodId: { in: neighborhoodIds },
          userId: { not: user.id },
        },
      }),
    ]);

  return (
    <div className="space-y-4">
      <CreditBalanceCard balance={balance} href="/barter/credits" />

      {matches.length > 0 && (
        <Link
          href="/barter/matches"
          className="block rounded-card bg-porch-600 p-4 text-white transition-transform duration-100 active:scale-[0.99]"
        >
          <p className="text-[15px] font-bold">
            <span aria-hidden>🎯</span>{" "}
            {matches.length === 1
              ? "A neighbor wants something you listed"
              : `${matches.length} neighbors want things you listed`}
          </p>
          <p className="mt-0.5 text-sm text-white/85">
            {matches[0].want.user.name} is looking for{" "}
            {matches[0].want.title.toLowerCase()} — tap to see all
          </p>
        </Link>
      )}

      <BarterNav
        openWants={openWants}
        pendingOffers={pendingOnMyListings}
        matchCount={matches.length}
      />

      <BarterBrowse listings={listings} />

      <Fab href="/barter/new" label="Post a trade" />
    </div>
  );
}
