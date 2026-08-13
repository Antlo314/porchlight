"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { notify } from "@/lib/notify";
import { createReviewSchema } from "@/lib/validators";
import type { ActionResult } from "@/components/business/types";

// `verifiedJob` is a Porchlight differentiator (reviews tied to real work), so
// it rides along with the shared review schema instead of forking it.
const reviewSchema = createReviewSchema.extend({
  verifiedJob: z.boolean().default(false),
});

const businessIdSchema = createReviewSchema.shape.businessId;

function firstError(error: z.ZodError): string {
  return error.issues[0]?.message ?? "Please check the form and try again.";
}

/**
 * One review per neighbor per business — enforced by the
 * @@unique([businessId, authorId]) constraint. Rather than letting a second
 * submit blow up on that constraint, we upsert: the composer shows the
 * neighbor their existing review and this edits it in place.
 */
export async function upsertReview(input: unknown): Promise<ActionResult> {
  const user = await requireUser();

  const parsed = reviewSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: firstError(parsed.error) };

  const { businessId, rating, body, verifiedJob } = parsed.data;

  const business = await db.business.findUnique({
    where: { id: businessId },
    select: { id: true, name: true, ownerId: true },
  });
  if (!business) {
    return { ok: false, error: "That business is no longer listed." };
  }
  if (business.ownerId === user.id) {
    return { ok: false, error: "You can't review your own business." };
  }

  const existing = await db.review.findUnique({
    where: { businessId_authorId: { businessId, authorId: user.id } },
    select: { id: true },
  });

  await db.review.upsert({
    where: { businessId_authorId: { businessId, authorId: user.id } },
    update: { rating, body, verifiedJob },
    create: { businessId, authorId: user.id, rating, body, verifiedJob },
  });

  await notify({
    userId: business.ownerId,
    actorId: user.id,
    type: "REVIEW",
    payload: {
      href: `/services/${businessId}`,
      text: `${user.name} ${existing ? "updated their" : "left a"} ${rating}-star review of ${business.name}`,
      actorName: user.name,
    },
  });

  revalidatePath(`/services/${businessId}`);
  revalidatePath("/services");
  revalidatePath("/business/manage");
  return { ok: true };
}

/** A neighbor may remove their own review, and only their own. */
export async function deleteMyReview(
  businessIdInput: unknown
): Promise<ActionResult> {
  const user = await requireUser();

  const parsed = businessIdSchema.safeParse(businessIdInput);
  if (!parsed.success) return { ok: false, error: "Unknown business." };
  const businessId = parsed.data;

  const existing = await db.review.findUnique({
    where: { businessId_authorId: { businessId, authorId: user.id } },
    select: { id: true, authorId: true },
  });
  if (!existing || existing.authorId !== user.id) {
    return { ok: false, error: "You don't have a review to remove." };
  }

  await db.review.delete({ where: { id: existing.id } });

  revalidatePath(`/services/${businessId}`);
  revalidatePath("/services");
  revalidatePath("/business/manage");
  return { ok: true };
}
