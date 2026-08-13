// Matching listings to wants.
//
// This is the part that separates Porchlight's barter from a classifieds board.
// A board makes both sides browse and hope they coincide. Here, posting either
// side of a trade immediately asks: is the other half already sitting in this
// neighborhood, waiting?
//
// The scoring is deliberately simple and explainable — category agreement plus
// word overlap — because a member has to be able to look at a match and see
// why it was suggested. An opaque score that surfaces a lawnmower for a
// babysitting request destroys trust in every future match.
import { db } from "./db";
import { notify } from "./notify";
import { visibleNeighborhoodIds } from "./visibility";

/** Words carrying no signal about what a thing actually is. */
const STOPWORDS = new Set([
  "a", "an", "and", "any", "are", "for", "from", "got", "has", "have", "help",
  "his", "her", "i", "if", "in", "is", "it", "its", "just", "looking", "me",
  "my", "need", "needed", "needing", "of", "on", "or", "our", "out", "please",
  "some", "someone", "that", "the", "their", "them", "there", "this", "to",
  "up", "want", "wanted", "wanting", "was", "we", "who", "will", "with", "you",
  "your",
]);

/** Crude singularisation so "ladders" matches "ladder". */
function stem(word: string): string {
  if (word.length > 4 && word.endsWith("ies")) return `${word.slice(0, -3)}y`;
  if (word.length > 3 && word.endsWith("es")) return word.slice(0, -2);
  if (word.length > 3 && word.endsWith("s")) return word.slice(0, -1);
  return word;
}

export function keywords(...parts: (string | null | undefined)[]): Set<string> {
  const out = new Set<string>();
  for (const part of parts) {
    if (!part) continue;
    for (const raw of part.toLowerCase().split(/[^a-z0-9]+/)) {
      if (raw.length < 3) continue;
      if (STOPWORDS.has(raw)) continue;
      out.add(stem(raw));
    }
  }
  return out;
}

export type MatchReason = { score: number; sharedWords: string[]; sameCategory: boolean };

/**
 * Scores a listing against a want. Returns null when they don't plausibly
 * match — a near-miss is worse than no suggestion, because it teaches people
 * to ignore the feature.
 */
export function scoreMatch(
  listing: { kind: string; category: string; title: string; description: string },
  want: { kind: string; category: string; title: string; description: string | null }
): MatchReason | null {
  // Someone wanting a SERVICE is not served by an ITEM. Kind is a hard gate.
  if (listing.kind !== want.kind) return null;

  const sameCategory = listing.category === want.category;

  const listingWords = keywords(listing.title, listing.description);
  const wantWords = keywords(want.title, want.description);
  const shared = [...wantWords].filter((w) => listingWords.has(w));

  // Category alone is too loose ("TOOLS" covers a hammer and a cement mixer),
  // so a match needs either a shared word, or category agreement plus a
  // title-level hit.
  let score = 0;
  if (sameCategory) score += 2;
  score += shared.length * 3;

  const titleWords = keywords(listing.title);
  const wantTitleWords = keywords(want.title);
  const titleOverlap = [...wantTitleWords].filter((w) => titleWords.has(w));
  score += titleOverlap.length * 2;

  if (score < 3) return null;
  if (!sameCategory && shared.length === 0) return null;

  return { score, sharedWords: shared.slice(0, 4), sameCategory };
}

/**
 * A new listing just went up — tell the neighbors who already asked for it.
 * Never throws into the create path: a failed match must not cost someone
 * their listing.
 */
export async function notifyWantsMatchingListing(listing: {
  id: string;
  ownerId: string;
  neighborhoodId: string;
  kind: string;
  category: string;
  title: string;
  description: string;
}): Promise<number> {
  try {
    const wants = await db.want.findMany({
      where: {
        status: "OPEN",
        neighborhoodId: listing.neighborhoodId,
        userId: { not: listing.ownerId },
        kind: listing.kind,
      },
      select: {
        id: true,
        userId: true,
        kind: true,
        category: true,
        title: true,
        description: true,
      },
      take: 200,
    });

    const hits = wants
      .map((want) => ({ want, match: scoreMatch(listing, want) }))
      .filter((r) => r.match !== null)
      .sort((a, b) => (b.match!.score ?? 0) - (a.match!.score ?? 0))
      .slice(0, 25);

    for (const { want } of hits) {
      await notify({
        userId: want.userId,
        actorId: listing.ownerId,
        type: "WANT_MATCHED",
        payload: {
          href: `/barter/${listing.id}`,
          text: `Someone listed "${listing.title}" — you asked for ${want.title}.`,
        },
      });
    }
    return hits.length;
  } catch {
    return 0;
  }
}

/**
 * A new want was posted — find listings that already exist for it. Returns the
 * matches so the composer can show them immediately rather than making the
 * member wait for a notification about something already on the shelf.
 */
export async function findListingsForWant(want: {
  userId: string;
  neighborhoodId: string;
  kind: string;
  category: string;
  title: string;
  description: string | null;
}) {
  const listings = await db.barterListing.findMany({
    where: {
      status: "OPEN",
      neighborhoodId: want.neighborhoodId,
      ownerId: { not: want.userId },
      kind: want.kind,
    },
    select: {
      id: true,
      kind: true,
      category: true,
      title: true,
      description: true,
      creditValue: true,
      images: true,
      owner: { select: { id: true, name: true, avatarUrl: true } },
    },
    take: 200,
  });

  return listings
    .map((listing) => ({ listing, match: scoreMatch(listing, want) }))
    .filter((r): r is { listing: (typeof listings)[number]; match: MatchReason } =>
      r.match !== null
    )
    .sort((a, b) => b.match.score - a.match.score)
    .slice(0, 12);
}

/**
 * Everything the viewer should be told about right now, in one place:
 * neighbors whose open wants match something the viewer is already offering.
 *
 * This is the "someone is waiting for your thing" signal, and it is the single
 * strongest reason to come back to the app — far stronger than browsing.
 */
export async function matchesForMyListings(user: {
  id: string;
  neighborhoodId: string;
}) {
  const [myListings, ids] = await Promise.all([
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
    visibleNeighborhoodIds(user),
  ]);
  if (myListings.length === 0) return [];

  const wants = await db.want.findMany({
    where: {
      status: "OPEN",
      neighborhoodId: { in: ids },
      userId: { not: user.id },
    },
    select: {
      id: true,
      kind: true,
      category: true,
      title: true,
      description: true,
      creditOffer: true,
      user: { select: { id: true, name: true, avatarUrl: true } },
    },
    take: 200,
  });

  const results: {
    listingId: string;
    listingTitle: string;
    want: (typeof wants)[number];
    match: MatchReason;
  }[] = [];

  for (const listing of myListings) {
    for (const want of wants) {
      const match = scoreMatch(listing, want);
      if (match) {
        results.push({
          listingId: listing.id,
          listingTitle: listing.title,
          want,
          match,
        });
      }
    }
  }

  return results.sort((a, b) => b.match.score - a.match.score).slice(0, 10);
}
