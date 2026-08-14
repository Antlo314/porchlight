import {
  EventCard,
  type EventCardData,
  type EventCardPerson,
} from "@/components/event/EventCard";
import { groupEventsByDay } from "@/components/event/eventGroups";
import { EmptyState, Fab, SectionHeading } from "@/components/ui";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { getUpcomingEvents } from "@/lib/events";
import { pluralize } from "@/lib/format";
import { visibleNeighborhoodIds } from "@/lib/visibility";

export const metadata = { title: "Events" };

const TAKE = 60;

/** EventRsvp.status is a plain SQLite string; narrow it before it reaches the UI. */
function toRsvpStatus(raw: string | undefined): "GOING" | "MAYBE" | null {
  if (raw === "GOING") return "GOING";
  if (raw === "MAYBE") return "MAYBE";
  return null;
}

export default async function EventsPage() {
  const user = await requireUser();

  const events = await getUpcomingEvents(await visibleNeighborhoodIds(user), TAKE);

  // getUpcomingEvents only returns RSVP user ids (it is shared with the feed,
  // which doesn't need the people), so resolve the attendee avatars in one
  // follow-up query instead of N per event.
  const goingIds = Array.from(
    new Set(
      events.flatMap((event) =>
        event.rsvps.filter((r) => r.status === "GOING").map((r) => r.userId)
      )
    )
  );

  const people =
    goingIds.length > 0
      ? await db.user.findMany({
          where: { id: { in: goingIds } },
          select: { id: true, name: true, avatarUrl: true },
        })
      : [];
  const peopleById = new Map(
    people.map((p): [string, EventCardPerson] => [p.id, p])
  );

  const cards: EventCardData[] = events.map((event) => {
    const mine = event.rsvps.find((r) => r.userId === user.id);

    return {
      postId: event.postId,
      title: event.post.title,
      body: event.post.body,
      startsAt: event.startsAt,
      endsAt: event.endsAt,
      location: event.location,
      host: {
        id: event.post.author.id,
        name: event.post.author.name,
        avatarUrl: event.post.author.avatarUrl,
      },
      going: event.rsvps
        .filter((r) => r.status === "GOING")
        .map((r) => peopleById.get(r.userId))
        .filter((p): p is EventCardPerson => p !== undefined),
      myStatus: toRsvpStatus(mine?.status),
    };
  });

  const groups = groupEventsByDay(cards);

  return (
    <div className="space-y-4">
      <div className="flex items-baseline justify-between gap-3">
        <h1 className="text-xl font-bold">Upcoming events</h1>
        {cards.length > 0 && (
          <span className="shrink-0 text-sm text-ink-soft">
            {pluralize(cards.length, "event")}
          </span>
        )}
      </div>

      {cards.length === 0 ? (
        <EmptyState
          icon="📅"
          imageSrc="/images/empty/empty-events.jpg"
          title="Nothing on the calendar"
          body={`No upcoming events in ${user.neighborhood.name} yet. A porch party, a yard sale, a stroller walk — post the first one.`}
          actionLabel="Create an event"
          actionHref="/feed/new?type=EVENT"
        />
      ) : (
        <div className="space-y-6">
          {groups.map((group) => (
            <section key={group.key}>
              <SectionHeading
                title={group.label}
                action={
                  <span className="text-xs text-ink-soft">
                    {pluralize(group.events.length, "event")}
                  </span>
                }
              />
              <ul className="space-y-3">
                {group.events.map((event) => (
                  <li key={event.postId}>
                    <EventCard event={event} />
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      )}

      <Fab href="/feed/new?type=EVENT" label="Create an event" />
    </div>
  );
}
