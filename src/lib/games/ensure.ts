import { db } from "@/lib/db";

let tableReady = false;

/** Production was bootstrapped with SQL, not migrate history. Create GameRun if missing. */
export async function ensureGameRunTable() {
  if (tableReady) return;
  await db.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS "GameRun" (
      "id" TEXT NOT NULL,
      "userId" TEXT,
      "game" TEXT NOT NULL,
      "nonce" TEXT NOT NULL,
      "levelId" TEXT NOT NULL,
      "seed" TEXT NOT NULL,
      "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "submittedAt" TIMESTAMP(3),
      "durationMs" INTEGER,
      "score" INTEGER,
      "porchesLit" INTEGER,
      "coins" INTEGER,
      "deaths" INTEGER,
      "finished" BOOLEAN NOT NULL DEFAULT false,
      "creditsAwarded" INTEGER NOT NULL DEFAULT 0,
      "status" TEXT NOT NULL,
      "rejectReason" TEXT,
      "clientMeta" TEXT,
      CONSTRAINT "GameRun_pkey" PRIMARY KEY ("id")
    )
  `);
  await db.$executeRawUnsafe(
    `CREATE UNIQUE INDEX IF NOT EXISTS "GameRun_nonce_key" ON "GameRun"("nonce")`
  );
  await db.$executeRawUnsafe(
    `CREATE INDEX IF NOT EXISTS "GameRun_userId_startedAt_idx" ON "GameRun"("userId", "startedAt")`
  );
  await db.$executeRawUnsafe(
    `CREATE INDEX IF NOT EXISTS "GameRun_status_startedAt_idx" ON "GameRun"("status", "startedAt")`
  );
  await db.$executeRawUnsafe(`
    DO $$ BEGIN
      ALTER TABLE "GameRun"
        ADD CONSTRAINT "GameRun_userId_fkey"
        FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    EXCEPTION WHEN duplicate_object THEN NULL;
    END $$
  `);
  tableReady = true;
}
