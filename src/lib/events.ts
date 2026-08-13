// Event/RSVP data access shared by the feed vertical (event posts) and the
// events calendar vertical. Both import from here so neither owns the other's
// files.
import { db } from "./db";
import { notify } from "./notify";

/** Pass every neighborhood the viewer may read — see @/lib/visibility. */
export async function getUpcomingEvents(neighborhoodIds: string[], take = 30) {
  return db.eventDetail.findMany({
    where: {
      startsAt: { gte: new Date() },
      post: { neighborhoodId: { in: neighborhoodIds } },
    },
    orderBy: { startsAt: "asc" },
    take,
    include: {
      post: {
        include: { author: { select: { id: true, name: true, avatarUrl: true } } },
      },
      rsvps: { select: { userId: true, status: true } },
    },
  });
}

export async function getEventForPost(postId: string) {
  return db.eventDetail.findUnique({
    where: { postId },
    include: {
      rsvps: {
        include: { user: { select: { id: true, name: true, avatarUrl: true } } },
      },
    },
  });
}

/**
 * Toggles an RSVP: sets the status, or removes the RSVP when the user taps the
 * status they already have. Returns the resulting state for optimistic UI.
 */
export async function toggleRsvp(opts: {
  eventId: string;
  userId: string;
  status: "GOING" | "MAYBE";
}): Promise<{ status: "GOING" | "MAYBE" | null; goingCount: number }> {
  const { eventId, userId, status } = opts;

  const existing = await db.eventRsvp.findUnique({
    where: { eventId_userId: { eventId, userId } },
  });

  if (existing?.status === status) {
    await db.eventRsvp.delete({
      where: { eventId_userId: { eventId, userId } },
    });
  } else {
    await db.eventRsvp.upsert({
      where: { eventId_userId: { eventId, userId } },
      update: { status },
      create: { eventId, userId, status },
    });

    if (!existing) {
      const event = await db.eventDetail.findUnique({
        where: { postId: eventId },
        include: {
          post: {
            select: { authorId: true, title: true },
          },
        },
      });
      const actor = await db.user.findUnique({
        where: { id: userId },
        select: { name: true },
      });
      if (event && actor) {
        await notify({
          userId: event.post.authorId,
          actorId: userId,
          type: "RSVP",
          payload: {
            href: `/feed/${eventId}`,
            text: `${actor.name} is ${status === "GOING" ? "going to" : "maybe going to"} "${event.post.title ?? "your event"}"`,
            actorName: actor.name,
          },
        });
      }
    }
  }

  const goingCount = await db.eventRsvp.count({
    where: { eventId, status: "GOING" },
  });

  const finalStatus = existing?.status === status ? null : status;
  return { status: finalStatus, goingCount };
}
