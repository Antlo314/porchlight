-- Calm Safety + Storm Mode

ALTER TABLE "Post" ADD COLUMN "expiresAt" TIMESTAMP(3);

CREATE TABLE "SafetyDetail" (
    "postId" TEXT NOT NULL,
    "location" TEXT NOT NULL,
    "happenedAt" TIMESTAMP(3),
    "about" TEXT NOT NULL DEFAULT 'INCIDENT',
    "expiresAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SafetyDetail_pkey" PRIMARY KEY ("postId")
);

ALTER TABLE "SafetyDetail" ADD CONSTRAINT "SafetyDetail_postId_fkey" FOREIGN KEY ("postId") REFERENCES "Post"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "Neighborhood" ADD COLUMN "stormActive" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Neighborhood" ADD COLUMN "stormActivatedAt" TIMESTAMP(3);

CREATE TABLE "StormCheckIn" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "neighborhoodId" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "resource" TEXT,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StormCheckIn_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "StormCheckIn_userId_neighborhoodId_key" ON "StormCheckIn"("userId", "neighborhoodId");
CREATE INDEX "StormCheckIn_neighborhoodId_status_idx" ON "StormCheckIn"("neighborhoodId", "status");

ALTER TABLE "StormCheckIn" ADD CONSTRAINT "StormCheckIn_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "StormCheckIn" ADD CONSTRAINT "StormCheckIn_neighborhoodId_fkey" FOREIGN KEY ("neighborhoodId") REFERENCES "Neighborhood"("id") ON DELETE CASCADE ON UPDATE CASCADE;
