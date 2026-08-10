"use server";

import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { serializeImages } from "@/lib/json";
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
  imageUrl?: string;
};

export type CreateListingResult =
  | { ok: true; id: string }
  | { ok: false; error: string; fieldErrors?: Record<string, string> };

export async function createListingAction(
  input: CreateListingInput
): Promise<CreateListingResult> {
  const user = await requireUser();

  const imageUrl = blankToUndefined(input.imageUrl);

  const parsed = createBarterListingSchema.safeParse({
    kind: input.kind,
    title: input.title,
    description: input.description,
    category: input.category,
    wants: blankToUndefined(input.wants),
    creditValue: blankToUndefined(input.creditValue),
    images: imageUrl ? [imageUrl] : [],
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

  revalidatePath("/barter");

  return { ok: true, id: listing.id };
}
