import { hashSeed, mulberry32 } from "@/lib/games/prng";
import { getNight } from "./nights";
import {
  BOARD_SIZE,
  COLORS,
  SHAPES,
  type Cell,
  type Color,
  type Goal,
  type NightId,
  type Progress,
  type QuiltMove,
  type QuiltState,
  type Shape,
  type Tile,
} from "./types";

function emptyProgress(): Progress {
  return {
    matches: 0,
    trueMatches: 0,
    byColor: { amber: 0, pine: 0, cream: 0, dusk: 0, clay: 0 },
    byShape: { lantern: 0, leaf: 0, peach: 0, key: 0, mug: 0, star: 0 },
  };
}

function inBounds(r: number, c: number) {
  return r >= 0 && c >= 0 && r < BOARD_SIZE && c < BOARD_SIZE;
}

export function adjacent(a: Cell, b: Cell) {
  return Math.abs(a.r - b.r) + Math.abs(a.c - b.c) === 1;
}

function runKind(tiles: Tile[]): "color" | "shape" | "true" | null {
  if (tiles.length < 3) return null;
  const sameColor = tiles.every((t) => t.color === tiles[0]!.color);
  const sameShape = tiles.every((t) => t.shape === tiles[0]!.shape);
  if (sameColor && sameShape) return "true";
  if (sameColor || sameShape) return sameColor ? "color" : "shape";
  return null;
}

export function findMatches(board: (Tile | null)[][]) {
  const marked = new Set<string>();
  let trueMatches = 0;
  const groups: { cells: Cell[]; kind: "color" | "shape" | "true" }[] = [];

  const consider = (cells: Cell[]) => {
    const tiles = cells
      .map((p) => board[p.r]![p.c])
      .filter((t): t is Tile => Boolean(t));
    if (tiles.length !== cells.length) return;
    const kind = runKind(tiles);
    if (!kind) return;
    groups.push({ cells, kind });
    if (kind === "true") trueMatches += 1;
    for (const p of cells) marked.add(`${p.r},${p.c}`);
  };

  const scanLine = (cells: Cell[]) => {
    let i = 0;
    while (i < cells.length) {
      let best = i + 1;
      for (let j = cells.length; j - i >= 3; j--) {
        const slice = cells.slice(i, j);
        const tiles = slice.map((p) => board[p.r]![p.c]).filter((t): t is Tile => Boolean(t));
        if (tiles.length === slice.length && runKind(tiles)) {
          consider(slice);
          best = j;
          break;
        }
      }
      i = best > i + 1 ? best : i + 1;
    }
  };

  for (let r = 0; r < BOARD_SIZE; r++) {
    scanLine(Array.from({ length: BOARD_SIZE }, (_, c) => ({ r, c })));
  }
  for (let c = 0; c < BOARD_SIZE; c++) {
    scanLine(Array.from({ length: BOARD_SIZE }, (_, r) => ({ r, c })));
  }

  return { marked, groups, trueMatches };
}

function makeTile(rng: () => number, id: number): Tile {
  return {
    id,
    color: COLORS[Math.floor(rng() * COLORS.length)]!,
    shape: SHAPES[Math.floor(rng() * SHAPES.length)]!,
  };
}

function wouldMatchAt(
  board: (Tile | null)[][],
  r: number,
  c: number,
  tile: Tile
) {
  const left: Tile[] = [];
  for (let cc = c - 1; cc >= 0; cc--) {
    const t = board[r]![cc];
    if (!t) break;
    left.push(t);
  }
  const right: Tile[] = [];
  for (let cc = c + 1; cc < BOARD_SIZE; cc++) {
    const t = board[r]![cc];
    if (!t) break;
    right.push(t);
  }
  const up: Tile[] = [];
  for (let rr = r - 1; rr >= 0; rr--) {
    const t = board[rr]![c];
    if (!t) break;
    up.push(t);
  }
  const down: Tile[] = [];
  for (let rr = r + 1; rr < BOARD_SIZE; rr++) {
    const t = board[rr]![c];
    if (!t) break;
    down.push(t);
  }
  const horiz = [...left.reverse(), tile, ...right];
  const vert = [...up.reverse(), tile, ...down];
  // only the contiguous run containing `tile` matters — that's the arrays above
  return Boolean(runKind(horiz) || runKind(vert));
}

function fillBoard(seed: string): { board: (Tile | null)[][]; nextId: number } {
  const rng = mulberry32(hashSeed(`quilt:${seed}`));
  const board: (Tile | null)[][] = Array.from({ length: BOARD_SIZE }, () =>
    Array.from({ length: BOARD_SIZE }, () => null)
  );
  let nextId = 1;
  for (let r = 0; r < BOARD_SIZE; r++) {
    for (let c = 0; c < BOARD_SIZE; c++) {
      let tile = makeTile(rng, nextId++);
      let guard = 0;
      while (wouldMatchAt(board, r, c, tile) && guard++ < 20) {
        tile = makeTile(rng, nextId++);
      }
      board[r]![c] = tile;
    }
  }
  return { board, nextId };
}

function gravity(board: (Tile | null)[][], rng: () => number, nextId: number) {
  let id = nextId;
  for (let c = 0; c < BOARD_SIZE; c++) {
    const stack: Tile[] = [];
    for (let r = BOARD_SIZE - 1; r >= 0; r--) {
      const t = board[r]![c];
      if (t) stack.push(t);
    }
    for (let r = BOARD_SIZE - 1; r >= 0; r--) {
      const fromStack = stack[BOARD_SIZE - 1 - r];
      if (fromStack) {
        board[r]![c] = fromStack;
      } else {
        board[r]![c] = makeTile(rng, id++);
      }
    }
  }
  return id;
}

function applyClears(state: QuiltState, rng: () => number): QuiltState {
  let combo = 0;
  let guard = 0;
  const board = state.board.map((row) => row.slice());
  let nextId = state.nextId;
  const progress = {
    ...state.progress,
    byColor: { ...state.progress.byColor },
    byShape: { ...state.progress.byShape },
  };
  let score = state.score;

  while (guard++ < 20) {
    const { marked, groups, trueMatches } = findMatches(board);
    if (marked.size === 0) break;
    combo += 1;
    progress.matches += groups.length;
    progress.trueMatches += trueMatches;
    for (const key of marked) {
      const [r, c] = key.split(",").map(Number);
      const tile = board[r]![c];
      if (tile) {
        progress.byColor[tile.color] += 1;
        progress.byShape[tile.shape] += 1;
      }
      board[r]![c] = null;
    }
    const base = marked.size * 20 + trueMatches * 80;
    score += base * combo;
    nextId = gravity(board, rng, nextId);
  }

  return {
    ...state,
    board,
    nextId,
    progress,
    score,
    combo,
  };
}

export function createState(nightId: NightId, seed: string): QuiltState {
  const night = getNight(nightId);
  if (!night) throw new Error("unknown night");
  const { board, nextId } = fillBoard(seed);
  const rng = mulberry32(hashSeed(`quilt-fill:${seed}`));
  const base: QuiltState = {
    nightId,
    seed,
    board,
    movesLeft: night.moves,
    score: 0,
    combo: 0,
    progress: emptyProgress(),
    nextId,
    failedSwaps: 0,
  };
  // opening board should be quiet
  return { ...base, board: applyClears({ ...base, score: 0 }, rng).board, score: 0, progress: emptyProgress() };
}

export function goalsMet(state: QuiltState): boolean {
  const night = getNight(state.nightId);
  if (!night) return false;
  return night.goals.every((g) => goalCount(state, g) >= g.n);
}

export function goalCount(state: QuiltState, g: Goal): number {
  if (g.kind === "matches") return state.progress.matches;
  if (g.kind === "true") return state.progress.trueMatches;
  if (g.kind === "color") return state.progress.byColor[g.color];
  return state.progress.byShape[g.shape];
}

export function goalLabel(g: Goal): string {
  if (g.kind === "matches") return `${g.n} matches`;
  if (g.kind === "true") return `${g.n} true stitches`;
  if (g.kind === "color") return `${g.n} ${g.color}`;
  return `${g.n} ${g.shape}s`;
}

export type SwapResult =
  | { ok: true; state: QuiltState; cleared: boolean }
  | { ok: false; reason: "not-adjacent" | "no-match" | "no-moves" | "done" };

export function swap(state: QuiltState, a: Cell, b: Cell): SwapResult {
  if (state.movesLeft <= 0) return { ok: false, reason: "no-moves" };
  if (goalsMet(state)) return { ok: false, reason: "done" };
  if (!adjacent(a, b) || !inBounds(a.r, a.c) || !inBounds(b.r, b.c)) {
    return { ok: false, reason: "not-adjacent" };
  }
  const board = state.board.map((row) => row.slice());
  const ta = board[a.r]![a.c];
  const tb = board[b.r]![b.c];
  if (!ta || !tb) return { ok: false, reason: "no-match" };
  board[a.r]![a.c] = tb;
  board[b.r]![b.c] = ta;
  const { marked } = findMatches(board);
  if (marked.size === 0) {
    return {
      ok: false,
      reason: "no-match",
    };
  }
  const rng = mulberry32(hashSeed(`quilt-play:${state.seed}:${state.movesLeft}:${a.r}${a.c}${b.r}${b.c}`));
  const next = applyClears(
    {
      ...state,
      board,
      movesLeft: state.movesLeft - 1,
      failedSwaps: 0,
    },
    rng
  );
  if (goalsMet(next)) {
    next.score += next.movesLeft * 25;
  }
  return { ok: true, state: next, cleared: true };
}

export function replay(nightId: NightId, seed: string, moves: QuiltMove[]): QuiltState {
  let state = createState(nightId, seed);
  for (const m of moves) {
    const res = swap(state, m.a, m.b);
    if (res.ok) state = res.state;
  }
  return state;
}

export function parseMoves(raw: unknown): QuiltMove[] | null {
  if (!Array.isArray(raw) || raw.length > 80) return null;
  const out: QuiltMove[] = [];
  for (const item of raw) {
    if (!item || typeof item !== "object") return null;
    const a = (item as { a?: Cell }).a;
    const b = (item as { b?: Cell }).b;
    if (!a || !b) return null;
    if (![a.r, a.c, b.r, b.c].every((n) => Number.isInteger(n))) return null;
    if (![a.r, a.c, b.r, b.c].every((n) => n >= 0 && n < BOARD_SIZE)) return null;
    out.push({ a: { r: a.r, c: a.c }, b: { r: b.r, c: b.c } });
  }
  return out;
}
