import { db } from "@/lib/db";
import { notify } from "@/lib/notify";
import { atlantaWeekKey, previousWeekKey, WEEKLY_PRIZE_REASON, WEEKLY_PRIZES } from "./week";

let tablesReady = false;

export async function ensureWeeklyTables() {
  if (tablesReady) return;
  await db.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS "WeeklyScore" (
      "id" TEXT NOT NULL,
      "userId" TEXT NOT NULL,
      "weekKey" TEXT NOT NULL,
      "score" INTEGER NOT NULL,
      "submittedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT "WeeklyScore_pkey" PRIMARY KEY ("id")
    )
  `);
  await db.$executeRawUnsafe(
    `CREATE UNIQUE INDEX IF NOT EXISTS "WeeklyScore_userId_weekKey_key" ON "WeeklyScore"("userId", "weekKey")`
  );
  await db.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS "WeeklyPrize" (
      "id" TEXT NOT NULL,
      "weekKey" TEXT NOT NULL,
      "place" INTEGER NOT NULL,
      "userId" TEXT NOT NULL,
      "credits" INTEGER NOT NULL,
      "paidAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT "WeeklyPrize_pkey" PRIMARY KEY ("id")
    )
  `);
  await db.$executeRawUnsafe(
    `CREATE UNIQUE INDEX IF NOT EXISTS "WeeklyPrize_weekKey_place_key" ON "WeeklyPrize"("weekKey", "place")`
  );
  tablesReady = true;
}

export type BoardRow = {
  place: number;
  userId: string;
  name: string;
  neighborhood: string;
  score: number;
};

function publicName(name: string) {
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0]!;
  return `${parts[0]} ${parts[parts.length - 1]![0]!.toUpperCase()}.`;
}

export async function recordWeeklyScore(userId: string, score: number) {
  if (score <= 0) return;
  await ensureWeeklyTables();
  const weekKey = atlantaWeekKey();
  const existing = await db.$queryRawUnsafe<
    { id: string; score: number }[]
  >(
    `SELECT "id", "score" FROM "WeeklyScore" WHERE "userId" = $1 AND "weekKey" = $2 LIMIT 1`,
    userId,
    weekKey
  );
  if (existing[0]) {
    if (score > existing[0].score) {
      await db.$executeRawUnsafe(
        `UPDATE "WeeklyScore" SET "score" = $1, "submittedAt" = NOW() WHERE "id" = $2`,
        score,
        existing[0].id
      );
    }
    return;
  }
  const id = `ws_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
  await db.$executeRawUnsafe(
    `INSERT INTO "WeeklyScore" ("id", "userId", "weekKey", "score") VALUES ($1, $2, $3, $4)`,
    id,
    userId,
    weekKey,
    score
  );
}

export async function weekLeaderboard(weekKey = atlantaWeekKey()): Promise<BoardRow[]> {
  await ensureWeeklyTables();
  const rows = await db.$queryRawUnsafe<
    { userId: string; score: number; name: string; neighborhood: string }[]
  >(
    `SELECT s."userId", s."score", u."name", n."name" as neighborhood
     FROM "WeeklyScore" s
     JOIN "User" u ON u."id" = s."userId"
     JOIN "Neighborhood" n ON n."id" = u."neighborhoodId"
     WHERE s."weekKey" = $1
     ORDER BY s."score" DESC, s."submittedAt" ASC
     LIMIT 20`,
    weekKey
  );
  return rows.map((r, i) => ({
    place: i + 1,
    userId: r.userId,
    name: publicName(r.name),
    neighborhood: r.neighborhood,
    score: r.score,
  }));
}

export async function settleLastWeek() {
  await ensureWeeklyTables();
  const last = previousWeekKey(atlantaWeekKey());
  const already = await db.$queryRawUnsafe<{ n: number }[]>(
    `SELECT COUNT(*)::int as n FROM "WeeklyPrize" WHERE "weekKey" = $1`,
    last
  );
  if ((already[0]?.n ?? 0) > 0) return { weekKey: last, paid: 0 };

  const top = await weekLeaderboard(last);
  let paid = 0;
  for (let i = 0; i < 3; i++) {
    const row = top[i];
    const credits = WEEKLY_PRIZES[i];
    if (!row || !credits) continue;
    const prizeId = `wp_${last}_${i + 1}`;
    try {
      await db.$transaction(async (tx) => {
        await tx.user.update({
          where: { id: row.userId },
          data: { updatedAt: new Date() },
        });
        await tx.$executeRawUnsafe(
          `INSERT INTO "WeeklyPrize" ("id", "weekKey", "place", "userId", "credits") VALUES ($1, $2, $3, $4, $5)`,
          prizeId,
          last,
          i + 1,
          row.userId,
          credits
        );
        await tx.tradeCreditEntry.create({
          data: {
            userId: row.userId,
            delta: credits,
            reason: WEEKLY_PRIZE_REASON,
          },
        });
      });
      await notify({
        userId: row.userId,
        type: "SYSTEM",
        payload: {
          href: "/barter/credits",
          text: `You placed ${i + 1}${["st", "nd", "rd"][i]} on last week's Ember's Quilt — +${credits} Porch Credits.`,
        },
      });
      paid += 1;
    } catch {
      // unique place already paid
    }
  }
  return { weekKey: last, paid };
}
