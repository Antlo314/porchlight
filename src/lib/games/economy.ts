// Game credit drip. Same invariants as the rest of the ledger: append-only,
// never a stored balance, never trust the client for a delta, lock the User
// row before counting today's GAME_REWARD rows.
import { db } from "@/lib/db";
import type { Prisma } from "@prisma/client";
import { notify } from "@/lib/notify";
import { creditsForRun } from "./scoring";
import { GAME_ID, RUN_STATUS, type LevelId } from "./types";

export const GAME_REWARD = "GAME_REWARD";
export const DAILY_CAP = 5;
export const LIFETIME_CAP = 150;
export const COOLDOWN_MS = 90_000;
export const FIRST_KIRKWOOD_BONUS = 3;

export function windowStart(at = new Date()): Date {
  return new Date(at.getTime() - 24 * 60 * 60 * 1000);
}

type Tx = Prisma.TransactionClient;

async function lockUser(tx: Tx, userId: string) {
  await tx.user.update({
    where: { id: userId },
    data: { updatedAt: new Date() },
  });
}

export async function gameCreditUsage(userId: string, at = new Date()) {
  const [lifetimeAgg, recentAgg, lastAward] = await Promise.all([
    db.tradeCreditEntry.aggregate({
      where: { userId, reason: GAME_REWARD, delta: { gt: 0 } },
      _sum: { delta: true },
    }),
    db.tradeCreditEntry.aggregate({
      where: {
        userId,
        reason: GAME_REWARD,
        delta: { gt: 0 },
        createdAt: { gte: windowStart(at) },
      },
      _sum: { delta: true },
    }),
    db.gameRun.findFirst({
      where: { userId, status: RUN_STATUS.AWARDED, creditsAwarded: { gt: 0 } },
      orderBy: { submittedAt: "desc" },
      select: { submittedAt: true },
    }),
  ]);
  const lifetime = lifetimeAgg._sum.delta ?? 0;
  const today = recentAgg._sum.delta ?? 0;
  return {
    lifetime,
    today,
    remainingToday: Math.max(0, DAILY_CAP - today),
    remainingLifetime: Math.max(0, LIFETIME_CAP - lifetime),
    lastAwardedAt: lastAward?.submittedAt ?? null,
  };
}

export type GrantInput = {
  userId: string;
  runId: string;
  levelId: LevelId;
  score: number;
  porchesLit: number;
  finished: boolean;
};

export type GrantResult = {
  credits: number;
  reason:
    | "AWARDED"
    | "NO_SCORE"
    | "DAILY_CAP"
    | "LIFETIME_CAP"
    | "COOLDOWN"
    | "DEMO";
  remainingToday: number;
};

export async function grantGameReward(input: GrantInput): Promise<GrantResult> {
  const empty = (reason: GrantResult["reason"], remainingToday: number): GrantResult => ({
    credits: 0,
    reason,
    remainingToday,
  });

  const result = await db.$transaction(async (tx) => {
    await lockUser(tx, input.userId);

    const [lifetimeAgg, recentAgg, lastAward, priorKirkwood] = await Promise.all([
      tx.tradeCreditEntry.aggregate({
        where: { userId: input.userId, reason: GAME_REWARD, delta: { gt: 0 } },
        _sum: { delta: true },
      }),
      tx.tradeCreditEntry.aggregate({
        where: {
          userId: input.userId,
          reason: GAME_REWARD,
          delta: { gt: 0 },
          createdAt: { gte: windowStart() },
        },
        _sum: { delta: true },
      }),
      tx.gameRun.findFirst({
        where: {
          userId: input.userId,
          status: RUN_STATUS.AWARDED,
          creditsAwarded: { gt: 0 },
          id: { not: input.runId },
        },
        orderBy: { submittedAt: "desc" },
        select: { submittedAt: true },
      }),
      tx.gameRun.findFirst({
        where: {
          userId: input.userId,
          levelId: "kirkwood",
          finished: true,
          status: RUN_STATUS.AWARDED,
          id: { not: input.runId },
        },
        select: { id: true },
      }),
    ]);

    const lifetime = lifetimeAgg._sum.delta ?? 0;
    const today = recentAgg._sum.delta ?? 0;
    const remainingToday = Math.max(0, DAILY_CAP - today);
    const remainingLifetime = Math.max(0, LIFETIME_CAP - lifetime);

    let payout = creditsForRun({
      score: input.score,
      porchesLit: input.porchesLit,
      finished: input.finished,
      levelId: input.levelId,
    });

    if (
      input.levelId === "kirkwood" &&
      input.finished &&
      !priorKirkwood
    ) {
      payout += FIRST_KIRKWOOD_BONUS;
    }

    if (payout <= 0) {
      await tx.gameRun.update({
        where: { id: input.runId },
        data: { creditsAwarded: 0, status: RUN_STATUS.AWARDED },
      });
      return empty("NO_SCORE", remainingToday);
    }

    if (remainingToday <= 0) {
      await tx.gameRun.update({
        where: { id: input.runId },
        data: { creditsAwarded: 0, status: RUN_STATUS.AWARDED },
      });
      return empty("DAILY_CAP", 0);
    }

    if (remainingLifetime <= 0) {
      await tx.gameRun.update({
        where: { id: input.runId },
        data: { creditsAwarded: 0, status: RUN_STATUS.AWARDED },
      });
      return empty("LIFETIME_CAP", remainingToday);
    }

    if (lastAward?.submittedAt) {
      const elapsed = Date.now() - lastAward.submittedAt.getTime();
      if (elapsed < COOLDOWN_MS) {
        await tx.gameRun.update({
          where: { id: input.runId },
          data: { creditsAwarded: 0, status: RUN_STATUS.AWARDED },
        });
        return empty("COOLDOWN", remainingToday);
      }
    }

    const credits = Math.min(payout, remainingToday, remainingLifetime);

    await tx.tradeCreditEntry.create({
      data: {
        userId: input.userId,
        delta: credits,
        reason: GAME_REWARD,
      },
    });
    await tx.gameRun.update({
      where: { id: input.runId },
      data: { creditsAwarded: credits, status: RUN_STATUS.AWARDED },
    });

    return { credits, reason: "AWARDED" as const, remainingToday: remainingToday - credits };
  });

  if (result.credits > 0) {
    await notify({
      userId: input.userId,
      type: "SYSTEM",
      payload: {
        href: "/barter/credits",
        text: `You earned ${result.credits} Porch Credit${result.credits === 1 ? "" : "s"} on Light the Block.`,
      },
    });
  }

  return result;
}

export { GAME_ID };
