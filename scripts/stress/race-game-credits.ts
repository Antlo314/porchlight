/**
 * Two submit-shaped grants at the same instant must not pay past the daily cap.
 *
 *   npx tsx scripts/stress/race-game-credits.ts
 */
import { PrismaClient } from "@prisma/client";
import { DAILY_CAP, GAME_REWARD, grantGameReward } from "../../src/lib/games/economy";
import { RUN_STATUS } from "../../src/lib/games/types";

const db = new PrismaClient();
let failures = 0;
function check(label: string, ok: boolean, detail = "") {
  if (ok) console.log(`  ok   ${label}`);
  else {
    failures++;
    console.log(`  FAIL ${label}${detail ? ` — ${detail}` : ""}`);
  }
}

async function main() {
  console.log("\nGame credit race\n");
  const hood = await db.neighborhood.findFirstOrThrow();
  const user = await db.user.create({
    data: {
      email: `race-game-${Date.now()}@example.test`,
      name: "[race] Gamer",
      passwordHash: "x",
      neighborhoodId: hood.id,
    },
  });

  const runs = await Promise.all(
    Array.from({ length: 8 }, (_, i) =>
      db.gameRun.create({
        data: {
          userId: user.id,
          game: "LIGHT_THE_BLOCK",
          nonce: `race-${Date.now()}-${i}`,
          levelId: "east-atlanta",
          seed: "east-atlanta",
          status: RUN_STATUS.STARTED,
        },
      })
    )
  );

  const results = await Promise.all(
    runs.map((run) =>
      grantGameReward({
        userId: user.id,
        runId: run.id,
        levelId: "east-atlanta",
        score: 2000,
        porchesLit: 9,
        finished: true,
      })
    )
  );

  const paid = results.reduce((n, r) => n + r.credits, 0);
  const ledger = await db.tradeCreditEntry.aggregate({
    where: { userId: user.id, reason: GAME_REWARD },
    _sum: { delta: true },
  });
  const summed = ledger._sum.delta ?? 0;

  check("burst payout equals ledger", paid === summed, `${paid} vs ${summed}`);
  check("burst never exceeds daily cap", summed <= DAILY_CAP, `paid ${summed}`);

  await db.tradeCreditEntry.deleteMany({ where: { userId: user.id } });
  await db.notification.deleteMany({ where: { userId: user.id } });
  await db.gameRun.deleteMany({ where: { userId: user.id } });
  await db.user.delete({ where: { id: user.id } });

  console.log(failures === 0 ? "\n✅ race held\n" : `\n❌ ${failures} failed\n`);
  if (failures) process.exitCode = 1;
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
