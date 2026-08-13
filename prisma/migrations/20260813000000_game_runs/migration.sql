-- Light the Block: one row per attempt. Guest runs have no userId.
CREATE TABLE "GameRun" (
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
);

CREATE UNIQUE INDEX "GameRun_nonce_key" ON "GameRun"("nonce");
CREATE INDEX "GameRun_userId_startedAt_idx" ON "GameRun"("userId", "startedAt");
CREATE INDEX "GameRun_status_startedAt_idx" ON "GameRun"("status", "startedAt");

ALTER TABLE "GameRun" ADD CONSTRAINT "GameRun_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
