-- Porchlight — add the Wants table
--
-- Paste into Neon's SQL Editor and press Run.
--
-- Safe on a live database with real members: it only ADDS a table and touches
-- nothing that already exists. Safe to run twice as well — every statement is
-- guarded, so a second run reports success instead of "already exists".

CREATE TABLE IF NOT EXISTS "Want" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "neighborhoodId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "kind" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "creditOffer" INTEGER,
    "status" TEXT NOT NULL DEFAULT 'OPEN',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Want_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "Want_neighborhoodId_status_createdAt_idx"
    ON "Want"("neighborhoodId", "status", "createdAt");

-- Foreign keys have no IF NOT EXISTS, so add them only when missing.
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'Want_userId_fkey'
    ) THEN
        ALTER TABLE "Want" ADD CONSTRAINT "Want_userId_fkey"
            FOREIGN KEY ("userId") REFERENCES "User"("id")
            ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'Want_neighborhoodId_fkey'
    ) THEN
        ALTER TABLE "Want" ADD CONSTRAINT "Want_neighborhoodId_fkey"
            FOREIGN KEY ("neighborhoodId") REFERENCES "Neighborhood"("id")
            ON DELETE RESTRICT ON UPDATE CASCADE;
    END IF;
END $$;

-- Should report 0 rows in a brand new table, and no error.
SELECT COUNT(*) AS wants_table_ready FROM "Want";
