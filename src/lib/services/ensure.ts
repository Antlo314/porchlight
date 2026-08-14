import { db } from "@/lib/db";

let ready = false;

export async function ensureServiceListingCredits() {
  if (ready) return;
  await db.$executeRawUnsafe(`
    ALTER TABLE "ServiceListing"
      ADD COLUMN IF NOT EXISTS "acceptsCredits" BOOLEAN NOT NULL DEFAULT false
  `);
  ready = true;
}
