"use server";

import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { serializeImages } from "@/lib/json";
import { notifyWantsMatchingListing } from "@/lib/matching";
import { createBarterListingSchema } from "@/lib/validators";
import { blankToUndefined, toFieldErrors } from "../formHelpers";

export type CreateListingInput = {
  kind: string;
  title: string;
  description: string;
  category: string;
  wants?: string;
  /** Raw string from the form; the schema coerces it. */
  creditValue?: string;
  /** Already-uploaded URLs from <ImageUploader>. */
  images?: string[];
};

export type CreateListingResult =
  | {
      ok: true;
      id: string;
      /**
       * How many neighbors had already asked for this. Surfaced right after
       * posting — "2 neighbors were waiting for this" is a far better reward
       * than a bare success toast, and it teaches people what wants are for.
       */
      matchedWants: number;
    }
  | { ok: false; error: string; fieldErrors?: Record<string, string> };

export async function createListingAction(
  input: CreateListingInput
): Promise<CreateListingResult> {
  const user = await requireUser();

  const parsed = createBarterListingSchema.safeParse({
    kind: input.kind,
    title: input.title,
    description: input.description,
    category: input.category,
    wants: blankToUndefined(input.wants),
    creditValue: blankToUndefined(input.creditValue),
    // The schema caps the gallery (imageListSchema.max(6)); no truncation here.
    images: input.images ?? [],
  });

  if (!parsed.success) {
    return {
      ok: false,
      error: "Check the highlighted fields.",
      fieldErrors: toFieldErrors(parsed.error),
    };
  }

  const data = parsed.data;

  const listing = await db.barterListing.create({
    data: {
      ownerId: user.id,
      // Listings always belong to the author's own neighborhood — never a
      // client-supplied one.
      neighborhoodId: user.neighborhoodId,
      kind: data.kind,
      title: data.title,
      description: data.description,
      category: data.category,
      wants: data.wants ?? null,
      creditValue: data.creditValue ?? null,
      images: serializeImages(data.images),
    },
    select: { id: true },
  });

  // Tell the neighbors who already asked for this. Never throws — a failed
  // match must not cost someone the listing they just wrote.
  const matchedWants = await notifyWantsMatchingListing({
    id: listing.id,
    ownerId: user.id,
    neighborhoodId: user.neighborhoodId,
    kind: data.kind,
    category: data.category,
    title: data.title,
    description: data.description,
  });

  revalidatePath("/barter");
  revalidatePath("/barter/wants");
  revalidatePath("/barter/matches");

  return { ok: true, id: listing.id, matchedWants };
}
