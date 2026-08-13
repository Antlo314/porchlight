/**
 * Pure quilt engine checks — no database.
 *   npx tsx scripts/test-quilt.ts
 */
import { createState, findMatches, replay, swap } from "../src/lib/quilt/engine";
import { atlantaWeekKey } from "../src/lib/quilt/week";

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
check("same seed same opening tile", a.board[0]![0]!.color === b.board[0]![0]!.color && a.board[0]![0]!.shape === b.board[0]![0]!.shape);

const c = createState("night-0", "seed-b");
check(
  "different seed different board",
  a.board[0]![0]!.color !== c.board[0]![0]!.color || a.board[0]![0]!.shape !== c.board[0]![0]!.shape
);

const opening = findMatches(a.board);
check("opening board has no matches", opening.marked.size === 0, `found ${opening.marked.size}`);

check("week key looks like a date", /^\d{4}-\d{2}-\d{2}$/.test(atlantaWeekKey()));

let foundSwap = false;
const start = createState("night-0", "hunt");
outer: for (let r = 0; r < 7; r++) {
  for (let col = 0; col < 6; col++) {
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

if (failures) {
  console.log(`\n${failures} failed\n`);
  process.exit(1);
}
console.log("\nall quilt checks passed\n");
