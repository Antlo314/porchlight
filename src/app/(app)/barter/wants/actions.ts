"use server";

import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { findListingsForWant, type MatchReason } from "@/lib/matching";
import { createWantSchema, wantStatusSchema } from "@/lib/validators";
import { blankToUndefined, toFieldErrors } from "../formHelpers";

export type CreateWantInput = {
  kind: string;
  title: string;
  description?: string;
  category: string;
  /** Raw string from the form; the schema coerces it. */
  creditOffer?: string;
};

/** One listing that already answers the want, with the reason it matched. */
export type WantMatch = {
  listing: {
    id: string;
    kind: string;
    category: string;
    title: string;
    description: string;
    creditValue: number | null;
    /** Raw JSON column; parsed with parseImages for display. */
    images: string;
    owner: { id: string; name: string; avatarUrl: string | null };
  };
  match: MatchReason;
};

export type CreateWantResult =
  | {
      ok: true;
      id: string;
      /**
       * Listings that already answer this want. Returned from the action
       * rather than left to a notification, because "3 neighbors already have
       * this" in the same breath as posting is the entire reason to record a
       * want instead of hoping to browse into one.
       */
      matches: WantMatch[];
    }
  | { ok: false; error: string; fieldErrors?: Record<string, string> };

export type WantActionResult = { ok: true } | { ok: false; error: string };

/** Every screen that counts or matches wants. */
function revalidateWants() {
  revalidatePath("/barter/wants");
  revalidatePath("/barter/matches");
  revalidatePath("/barter");
}

export async function createWantAction(
  input: CreateWantInput
): Promise<CreateWantResult> {
  const user = await requireUser();

  const parsed = createWantSchema.safeParse({
    kind: input.kind,
    title: input.title,
    description: blankToUndefined(input.description),
    category: input.category,
    creditOffer: blankToUndefined(input.creditOffer),
  });

  if (!parsed.success) {
    return {
      ok: false,
      error: "Check the highlighted fields.",
      fieldErrors: toFieldErrors(parsed.error),
    };
  }

  const data = parsed.data;
  const description = data.description ? data.description : null;

  const want = await db.want.create({
    data: {
      userId: user.id,
      // Reads widen to followed neighborhoods, writes never do: a want belongs
      // to the author's own neighborhood, never a client-supplied one.
      neighborhoodId: user.neighborhoodId,
      kind: data.kind,
      title: data.title,
      description,
      category: data.category,
      creditOffer: data.creditOffer ?? null,
    },
    select: { id: true },
  });

  // Never throws into the create path: a failed match must not cost someone
  // the want they just wrote.
  let matches: WantMatch[] = [];
  try {
    matches = await findListingsForWant({
      userId: user.id,
      neighborhoodId: user.neighborhoodId,
      kind: data.kind,
      category: data.category,
      title: data.title,
      description,
    });
  } catch {
    matches = [];
  }

  revalidateWants();
  return { ok: true, id: want.id, matches };
}

/**
 * Only the neighbor who posted a want may close or fulfil it. Ownership is
 * re-checked here rather than trusted from the client, because the want id
 * arrives from the browser.
 */
export async function setWantStatusAction(input: {
  wantId: string;
  status: string;
}): Promise<WantActionResult> {
  const user = await requireUser();

  const parsed = wantStatusSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "That isn't a valid status." };
  const { wantId, status } = parsed.data;

  const want = await db.want.findUnique({
    where: { id: wantId },
    select: { id: true, userId: true, status: true },
  });
  if (!want) return { ok: false, error: "That want is no longer here." };

  if (want.userId !== user.id) {
    return {
      ok: false,
      error: "Only the neighbor who posted this want can change it.",
    };
  }
  if (want.status === status) return { ok: true };

  await db.want.update({ where: { id: want.id }, data: { status } });

  revalidateWants();
  return { ok: true };
}
