#!/usr/bin/env node
// ═══════════════════════════════════════════════════════════════════════════
//  Porchlight — matching quality harness
//  scripts/stress/matching-quality.mjs
//
//  Run:  node scripts/stress/matching-quality.mjs [--verbose] [--strict]
//
//  NO DATABASE REQUIRED. This is the only script under scripts/ that needs
//  neither Postgres nor a running server. No dependencies, no build step.
//
//  WHAT THIS TESTS
//  ---------------
//  src/lib/matching.ts decides which listings get suggested to which neighbors.
//  The cost of a bad suggestion is asymmetric: one absurd match ("you wanted
//  babysitting, here's a lawnmower") teaches a member to ignore the feature
//  forever, while a missed match costs only that one trade. So this harness
//  tests BOTH directions — things that must match, and things that must not.
//
// ╔═════════════════════════════════════════════════════════════════════════╗
// ║  ⚠  THIS FILE CONTAINS A HAND-COPY OF THE SCORING LOGIC  ⚠              ║
// ║                                                                         ║
// ║  src/lib/matching.ts imports ./db, which imports Prisma, which needs a   ║
// ║  live Postgres connection at module load. Importing it here would make   ║
// ║  a pure-logic test require a database. So STOPWORDS, stem(), keywords()  ║
// ║  and scoreMatch() below are a FAITHFUL LINE-BY-LINE COPY of the real     ║
// ║  ones, with TypeScript types stripped and nothing else changed.          ║
// ║                                                                         ║
// ║  IF YOU CHANGE src/lib/matching.ts, YOU MUST UPDATE THE COPY BELOW.      ║
// ║  Otherwise this harness will happily report PASS for logic that is no    ║
// ║  longer running in production.                                          ║
// ║                                                                         ║
// ║  A drift check runs on every invocation: it hashes the real file's       ║
// ║  scoring region (comments and whitespace stripped) and compares it to    ║
// ║  SOURCE_FINGERPRINT below. If it screams, re-copy the logic and paste    ║
// ║  the new fingerprint it prints.                                         ║
// ╚═════════════════════════════════════════════════════════════════════════╝
//
//  HOW TO READ THE OUTPUT
//  ----------------------
//  PASS   the engine agreed with the expectation.
//  FAIL   the engine disagreed and this is a regression. Exits non-zero.
//  KNOWN  the engine disagreed, and we already know why — a defect documented
//         in the case's `known` field. Does not fail the suite by default
//         (use --strict to gate on these), but is printed loudly and listed
//         again in the summary. These are the honest disagreements: the
//         expectation records what a NEIGHBOR would expect, not what the code
//         currently does. Do not "fix" a KNOWN case by changing the
//         expectation — fix the engine, or argue the expectation down in a
//         code review.
//  FIXED  a KNOWN case now behaves correctly. Delete its `known` field so it
//         becomes a real regression test.
//
//  Every case prints its score, its shared words, and (on any non-PASS, or
//  with --verbose) the full extracted keyword sets for both sides — so a human
//  can audit the judgement instead of trusting a number.
// ═══════════════════════════════════════════════════════════════════════════

import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";

const ARGS = new Set(process.argv.slice(2));
const VERBOSE = ARGS.has("--verbose") || ARGS.has("-v");
const STRICT = ARGS.has("--strict");

// ───────────────────────────────────────────────────────────────────────────
// BEGIN COPIED LOGIC — mirror of src/lib/matching.ts (do not edit in isolation)
// ───────────────────────────────────────────────────────────────────────────

/** Words carrying no signal about what a thing actually is. */
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

/** Crude singularisation so "ladders" matches "ladder". */
function stem(word) {
  if (word.length > 4 && word.endsWith("ies")) return `${word.slice(0, -3)}y`;
  if (word.length > 4 && /(?:ss|x|z|ch|sh)es$/.test(word)) {
    return word.slice(0, -2);
  }
  if (word.length > 3 && word.endsWith("s") && !word.endsWith("ss")) {
    return word.slice(0, -1);
  }
  return word;
}

function keywords(...parts) {
  const out = new Set();
  for (const part of parts) {
    if (!part) continue;
    for (const raw of part.toLowerCase().split(/[^a-z0-9]+/)) {
      if (raw.length < 2) continue;
      if (STOPWORDS.has(raw)) continue;
      const stemmed = stem(raw);
      if (STOPWORDS.has(stemmed)) continue;
      out.add(stemmed);
    }
  }
  return out;
}

/**
 * Scores a listing against a want. Returns null when they don't plausibly
 * match — a near-miss is worse than no suggestion, because it teaches people
 * to ignore the feature.
 */
function scoreMatch(listing, want) {
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

  const strongEnough =
    shared.length >= 2 || (shared.length === 1 && titleOverlap.length >= 1);
  if (!strongEnough) return null;
  if (!sameCategory && shared.length < 2) return null;

  return { score, sharedWords: shared.slice(0, 4), sameCategory };
}

// ───────────────────────────────────────────────────────────────────────────
// END COPIED LOGIC
// ───────────────────────────────────────────────────────────────────────────

/**
 * Recomputes the score components for reporting only. Derived from the copy
 * above; never consulted for pass/fail, only to explain a verdict to a human.
 * Unlike scoreMatch it reports the raw score even when the gates return null,
 * which is exactly what you need in order to see WHY something was rejected.
 */
function explain(listing, want) {
  const kindGate = listing.kind === want.kind;
  const sameCategory = listing.category === want.category;
  const listingWords = [...keywords(listing.title, listing.description)];
  const wantWords = [...keywords(want.title, want.description)];
  const shared = wantWords.filter((w) => listingWords.includes(w));
  const titleWords = [...keywords(listing.title)];
  const titleOverlap = [...keywords(want.title)].filter((w) =>
    titleWords.includes(w)
  );
  const raw =
    (sameCategory ? 2 : 0) + shared.length * 3 + titleOverlap.length * 2;
  return {
    kindGate,
    sameCategory,
    listingWords,
    wantWords,
    shared,
    titleOverlap,
    raw,
  };
}

// ───────────────────────────────────────────────────────────────────────────
// Console helpers
// ───────────────────────────────────────────────────────────────────────────

const COLOR = process.stdout.isTTY && !process.env.NO_COLOR;
const c = (code, s) => (COLOR ? `[${code}m${s}[0m` : s);
const green = (s) => c("32", s);
const red = (s) => c("31;1", s);
const yellow = (s) => c("33", s);
const blue = (s) => c("36", s);
const dim = (s) => c("2", s);
const bold = (s) => c("1", s);

const rule = (ch = "─") => console.log(dim(ch.repeat(78)));
function heading(text) {
  console.log("");
  console.log(bold(text));
  rule();
}

// ───────────────────────────────────────────────────────────────────────────
// Drift check — is the copy above still the code that ships?
// ───────────────────────────────────────────────────────────────────────────

// sha256 of the scoring region of src/lib/matching.ts with all comments and
// whitespace removed. Regenerate by running this script and pasting the value
// it prints when it complains.
const SOURCE_FINGERPRINT =
  "fe2d5b81c6cca52ddb1f9befb6147954115e61be021ce6946b578aac2e5aeac6";

function normalizeSource(text) {
  return text
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/\/\/[^\n]*/g, "")
    .replace(/\s+/g, "");
}

async function checkDrift() {
  const here = path.dirname(fileURLToPath(import.meta.url));
  const target = path.resolve(here, "..", "..", "src", "lib", "matching.ts");
  let src;
  try {
    src = await readFile(target, "utf8");
  } catch {
    return {
      status: "unreadable",
      message: `Could not read ${target} — drift check skipped.`,
    };
  }

  const start = src.indexOf("const STOPWORDS");
  const end = src.indexOf("export async function notifyWantsMatchingListing");
  if (start === -1 || end === -1 || end < start) {
    return {
      status: "unrecognized",
      message:
        "matching.ts no longer has the expected shape (STOPWORDS … " +
        "notifyWantsMatchingListing). The copy in this file is almost " +
        "certainly stale. Re-copy it by hand.",
    };
  }

  const hash = createHash("sha256")
    .update(normalizeSource(src.slice(start, end)))
    .digest("hex");

  if (hash === SOURCE_FINGERPRINT) return { status: "ok", hash };
  return { status: "drift", hash };
}

// ───────────────────────────────────────────────────────────────────────────
// Cases
//
// kind:     GOODS | SERVICE | TIME          (validators.ts BarterKind)
// category: TOOLS | FURNITURE | ELECTRONICS | CLOTHING | GARDEN | SKILLS |
//           CHILDCARE | TUTORING | REPAIRS | OTHER
//
// A listing always has a string description (createBarterListingSchema
// requires min 1). A want's description is optional, so it can be null or "" —
// several cases exercise that on purpose.
// ───────────────────────────────────────────────────────────────────────────

const L = (kind, category, title, description) => ({
  kind,
  category,
  title,
  description,
});
const W = (kind, category, title, description = null) => ({
  kind,
  category,
  title,
  description,
});

const CASES = [
  // ─── TRUE POSITIVES: these must match ────────────────────────────────────
  {
    id: "TP-01",
    group: "true positive",
    name: "pressure washer, same kind + category",
    why: "The canonical good match: same item, same words, same category.",
    listing: L(
      "GOODS",
      "TOOLS",
      "Pressure washer (electric, 2000 PSI)",
      "Electric, 2000 PSI. Great for driveways and siding. Hose not included."
    ),
    want: W(
      "GOODS",
      "TOOLS",
      "Pressure washer for a weekend",
      "Doing the driveway before the family comes for Labor Day."
    ),
    expect: "match",
  },
  {
    id: "TP-02",
    group: "true positive",
    name: "math tutoring, TIME/TUTORING",
    why: "Hours-of-help trade with two strong content words in both titles.",
    listing: L(
      "TIME",
      "TUTORING",
      "2 hours of math tutoring",
      "Retired teacher, happy to trade for yard work. Algebra and fractions."
    ),
    want: W(
      "TIME",
      "TUTORING",
      "Math tutoring for my daughter",
      "She is in 7th grade and stuck on fractions."
    ),
    expect: "match",
  },
  {
    id: "TP-03",
    group: "true positive",
    name: "plural want vs singular listing (ladders / ladder)",
    why: "stem() exists precisely so 'ladders' finds 'ladder'.",
    listing: L(
      "GOODS",
      "TOOLS",
      "Extension ladder, 24 foot",
      "Aluminum, sturdy. Yours for the weekend."
    ),
    want: W("GOODS", "TOOLS", "Ladders for gutter cleaning", "Two-story house."),
    expect: "match",
  },
  {
    id: "TP-04",
    group: "true positive",
    name: "bike repair phrased two different ways",
    why: "Different phrasing, same trade. Only 'bike' and 'flat' overlap and that should be enough.",
    listing: L(
      "SERVICE",
      "REPAIRS",
      "I'll fix your bike",
      "Flats, brakes, chains. I have a stand and tools."
    ),
    want: W(
      "SERVICE",
      "REPAIRS",
      "Bike repair - flat tire",
      "Front tire on my daughter's bike keeps going flat."
    ),
    expect: "match",
  },
  {
    id: "TP-05",
    group: "true positive",
    name: "miscategorised but obviously the same thing",
    why: "Members pick categories carelessly. A word-identical pair must still match across categories.",
    listing: L(
      "GOODS",
      "TOOLS",
      "Extension ladder, 24 foot",
      "Aluminum. Barely used."
    ),
    want: W("GOODS", "OTHER", "Extension ladder", "Need to reach the gutters."),
    expect: "match",
  },
  {
    id: "TP-06",
    group: "true positive",
    name: "punctuation, casing and emoji noise",
    why: "Real titles are shouty and full of punctuation. Tokenisation must not care.",
    listing: L("GOODS", "TOOLS", "pressure-washer — electric", "Works fine."),
    want: W("GOODS", "TOOLS", "🔨 PRESSURE WASHER!!! (any brand)"),
    expect: "match",
  },
  {
    id: "TP-07",
    group: "true positive",
    name: "crib, signal in the description only overlaps on one word",
    why: "One strong shared noun plus category agreement is a legitimately good suggestion.",
    listing: L(
      "GOODS",
      "CHILDCARE",
      "Baby crib, barely used",
      "Solid maple, mattress included. Grandkids outgrew it."
    ),
    want: W(
      "GOODS",
      "CHILDCARE",
      "Crib for our grandbaby",
      "Visiting in September and we have nowhere to put her."
    ),
    expect: "match",
  },
  {
    id: "TP-08",
    group: "true positive",
    name: "want with a null description",
    why: "description is optional on a Want. Title-only wants are the common case and must still match.",
    listing: L("GOODS", "GARDEN", "Wheelbarrow", "Steel tray, good tyre."),
    want: W("GOODS", "GARDEN", "Wheelbarrow"),
    expect: "match",
  },
  {
    id: "TP-09",
    group: "true positive",
    name: "three-letter title (Saw)",
    why: "3 chars is exactly the tokeniser's minimum — the boundary must be inclusive.",
    listing: L(
      "GOODS",
      "TOOLS",
      "Saw for cutting deck boards",
      "Circular saw, sharp blade."
    ),
    want: W("GOODS", "TOOLS", "Saw", ""),
    expect: "match",
  },
  {
    id: "TP-10",
    group: "true positive",
    name: "plural/singular where the singular ends in 'e' (bikes / bike)",
    why:
      "Same expectation as TP-03. A neighbor typing the plural must find the singular.",
    listing: L(
      "GOODS",
      "OTHER",
      "Bike, 20 inch",
      "Purple, barely ridden, needs air."
    ),
    want: W("GOODS", "OTHER", "Bikes for the grandkids"),
    expect: "match",
    known:
      "stem() strips 'es' before it strips 's', so stem('bikes') = 'bik' but " +
      "stem('bike') = 'bike'. Every singular noun ending in 'e' is broken: " +
      "bike, tire, table, hose, rake, shoe, service, crate, fence. See the " +
      "PLURAL PROBE below for the measured blast radius.",
  },
  {
    id: "TP-11",
    group: "true positive",
    name: "singular ending in 'ss' vs its plural (mattress / mattresses)",
    why:
      "Someone furnishing bunk beds must see a twin mattress. The word " +
      "'mattress' is the only thing these two posts have in common, which is " +
      "exactly what makes it a clean isolation of the stemmer.",
    listing: L(
      "GOODS",
      "FURNITURE",
      "Mattress, twin, clean",
      "Kept in the spare room, no stains."
    ),
    want: W("GOODS", "FURNITURE", "Mattresses for the bunk beds"),
    expect: "match",
    known:
      "stem('mattress') = 'mattres' (the 's' rule chews the second 's') but " +
      "stem('mattresses') = 'mattress' (the 'es' rule). Same root cause as " +
      "TP-10, hitting every singular ending in 'ss': class, glass, dress, " +
      "mattress, address.",
  },

  // ─── TRUE NEGATIVES: these must NOT match ────────────────────────────────
  {
    id: "TN-01",
    group: "true negative",
    name: "hard kind gate: SERVICE want vs GOODS listing",
    why:
      "Someone who wants their lawn MOWED is not served by being sold a mower. " +
      "Without the kind gate this pair scores 7 on the shared word 'lawn'.",
    listing: L(
      "GOODS",
      "GARDEN",
      "Lawn mower, self-propelled",
      "Honda engine, starts first pull. Lawn ready."
    ),
    want: W(
      "SERVICE",
      "GARDEN",
      "Lawn mowing every other week",
      "Half acre of lawn, front and back."
    ),
    expect: "no-match",
  },
  {
    id: "TN-02",
    group: "true negative",
    name: "hard kind gate: GOODS want vs SERVICE listing",
    why: "The gate must hold in both directions, not just one.",
    listing: L(
      "SERVICE",
      "REPAIRS",
      "Bike repair, any make",
      "Flats, brakes, tune-ups."
    ),
    want: W("GOODS", "REPAIRS", "Bike repair stand", "Want to buy or borrow."),
    expect: "no-match",
  },
  {
    id: "TN-03",
    group: "true negative",
    name: "same category, unrelated items (hammer vs cement mixer)",
    why:
      "TOOLS covers a hammer and a cement mixer. Category agreement alone " +
      "(2 points) must sit below the threshold of 3.",
    listing: L(
      "GOODS",
      "TOOLS",
      "Cement mixer",
      "Towable, good for a patio pour."
    ),
    want: W("GOODS", "TOOLS", "Hammer"),
    expect: "no-match",
  },
  {
    id: "TN-04",
    group: "true negative",
    name: "same category, near neighbours but different machines",
    why: "Post-storm Georgia: everyone posts yard equipment. Chainsaw is not a leaf blower.",
    listing: L(
      "GOODS",
      "GARDEN",
      "Leaf blower, gas powered",
      "Backpack style, plenty of fuel left."
    ),
    want: W(
      "GOODS",
      "GARDEN",
      "Chainsaw for storm cleanup",
      "Pine came down across the driveway."
    ),
    expect: "no-match",
  },
  {
    id: "TN-05",
    group: "true negative",
    name: "pure stopword overlap",
    why:
      "Two contentless posts share nothing but filler. Nothing may be " +
      "suggested from filler alone.",
    listing: L(
      "SERVICE",
      "OTHER",
      "I have some help for you",
      "Whatever you have, I can have a look."
    ),
    want: W("SERVICE", "OTHER", "Looking for someone to help me out"),
    expect: "no-match",
  },
  {
    id: "TN-06",
    group: "true negative",
    name: "filler-noun overlap ('thing')",
    why:
      "The prompt case: 'I need help with the thing' vs 'Help with a thing'. " +
      "Every real word here is filler and the pair carries zero information.",
    listing: L(
      "SERVICE",
      "OTHER",
      "Help with a thing",
      "Whatever you need, I can probably do it."
    ),
    want: W("SERVICE", "OTHER", "I need help with the thing"),
    expect: "no-match",
    known:
      "'help' is a stopword but 'thing' is not, so the pair matches on 'thing' " +
      "for 7 points. STOPWORDS covers grammar words but not semantically " +
      "empty nouns. Add: thing, things, stuff, item, items, something, " +
      "anything, everything, whatever, misc, stuff.",
  },
  {
    id: "TN-07",
    group: "true negative",
    name: "incidental logistics word ('weekend')",
    why:
      "A hammer and a cement mixer are still unrelated when both posts happen " +
      "to mention the weekend. This is the exact 'absurd suggestion' the " +
      "module header warns about.",
    listing: L(
      "GOODS",
      "TOOLS",
      "Cement mixer",
      "Free to borrow for the weekend."
    ),
    want: W("GOODS", "TOOLS", "Hammer", "Just need it for the weekend."),
    expect: "no-match",
    known:
      "One shared word (3) plus same category (2) clears the threshold of 3, " +
      "even when the shared word says nothing about WHAT the thing is. " +
      "Scheduling and logistics words are the common carrier: weekend, " +
      "saturday, sunday, morning, evening, today, tomorrow, week, day, hour, " +
      "borrow, lend, free, cheap, condition, available, pickup, porch, " +
      "neighborhood, trade, credit. Either add them to STOPWORDS or require " +
      "a title-level hit when there is only one shared word.",
  },
  {
    id: "TN-08",
    group: "true negative",
    name: "leaked stopword via stemming ('needs' → 'need')",
    why:
      "Leaf raking and piano lessons have nothing in common. They match on the " +
      "stem of a word that IS in STOPWORDS.",
    listing: L(
      "SERVICE",
      "TUTORING",
      "Piano lessons for anyone who needs them",
      "Half hour slots after school."
    ),
    want: W(
      "SERVICE",
      "GARDEN",
      "Leaf raking, needs doing before Thanksgiving",
      "Big water oak out front."
    ),
    expect: "no-match",
    known:
      "STOPWORDS is checked against the RAW token, before stemming. 'needs' " +
      "is not in the list, survives the filter, and then stems to 'need' — " +
      "which is. The same leak exists for 'wants'→'want', 'helps'→'help', " +
      "'yours'→'your', 'ours'→'our'. Worse, this pair is in DIFFERENT " +
      "categories, so the leaked stopword is the only thing holding the match " +
      "together. Fix: check STOPWORDS again after stemming (or stem the " +
      "stopword list itself at module load).",
  },
  {
    id: "TN-09",
    group: "true negative",
    name: "shared adjective, different noun (pressure washer vs pressure treated lumber)",
    why:
      "A member who asked to borrow a pressure washer being shown leftover " +
      "decking boards is the textbook near-miss.",
    listing: L(
      "GOODS",
      "TOOLS",
      "Pressure treated lumber, leftover",
      "About twelve boards from a deck job."
    ),
    want: W(
      "GOODS",
      "TOOLS",
      "Pressure washer for the driveway",
      "Mildew everywhere after the rain."
    ),
    expect: "no-match",
    known:
      "Same root cause as TN-07: a single shared word plus category agreement " +
      "reaches the threshold. Here the shared word is even a title word " +
      "('pressure' scores 3 + 2 + 2 = 7), so a title-hit requirement would " +
      "NOT catch it. This one argues for weighting words by how rare they are " +
      "across the neighborhood's corpus, or for requiring 2 shared words when " +
      "neither side is a short title.",
  },
  {
    id: "TN-10",
    group: "true negative",
    name: "TIME want vs SERVICE listing for the same activity",
    why:
      "By design: kind is a hard gate. Recorded so the trade-off is visible, " +
      "not because the outcome is desirable.",
    listing: L(
      "SERVICE",
      "CHILDCARE",
      "Babysitting, weekday evenings",
      "CPR certified, references from three families on the street."
    ),
    want: W(
      "TIME",
      "CHILDCARE",
      "Babysitting for two hours Friday",
      "Anniversary dinner, back by nine."
    ),
    expect: "no-match",
    note:
      "DESIGN NOTE — GOODS vs SERVICE is a distinction members get right; " +
      "TIME vs SERVICE is not. BARTER_KIND_META describes TIME as 'Hours of " +
      "help' and SERVICE as 'Something you can do', which is the same thing " +
      "to most people. This pair is a perfect babysitting match that the gate " +
      "silently discards. Recommendation: keep the GOODS↔{SERVICE,TIME} gate " +
      "hard, but treat TIME and SERVICE as interchangeable (or score a " +
      "cross-kind TIME/SERVICE match at a small penalty).",
  },

  // ─── EDGE CASES ──────────────────────────────────────────────────────────
  {
    id: "EDGE-01",
    group: "edge case",
    name: "empty description on both sides",
    why: "Must not crash, and must still match on identical titles.",
    listing: L("GOODS", "GARDEN", "Wheelbarrow", ""),
    want: W("GOODS", "GARDEN", "Wheelbarrow", ""),
    expect: "match",
  },
  {
    id: "EDGE-02",
    group: "edge case",
    name: "emoji-only want title",
    why:
      "Zod's min(3) counts UTF-16 units, so a two-emoji title passes " +
      "validation. The tokeniser must survive it.",
    listing: L("GOODS", "TOOLS", "Hammer and nails", "Claw hammer, 16 oz."),
    want: W("GOODS", "TOOLS", "🔨🔨🔨"),
    expect: "no-match",
    note:
      "Correct outcome, but silent. An emoji-only want yields zero keywords " +
      "and can never match anything, forever. The want composer should tell " +
      "the member their post is unsearchable rather than let it sit open.",
  },
  {
    id: "EDGE-03",
    group: "edge case",
    name: "want title that is a single stopword",
    why: "'Help' passes validation (4 chars) and produces zero keywords.",
    listing: L(
      "SERVICE",
      "SKILLS",
      "Fence painting",
      "I paint fences and decks, weekends only."
    ),
    want: W("SERVICE", "SKILLS", "Help"),
    expect: "no-match",
    note:
      "Same silent dead-end as EDGE-02. 'Help', 'Need', 'Looking', 'Anyone?' " +
      "are all plausible titles a member would type.",
  },
  {
    id: "EDGE-04",
    group: "edge case",
    name: "two-character noun (TV)",
    why:
      "One neighbor wants a TV, another is giving one away, same category. " +
      "A member would call a miss here broken.",
    listing: L(
      "GOODS",
      "ELECTRONICS",
      "TV, 40 inch, works great",
      "Flat screen, no stand, pickup only."
    ),
    want: W("GOODS", "ELECTRONICS", "TV for the garage"),
    expect: "match",
    known:
      "The tokeniser drops every token shorter than 3 characters, so 'tv' " +
      "never exists. Also kills AC, PC, RV, PS, and any 2-char model name. " +
      "Fix: keep short tokens when they are the only content in a title, or " +
      "whitelist a handful of common 2-char nouns.",
  },
  {
    id: "EDGE-05",
    group: "edge case",
    name: "digits carry the distinguishing signal",
    why: "'2000 PSI' vs '1600 PSI' — numbers survive tokenisation and should help, not hurt.",
    listing: L(
      "GOODS",
      "TOOLS",
      "Pressure washer 2000 PSI",
      "Electric, hose included."
    ),
    want: W("GOODS", "TOOLS", "Pressure washer 2000 PSI or better", ""),
    expect: "match",
  },
  {
    id: "EDGE-06",
    group: "edge case",
    name: "very long description, one real overlap",
    why: "Long posts must not drown the signal; the set is deduplicated so repetition cannot inflate the score.",
    listing: L(
      "GOODS",
      "FURNITURE",
      "Dining table and six chairs",
      "Solid oak dining table, six chairs, one leaf. Moving to Marietta at " +
        "the end of the month and it will not fit in the new place. Table " +
        "has a few scratches on the table top. Table, table, table."
    ),
    want: W(
      "GOODS",
      "FURNITURE",
      "Dining table for a big family",
      "Six of us and we eat in shifts right now."
    ),
    expect: "match",
  },
];

// ───────────────────────────────────────────────────────────────────────────
// Runner
// ───────────────────────────────────────────────────────────────────────────

const results = [];

function runCase(tc) {
  const match = scoreMatch(tc.listing, tc.want);
  const actual = match ? "match" : "no-match";
  const agreed = actual === tc.expect;
  const detail = explain(tc.listing, tc.want);

  let status;
  if (agreed && tc.known) status = "FIXED";
  else if (agreed) status = "PASS";
  else if (tc.known) status = "KNOWN";
  else status = "FAIL";

  const r = { tc, match, actual, detail, status };
  results.push(r);
  return r;
}

function fmtWords(list) {
  return list.length ? list.join(" ") : dim("(none)");
}

function reportCase(r) {
  const { tc, match, detail, status } = r;
  const tag = {
    PASS: green("PASS "),
    FAIL: red("FAIL "),
    KNOWN: yellow("KNOWN"),
    FIXED: blue("FIXED"),
  }[status];

  const score = match ? String(match.score) : dim("no match");
  const shared = match
    ? match.sharedWords.join(", ")
    : detail.shared.join(", ") || "-";

  console.log(
    `${tag} ${bold(tc.id)} ${tc.name}\n` +
      `      expected ${tc.expect}, got ${r.actual}  ` +
      `| score ${score} | shared: ${shared}`
  );

  const loud = status !== "PASS" || VERBOSE;
  if (loud) {
    console.log(dim(`      want    [${tc.want.kind}/${tc.want.category}] "${tc.want.title}"`));
    console.log(dim(`              desc: ${tc.want.description === null ? "(null)" : JSON.stringify(tc.want.description)}`));
    console.log(dim(`      listing [${tc.listing.kind}/${tc.listing.category}] "${tc.listing.title}"`));
    console.log(dim(`              desc: ${JSON.stringify(tc.listing.description)}`));
    console.log(dim(`      want keywords    : ${fmtWords(detail.wantWords)}`));
    console.log(dim(`      listing keywords : ${fmtWords(detail.listingWords)}`));
    console.log(
      dim(
        `      components : kind ${detail.kindGate ? "same" : "DIFFERENT (hard gate → null)"}` +
          `, sameCategory ${detail.sameCategory ? "+2" : "+0"}` +
          `, shared ${detail.shared.length}x3=+${detail.shared.length * 3}` +
          `, titleOverlap ${detail.titleOverlap.length}x2=+${detail.titleOverlap.length * 2}` +
          ` => raw ${detail.raw} (threshold 3)`
      )
    );
    console.log(dim(`      why this case exists: ${tc.why}`));
  }
  if (status === "KNOWN") {
    console.log(yellow(`      ↳ KNOWN ENGINE DEFECT: ${tc.known}`));
  }
  if (status === "FIXED") {
    console.log(
      blue(
        `      ↳ This was a known defect and now behaves correctly. Delete the ` +
          `'known' field on ${tc.id} so it guards the fix.`
      )
    );
  }
  if (tc.note) console.log(blue(`      ↳ ${tc.note}`));
  if (loud || tc.note) console.log("");
}

// ───────────────────────────────────────────────────────────────────────────
// Structural probes — properties that must hold for EVERY pair, not just the
// hand-written ones. Cheap, and they catch classes of bug a case list cannot.
// ───────────────────────────────────────────────────────────────────────────

function runProbes() {
  const posts = CASES.flatMap((tc) => [
    { label: `${tc.id}.listing`, post: tc.listing },
    {
      label: `${tc.id}.want`,
      post: { ...tc.want, description: tc.want.description ?? "" },
    },
  ]);

  const failures = [];
  const invisible = [];
  let pairs = 0;

  for (const a of posts) {
    // Self-match: a post compared to an identical want must match itself.
    // Anything that fails this is invisible to the matching engine entirely.
    if (!scoreMatch(a.post, a.post)) {
      invisible.push(a);
    }

    for (const b of posts) {
      pairs++;
      const ab = scoreMatch(a.post, b.post);
      const ba = scoreMatch(b.post, a.post);

      // 1. Kind is a hard gate, unconditionally.
      if (a.post.kind !== b.post.kind && ab !== null) {
        failures.push(
          `kind gate leaked: ${a.label} (${a.post.kind}) matched ${b.label} (${b.post.kind})`
        );
      }

      // 2. Scoring must be symmetric — matchesForMyListings() and
      //    findListingsForWant() call scoreMatch with the two sides swapped,
      //    so an asymmetry would mean the same pair ranks differently
      //    depending on which member is looking.
      if ((ab === null) !== (ba === null)) {
        failures.push(
          `asymmetric verdict between ${a.label} and ${b.label}: ` +
            `${ab ? ab.score : "null"} vs ${ba ? ba.score : "null"}`
        );
      } else if (ab && ba && ab.score !== ba.score) {
        failures.push(
          `asymmetric score between ${a.label} and ${b.label}: ${ab.score} vs ${ba.score}`
        );
      }

      if (!ab) continue;

      // 3. No match may be returned without at least one shared word. The
      //    module comment claims "category agreement plus a title-level hit"
      //    is a second route in, but title words are a subset of all words,
      //    so that route cannot exist. Worth asserting: if this ever fires,
      //    a listing is being suggested with nothing to explain it, and the
      //    notification copy ("you asked for X") will read as nonsense.
      if (ab.sharedWords.length === 0) {
        failures.push(
          `match with no shared words: ${a.label} → ${b.label} scored ${ab.score}`
        );
      }

      // 4. sharedWords is what the UI shows as the reason. It must be a real
      //    subset of both sides and capped at 4.
      if (ab.sharedWords.length > 4) {
        failures.push(`sharedWords longer than 4 for ${a.label} → ${b.label}`);
      }
      const aw = keywords(a.post.title, a.post.description);
      const bw = keywords(b.post.title, b.post.description);
      for (const w of ab.sharedWords) {
        if (!aw.has(w) || !bw.has(w)) {
          failures.push(
            `sharedWords contains "${w}" which is not in both posts (${a.label} → ${b.label})`
          );
        }
      }
    }
  }

  return { failures, invisible, pairs, posts: posts.length };
}

// ───────────────────────────────────────────────────────────────────────────
// Plural probe — measures the blast radius of stem() directly, so the defect
// behind TP-10/TP-11 is visible as a table instead of two anecdotes.
// ───────────────────────────────────────────────────────────────────────────

const PLURALS = [
  ["ladders", "ladder"],
  ["mowers", "mower"],
  ["tools", "tool"],
  ["boxes", "box"],
  ["dishes", "dish"],
  ["dollies", "dolly"],
  ["hours", "hour"],
  ["kids", "kid"],
  ["lessons", "lesson"],
  ["bikes", "bike"],
  ["tires", "tire"],
  ["tables", "table"],
  ["hoses", "hose"],
  ["rakes", "rake"],
  ["crates", "crate"],
  ["fences", "fence"],
  ["shoes", "shoe"],
  ["services", "service"],
  ["classes", "class"],
  ["glasses", "glass"],
  ["mattresses", "mattress"],
  ["dresses", "dress"],
];

// Unrelated words that must NOT collapse onto the same stem.
const MUST_NOT_COLLIDE = [
  ["cars", "cares"],
  ["tools", "toes"],
];

function runStemProbe() {
  const broken = [];
  for (const [plural, singular] of PLURALS) {
    if (stem(plural) !== stem(singular)) {
      broken.push([plural, stem(plural), singular, stem(singular)]);
    }
  }
  const collided = [];
  for (const [a, b] of MUST_NOT_COLLIDE) {
    if (stem(a) === stem(b)) collided.push([a, b, stem(a)]);
  }
  return { broken, collided };
}

// ───────────────────────────────────────────────────────────────────────────
// Main
// ───────────────────────────────────────────────────────────────────────────

async function main() {
  console.log("");
  console.log(bold("Porchlight — matching quality harness"));
  console.log(
    dim("scripts/stress/matching-quality.mjs — no database, no dependencies")
  );

  // ── Drift ────────────────────────────────────────────────────────────────
  const drift = await checkDrift();
  heading("0. SOURCE DRIFT CHECK");
  if (drift.status === "ok") {
    console.log(
      green("OK") +
        "  the scoring logic copied into this file matches src/lib/matching.ts"
    );
    console.log(dim(`    fingerprint ${drift.hash.slice(0, 16)}…`));
  } else if (drift.status === "drift") {
    console.log(
      red("!! DRIFT !!") +
        "  src/lib/matching.ts has changed since this copy was made."
    );
    console.log(
      red("            Every result below may describe code that no longer runs.")
    );
    console.log(
      "            1. Re-copy STOPWORDS / stem / keywords / scoreMatch into the"
    );
    console.log("               COPIED LOGIC block of this file.");
    console.log("            2. Set SOURCE_FINGERPRINT to:");
    console.log(bold(`               "${drift.hash}"`));
  } else {
    console.log(yellow("SKIPPED") + `  ${drift.message}`);
  }

  // ── Cases ────────────────────────────────────────────────────────────────
  const groups = ["true positive", "true negative", "edge case"];
  const titles = {
    "true positive": "1. TRUE POSITIVES — these must be suggested",
    "true negative": "2. TRUE NEGATIVES — these must never be suggested",
    "edge case": "3. EDGE CASES",
  };
  for (const g of groups) {
    heading(titles[g]);
    for (const tc of CASES.filter((t) => t.group === g)) reportCase(runCase(tc));
  }

  // ── Probes ───────────────────────────────────────────────────────────────
  heading("4. STRUCTURAL PROBES — properties over every pair of posts above");
  const probe = runProbes();
  console.log(
    dim(
      `    ${probe.pairs} pairs from ${probe.posts} posts; checked: kind gate, ` +
        `symmetry, no-match-without-a-shared-word, sharedWords sanity`
    )
  );
  if (probe.failures.length === 0) {
    console.log(green("PASS ") + " all structural properties held");
  } else {
    for (const f of new Set(probe.failures)) console.log(red("FAIL ") + " " + f);
  }
  if (probe.invisible.length) {
    console.log("");
    console.log(
      yellow(
        `    ${probe.invisible.length} post(s) do not even match themselves — ` +
          `they yield zero keywords and can never be matched to anything:`
      )
    );
    for (const p of probe.invisible) {
      console.log(yellow(`      ${p.label}: "${p.post.title}"`));
    }
    console.log(
      blue(
        "      These are legal posts a member can create today. The composer " +
          "should warn at post time rather than leaving them silently dead."
      )
    );
  }

  // ── Stem probe ───────────────────────────────────────────────────────────
  heading("5. PLURAL PROBE — does stem() actually unify plural and singular?");
  const { broken, collided } = runStemProbe();
  console.log(
    dim(`    ${PLURALS.length} plural/singular pairs, ${broken.length} broken`)
  );
  if (broken.length === 0) {
    console.log(green("PASS ") + " every plural stems to its singular");
  } else {
    for (const [p, ps, s, ss] of broken) {
      console.log(
        yellow("KNOWN") +
          `  ${p.padEnd(12)} → ${ps.padEnd(10)} but ${s.padEnd(10)} → ${ss}`
      );
    }
    console.log("");
    console.log(
      yellow(
        `      ${broken.length} of ${PLURALS.length} pairs fail. The 'es' rule ` +
          `runs before the 's' rule and blindly drops two characters, so every`
      )
    );
    console.log(
      yellow(
        "      singular ending in 'e' (bike, tire, table, hose, fence, service) " +
          "and every singular ending in 'ss' (class, glass,"
      )
    );
    console.log(
      yellow(
        "      dress, mattress) is broken. Suggested fix: only apply the 'es' " +
          "rule after a sibilant (s, x, z, ch, sh) — e.g."
      )
    );
    console.log(
      yellow(
        "      if (/(?:ss|x|z|ch|sh)es$/.test(word)) return word.slice(0, -2); " +
          "— and check the 's' rule does not strip a trailing 'ss'."
      )
    );
  }
  for (const [a, b, s] of collided) {
    console.log(
      yellow("KNOWN") +
        `  unrelated words collapse: "${a}" and "${b}" both stem to "${s}"`
    );
  }

  // ── Summary ──────────────────────────────────────────────────────────────
  const pass = results.filter((r) => r.status === "PASS");
  const fail = results.filter((r) => r.status === "FAIL");
  const known = results.filter((r) => r.status === "KNOWN");
  const fixed = results.filter((r) => r.status === "FIXED");
  const stemKnown = broken.length + collided.length;

  heading("SUMMARY");
  console.log(`    cases            ${results.length}`);
  console.log(`    ${green("passed")}           ${pass.length}`);
  console.log(
    `    ${fail.length ? red("failed") : "failed"}           ${fail.length}` +
      (fail.length ? red("   <- regressions, fix these") : "")
  );
  console.log(
    `    ${known.length ? yellow("known defects") : "known defects"}    ${known.length}` +
      (known.length ? yellow("   <- engine is wrong, expectations are not") : "")
  );
  console.log(`    ${blue("newly fixed")}      ${fixed.length}`);
  console.log(`    structural       ${probe.failures.length} failure(s)`);
  console.log(`    stem defects     ${stemKnown}`);

  if (known.length) {
    console.log("");
    console.log(
      bold(
        "WHERE THIS HARNESS DISAGREES WITH THE ENGINE (ranked by damage to trust)"
      )
    );
    rule();
    const ranked = [
      "TN-08",
      "TN-07",
      "TN-09",
      "EDGE-04",
      "TP-10",
      "TP-11",
      "TN-06",
    ];
    const order = (id) => {
      const i = ranked.indexOf(id);
      return i === -1 ? ranked.length : i;
    };
    for (const r of [...known].sort(
      (a, b) => order(a.tc.id) - order(b.tc.id)
    )) {
      console.log(`  ${bold(r.tc.id)} ${r.tc.name}`);
      console.log(`       expected ${r.tc.expect}, engine says ${r.actual}`);
      console.log(dim(`       ${r.tc.known}`));
      console.log("");
    }
    console.log(
      dim(
        "  These are judgement calls recorded deliberately. If you disagree " +
          "with one, argue it in review and\n  delete the case — do not flip " +
          "the expectation to match the code."
      )
    );
  }

  const hardFail =
    fail.length > 0 ||
    probe.failures.length > 0 ||
    (STRICT && (known.length > 0 || stemKnown > 0 || drift.status !== "ok"));

  console.log("");
  if (hardFail) {
    console.log(red(bold("RESULT: FAIL")));
    if (STRICT && !fail.length && !probe.failures.length) {
      console.log(dim("       (--strict: known defects and drift count as failures)"));
    }
  } else if (known.length || stemKnown || drift.status !== "ok") {
    console.log(
      green(bold("RESULT: PASS")) +
        yellow(
          `  — with ${known.length + stemKnown} known defect(s) still open. ` +
            `Re-run with --strict to gate on them.`
        )
    );
  } else {
    console.log(green(bold("RESULT: PASS")));
  }
  console.log("");

  process.exit(hardFail ? 1 : 0);
}

main().catch((err) => {
  console.error(red("harness crashed:"), err);
  process.exit(1);
});
