-- CreateTable
CREATE TABLE "Want" (
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

-- CreateIndex
CREATE INDEX "Want_neighborhoodId_status_createdAt_idx" ON "Want"("neighborhoodId", "status", "createdAt");

-- AddForeignKey
ALTER TABLE "Want" ADD CONSTRAINT "Want_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Want" ADD CONSTRAINT "Want_neighborhoodId_fkey" FOREIGN KEY ("neighborhoodId") REFERENCES "Neighborhood"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
