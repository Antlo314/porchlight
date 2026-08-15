/**
 * Pure quilt engine checks — no database.
 *   npx tsx scripts/test-quilt.ts
 */
import {
  createState,
  findHint,
  findMatches,
  goalCount,
  goalsMet,
  isBoarded,
  replay,
  swap,
} from "../src/lib/quilt/engine";
import { NIGHTS, STORY_NIGHTS, getNight, nextStoryNight } from "../src/lib/quilt/nights";
import { atlantaWeekKey } from "../src/lib/quilt/week";
import { COLORS, DEFAULT_BOARD_SIZE, SHAPES } from "../src/lib/quilt/types";

let failures = 0;
function check(label: string, ok: boolean, detail = "") {
  if (ok) console.log(`  ok   ${label}`);
  else {
    failures++;
    console.log(`  FAIL ${label}${detail ? ` — ${detail}` : ""}`);
  }
}

console.log("\nEmber's Quilt engine\n");

const a = createState("night-0", "seed-a");
const b = createState("night-0", "seed-a");
check(
  "same seed same opening tile",
  a.board[0]![0]!.color === b.board[0]![0]!.color &&
    a.board[0]![0]!.shape === b.board[0]![0]!.shape
);

const c = createState("night-0", "seed-b");
check(
  "different seed different board",
  a.board[0]![0]!.color !== c.board[0]![0]!.color ||
    a.board[0]![0]!.shape !== c.board[0]![0]!.shape
);

check("opening board has no matches", findMatches(a.board).marked.size === 0);
check("week key looks like a date", /^\d{4}-\d{2}-\d{2}$/.test(atlantaWeekKey()));

let foundSwap = false;
const start = createState("night-0", "hunt");
outer: for (let r = 0; r < DEFAULT_BOARD_SIZE; r++) {
  for (let col = 0; col < DEFAULT_BOARD_SIZE - 1; col++) {
    const res = swap(start, { r, c: col }, { r, c: col + 1 });
    if (res.ok) {
      foundSwap = true;
      const again = replay("night-0", "hunt", [{ a: { r, c: col }, b: { r, c: col + 1 } }]);
      check("replay matches live swap score", again.score === res.state.score);
      check("successful swap spends a move", res.state.movesLeft === start.movesLeft - 1);
      break outer;
    }
  }
}
check("found at least one legal opening swap", foundSwap);

const bad = swap(start, { r: 0, c: 0 }, { r: 3, c: 3 });
check("non-adjacent swap rejected", !bad.ok && bad.reason === "not-adjacent");

console.log("\nRuns of four and five\n");

// Hand-built boards: does a run longer than three clear as ONE run, or does the
// scanner stop at three? Colors step by 1 and shapes by 2 across the grid, so
// no two neighbours ever share either attribute and the filler is provably
// quiet — any match the engine reports is the one the test planted.
type AnyTile = { id: number; color: string; shape: string };
function quietBoard(): AnyTile[][] {
  let id = 1;
  return Array.from({ length: 7 }, (_, r) =>
    Array.from({ length: 7 }, (_, c) => ({
      id: id++,
      color: COLORS[(r + c) % COLORS.length]!,
      shape: SHAPES[(r * 2 + c) % SHAPES.length]!,
    }))
  );
}
function paint(board: AnyTile[][], cells: [number, number][], color: string, shapes: string[]) {
  cells.forEach(([r, c], i) => {
    board[r]![c] = { ...board[r]![c]!, color, shape: shapes[i % shapes.length]! };
  });
  return board;
}

const quiet = quietBoard();
check("the probe filler is quiet", findMatches(quiet as never).marked.size === 0);

const four = paint(quietBoard(), [[3, 0], [3, 1], [3, 2], [3, 3]], "amber", [
  "leaf",
  "key",
  "mug",
  "star",
]);
check(
  "four of one color clear as one run",
  findMatches(four as never).marked.size === 4,
  `marked ${findMatches(four as never).marked.size}`
);

const five = paint(
  quietBoard(),
  [[5, 0], [5, 1], [5, 2], [5, 3], [5, 4]],
  "dusk",
  ["star", "leaf", "key", "mug", "peach"]
);
check(
  "five of one color clear as one run",
  findMatches(five as never).marked.size === 5,
  `marked ${findMatches(five as never).marked.size}`
);

const col = paint(quietBoard(), [[0, 2], [1, 2], [2, 2], [3, 2]], "clay", [
  "mug",
  "leaf",
  "star",
  "key",
]);
check(
  "four in a column clear as one run",
  findMatches(col as never).marked.size === 4,
  `marked ${findMatches(col as never).marked.size}`
);

// Same shape, four across, four different colors.
const shapeRun = quietBoard();
[
  [1, 0],
  [1, 1],
  [1, 2],
  [1, 3],
].forEach(([r, c], i) => {
  shapeRun[r!]![c!] = {
    ...shapeRun[r!]![c!]!,
    shape: "star",
    color: ["amber", "pine", "cream", "dusk"][i]!,
  };
});
check(
  "four of one shape clear as one run",
  findMatches(shapeRun as never).marked.size === 4,
  `marked ${findMatches(shapeRun as never).marked.size}`
);

console.log("\nStory arc\n");

check("fifteen story nights", STORY_NIGHTS.length === 15, `got ${STORY_NIGHTS.length}`);
check("weekly is not part of the story", !STORY_NIGHTS.some((n) => n.id === "weekly"));
check(
  "every night chains to the next",
  STORY_NIGHTS.slice(0, -1).every((n) => nextStoryNight(n.id) !== null)
);
check("the last story night ends the arc", nextStoryNight("night-14") === null);
check(
  "every night has a scene and an Ember line",
  NIGHTS.every((n) => n.scene.length > 0 && n.ember.length > 0)
);

// Every night must be buildable, quiet at the open, and have a legal first move
// — otherwise a player can hit a night that is unplayable from move one.
for (const night of NIGHTS) {
  const s = createState(night.id, `${night.id}:v1`);
  const size = night.size ?? DEFAULT_BOARD_SIZE;
  check(`${night.id}: board is ${size}x${size}`, s.size === size && s.board.length === size);
  check(`${night.id}: opens quiet`, findMatches(s.board).marked.size === 0);
  check(`${night.id}: has a legal opening move`, findHint(s.board) !== null);
  check(`${night.id}: starts unmet`, !goalsMet(s));
  const boarded = s.board.flat().filter(isBoarded).length;
  check(`${night.id}: seeds ${night.boards ?? 0} boarded tiles`, boarded === (night.boards ?? 0), `got ${boarded}`);
}

console.log("\nBoarded windows\n");

const boardedNight = getNight("night-4")!;
const bs = createState("night-4", "boards-test");
check("night-4 declares a boards goal", boardedNight.goals.some((g) => g.kind === "boards"));
check("boards start unfreed", goalCount(bs, { kind: "boards", n: 1 }) === 0);

const firstBoarded = (() => {
  for (let r = 0; r < bs.size; r++) {
    for (let col = 0; col < bs.size; col++) {
      if (isBoarded(bs.board[r]![col])) return { r, c: col };
    }
  }
  return null;
})();
check("a boarded tile exists", firstBoarded !== null);
if (firstBoarded) {
  const nb =
    firstBoarded.c + 1 < bs.size
      ? { r: firstBoarded.r, c: firstBoarded.c + 1 }
      : { r: firstBoarded.r, c: firstBoarded.c - 1 };
  const res = swap(bs, firstBoarded, nb);
  check("a boarded tile cannot be swapped", !res.ok && res.reason === "boarded");
  check(
    "hints never point at a boarded tile",
    (() => {
      const h = findHint(bs.board);
      return !h || (!isBoarded(bs.board[h.a.r]![h.a.c]) && !isBoarded(bs.board[h.b.r]![h.b.c]));
    })()
  );
}

// Replay determinism across a long game is what the server trusts when it
// re-scores a submitted run, so exercise it on a big boarded board.
const longSeed = "night-13:v1";
let live = createState("night-13", longSeed);
const played: { a: { r: number; c: number }; b: { r: number; c: number } }[] = [];
for (let step = 0; step < 20 && live.movesLeft > 0 && !goalsMet(live); step++) {
  const h = findHint(live.board);
  if (!h) break;
  const res = swap(live, h.a, h.b);
  if (!res.ok) break;
  played.push(h);
  live = res.state;
}
check("played a long boarded game", played.length >= 10, `${played.length} moves`);
const rerun = replay("night-13", longSeed, played);
check("server replay reproduces the score", rerun.score === live.score, `${rerun.score} vs ${live.score}`);
check(
  "server replay reproduces board progress",
  rerun.progress.boardsFreed === live.progress.boardsFreed &&
    rerun.progress.matches === live.progress.matches
);

console.log("\nDifficulty\n");

/**
 * A greedy solver takes whatever stitch it is offered and never aims, so it is
 * a floor on player skill. Every night must be beatable by it at least
 * occasionally — a night greedy can never clear is one where a real player is
 * relying on luck too. Run `npx tsx scripts/quilt-balance.ts` for the detail.
 */
const PROBE_SEEDS = ["v1", "alpha", "beta", "gamma", "delta", "eps", "zeta"];

function greedyClears(nightId: string): number {
  let cleared = 0;
  for (const s of PROBE_SEEDS) {
    let st = createState(nightId as never, `${nightId}:${s}`);
    while (st.movesLeft > 0 && !goalsMet(st)) {
      const h = findHint(st.board);
      if (!h) break;
      const res = swap(st, h.a, h.b);
      if (!res.ok) break;
      st = res.state;
    }
    if (goalsMet(st)) cleared += 1;
  }
  return cleared;
}

for (const night of NIGHTS) {
  const cleared = greedyClears(night.id);
  check(
    `${night.id}: a mindless solver can clear it`,
    cleared >= 2,
    `${cleared}/${PROBE_SEEDS.length} seeds`
  );
}

// The opening nights teach; they should not filter anybody out.
for (const id of ["night-0", "night-1", "night-2"]) {
  const cleared = greedyClears(id);
  check(`${id}: onboarding night is reliably clearable`, cleared === PROBE_SEEDS.length, `${cleared}/${PROBE_SEEDS.length}`);
}

// ...and the finale should not be a formality.
check(
  "night-14: the finale still takes real play",
  greedyClears("night-14") < PROBE_SEEDS.length,
  "a mindless solver cleared every seed"
);

if (failures) {
  console.log(`\n${failures} failed\n`);
  process.exit(1);
}
console.log("\nall quilt checks passed\n");
