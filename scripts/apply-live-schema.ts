/**
 * Adds Calm Safety + Storm Mode columns/tables if they are missing.
 * Does not drop anything. Safe to run on every production build.
 */
import { PrismaClient } from "@prisma/client";

const db = new PrismaClient();

const STATEMENTS = [
  `ALTER TABLE "Post" ADD COLUMN IF NOT EXISTS "expiresAt" TIMESTAMP(3)`,
  `ALTER TABLE "Neighborhood" ADD COLUMN IF NOT EXISTS "stormActive" BOOLEAN NOT NULL DEFAULT false`,
  `ALTER TABLE "Neighborhood" ADD COLUMN IF NOT EXISTS "stormActivatedAt" TIMESTAMP(3)`,
  `CREATE TABLE IF NOT EXISTS "SafetyDetail" (
    "postId" TEXT NOT NULL,
    "location" TEXT NOT NULL,
    "happenedAt" TIMESTAMP(3),
    "about" TEXT NOT NULL DEFAULT 'INCIDENT',
    "expiresAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "SafetyDetail_pkey" PRIMARY KEY ("postId")
  )`,
  `DO $$ BEGIN
    ALTER TABLE "SafetyDetail"
      ADD CONSTRAINT "SafetyDetail_postId_fkey"
      FOREIGN KEY ("postId") REFERENCES "Post"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  EXCEPTION WHEN duplicate_object THEN NULL;
  END $$`,
  `CREATE TABLE IF NOT EXISTS "StormCheckIn" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "neighborhoodId" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "resource" TEXT,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "StormCheckIn_pkey" PRIMARY KEY ("id")
  )`,
  `CREATE UNIQUE INDEX IF NOT EXISTS "StormCheckIn_userId_neighborhoodId_key"
    ON "StormCheckIn"("userId", "neighborhoodId")`,
  `CREATE INDEX IF NOT EXISTS "StormCheckIn_neighborhoodId_status_idx"
    ON "StormCheckIn"("neighborhoodId", "status")`,
  `DO $$ BEGIN
    ALTER TABLE "StormCheckIn"
      ADD CONSTRAINT "StormCheckIn_userId_fkey"
      FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  EXCEPTION WHEN duplicate_object THEN NULL;
  END $$`,
  `DO $$ BEGIN
    ALTER TABLE "StormCheckIn"
      ADD CONSTRAINT "StormCheckIn_neighborhoodId_fkey"
      FOREIGN KEY ("neighborhoodId") REFERENCES "Neighborhood"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  EXCEPTION WHEN duplicate_object THEN NULL;
  END $$`,
];

async function main() {
  for (const sql of STATEMENTS) {
    await db.$executeRawUnsafe(sql);
  }
  console.log("Live schema: storm/safety columns are present.");
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
