"use server";

import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { createServiceListingSchema } from "@/lib/validators";
import { z } from "zod";

// Reuse the id validator that already exists in validators.ts rather than
// re-deriving a second one that could drift.
const businessIdSchema = createServiceListingSchema.shape.businessId;
const businessIdsSchema = z.array(businessIdSchema).min(1).max(24);

/**
 * Ad-Boost delivery metrics. These are the numbers the owner dashboard reports
 * and the Ad-Boost Pool is audited on, so they have to survive an adversary.
 *
 * Scoping the write to a currently-live boost constrains WHICH rows can be
 * written, not WHO may write them — on its own that still lets any signed-in
 * member sit in a loop inflating a counter. Two things make the number real:
 *
 *   1. A BoostEvent row keyed @@unique([boostId, userId, kind, day]) — a
 *      replayed or scripted call collides and is dropped, so a viewer counts
 *      at most once per boost per day.
 *   2. Owners are excluded, so a business can't manufacture its own delivery
 *      numbers and justify the pool spend.
 *
 * Note the deliberate absence of revalidatePath("/services"): revalidating the
 * page that fires the impression would re-render it, re-fire the impression,
 * and loop. Only the dashboard that displays the totals is revalidated.
 */
async function recordBoostEvents(opts: {
  userId: string;
  businessIds: string[];
  kind: "IMPRESSION" | "CLICK";
}) {
  const now = new Date();
  const day = now.toISOString().slice(0, 10);

  const boosts = await db.adBoost.findMany({
    where: {
      businessId: { in: opts.businessIds },
      startsAt: { lte: now },
      endsAt: { gte: now },
      business: { ownerId: { not: opts.userId } },
    },
    select: { id: true },
  });

  for (const boost of boosts) {
    try {
      await db.$transaction([
        db.boostEvent.create({
          data: {
            boostId: boost.id,
            userId: opts.userId,
            kind: opts.kind,
            day,
          },
        }),
        db.adBoost.update({
          where: { id: boost.id },
          data:
            opts.kind === "IMPRESSION"
              ? { impressions: { increment: 1 } }
              : { clicks: { increment: 1 } },
        }),
      ]);
    } catch {
      // Unique-constraint collision: this viewer already counted for this
      // boost today. Dropping it silently is the whole point.
    }
  }
}

export async function recordBoostImpressions(businessIds: string[]) {
  const user = await requireUser();

  const parsed = businessIdsSchema.safeParse(businessIds);
  if (!parsed.success) return;

  await recordBoostEvents({
    userId: user.id,
    businessIds: parsed.data,
    kind: "IMPRESSION",
  });

  revalidatePath("/business/manage");
}

export async function recordBoostClick(businessId: string) {
  const user = await requireUser();

  const parsed = businessIdSchema.safeParse(businessId);
  if (!parsed.success) return;

  await recordBoostEvents({
    userId: user.id,
    businessIds: [parsed.data],
    kind: "CLICK",
  });

  revalidatePath("/business/manage");
}
