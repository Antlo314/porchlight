import { hashSeed, mulberry32 } from "@/lib/games/prng";
import { getNight } from "./nights";
import {
  COLORS,
  DEFAULT_BOARD_SIZE,
  MAX_BOARD_SIZE,
  SHAPES,
  type Cell,
  type Goal,
  type NightId,
  type Progress,
  type QuiltMove,
  type QuiltState,
  type Tile,
} from "./types";

function emptyProgress(): Progress {
  return {
    matches: 0,
    trueMatches: 0,
    boardsFreed: 0,
    byColor: { amber: 0, pine: 0, cream: 0, dusk: 0, clay: 0 },
    byShape: { lantern: 0, leaf: 0, peach: 0, key: 0, mug: 0, star: 0 },
  };
}

/** Boards are square, so the grid tells us its own size. */
function sizeOf(board: (Tile | null)[][]) {
  return board.length;
}

function inBounds(r: number, c: number, size: number) {
  return r >= 0 && c >= 0 && r < size && c < size;
}

export function adjacent(a: Cell, b: Cell) {
  return Math.abs(a.r - b.r) + Math.abs(a.c - b.c) === 1;
}

export function isBoarded(tile: Tile | null | undefined): boolean {
  return Boolean(tile && tile.boards && tile.boards > 0);
}

function runKind(tiles: Tile[]): "color" | "shape" | "true" | null {
  if (tiles.length < 3) return null;
  const sameColor = tiles.every((t) => t.color === tiles[0]!.color);
  const sameShape = tiles.every((t) => t.shape === tiles[0]!.shape);
  if (sameColor && sameShape) return "true";
  if (sameColor || sameShape) return sameColor ? "color" : "shape";
  return null;
}

/** Contiguous runs of 3+ same color, and 3+ same shape. 4 and 5 count. */
export function findMatches(board: (Tile | null)[][]) {
  const size = sizeOf(board);
  const marked = new Set<string>();
  let trueMatches = 0;
  const groups: { cells: Cell[]; kind: "color" | "shape" | "true" }[] = [];

  const consider = (cells: Cell[]) => {
    const tiles = cells
      .map((p) => board[p.r]![p.c])
      .filter((t): t is Tile => Boolean(t));
    if (tiles.length !== cells.length || tiles.length < 3) return;
    const kind = runKind(tiles);
    if (!kind) return;
    groups.push({ cells, kind });
    if (kind === "true") trueMatches += 1;
    for (const p of cells) marked.add(`${p.r},${p.c}`);
  };

  const scanAttr = (cells: Cell[], attr: (t: Tile) => string) => {
    let i = 0;
    while (i < cells.length) {
      const start = board[cells[i]!.r]![cells[i]!.c];
      if (!start) {
        i += 1;
        continue;
      }
      const key = attr(start);
      let j = i + 1;
      while (j < cells.length) {
        const t = board[cells[j]!.r]![cells[j]!.c];
        if (!t || attr(t) !== key) break;
        j += 1;
      }
      if (j - i >= 3) consider(cells.slice(i, j));
      i = j;
    }
  };

  const scanLine = (cells: Cell[]) => {
    scanAttr(cells, (t) => t.color);
    scanAttr(cells, (t) => t.shape);
  };

  for (let r = 0; r < size; r++) {
    scanLine(Array.from({ length: size }, (_, c) => ({ r, c })));
  }
  for (let c = 0; c < size; c++) {
    scanLine(Array.from({ length: size }, (_, r) => ({ r, c })));
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

function wouldMatchAt(board: (Tile | null)[][], r: number, c: number, tile: Tile) {
  const size = sizeOf(board);
  const left: Tile[] = [];
  for (let cc = c - 1; cc >= 0; cc--) {
    const t = board[r]![cc];
    if (!t) break;
    left.push(t);
  }
  const right: Tile[] = [];
  for (let cc = c + 1; cc < size; cc++) {
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
  for (let rr = r + 1; rr < size; rr++) {
    const t = board[rr]![c];
    if (!t) break;
    down.push(t);
  }
  const horiz = [...left.reverse(), tile, ...right];
  const vert = [...up.reverse(), tile, ...down];
  // only the contiguous run containing `tile` matters — that's the arrays above
  return Boolean(runKind(horiz) || runKind(vert));
}

function fillBoard(seed: string, size: number): { board: (Tile | null)[][]; nextId: number } {
  const rng = mulberry32(hashSeed(`quilt:${seed}`));
  const board: (Tile | null)[][] = Array.from({ length: size }, () =>
    Array.from({ length: size }, () => null)
  );
  let nextId = 1;
  for (let r = 0; r < size; r++) {
    for (let c = 0; c < size; c++) {
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

/**
 * Everything falls, boarded tiles included — they slide down the facade with
 * their boards still on. Anchoring them instead would strand unfillable holes
 * underneath, since nothing above could drop past to fill them.
 */
function gravity(board: (Tile | null)[][], rng: () => number, nextId: number) {
  const size = sizeOf(board);
  let id = nextId;
  for (let c = 0; c < size; c++) {
    const stack: Tile[] = [];
    for (let r = size - 1; r >= 0; r--) {
      const t = board[r]![c];
      if (t) stack.push(t);
    }
    for (let r = size - 1; r >= 0; r--) {
      const fromStack = stack[size - 1 - r];
      board[r]![c] = fromStack ?? makeTile(rng, id++);
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
  const firstCleared: Cell[] = [];

  while (guard++ < 20) {
    const { marked, groups, trueMatches } = findMatches(board);
    if (marked.size === 0) break;

    let clearedCount = 0;
    let boardsStripped = 0;
    let boardsFreed = 0;
    const cleared: Cell[] = [];

    for (const key of marked) {
      const [r, c] = key.split(",").map(Number) as [number, number];
      const tile = board[r]![c];
      if (!tile) continue;
      if (isBoarded(tile)) {
        const left = (tile.boards ?? 0) - 1;
        board[r]![c] = { ...tile, boards: left };
        boardsStripped += 1;
        if (left <= 0) boardsFreed += 1;
        continue;
      }
      progress.byColor[tile.color] += 1;
      progress.byShape[tile.shape] += 1;
      board[r]![c] = null;
      cleared.push({ r, c });
      clearedCount += 1;
    }

    progress.boardsFreed += boardsFreed;

    // Nothing moved and no board came off — stop rather than spin the guard.
    if (clearedCount === 0 && boardsStripped === 0) break;

    if (clearedCount > 0) {
      combo += 1;
      progress.matches += groups.length;
      progress.trueMatches += trueMatches;
      if (guard === 1) firstCleared.push(...cleared);
    }

    const multiplier = Math.max(1, combo);
    score += (clearedCount * 20 + trueMatches * 80 + boardsStripped * 30) * multiplier;
    nextId = gravity(board, rng, nextId);
  }

  return {
    ...state,
    board,
    nextId,
    progress,
    score,
    combo,
    lastCleared: firstCleared,
  };
}

/** Deterministically nail boards onto `count` cells. */
function placeBoards(
  board: (Tile | null)[][],
  seed: string,
  count: number,
  layers: number
) {
  const size = sizeOf(board);
  const cells: Cell[] = [];
  for (let r = 0; r < size; r++) {
    for (let c = 0; c < size; c++) cells.push({ r, c });
  }
  const rng = mulberry32(hashSeed(`quilt-boards:${seed}`));
  for (let i = cells.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    const tmp = cells[i]!;
    cells[i] = cells[j]!;
    cells[j] = tmp;
  }
  for (const cell of cells.slice(0, Math.min(count, cells.length))) {
    const tile = board[cell.r]![cell.c];
    if (tile) board[cell.r]![cell.c] = { ...tile, boards: layers };
  }
}

export function createState(nightId: NightId, seed: string): QuiltState {
  const night = getNight(nightId);
  if (!night) throw new Error("unknown night");
  const size = night.size ?? DEFAULT_BOARD_SIZE;
  const { board, nextId } = fillBoard(seed, size);
  const rng = mulberry32(hashSeed(`quilt-fill:${seed}`));
  const base: QuiltState = {
    nightId,
    seed,
    size,
    board,
    movesLeft: night.moves,
    score: 0,
    combo: 0,
    progress: emptyProgress(),
    nextId,
    failedSwaps: 0,
    lastCleared: [],
  };
  // The opening board should be quiet: settle any accidental runs, then nail
  // the boards on so they can't be cleared before the player has moved.
  const quiet = applyClears({ ...base, score: 0 }, rng);
  const settled = quiet.board.map((row) => row.slice());
  if (night.boards) placeBoards(settled, seed, night.boards, night.boardLayers ?? 1);
  return {
    ...base,
    board: settled,
    nextId: quiet.nextId,
    score: 0,
    combo: 0,
    progress: emptyProgress(),
    lastCleared: [],
  };
}

export function goalsMet(state: QuiltState): boolean {
  const night = getNight(state.nightId);
  if (!night) return false;
  return night.goals.every((g) => goalCount(state, g) >= g.n);
}

export function goalCount(state: QuiltState, g: Goal): number {
  if (g.kind === "matches") return state.progress.matches;
  if (g.kind === "true") return state.progress.trueMatches;
  if (g.kind === "boards") return state.progress.boardsFreed;
  if (g.kind === "score") return state.score;
  if (g.kind === "color") return state.progress.byColor[g.color];
  return state.progress.byShape[g.shape];
}

export function goalLabel(g: Goal): string {
  if (g.kind === "matches") return "matches";
  if (g.kind === "true") return "true stitches";
  if (g.kind === "boards") return "boards off";
  if (g.kind === "score") return "glow";
  if (g.kind === "color") return g.color;
  return `${g.shape}s`;
}

export function findHint(board: (Tile | null)[][]): { a: Cell; b: Cell } | null {
  const size = sizeOf(board);
  const dirs = [
    { dr: 0, dc: 1 },
    { dr: 1, dc: 0 },
  ];
  for (let r = 0; r < size; r++) {
    for (let c = 0; c < size; c++) {
      const here = board[r]![c];
      if (!here || isBoarded(here)) continue;
      for (const { dr, dc } of dirs) {
        const nr = r + dr;
        const nc = c + dc;
        if (!inBounds(nr, nc, size)) continue;
        const there = board[nr]![nc];
        if (!there || isBoarded(there)) continue;
        const copy = board.map((row) => row.slice());
        copy[r]![c] = there;
        copy[nr]![nc] = here;
        if (findMatches(copy).marked.size > 0) {
          return { a: { r, c }, b: { r: nr, c: nc } };
        }
      }
    }
  }
  return null;
}

export type SwapResult =
  | { ok: true; state: QuiltState; cleared: boolean }
  | { ok: false; reason: "not-adjacent" | "no-match" | "no-moves" | "done" | "boarded" };

export function swap(state: QuiltState, a: Cell, b: Cell): SwapResult {
  const size = sizeOf(state.board);
  if (state.movesLeft <= 0) return { ok: false, reason: "no-moves" };
  if (goalsMet(state)) return { ok: false, reason: "done" };
  if (!adjacent(a, b) || !inBounds(a.r, a.c, size) || !inBounds(b.r, b.c, size)) {
    return { ok: false, reason: "not-adjacent" };
  }
  const board = state.board.map((row) => row.slice());
  const ta = board[a.r]![a.c];
  const tb = board[b.r]![b.c];
  if (!ta || !tb) return { ok: false, reason: "no-match" };
  if (isBoarded(ta) || isBoarded(tb)) return { ok: false, reason: "boarded" };
  board[a.r]![a.c] = tb;
  board[b.r]![b.c] = ta;
  const { marked } = findMatches(board);
  if (marked.size === 0) {
    return { ok: false, reason: "no-match" };
  }
  const rng = mulberry32(
    hashSeed(`quilt-play:${state.seed}:${state.movesLeft}:${a.r}${a.c}${b.r}${b.c}`)
  );
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
  if (!Array.isArray(raw) || raw.length > 120) return null;
  const out: QuiltMove[] = [];
  for (const item of raw) {
    if (!item || typeof item !== "object") return null;
    const a = (item as { a?: Cell }).a;
    const b = (item as { b?: Cell }).b;
    if (!a || !b) return null;
    if (![a.r, a.c, b.r, b.c].every((n) => Number.isInteger(n))) return null;
    if (![a.r, a.c, b.r, b.c].every((n) => n >= 0 && n < MAX_BOARD_SIZE)) return null;
    out.push({ a: { r: a.r, c: a.c }, b: { r: b.r, c: b.c } });
  }
  return out;
}
