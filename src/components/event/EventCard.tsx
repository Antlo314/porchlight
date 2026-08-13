import Link from "next/link";
import { Avatar, AvatarStack, Card } from "@/components/ui";
import { formatEventRange, pluralize, truncate } from "@/lib/format";
import { RsvpButton, type RsvpStatus } from "./RsvpButton";

export type EventCardPerson = {
  id: string;
  name: string;
  avatarUrl: string | null;
};

export type EventCardData = {
  /** EventDetail is keyed on postId, so this is both the event and post id. */
  postId: string;
  title: string | null;
  body: string;
  startsAt: Date;
  endsAt: Date | null;
  location: string;
  host: EventCardPerson;
  going: EventCardPerson[];
  myStatus: RsvpStatus | null;
};

/**
 * One upcoming event. The whole header taps through to the underlying post at
 * /feed/[postId]; the RSVP controls live outside that link so a tap on "Going"
 * never navigates away (and so the markup stays valid — no button inside an
 * anchor).
 */
export function EventCard({ event }: { event: EventCardData }) {
  const heading = event.title?.trim() || truncate(event.body, 70);
  const goingCount = event.going.length;

  return (
    <Card padded={false} className="animate-fade-in overflow-hidden">
      <Link
        href={`/feed/${event.postId}`}
        className="block p-4 transition-colors duration-100 active:bg-porch-50/60"
      >
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h3 className="text-[17px] font-bold leading-snug">{heading}</h3>
            <p className="mt-1 text-sm font-semibold text-pine-600">
              <span aria-hidden>🕒</span>{" "}
              {formatEventRange(event.startsAt, event.endsAt)}
            </p>
            <p className="mt-0.5 text-sm text-ink-soft">
              <span aria-hidden>📍</span> {event.location}
            </p>
          </div>
          <Avatar name={event.host.name} src={event.host.avatarUrl} size="md" />
        </div>
        <p className="mt-2 text-xs text-ink-soft">
          Hosted by {event.host.name}
        </p>
      </Link>

      <div className="border-t border-line px-4 py-3">
        <div className="mb-3 flex min-h-8 items-center gap-2">
          {goingCount > 0 ? (
            <>
              <AvatarStack people={event.going} />
              <span className="text-sm text-ink-soft">
                {pluralize(goingCount, "neighbor")} going
              </span>
            </>
          ) : (
            <span className="text-sm text-ink-soft">
              No RSVPs yet — be the first.
            </span>
          )}
        </div>

        <RsvpButton
          eventId={event.postId}
          initialStatus={event.myStatus}
          initialGoingCount={goingCount}
        />
      </div>
    </Card>
  );
}
