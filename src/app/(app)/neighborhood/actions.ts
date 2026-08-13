"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { signupSchema } from "@/lib/validators";

// Reuse the neighborhood-id validator that already exists in validators.ts
// rather than re-deriving a second one that could drift.
const followSchema = z.object({
  neighborhoodId: signupSchema.shape.neighborhoodId,
  follow: z.boolean(),
});

export type FollowResult =
  | { ok: true; following: boolean }
  | { ok: false; error: string };

/**
 * Follow / unfollow a nearby neighborhood.
 *
 * The NeighborhoodFollow row is keyed on (userId, neighborhoodId) and userId
 * always comes from the session, never from the client — so a member can only
 * ever create or remove their own follow. The only thing left to verify is that
 * the neighborhood the client named is real and isn't their own home.
 */
export async function setFollowAction(input: {
  neighborhoodId: string;
  follow: boolean;
}): Promise<FollowResult> {
  const user = await requireUser();

  const parsed = followSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: "That isn't a neighborhood we know." };
  }
  const { neighborhoodId, follow } = parsed.data;

  if (neighborhoodId === user.neighborhoodId) {
    return {
      ok: false,
      error: "That's your home neighborhood — you already see everything here.",
    };
  }

  const neighborhood = await db.neighborhood.findUnique({
    where: { id: neighborhoodId },
    select: { id: true },
  });
  if (!neighborhood) {
    return { ok: false, error: "That neighborhood is no longer listed." };
  }

  if (follow) {
    // Upsert rather than create: a double-tap shouldn't fail on the compound key.
    await db.neighborhoodFollow.upsert({
      where: {
        userId_neighborhoodId: { userId: user.id, neighborhoodId },
      },
      update: {},
      create: { userId: user.id, neighborhoodId },
    });
  } else {
    // deleteMany so unfollowing something already unfollowed is a no-op.
    await db.neighborhoodFollow.deleteMany({
      where: { userId: user.id, neighborhoodId },
    });
  }

  // Following widens what the member may read, so every browse surface that
  // gates on neighborhood membership has to be refreshed.
  revalidatePath("/neighborhood");
  revalidatePath("/feed");
  revalidatePath("/barter");
  revalidatePath("/services");
  revalidatePath("/events");
  revalidatePath("/profile");

  return { ok: true, following: follow };
}
