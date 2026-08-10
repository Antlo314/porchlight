"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { serializeImages } from "@/lib/json";
import { createPostSchema } from "@/lib/validators";

/**
 * Creates a post in the author's own neighborhood (never a client-supplied
 * one), plus the nested EventDetail when the post is an event.
 */
export async function createPostAction(input: {
  type: string;
  title?: string;
  body: string;
  images?: string[];
  /** datetime-local strings; coerced to Date by createPostSchema. */
  startsAt?: string;
  endsAt?: string;
  location?: string;
}): Promise<{ error?: string } | undefined> {
  const user = await requireUser();

  const isEvent = input.type === "EVENT";
  const parsed = createPostSchema.safeParse({
    type: input.type,
    title: input.title?.trim() || undefined,
    body: input.body,
    images: input.images ?? [],
    // Empty strings would coerce to an Invalid Date, so drop them entirely.
    startsAt: isEvent && input.startsAt ? input.startsAt : undefined,
    endsAt: isEvent && input.endsAt ? input.endsAt : undefined,
    location: isEvent && input.location?.trim() ? input.location.trim() : undefined,
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Check the form" };
  }

  const data = parsed.data;

  const post = await db.post.create({
    data: {
      authorId: user.id,
      neighborhoodId: user.neighborhoodId,
      type: data.type,
      title: data.title ?? null,
      body: data.body,
      images: serializeImages(data.images),
      ...(data.type === "EVENT" && data.startsAt && data.location
        ? {
            event: {
              create: {
                startsAt: data.startsAt,
                endsAt: data.endsAt ?? null,
                location: data.location,
              },
            },
          }
        : {}),
    },
    select: { id: true },
  });

  revalidatePath("/feed");
  redirect(`/feed/${post.id}`);
}
