import Link from "next/link";
import { Fab, SectionHeading } from "@/components/ui";
import { BackLink } from "@/components/want/BackLink";
import { MyWantCard } from "@/components/want/MyWantCard";
import { matchReasons } from "@/components/want/meta";
import type { WantCardData } from "@/components/want/WantCard";
import { WantsBoard, type BoardWant } from "@/components/want/WantsBoard";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { scoreMatch } from "@/lib/matching";
import { visibleNeighborhoodIds } from "@/lib/visibility";

export const metadata = { title: "Wanted" };

const BOARD_SIZE = 60;
const MY_WANTS_SIZE = 20;

/**
 * The wants board — the half of barter that fixes the double coincidence of
 * wants. A listing says "what I have"; these say "what I need", and because
 * both halves are recorded the app can point at the overlap instead of leaving
 * it to two people happening to browse at the same moment.
 *
 * The badge on a card the viewer can personally fill is why this screen exists:
 * browsing wants should end in "wait, I have that in the shed."
 */
export default async function WantsPage() {
  const user = await requireUser();
  const neighborhoodIds = await visibleNeighborhoodIds(user);

  const [myWants, neighborWants, myListings] = await Promise.all([
    db.want.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: "desc" },
      take: MY_WANTS_SIZE,
      select: {
        id: true,
        title: true,
        description: true,
        kind: true,
        category: true,
        creditOffer: true,
        status: true,
        createdAt: true,
        user: { select: { id: true, name: true, avatarUrl: true } },
      },
    }),
    db.want.findMany({
      where: {
        status: "OPEN",
        neighborhoodId: { in: neighborhoodIds },
        userId: { not: user.id },
      },
      orderBy: { createdAt: "desc" },
      take: BOARD_SIZE,
      select: {
        id: true,
        title: true,
        description: true,
        kind: true,
        category: true,
        creditOffer: true,
        status: true,
        createdAt: true,
        user: { select: { id: true, name: true, avatarUrl: true } },
      },
    }),
    // Only the fields scoreMatch reads. The viewer's open listings are the
    // other half of every "You have this" badge below.
    db.barterListing.findMany({
      where: { ownerId: user.id, status: "OPEN" },
      select: {
        id: true,
        kind: true,
        category: true,
        title: true,
        description: true,
      },
    }),
  ]);

  const board: BoardWant[] = neighborWants.map((want) => {
    // Best listing per want, not every listing: three near-identical badges on
    // one card is noise, and only the strongest match is worth acting on.
    let best:
      | { id: string; title: string; score: number; reasons: string[] }
      | null = null;

    for (const listing of myListings) {
      const match = scoreMatch(listing, want);
      if (!match) continue;
      if (best && match.score <= best.score) continue;
      best = {
        id: listing.id,
        title: listing.title,
        score: match.score,
        reasons: matchReasons(match, want.category),
      };
    }

    return {
      ...want,
      myMatch: best
        ? { listingId: best.id, listingTitle: best.title, reasons: best.reasons }
        : undefined,
    };
  });

  const fillable = board.filter((want) => want.myMatch).length;

  // Open first — a closed want is history, and history should not push the
  // thing you are still waiting for below the fold.
  const orderedMine: WantCardData[] = [
    ...myWants.filter((want) => want.status === "OPEN"),
    ...myWants.filter((want) => want.status !== "OPEN"),
  ];

  return (
    <div className="space-y-4">
      <BackLink />

      <header>
        <h1 className="text-2xl font-bold">Wanted nearby</h1>
        <p className="mt-1 text-sm text-ink-soft">
          What neighbors are still looking for. If one of them is sitting in
          your garage, you are a tap away from a trade.
        </p>
      </header>

      {fillable > 0 && (
        <div className="rounded-card border border-porch-200 bg-porch-50 p-4">
          <p className="text-sm font-bold text-porch-800">
            <span aria-hidden>🎯</span>{" "}
            {fillable === 1
              ? "You can fill one of these"
              : `You can fill ${fillable} of these`}
          </p>
          <p className="mt-1 text-sm text-ink-soft">
            They are marked below, with the listing of yours that matches and
            why it matched. Message the neighbor and the trade is half done.
          </p>
        </div>
      )}

      {orderedMine.length > 0 ? (
        <section>
          <SectionHeading title="Your wants" />
          <ul className="space-y-3">
            {orderedMine.map((want) => (
              <li key={want.id}>
                <MyWantCard want={want} />
              </li>
            ))}
          </ul>
        </section>
      ) : (
        <Link
          href="/barter/wants/new"
          className="block rounded-card border border-dashed border-porch-300 bg-card p-4 transition-transform duration-100 active:scale-[0.99]"
        >
          <p className="text-sm font-semibold text-porch-800">
            Waiting on something yourself?
          </p>
          <p className="mt-1 text-sm text-ink-soft">
            Post it once. Anything that already matches shows up straight away,
            and the next neighbor who lists it is told you are waiting.
          </p>
        </Link>
      )}

      <section>
        <SectionHeading title="From your neighbors" />
        <WantsBoard wants={board} />
      </section>

      <Fab href="/barter/wants/new" label="Post a want" />
    </div>
  );
}
