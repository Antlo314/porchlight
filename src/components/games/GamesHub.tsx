import Link from "next/link";
import { ButtonLink, Card, CreditPill } from "@/components/ui";
import { HOURLY_TARGET } from "@/lib/games/economy";
import { listCourses } from "@/lib/games/levels";
import { atlantaDateKey } from "@/lib/games/prng";

const MOOD_LABEL = {
  dusk: "Golden hour",
  storm: "Storm",
  night: "Night market",
} as const;

/**
 * Light the Block only. Ember's Quilt is parked — its routes and engine are
 * untouched at /games/quilt, it just isn't surfaced here.
 */
export function GamesHub({
  demo,
  remainingToday,
}: {
  demo: boolean;
  remainingToday: number;
}) {
  const courses = listCourses();
  const flagship = courses[0]!;
  const rest = courses.slice(1);

  return (
    <div className="space-y-5 pb-8">
      <div className="overflow-hidden rounded-card bg-ink shadow-glow">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/images/games-hub.jpg" alt="" className="h-44 w-full object-cover" />
        <div className="px-4 pb-4 pt-3 text-cream">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-porch-200">
            Porchlight Games
          </p>
          <h1 className="mt-1 font-display text-3xl font-semibold">Light the Block</h1>
          <p className="mt-1 text-sm text-porch-100">
            You&apos;re the porch lantern. Hop Atlanta stoops, light the dark ones, and
            earn a small drip of Porch Credits.
          </p>
          <ButtonLink
            href={`/games/light-the-block?level=${flagship.id}`}
            size="lg"
            className="mt-4"
          >
            Play — {flagship.name}
          </ButtonLink>
        </div>
      </div>

      <Card className="flex items-center justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-ink-soft">
            Credits on the drip
          </p>
          <p className="mt-0.5 text-sm text-ink-soft">
            {demo
              ? "Log in to keep what you earn."
              : `${remainingToday} of ${HOURLY_TARGET} still available this hour.`}
          </p>
        </div>
        <CreditPill amount={demo ? 0 : remainingToday} />
      </Card>

      <div>
        <p className="mb-2 text-sm font-semibold uppercase tracking-wide text-ink-soft">
          More courses
        </p>
        <ul className="space-y-2">
          {rest.map((course) => (
            <li key={course.id}>
              <Link
                href={`/games/light-the-block?level=${course.id}`}
                className="surface block p-4 active:bg-porch-50/50"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-[15px] font-semibold">{course.name}</p>
                    <p className="mt-0.5 text-sm text-ink-soft">{course.blurb}</p>
                  </div>
                  <span className="shrink-0 rounded-full bg-porch-100 px-2 py-0.5 text-xs font-semibold text-porch-800">
                    {MOOD_LABEL[course.mood]}
                  </span>
                </div>
                {course.id === "daily" && (
                  <p className="mt-2 text-xs text-ink-soft">
                    {atlantaDateKey()} · same course for the whole block
                  </p>
                )}
              </Link>
            </li>
          ))}
        </ul>
      </div>

      {demo && (
        <ButtonLink href="/login?next=/games" size="lg">
          Log in to earn Porch Credits
        </ButtonLink>
      )}

      <p className="text-center text-xs text-ink-soft">
        Credits from play are a drip, never a paycheck. They can&apos;t be bought and they
        can&apos;t be cashed out.
      </p>
    </div>
  );
}
