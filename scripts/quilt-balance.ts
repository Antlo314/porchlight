/**
 * Difficulty probe for Ember's Quilt.
 *
 *   npx tsx scripts/quilt-balance.ts
 *
 * Plays every night with a greedy solver that just takes the first stitch it
 * is offered. A greedy bot is a weak player, so:
 *   - if greedy clears a night in 1-2 moves, the night is trivial
 *   - if greedy cannot clear it at all, a human probably has a bad time
 * The numbers here set the thresholds asserted in test-quilt.ts.
 */
import { createState, findHint, goalCount, goalLabel, goalsMet, swap } from "../src/lib/quilt/engine";
import { NIGHTS } from "../src/lib/quilt/nights";

const SEEDS = ["v1", "alpha", "beta", "gamma", "delta", "eps", "zeta"];
const median = (xs: number[]) => [...xs].sort((a, b) => a - b)[Math.floor(xs.length / 2)]!;

console.log("\nGreedy solver — takes the first stitch offered, never aims.\n");
console.log("night            moves  cleared   per-goal reach (greedy / target)\n");

for (const night of NIGHTS) {
  let cleared = 0;
  const reach: number[][] = night.goals.map(() => []);
  const scores: number[] = [];

  for (const s of SEEDS) {
    let state = createState(night.id, `${night.id}:${s}`);
    while (state.movesLeft > 0 && !goalsMet(state)) {
      const h = findHint(state.board);
      if (!h) break;
      const res = swap(state, h.a, h.b);
      if (!res.ok) break;
      state = res.state;
    }
    if (goalsMet(state)) cleared += 1;
    night.goals.forEach((g, i) => reach[i]!.push(goalCount(state, g)));
    scores.push(state.score);
  }

  const parts = night.goals.map((g, i) => {
    const got = median(reach[i]!);
    const pct = Math.round((got / g.n) * 100);
    return `${goalLabel(g)} ${got}/${g.n} (${pct}%)`;
  });

  console.log(
    `${night.id.padEnd(15)} ${String(night.moves).padStart(5)} ${`${cleared}/${SEEDS.length}`.padStart(8)}   ${parts.join(" · ")}`
  );
}

console.log("");
