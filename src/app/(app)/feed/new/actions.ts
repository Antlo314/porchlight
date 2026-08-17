"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { serializeImages } from "@/lib/json";
import { safetyExpiresAt } from "@/lib/safety";
import { createPostSchema } from "@/lib/validators";

/**
 * Creates a post in the author's own neighborhood (never a client-supplied
 * one), plus the nested EventDetail when the post is an event, or a
 * 14-day SafetyDetail when it is a calm notice.
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
  safetyLocation?: string;
  safetyWhen?: string;
}): Promise<{ error?: string } | undefined> {
  const user = await requireUser();

  const isEvent = input.type === "EVENT";
  const isSafety = input.type === "SAFETY";
  const parsed = createPostSchema.safeParse({
    type: input.type,
    title: input.title?.trim() || undefined,
    body: input.body,
    images: input.images ?? [],
    // Empty strings would coerce to an Invalid Date, so drop them entirely.
    startsAt: isEvent && input.startsAt ? input.startsAt : undefined,
    endsAt: isEvent && input.endsAt ? input.endsAt : undefined,
    location: isEvent && input.location?.trim() ? input.location.trim() : undefined,
    safetyLocation:
      isSafety && input.safetyLocation?.trim()
        ? input.safetyLocation.trim()
        : undefined,
    safetyWhen: isSafety && input.safetyWhen ? input.safetyWhen : undefined,
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Check the form" };
  }

  const data = parsed.data;
  const expiresAt = isSafety ? safetyExpiresAt() : null;

  const post = await db.post.create({
    data: {
      authorId: user.id,
      neighborhoodId: user.neighborhoodId,
      type: data.type,
      title: data.title ?? null,
      body: data.body,
      images: serializeImages(data.images),
      expiresAt,
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
      ...(data.type === "SAFETY" && data.safetyLocation
        ? {
            safety: {
              create: {
                location: data.safetyLocation,
                happenedAt: data.safetyWhen ?? null,
                about: "INCIDENT",
                expiresAt: expiresAt!,
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
