// Shared read helpers for the feed routes. Kept out of actions.ts because a
// "use server" module may only export async server actions.
import { db } from "@/lib/db";

/**
 * A member can read their home neighborhood plus any neighborhood they follow.
 * Every feed action runs this before touching a post the client named.
 */
export async function canViewNeighborhood(opts: {
  userId: string;
  homeNeighborhoodId: string;
  neighborhoodId: string;
}): Promise<boolean> {
  if (opts.neighborhoodId === opts.homeNeighborhoodId) return true;

  const follow = await db.neighborhoodFollow.findUnique({
    where: {
      userId_neighborhoodId: {
        userId: opts.userId,
        neighborhoodId: opts.neighborhoodId,
      },
    },
    select: { userId: true },
  });
  return follow !== null;
}
