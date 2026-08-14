import { Card } from "@/components/ui";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { pluralize } from "@/lib/format";
import {
  NeighborhoodExplorer,
  type ExploreNeighborhood,
} from "./NeighborhoodExplorer";

export const metadata = { title: "Neighborhoods" };

export default async function NeighborhoodPage() {
  const user = await requireUser();

  const [neighborhoods, follows] = await Promise.all([
    db.neighborhood.findMany({
      orderBy: [{ city: "asc" }, { name: "asc" }],
      include: { _count: { select: { users: true, posts: true } } },
    }),
    db.neighborhoodFollow.findMany({
      where: { userId: user.id },
      select: { neighborhoodId: true },
    }),
  ]);

  const followedIds = new Set(follows.map((f) => f.neighborhoodId));

  // The FK guarantees the home neighborhood is in the list; the fallback keeps
  // the page renderable rather than throwing if it somehow isn't.
  const home = neighborhoods.find((n) => n.id === user.neighborhoodId) ?? {
    ...user.neighborhood,
    _count: { users: 0, posts: 0 },
  };

  const others: ExploreNeighborhood[] = neighborhoods
    .filter((n) => n.id !== user.neighborhoodId)
    .map((n) => ({
      id: n.id,
      name: n.name,
      city: n.city,
      county: n.county,
      memberCount: n._count.users,
      following: followedIds.has(n.id),
    }));

  return (
    <div className="space-y-4">
      <Card className="border-porch-200 bg-porch-50">
        <p className="text-xs font-semibold uppercase tracking-wide text-porch-700">
          Your neighborhood
        </p>
        <h1 className="mt-1 text-xl font-bold">{home.name}</h1>
        <p className="mt-0.5 text-sm text-ink-soft">
          {home.city}, {home.state} · {home.county} County
        </p>
        <div className="mt-3 flex items-center gap-5 border-t border-porch-200 pt-3 text-sm">
          <span>
            <span className="font-bold tabular-nums">{home._count.users}</span>{" "}
            <span className="text-ink-soft">
              {home._count.users === 1 ? "neighbor" : "neighbors"}
            </span>
          </span>
          <span>
            <span className="font-bold tabular-nums">{home._count.posts}</span>{" "}
            <span className="text-ink-soft">
              {home._count.posts === 1 ? "post" : "posts"}
            </span>
          </span>
        </div>
      </Card>

      <Card className="bg-pine-500/5">
        <h2 className="text-[15px] font-semibold">
          <span aria-hidden>🗺️</span> Following nearby areas
        </h2>
        <p className="mt-1 text-sm leading-relaxed text-ink-soft">
          Your neighborhood is your home base and never changes. Follow a nearby
          neighborhood and its posts, events, and barter listings open up for
          you too — handy when you live on the line between two areas. Unfollow
          any time.
        </p>
      </Card>

      <NeighborhoodExplorer neighborhoods={others} />

      <p className="px-1 pb-2 text-center text-xs text-ink-soft">
        {pluralize(followedIds.size, "neighborhood")} followed
      </p>
    </div>
  );
}
