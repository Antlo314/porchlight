"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { createBusinessSchema } from "@/lib/validators";
import type { ActionResult } from "@/components/business/types";

function firstError(error: z.ZodError): string {
  return error.issues[0]?.message ?? "Please check the form and try again.";
}

/**
 * Creates the neighbor's business profile plus its FREE subscription row.
 * One business per user for now — the guard below is the ownership check that
 * keeps a replayed submit from minting a second profile.
 *
 * The business is pinned to the owner's own neighborhood; a client-supplied
 * neighborhoodId is never trusted.
 */
export async function createBusiness(input: unknown): Promise<ActionResult> {
  const user = await requireUser();

  const parsed = createBusinessSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: firstError(parsed.error) };

  const existing = await db.business.findFirst({
    where: { ownerId: user.id },
    select: { id: true },
  });
  if (existing) {
    return {
      ok: false,
      error: "You already have a business listed. Edit it from your dashboard.",
    };
  }

  const { name, category, description, phone, website, logoUrl } = parsed.data;

  await db.$transaction(async (tx) => {
    const business = await tx.business.create({
      data: {
        ownerId: user.id,
        neighborhoodId: user.neighborhoodId,
        name,
        category,
        description,
        phone: phone ? phone : null,
        website: website ? website : null,
        logoUrl: logoUrl ? logoUrl : null,
      },
      select: { id: true },
    });

    // Everyone starts on FREE — the free tier is the whole acquisition wedge,
    // so the subscription row is created up front rather than on upgrade.
    await tx.subscription.create({
      data: { businessId: business.id, plan: "FREE", status: "ACTIVE" },
    });
  });

  revalidatePath("/services");
  revalidatePath("/business/manage");
  return { ok: true };
}
