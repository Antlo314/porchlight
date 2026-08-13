/**
 * Pure scoring / anti-cheat checks — no database.
 *
 *   npx tsx scripts/test-game-scoring.ts
 */
import { getLevel } from "../src/lib/games/levels";
import {
  creditsForRun,
  parseEvents,
  scoreFromCounts,
  validateRun,
} from "../src/lib/games/scoring";

let failures = 0;
function check(label: string, ok: boolean, detail = "") {
  if (ok) console.log(`  ok   ${label}`);
  else {
    failures++;
    console.log(`  FAIL ${label}${detail ? ` — ${detail}` : ""}`);
  }
}

const kirkwood = getLevel("kirkwood");

console.log("\nLight the Block scoring\n");

check(
  "empty run scores 0",
  scoreFromCounts({ coins: 0, porchesLit: 0, finished: false }) === 0
);
check(
  "one porch + finish is 320",
  scoreFromCounts({ coins: 0, porchesLit: 1, finished: true }) === 320
);
check(
  "200 glow pays 1 credit",
  creditsForRun({ score: 200, porchesLit: 1, finished: false, levelId: "kirkwood" }) === 1
);
check(
  "800 glow pays 2",
  creditsForRun({ score: 800, porchesLit: 4, finished: false, levelId: "kirkwood" }) === 2
);
check(
  "1600 glow pays 3",
  creditsForRun({ score: 1600, porchesLit: 8, finished: true, levelId: "kirkwood" }) === 3
);
check(
  "daily finish pays 3 even at low score",
  creditsForRun({ score: 200, porchesLit: 2, finished: true, levelId: "daily" }) === 3
);

const tooFast = validateRun({
  level: kirkwood,
  events: [{ t: 100, k: "finish" }],
  durationMs: 2000,
});
check("too-fast finish is rejected", !tooFast.ok && !tooFast.ok && "code" in tooFast && tooFast.code === "TOO_FAST");

const badPorch = validateRun({
  level: kirkwood,
  events: [{ t: 1000, k: "porch", id: "not-real" }],
  durationMs: kirkwood.minDurationMs + 1000,
});
check("unknown porch is rejected", !badPorch.ok && "code" in badPorch && badPorch.code === "UNKNOWN_ID");

const dup = validateRun({
  level: kirkwood,
  events: [
    { t: 1000, k: "porch", id: "k1" },
    { t: 2000, k: "porch", id: "k1" },
  ],
  durationMs: kirkwood.minDurationMs + 1000,
});
check("duplicate porch is rejected", !dup.ok && "code" in dup && dup.code === "DUP_COLLECT");

const events = parseEvents([
  { t: 500, k: "jump" },
  { t: 2000, k: "porch", id: "k1" },
  { t: 4000, k: "coin", id: "kc1" },
  { t: 17000, k: "finish" },
]);
check("event log parses", Array.isArray(events) && events?.length === 4);

const good = validateRun({
  level: kirkwood,
  events: events ?? [],
  durationMs: 18000,
});
check(
  "honest kirkwood run is accepted",
  good.ok && good.ok && good.score === scoreFromCounts({ coins: 1, porchesLit: 1, finished: true }),
  good.ok ? `score ${good.score}` : ""
);

const backwards = parseEvents([
  { t: 2000, k: "coin", id: "kc1" },
  { t: 1000, k: "jump" },
]);
check("out-of-order events rejected", backwards === null);

const dailyA = getLevel("daily", "2026-08-13:test");
const dailyB = getLevel("daily", "2026-08-13:test");
check(
  "daily seed is deterministic",
  dailyA.porches.length === dailyB.porches.length &&
    dailyA.porches[0]?.x === dailyB.porches[0]?.x
);
const dailyC = getLevel("daily", "2026-08-14:test");
check(
  "different day is a different block",
  dailyA.porches[0]?.x !== dailyC.porches[0]?.x || dailyA.coins.length !== dailyC.coins.length
);

if (failures) {
  console.log(`\n${failures} failed\n`);
  process.exit(1);
}
console.log("\nall scoring checks passed\n");
