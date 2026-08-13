"use server";

import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { toggleRsvp } from "@/lib/events";
import { rsvpSchema } from "@/lib/validators";

export type RsvpResult =
  | { ok: true; status: "GOING" | "MAYBE" | null; goingCount: number }
  | { ok: false; error: string };

/**
 * Thin, authorized wrapper around toggleRsvp() in @/lib/events — the toggle
 * semantics and the host notification live there so the feed and the events
 * calendar behave identically.
 */
export async function rsvpAction(input: {
  eventId: string;
  status: "GOING" | "MAYBE";
}): Promise<RsvpResult> {
  const user = await requireUser();

  const parsed = rsvpSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "That isn't a valid RSVP." };
  const { eventId, status } = parsed.data;

  // The client names the event id, so re-read it and confirm the member is
  // allowed to see the neighborhood it belongs to before writing anything.
  const event = await db.eventDetail.findUnique({
    where: { postId: eventId },
    select: { postId: true, post: { select: { neighborhoodId: true } } },
  });
  if (!event) return { ok: false, error: "That event is no longer listed." };

  if (event.post.neighborhoodId !== user.neighborhoodId) {
    const follow = await db.neighborhoodFollow.findUnique({
      where: {
        userId_neighborhoodId: {
          userId: user.id,
          neighborhoodId: event.post.neighborhoodId,
        },
      },
      select: { userId: true },
    });
    if (!follow) {
      return {
        ok: false,
        error: "That event is in a neighborhood you don't follow.",
      };
    }
  }

  const result = await toggleRsvp({ eventId, userId: user.id, status });

  revalidatePath("/events");
  revalidatePath("/feed");
  revalidatePath(`/feed/${eventId}`);

  return { ok: true, status: result.status, goingCount: result.goingCount };
}
