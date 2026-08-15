/**
 * Pure scoring / anti-cheat checks — no database.
 *
 *   npx tsx scripts/test-game-scoring.ts
 */
import { getLevel } from "../src/lib/games/levels";
import { GROUND_Y, fastestClearMs } from "../src/lib/games/physics";
import {
  creditsForRun,
  parseEvents,
  scoreFromCounts,
  validateRun,
} from "../src/lib/games/scoring";
import { LEVEL_IDS } from "../src/lib/games/types";

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

// Ids come from the course itself — the builder names props, not the test.
const FIRST_PORCH = kirkwood.porches[0]!.id;
const FIRST_COIN = kirkwood.coins[0]!.id;
const LAST_PORCH = kirkwood.porches[kirkwood.porches.length - 1]!;
const KIRKWOOD_CLEAR = Math.round(kirkwood.minDurationMs * 1.4);

const dup = validateRun({
  level: kirkwood,
  events: [
    { t: 1000, k: "porch", id: FIRST_PORCH },
    { t: 2000, k: "porch", id: FIRST_PORCH },
  ],
  durationMs: KIRKWOOD_CLEAR,
});
check("duplicate porch is rejected", !dup.ok && "code" in dup && dup.code === "DUP_COLLECT");

const events = parseEvents([
  { t: 500, k: "jump" },
  { t: 2000, k: "porch", id: FIRST_PORCH },
  { t: 4000, k: "coin", id: FIRST_COIN },
  { t: KIRKWOOD_CLEAR - 500, k: "finish" },
]);
check("event log parses", Array.isArray(events) && events?.length === 4);

const good = validateRun({
  level: kirkwood,
  events: events ?? [],
  durationMs: KIRKWOOD_CLEAR,
});
check(
  "honest kirkwood run is accepted",
  good.ok && good.score === scoreFromCounts({ coins: 1, porchesLit: 1, finished: true }),
  good.ok ? `score ${good.score}` : `${good.code}`
);

const backwards = parseEvents([
  { t: 2000, k: "coin", id: FIRST_COIN },
  { t: 1000, k: "jump" },
]);
check("out-of-order events rejected", backwards === null);

// Regression: the anti-cheat floor used to sit ABOVE the fastest run the
// lantern can physically make, so every honest clear came back TOO_FAST.
for (const id of LEVEL_IDS) {
  const lvl = getLevel(id, "2026-08-14:test");
  const fastest = Math.round(fastestClearMs(lvl.mood, lvl.finishX));
  // A course with keys cannot be finished without them, so a clean run has to
  // carry the full set for the clock check to be the thing under test.
  const keySweep = lvl.keys.map((k, i) => ({ t: 10 + i, k: "key" as const, id: k.id }));
  const clean = validateRun({
    level: lvl,
    events: [...keySweep, { t: fastest, k: "finish" }],
    durationMs: fastest,
  });
  check(
    `${id}: a flat-out clean finish is accepted`,
    clean.ok,
    `fastest possible ${fastest}ms, floor ${lvl.minDurationMs}ms${clean.ok ? "" : ` — ${clean.code}`}`
  );
  const cheated = validateRun({
    level: lvl,
    events: [...keySweep, { t: 1500, k: "finish" }],
    durationMs: 1500,
  });
  check(
    `${id}: an impossible 1.5s finish is still rejected`,
    !cheated.ok && "code" in cheated && cheated.code === "TOO_FAST",
    cheated.ok ? "accepted" : ""
  );
}

// Regression: a run that ends in a puddle claims no ground, so the distance
// floor must not touch it. The old flat floor rejected every early death.
const earlySnuff = parseEvents([
  { t: 900, k: "jump" },
  { t: 2400, k: "porch", id: FIRST_PORCH },
  { t: 3100, k: "coin", id: FIRST_COIN },
  { t: 4000, k: "die" },
  { t: 4500, k: "die" },
  { t: 5000, k: "die" },
]);
const snuffScore = scoreFromCounts({ coins: 1, porchesLit: 1, finished: false });
const snuffed = validateRun({
  level: kirkwood,
  events: earlySnuff ?? [],
  durationMs: 5200,
  claimedScore: snuffScore,
});
check(
  "a run snuffed near the start is accepted",
  snuffed.ok,
  !snuffed.ok ? snuffed.code : ""
);

// Regression: the scene used to flip `finished` before scoring, so every
// death-ended run claimed the +200 finish bonus the server never saw.
const phantomFinish = validateRun({
  level: kirkwood,
  events: earlySnuff ?? [],
  durationMs: 5200,
  claimedScore: scoreFromCounts({ coins: 1, porchesLit: 1, finished: true }),
});
check(
  "claiming the finish bonus without a finish event is rejected",
  !phantomFinish.ok && "code" in phantomFinish && phantomFinish.code === "SCORE_MISMATCH"
);

// Lighting the last porch on the block still costs the walk to get there.
const teleport = validateRun({
  level: kirkwood,
  events: [{ t: 1200, k: "porch", id: LAST_PORCH.id }],
  durationMs: 1400,
});
check(
  "a far porch lit in 1.4s is rejected",
  !teleport.ok && "code" in teleport && teleport.code === "TOO_FAST"
);

console.log("\nCourse geometry\n");

// Levels are generated by a cursor builder, so the reachability rules have to
// be asserted rather than eyeballed. A ledge the lantern cannot reach is a
// course that cannot be cleared, and nothing else in the suite would catch it.
for (const id of LEVEL_IDS) {
  const lvl = getLevel(id, "2026-08-14:test");
  const ledges = lvl.platforms.filter((p) => p.kind !== "ground");
  const ground = lvl.platforms.find((p) => p.kind === "ground");

  check(`${id}: ground runs the whole block`, Boolean(ground && ground.w >= lvl.length));
  check(`${id}: ribbon sits inside the block`, lvl.finishX < lvl.length && lvl.finishX > 0);
  check(`${id}: is a long course`, lvl.length >= 5000, `${lvl.length}px`);

  const tooHigh = ledges.filter((p) => GROUND_Y - p.y > 240);
  check(`${id}: every ledge is within jump range`, tooHigh.length === 0, `${tooHigh.length} too high`);

  // Ledge-to-ledge distance is not a reachability constraint here: the ground
  // runs unbroken under the whole course, so a long stretch without a ledge is
  // just flat running. What matters is that it isn't *empty* running — a dead
  // zone with nothing to jump, light, or dodge is a boring course.
  const features = [
    ...ledges.map((p) => p.x),
    ...lvl.coins.map((c) => c.x),
    ...lvl.porches.map((p) => p.x),
    ...lvl.puddles.map((p) => p.x),
    ...lvl.spikes.map((s) => s.x),
    ...lvl.springs.map((s) => s.x),
    ...lvl.gusts.map((g) => g.x),
    ...lvl.keys.map((k) => k.x),
    ...lvl.gates.map((g) => g.x),
  ].sort((a, b) => a - b);
  let dead = features[0] ?? lvl.length;
  for (let i = 1; i < features.length; i++) {
    dead = Math.max(dead, features[i]! - features[i - 1]!);
  }
  dead = Math.max(dead, lvl.finishX - (features[features.length - 1] ?? 0));
  check(`${id}: no dead stretch of empty ground`, dead <= 900, `worst ${dead}px`);

  // Dying sends you to the last checkpoint, so a course without them means a
  // 12,000px block replayed from zero on every mistake.
  check(`${id}: has checkpoints`, lvl.checkpoints.length >= 2, `${lvl.checkpoints.length}`);
  const cps = [...lvl.checkpoints].sort((a, b) => a.x - b.x);
  let worstBack = cps[0]?.x ?? lvl.finishX;
  for (let i = 1; i < cps.length; i++) worstBack = Math.max(worstBack, cps[i]!.x - cps[i - 1]!.x);
  worstBack = Math.max(worstBack, lvl.finishX - (cps[cps.length - 1]?.x ?? 0));
  check(`${id}: no brutal walk back to a checkpoint`, worstBack <= 5200, `worst ${worstBack}px`);
  check(
    `${id}: every checkpoint sits on the course`,
    lvl.checkpoints.every((c) => c.x > 0 && c.x < lvl.finishX)
  );

  const ids = [
    ...lvl.porches.map((p) => p.id),
    ...lvl.checkpoints.map((c) => c.id),
    ...lvl.coins.map((c) => c.id),
    ...lvl.keys.map((k) => k.id),
    ...lvl.switches.map((s) => s.id),
  ];
  check(`${id}: prop ids are unique`, new Set(ids).size === ids.length);

  const gateIds = new Set(lvl.gates.map((g) => g.id));
  check(
    `${id}: every switch drives a real gate`,
    lvl.switches.every((s) => gateIds.has(s.gate))
  );
  // A gate the player meets before its plate is an unwinnable wall.
  const plateOf = new Map(lvl.switches.map((s) => [s.gate, s.x]));
  check(
    `${id}: every gate's plate comes first`,
    lvl.gates.every((g) => (plateOf.get(g.id) ?? Infinity) < g.x)
  );
}

// Keys gate the ribbon, so a finish claimed with keys left behind is a forgery.
const locks = getLevel("reynoldstown");
check("the puzzle course actually has keys", locks.keys.length >= 3);
const forged = validateRun({
  level: locks,
  events: [
    { t: 1000, k: "key", id: locks.keys[0]!.id },
    { t: 40_000, k: "finish" },
  ],
  durationMs: 41_000,
});
check(
  "a finish with keys still on the block is rejected",
  !forged.ok && "code" in forged && forged.code === "IMPOSSIBLE",
  forged.ok ? "accepted" : ""
);

// Duration comes off the course, not a literal — the blocks got twice as long
// and a hardcoded clock silently became a too-fast claim.
const locksClear = Math.round(fastestClearMs(locks.mood, locks.finishX) * 1.3);
const honestKeys = validateRun({
  level: locks,
  events: [
    ...locks.keys.map((k, i) => ({ t: 2000 + i * 1000, k: "key" as const, id: k.id })),
    ...locks.switches.map((s, i) => ({ t: 3000 + i * 1000, k: "switch" as const, id: s.id })),
    { t: locksClear - 500, k: "finish" as const },
  ],
  durationMs: locksClear,
});
check("a full key sweep is accepted", honestKeys.ok, !honestKeys.ok ? honestKeys.code : "");
check(
  "keys and switches are scored",
  honestKeys.ok &&
    honestKeys.score ===
      scoreFromCounts({
        coins: 0,
        porchesLit: 0,
        keys: locks.keys.length,
        switches: locks.switches.length,
        finished: true,
      })
);

const dailyA = getLevel("daily", "2026-08-13:test");
const dailyB = getLevel("daily", "2026-08-13:test");
check(
  "daily seed is deterministic",
  dailyA.porches.length === dailyB.porches.length &&
    dailyA.porches[0]?.x === dailyB.porches[0]?.x
);
const dailyC = getLevel("daily", "2026-08-14:test");
// The opening ledge is fixed so every daily starts fair; compare the seeded
// body of the course instead of its first prop.
const shape = (l: ReturnType<typeof getLevel>) =>
  l.platforms.map((p) => `${p.x}:${p.y}:${p.kind}`).join("|");
check("different day is a different block", shape(dailyA) !== shape(dailyC));

if (failures) {
  console.log(`\n${failures} failed\n`);
  process.exit(1);
}
console.log("\nall scoring checks passed\n");
