// Which neighborhoods a member may read.
//
// A member always sees their home neighborhood, plus any they follow via
// NeighborhoodFollow. Every browse surface (feed, barter, services, events,
// the neighbor picker) must scope its query through this helper — otherwise
// following a nearby neighborhood silently does nothing, which is exactly the
// promise /neighborhood makes to the user.
//
// Note the asymmetry: reads widen, writes don't. You post, list, and register a
// business in your OWN neighborhood only, so create paths keep using
// user.neighborhoodId directly.
import { db } from "./db";

export async function visibleNeighborhoodIds(user: {
  id: string;
  neighborhoodId: string;
}): Promise<string[]> {
  const follows = await db.neighborhoodFollow.findMany({
    where: { userId: user.id },
    select: { neighborhoodId: true },
  });

  const ids = new Set<string>([user.neighborhoodId]);
  for (const f of follows) ids.add(f.neighborhoodId);
  return Array.from(ids);
}
