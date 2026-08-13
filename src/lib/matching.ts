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
import { notifyMany } from "./notify";
import { visibleNeighborhoodIds } from "./visibility";

/**
 * Words carrying no signal about WHAT a thing is.
 *
 * Three groups, and the last two were learned from false positives caught by
 * scripts/stress/matching-quality.mjs:
 *  - grammar ("the", "with")
 *  - logistics and scheduling ("weekend", "borrow", "pickup") — these are the
 *    common carrier for bogus matches, because two unrelated posts both
 *    mentioning "this weekend" would otherwise score as a match
 *  - semantically empty nouns ("thing", "stuff") — grammar lists miss these,
 *    but "anyone have a thing" matching "getting rid of some stuff" is exactly
 *    the kind of suggestion that teaches people to ignore the feature
 */
const STOPWORDS = new Set([
  // grammar
  "a", "an", "and", "any", "are", "as", "at", "be", "but", "by", "can", "do",
  "for", "from", "get", "got", "has", "have", "help", "his", "her", "i", "if",
  "in", "is", "it", "its", "just", "looking", "me", "my", "need", "no", "not",
  "of", "on", "or", "our", "out", "please", "so", "some", "someone", "that",
  "the", "their", "them", "then", "there", "this", "to", "up", "us", "want",
  "was", "we", "who", "will", "with", "would", "you", "your",
  // logistics, scheduling, and trade-speak
  "afternoon", "available", "borrow", "cheap", "condition", "credit",
  "credits", "day", "drop", "evening", "fair", "free", "friday", "hour",
  "lend", "loan", "monday", "month", "morning", "neighborhood", "neighbour",
  "neighbor", "night", "offer", "pickup", "porch", "return", "saturday",
  "soon", "sunday", "swap", "thursday", "today", "tomorrow", "trade",
  "tuesday", "wednesday", "week", "weekend", "year",
  // semantically empty nouns
  "anything", "everything", "item", "misc", "something", "stuff", "thing",
  "whatever",
]);

/**
 * Crude singularisation so "ladders" matches "ladder".
 *
 * The "es" rule only fires after a sibilant. A blanket `-es` strip turns
 * "bikes" into "bik" while "bike" stays "bike", so the two never match — which
 * silently broke every singular noun ending in -e (bike, tire, table, hose,
 * rake, fence, service). That is the core of the feature failing on the most
 * ordinary words in it. Guarded by scripts/stress/matching-quality.mjs.
 */
function stem(word: string): string {
  if (word.length > 4 && word.endsWith("ies")) return `${word.slice(0, -3)}y`;
  // "ss", not a lone "s". Requiring a doubled s keeps "mattresses" -> "mattress"
  // while letting "hoses" fall through to the -s rule and become "hose"
  // rather than "hos" — a lone s before "es" is far more often part of the
  // singular than a sibilant plural.
  if (word.length > 4 && /(?:ss|x|z|ch|sh)es$/.test(word)) {
    return word.slice(0, -2);
  }
  // "mattress" must not become "mattres".
  if (word.length > 3 && word.endsWith("s") && !word.endsWith("ss")) {
    return word.slice(0, -1);
  }
  return word;
}

export function keywords(...parts: (string | null | undefined)[]): Set<string> {
  const out = new Set<string>();
  for (const part of parts) {
    if (!part) continue;
    for (const raw of part.toLowerCase().split(/[^a-z0-9]+/)) {
      // Two characters, not three: "AC", "TV", "PC", and "RV" are real things
      // neighbors trade and ask about, and a 3-char floor erased them entirely.
      if (raw.length < 2) continue;
      if (STOPWORDS.has(raw)) continue;
      const stemmed = stem(raw);
      // Check again after stemming: "needs" survives the raw check and only
      // becomes the stopword "need" afterwards.
      if (STOPWORDS.has(stemmed)) continue;
      out.add(stemmed);
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

  const titleWords = keywords(listing.title);
  const wantTitleWords = keywords(want.title);
  const titleOverlap = [...wantTitleWords].filter((w) => titleWords.has(w));

  let score = 0;
  if (sameCategory) score += 2;
  score += shared.length * 3;
  score += titleOverlap.length * 2;

  // A single shared word is not evidence on its own. Category agreement plus
  // one incidental word ("...this weekend") was enough to clear the old
  // threshold, which produced confident-looking nonsense.
  //
  // Two independent words, or one word that BOTH sides put in their title —
  // what someone titles a post is what they think it is.
  //
  // A stricter version (requiring the want's title to be that single word)
  // was tried and reverted: it killed "Bikes for the kids" vs "Bike", which is
  // a trade a neighbor would obviously want. The remaining false positive is
  // a shared adjective across different nouns ("pressure washer" vs "pressure
  // treated lumber"), which word overlap alone cannot separate — it needs
  // rarity weighting over the neighborhood's own corpus. Documented as a known
  // defect in scripts/stress/matching-quality.mjs rather than papered over,
  // because missing real trades costs more than the occasional odd suggestion.
  const strongEnough =
    shared.length >= 2 || (shared.length === 1 && titleOverlap.length >= 1);
  if (!strongEnough) return null;

  // Category alone is never enough: "TOOLS" covers a hammer and a cement mixer.
  if (!sameCategory && shared.length < 2) return null;

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
      // An unordered LIMIT on Postgres returns an arbitrary, unstable subset —
      // the same request can return different rows run to run. Newest-first
      // makes the cap deterministic, and the @@index([neighborhoodId, status,
      // createdAt]) on Want covers it.
      orderBy: { createdAt: "desc" },
      take: 200,
    });

    const hits = wants
      .map((want) => ({ want, match: scoreMatch(listing, want) }))
      .filter((r) => r.match !== null)
      .sort((a, b) => (b.match!.score ?? 0) - (a.match!.score ?? 0))
      .slice(0, 25);

    if (hits.length === 0) return 0;

    // One insert for the whole set rather than one per recipient — this runs
    // on the critical path of posting a listing.
    await notifyMany({
      userIds: hits.map((h) => h.want.userId),
      actorId: listing.ownerId,
      type: "WANT_MATCHED",
      payload: {
        href: `/barter/${listing.id}`,
        text: `A neighbor just listed "${listing.title}" — you were looking for something like this.`,
      },
    });
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
    orderBy: { createdAt: "desc" }, // see the note in notifyWantsMatchingListing
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

  // scoreMatch hard-gates on kind, so pre-filtering to the kinds actually
  // listed changes nothing semantically but stops the 200-row cap being spent
  // on wants that could never match.
  const kinds = [...new Set(myListings.map((l) => l.kind))];

  const wants = await db.want.findMany({
    where: {
      status: "OPEN",
      neighborhoodId: { in: ids },
      userId: { not: user.id },
      kind: { in: kinds },
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
    orderBy: { createdAt: "desc" },
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

  // Dedupe by want BEFORE slicing, keeping each want's best-scoring listing.
  //
  // Without this the array is one row per (listing, want) pair, so three of my
  // ladders matching one neighbor's "ladder" want counted as three neighbors
  // on the hub while the matches page — which deduped afterwards — showed one.
  // Worse, a pre-dedupe slice(0, 10) could spend all ten rows on two wants and
  // hide seventeen neighbors who were actually waiting.
  const seenWants = new Set<string>();
  return results
    .sort((a, b) => b.match.score - a.match.score)
    .filter((r) => {
      if (seenWants.has(r.want.id)) return false;
      seenWants.add(r.want.id);
      return true;
    })
    .slice(0, 10);
}
