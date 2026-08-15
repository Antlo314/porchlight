"use server";

import { currentUser } from "@/lib/auth";
import { db } from "@/lib/db";
import {
  gameCreditUsage,
  grantGameReward,
  grantHourlyPlayCredits,
} from "@/lib/games/economy";
import { ensureGameRunTable } from "@/lib/games/ensure";
import { dailySeed, getLevel } from "@/lib/games/levels";
import { parseEvents, validateRun } from "@/lib/games/scoring";
import { issueTicket, mintNonce, readTicket, TICKET_TTL_MS } from "@/lib/games/session";
import { courseLocked, nextCourse } from "@/lib/games/progress";
import { COURSE_ORDER, GAME_ID, isLevelId, RUN_STATUS, type LevelId } from "@/lib/games/types";
import { goalsMet, parseMoves, replay } from "@/lib/quilt/engine";
import { isNightId, STORY_NIGHTS } from "@/lib/quilt/nights";
import { atlantaWeekKey } from "@/lib/quilt/week";
import { recordWeeklyScore, settleLastWeek, weekLeaderboard } from "@/lib/quilt/weekly";

export type StartRunResult =
  | {
      ok: true;
      runId: string;
      nonce: string;
      seed: string;
      token: string;
      demo: boolean;
      remainingToday: number;
    }
  | { ok: false; error: string };

/** Courses the player has actually cleared, in no particular order. */
export async function clearedCourses(userId: string): Promise<LevelId[]> {
  await ensureGameRunTable();
  const rows = await db.gameRun.findMany({
    where: { userId, game: GAME_ID, finished: true },
    select: { levelId: true },
  });
  return [...new Set(rows.map((r) => r.levelId))].filter(isLevelId);
}

export type CourseProgress = {
  cleared: LevelId[];
  next: LevelId;
  demo: boolean;
};

export async function loadCourseProgress(): Promise<CourseProgress> {
  const user = await currentUser().catch(() => null);
  if (!user) return { cleared: [], next: COURSE_ORDER[0]!, demo: true };
  const cleared = await clearedCourses(user.id).catch(() => [] as LevelId[]);
  return { cleared, next: nextCourse(cleared), demo: false };
}

export async function startRunAction(levelId: string): Promise<StartRunResult> {
  if (!isLevelId(levelId)) {
    return { ok: false, error: "That course isn't on the board." };
  }

  const user = await currentUser().catch(() => null);

  // Guests get the first course and the daily; the ladder needs an account to
  // remember what you cleared.
  if (user) {
    const cleared = await clearedCourses(user.id).catch(() => [] as LevelId[]);
    const needs = courseLocked(levelId, cleared);
    if (needs) {
      const name = needs.replace(/-/g, " ");
      return { ok: false, error: `Finish ${name} first — the block opens in order.` };
    }
  } else if (levelId !== COURSE_ORDER[0] && levelId !== "daily") {
    return {
      ok: false,
      error: "Log in to run the later blocks. Kirkwood and the Daily Block are open to guests.",
    };
  }
  const seed =
    levelId === "daily" ? dailySeed(user?.neighborhoodId ?? null) : levelId;
  const nonce = mintNonce();

  try {
    await ensureGameRunTable();
    if (user) {
      await db.gameRun.updateMany({
        where: { userId: user.id, status: RUN_STATUS.STARTED },
        data: { status: RUN_STATUS.REJECTED, rejectReason: "SUPERSEDED" },
      });
    }

    const run = await db.gameRun.create({
      data: {
        userId: user?.id ?? null,
        game: GAME_ID,
        nonce,
        levelId,
        seed,
        status: user ? RUN_STATUS.STARTED : RUN_STATUS.DEMO,
      },
    });

    const token = issueTicket({
      runId: run.id,
      userId: user?.id ?? null,
      nonce,
      levelId,
      seed,
      iat: Date.now(),
    });

    const usage = user
      ? await gameCreditUsage(user.id)
      : { remainingToday: 0 };

    return {
      ok: true,
      runId: run.id,
      nonce,
      seed,
      token,
      demo: !user,
      remainingToday: usage.remainingToday,
    };
  } catch {
    if (user) {
      return { ok: false, error: "The porch ledger is offline right now." };
    }
    const token = issueTicket({
      runId: `demo-${nonce}`,
      userId: null,
      nonce,
      levelId,
      seed,
      iat: Date.now(),
    });
    return {
      ok: true,
      runId: `demo-${nonce}`,
      nonce,
      seed,
      token,
      demo: true,
      remainingToday: 0,
    };
  }
}

export type SubmitRunResult =
  | {
      ok: true;
      score: number;
      coins: number;
      porchesLit: number;
      deaths: number;
      finished: boolean;
      credits: number;
      remainingToday: number;
      demo: boolean;
      reason: string;
    }
  | { ok: false; error: string; code?: string };

export async function submitRunAction(input: {
  token: string;
  events: unknown;
  durationMs: number;
  claimedScore?: number;
}): Promise<SubmitRunResult> {
  const ticket = readTicket(input.token);
  if (!ticket) {
    return { ok: false, error: "That run ticket isn't valid.", code: "BAD_TICKET" };
  }
  if (Date.now() - ticket.iat > TICKET_TTL_MS) {
    return { ok: false, error: "That run sat too long. Start another.", code: "EXPIRED" };
  }
  if (!isLevelId(ticket.levelId)) {
    return { ok: false, error: "That course isn't on the board.", code: "BAD_LEVEL" };
  }

  const events = parseEvents(input.events);
  if (!events) {
    return { ok: false, error: "The run log didn't parse.", code: "BAD_EVENTS" };
  }

  const run = await db.gameRun
    .findUnique({ where: { id: ticket.runId } })
    .catch(() => null);

  if (!run && ticket.userId === null) {
    const level = getLevel(ticket.levelId, ticket.seed);
    const checked = validateRun({
      level,
      events,
      durationMs: input.durationMs,
      claimedScore: input.claimedScore,
    });
    if (!checked.ok) {
      return { ok: false, error: checked.error, code: checked.code };
    }
    return {
      ok: true,
      score: checked.score,
      coins: checked.coins,
      porchesLit: checked.porchesLit,
      deaths: checked.deaths,
      finished: checked.finished,
      credits: 0,
      remainingToday: 0,
      demo: true,
      reason: "DEMO",
    };
  }

  if (!run || run.nonce !== ticket.nonce) {
    return { ok: false, error: "We couldn't find that run.", code: "MISSING" };
  }
  if (run.submittedAt || (run.status !== RUN_STATUS.STARTED && run.status !== RUN_STATUS.DEMO)) {
    return { ok: false, error: "That run was already turned in.", code: "REPLAY" };
  }
  if (run.levelId !== ticket.levelId || run.seed !== ticket.seed) {
    return { ok: false, error: "The ticket doesn't match the run.", code: "MISMATCH" };
  }

  const user = await currentUser();
  if (run.userId && (!user || user.id !== run.userId)) {
    return { ok: false, error: "That run belongs to someone else.", code: "AUTH" };
  }
  if (ticket.userId && (!user || user.id !== ticket.userId)) {
    return { ok: false, error: "Sign back in to keep these credits.", code: "AUTH" };
  }

  const level = getLevel(ticket.levelId, ticket.seed);
  const checked = validateRun({
    level,
    events,
    durationMs: input.durationMs,
    claimedScore: input.claimedScore,
  });

  if (!checked.ok) {
    await db.gameRun.update({
      where: { id: run.id },
      data: {
        submittedAt: new Date(),
        durationMs: Math.floor(input.durationMs),
        status: RUN_STATUS.REJECTED,
        rejectReason: checked.code,
        clientMeta: JSON.stringify({ n: events.length }),
      },
    });
    return { ok: false, error: checked.error, code: checked.code };
  }

  const demo = !run.userId || !user;
  await db.gameRun.update({
    where: { id: run.id },
    data: {
      submittedAt: new Date(),
      durationMs: Math.floor(input.durationMs),
      score: checked.score,
      porchesLit: checked.porchesLit,
      coins: checked.coins,
      deaths: checked.deaths,
      finished: checked.finished,
      status: demo ? RUN_STATUS.DEMO : RUN_STATUS.STARTED,
      clientMeta: JSON.stringify({ jumps: checked.jumps }),
    },
  });

  if (demo) {
    return {
      ok: true,
      score: checked.score,
      coins: checked.coins,
      porchesLit: checked.porchesLit,
      deaths: checked.deaths,
      finished: checked.finished,
      credits: 0,
      remainingToday: 0,
      demo: true,
      reason: "DEMO",
    };
  }

  const grant = await grantGameReward({
    userId: user.id,
    runId: run.id,
    levelId: ticket.levelId,
    score: checked.score,
    porchesLit: checked.porchesLit,
    finished: checked.finished,
  });

  return {
    ok: true,
    score: checked.score,
    coins: checked.coins,
    porchesLit: checked.porchesLit,
    deaths: checked.deaths,
    finished: checked.finished,
    credits: grant.credits,
    remainingToday: grant.remainingToday,
    demo: false,
    reason: grant.reason,
  };
}

const QUILT_GAME = "EMBER_QUILT";

export async function startQuiltAction(nightId: string) {
  if (!isNightId(nightId)) {
    return { ok: false as const, error: "That night isn't on the quilt." };
  }
  const user = await currentUser().catch(() => null);
  const lock = await quiltLock(user?.id ?? null, nightId);
  if (lock) return { ok: false as const, error: lock };
  const seed =
    nightId === "weekly"
      ? `weekly:${atlantaWeekKey()}:${user?.neighborhoodId ?? "atl"}`
      : `${nightId}:v1`;
  const nonce = mintNonce();
  try {
    await ensureGameRunTable();
    const run = await db.gameRun.create({
      data: {
        userId: user?.id ?? null,
        game: QUILT_GAME,
        nonce,
        levelId: nightId,
        seed,
        status: user ? RUN_STATUS.STARTED : RUN_STATUS.DEMO,
      },
    });
    const token = issueTicket({
      runId: run.id,
      userId: user?.id ?? null,
      nonce,
      levelId: nightId,
      seed,
      iat: Date.now(),
    });
    return {
      ok: true as const,
      seed,
      token,
      demo: !user,
      nightId,
    };
  } catch {
    if (nightId !== "night-0") {
      return {
        ok: false as const,
        error: "Couldn't start that night. Try Night 0 from the hub.",
      };
    }
    const token = issueTicket({
      runId: `demo-${nonce}`,
      userId: null,
      nonce,
      levelId: nightId,
      seed,
      iat: Date.now(),
    });
    return {
      ok: true as const,
      seed,
      token,
      demo: true,
      nightId,
    };
  }
}

export async function submitQuiltAction(input: {
  token: string;
  moves: unknown;
  claimedScore: number;
}) {
  const ticket = readTicket(input.token);
  if (!ticket || !isNightId(ticket.levelId)) {
    return { ok: false as const, error: "That run ticket isn't valid." };
  }
  const moves = parseMoves(input.moves);
  if (!moves) return { ok: false as const, error: "Those moves didn't parse." };

  const final = replay(ticket.levelId, ticket.seed, moves);
  if (final.score !== input.claimedScore) {
    return { ok: false as const, error: "The score didn't match the quilt." };
  }

  const user = await currentUser().catch(() => null);
  const won = goalsMet(final);
  if (user && ticket.userId === user.id) {
    try {
      await ensureGameRunTable();
      await db.gameRun.updateMany({
        where: { id: ticket.runId, userId: user.id },
        data: {
          submittedAt: new Date(),
          score: final.score,
          finished: won,
          status: RUN_STATUS.AWARDED,
        },
      });
    } catch {
      /* table may still be coming up */
    }
    if (won) {
      await grantHourlyPlayCredits({
        userId: user.id,
        runId: ticket.runId,
        amount: 3,
      }).catch(() => 0);
    }
    if (ticket.levelId === "weekly") {
      try {
        await recordWeeklyScore(user.id, final.score);
      } catch {
        /* table may still be coming up */
      }
    }
  }

  return {
    ok: true as const,
    score: final.score,
    won,
    demo: !user,
    movesLeft: final.movesLeft,
  };
}

async function clearedStoryNights(userId: string): Promise<string[]> {
  await ensureGameRunTable();
  const rows = await db.gameRun.findMany({
    where: {
      userId,
      game: QUILT_GAME,
      finished: true,
      levelId: { in: STORY_NIGHTS.map((n) => n.id) },
    },
    select: { levelId: true },
  });
  return [...new Set(rows.map((r) => r.levelId))];
}

async function quiltLock(userId: string | null, nightId: string) {
  if (nightId === "night-0") return null;
  if (!userId) {
    return "Log in to play later nights. Night 0 is open as a guest.";
  }
  const cleared = await clearedStoryNights(userId).catch(() => [] as string[]);
  if (nightId === "weekly") {
    return cleared.includes("night-0")
      ? null
      : "Finish Night 0 with Ember first, then this week's porch opens.";
  }
  const storyIndex = STORY_NIGHTS.findIndex((n) => n.id === nightId);
  if (storyIndex <= 0) return null;
  const prev = STORY_NIGHTS[storyIndex - 1]!;
  return cleared.includes(prev.id)
    ? null
    : `Finish ${prev.title} first. Nights unlock in order.`;
}

export async function loadQuiltHub() {
  try {
    await settleLastWeek();
  } catch {
    /* first load without tables */
  }
  const user = await currentUser().catch(() => null);
  const cleared = user
    ? await clearedStoryNights(user.id).catch(() => [] as string[])
    : [];
  try {
    const board = await weekLeaderboard();
    return { weekKey: atlantaWeekKey(), board, cleared };
  } catch {
    return { weekKey: atlantaWeekKey(), board: [], cleared };
  }
}
