import { getLevel } from "./levels";
import type { LevelDef, LevelId, RunEvent } from "./types";

export const COIN_POINTS = 50;
export const PORCH_POINTS = 120;
export const FINISH_POINTS = 200;

export const SCORE_TIER_LOW = 200;
export const SCORE_TIER_MID = 800;
export const SCORE_TIER_HIGH = 1600;
export const PORCH_TIER_MID = 8;

const MAX_EVENTS = 400;
const MAX_JUMPS_PER_SEC = 6;

export type ScoreBreakdown = {
  score: number;
  coins: number;
  porchesLit: number;
  deaths: number;
  finished: boolean;
  jumps: number;
};

export type ValidationFail = {
  ok: false;
  code:
    | "BAD_EVENTS"
    | "TOO_FAST"
    | "UNKNOWN_ID"
    | "DUP_COLLECT"
    | "SCORE_MISMATCH"
    | "IMPOSSIBLE";
  error: string;
};

export type ValidationOk = { ok: true } & ScoreBreakdown;

export function comboBonus(porchesLit: number): number {
  if (porchesLit < 2) return 0;
  return (porchesLit * (porchesLit - 1) * 20) / 2;
}

export function scoreFromCounts(opts: {
  coins: number;
  porchesLit: number;
  finished: boolean;
}): number {
  return (
    opts.coins * COIN_POINTS +
    opts.porchesLit * PORCH_POINTS +
    (opts.finished ? FINISH_POINTS : 0) +
    comboBonus(opts.porchesLit)
  );
}

export function creditsForRun(opts: {
  score: number;
  porchesLit: number;
  finished: boolean;
  levelId: LevelId;
}): number {
  const { score, porchesLit, finished, levelId } = opts;
  if (score >= SCORE_TIER_HIGH || (levelId === "daily" && finished)) return 3;
  if (score >= SCORE_TIER_MID || porchesLit >= PORCH_TIER_MID) return 2;
  if (score >= SCORE_TIER_LOW || finished) return 1;
  return 0;
}

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null;
}

export function parseEvents(raw: unknown): RunEvent[] | null {
  if (!Array.isArray(raw) || raw.length > MAX_EVENTS) return null;
  const out: RunEvent[] = [];
  let lastT = -1;
  for (const item of raw) {
    if (!isRecord(item)) return null;
    const t = item.t;
    const k = item.k;
    if (typeof t !== "number" || !Number.isFinite(t) || t < 0) return null;
    if (t + 1e-6 < lastT) return null;
    if (k !== "porch" && k !== "coin" && k !== "die" && k !== "finish" && k !== "jump") {
      return null;
    }
    if ((k === "porch" || k === "coin") && typeof item.id !== "string") return null;
    if (typeof item.id === "string" && item.id.length > 32) return null;
    out.push({
      t,
      k,
      ...(typeof item.id === "string" ? { id: item.id } : {}),
    });
    lastT = t;
  }
  return out;
}

export function validateRun(opts: {
  level: LevelDef;
  events: RunEvent[];
  durationMs: number;
  claimedScore?: number;
}): ValidationOk | ValidationFail {
  const { level, events, durationMs } = opts;

  if (!Number.isFinite(durationMs) || durationMs < 0 || durationMs > 15 * 60_000) {
    return { ok: false, code: "BAD_EVENTS", error: "That run clock looks wrong." };
  }
  if (durationMs < level.minDurationMs) {
    return {
      ok: false,
      code: "TOO_FAST",
      error: "That finish was quicker than the block allows.",
    };
  }

  const porchIds = new Set(level.porches.map((p) => p.id));
  const coinIds = new Set(level.coins.map((c) => c.id));
  const seenPorch = new Set<string>();
  const seenCoin = new Set<string>();
  let deaths = 0;
  let finished = false;
  let jumps = 0;

  for (const ev of events) {
    if (ev.t > durationMs + 250) {
      return { ok: false, code: "BAD_EVENTS", error: "An event landed after the clock." };
    }
    if (ev.k === "jump") {
      jumps += 1;
      continue;
    }
    if (ev.k === "die") {
      deaths += 1;
      continue;
    }
    if (ev.k === "finish") {
      finished = true;
      continue;
    }
    if (ev.k === "porch") {
      if (!ev.id || !porchIds.has(ev.id)) {
        return { ok: false, code: "UNKNOWN_ID", error: "Lit a porch that isn't on this block." };
      }
      if (seenPorch.has(ev.id)) {
        return { ok: false, code: "DUP_COLLECT", error: "The same porch was lit twice." };
      }
      seenPorch.add(ev.id);
      continue;
    }
    if (ev.k === "coin") {
      if (!ev.id || !coinIds.has(ev.id)) {
        return { ok: false, code: "UNKNOWN_ID", error: "Collected a coin that isn't on this block." };
      }
      if (seenCoin.has(ev.id)) {
        return { ok: false, code: "DUP_COLLECT", error: "The same coin was grabbed twice." };
      }
      seenCoin.add(ev.id);
    }
  }

  const seconds = Math.max(1, durationMs / 1000);
  if (jumps / seconds > MAX_JUMPS_PER_SEC) {
    return { ok: false, code: "IMPOSSIBLE", error: "Too many jumps for that clock." };
  }
  if (deaths > 12) {
    return { ok: false, code: "IMPOSSIBLE", error: "Too many snuffs for one run." };
  }

  const coins = seenCoin.size;
  const porchesLit = seenPorch.size;
  const score = scoreFromCounts({ coins, porchesLit, finished });

  if (opts.claimedScore !== undefined && opts.claimedScore !== score) {
    return { ok: false, code: "SCORE_MISMATCH", error: "The score didn't match the run." };
  }

  return { ok: true, score, coins, porchesLit, deaths, finished, jumps };
}

export function levelForRun(levelId: LevelId, seed: string): LevelDef {
  return getLevel(levelId, seed);
}
