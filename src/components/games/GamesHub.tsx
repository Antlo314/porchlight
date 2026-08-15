import Link from "next/link";
import { ButtonLink, Card } from "@/components/ui";
import { listCourses } from "@/lib/games/levels";
import { atlantaDateKey } from "@/lib/games/prng";
import { STORY_NIGHTS } from "@/lib/quilt/nights";
import { WEEKLY_PRIZES } from "@/lib/quilt/week";
import type { BoardRow } from "@/lib/quilt/weekly";

const MOOD_LABEL = {
  dusk: "Golden hour",
  storm: "Storm",
  night: "Night market",
} as const;

export function GamesHub({
  demo,
  weekKey,
  board,
  cleared,
}: {
  demo: boolean;
  weekKey: string;
  board: BoardRow[];
  cleared: string[];
}) {
  const courses = listCourses();
  const flagship = courses[0]!;
  const otherCourses = courses.slice(1);

  const currentIndex = STORY_NIGHTS.findIndex((n) => !cleared.includes(n.id));
  const current =
    currentIndex === -1 ? STORY_NIGHTS[STORY_NIGHTS.length - 1]! : STORY_NIGHTS[currentIndex]!;
  const lastNight = STORY_NIGHTS.length - 1;
  const doneCount = STORY_NIGHTS.filter((n) => cleared.includes(n.id)).length;
  const storyDone = currentIndex === -1;
  const weeklyOpen = cleared.includes("night-0") && !demo;

  return (
    <div className="space-y-6 pb-8">
      {/* ---------------------------------------------------- flagship game */}
      <section>
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
              earn an hourly drip of Porch Credits.
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

        <ul className="mt-2 space-y-2">
          {otherCourses.map((course) => (
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
      </section>

      {/* ------------------------------------------------------ story game */}
      <section>
        <div className="overflow-hidden rounded-card bg-ink shadow-glow">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/images/quilt-hub.jpg" alt="" className="h-36 w-full object-cover" />
          <div className="px-4 pb-4 pt-3 text-cream">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-porch-200">
              Story · {lastNight + 1} nights
            </p>
            <h2 className="mt-1 font-display text-2xl font-semibold">Ember&apos;s Quilt</h2>
            <p className="mt-1 text-sm text-porch-100">
              The porches went dark. Match three or more of a color or a shape. Each night
              rolls straight into the next.
            </p>

            <div className="mt-3">
              <div className="flex items-center justify-between text-xs font-semibold text-porch-200">
                <span>
                  {storyDone
                    ? "Story complete"
                    : `Night ${currentIndex} of ${lastNight} · ${current.title}`}
                </span>
                <span className="tabular-nums">
                  {doneCount}/{lastNight + 1}
                </span>
              </div>
              <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-cream/20">
                <div
                  className="h-full rounded-full bg-porch-400"
                  style={{ width: `${(doneCount / (lastNight + 1)) * 100}%` }}
                />
              </div>
            </div>

            <ButtonLink
              href={`/games/quilt?night=${current.id}`}
              size="lg"
              className="mt-4"
              variant="secondary"
            >
              {storyDone
                ? `Replay — ${current.title}`
                : doneCount === 0
                  ? "Start the story with Ember"
                  : `Continue — ${current.title}`}
            </ButtonLink>
          </div>
        </div>
      </section>

      {/* --------------------------------------------------- weekly ladder */}
      <section className="space-y-3">
        {weeklyOpen ? (
          <Link
            href="/games/quilt?night=weekly"
            className="glow-ring block rounded-card border border-porch-200 bg-porch-50 p-4"
          >
            <p className="text-[15px] font-semibold">This week&apos;s porch</p>
            <p className="mt-0.5 text-sm text-ink-soft">
              Same board for everyone. Best score this week (week of {weekKey}) ranks for
              coins.
            </p>
          </Link>
        ) : (
          <div className="surface flex items-start gap-3 p-4">
            <span
              aria-hidden
              className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-line bg-line/70 text-sm font-bold text-ink-soft"
            >
              ⌁
            </span>
            <div>
              <p className="text-[15px] font-semibold text-ink-soft">
                Locked · This week&apos;s porch
              </p>
              <p className="mt-0.5 text-sm text-ink-soft">
                {demo
                  ? "Log in and finish Night 0 to rank this week."
                  : "Finish Night 0 with Ember, then this week's board opens."}
              </p>
            </div>
          </div>
        )}

        <Card>
          <p className="text-xs font-semibold uppercase tracking-wide text-ink-soft">
            Weekly payout
          </p>
          <p className="mt-1 text-sm text-ink">
            Atlanta week: Monday through Sunday. Your <strong>best score</strong> this week
            is what ranks — play as many times as you want; only the high score sticks.
          </p>
          <ul className="mt-3 space-y-1.5 text-sm">
            <li className="flex items-center justify-between">
              <span>1st place</span>
              <span className="font-bold">{WEEKLY_PRIZES[0]} Porch Credits</span>
            </li>
            <li className="flex items-center justify-between">
              <span>2nd place</span>
              <span className="font-bold">{WEEKLY_PRIZES[1]} Porch Credits</span>
            </li>
            <li className="flex items-center justify-between">
              <span>3rd place</span>
              <span className="font-bold">{WEEKLY_PRIZES[2]} Porch Credits</span>
            </li>
          </ul>
          <p className="mt-3 text-sm text-ink-soft">
            Coins post Monday morning when the week rolls. Ties go to whoever posted the
            score first. Credits can&apos;t be bought or cashed out — spend them with
            neighbors. Guests can play Night 0; only logged-in neighbors rank.
          </p>
        </Card>

        <div>
          <p className="mb-2 text-sm font-semibold uppercase tracking-wide text-ink-soft">
            This week&apos;s rail
          </p>
          {board.length === 0 ? (
            <Card>
              <p className="text-sm text-ink-soft">
                No scores this week yet. Play this week&apos;s porch to put a name on the
                rail.
              </p>
            </Card>
          ) : (
            <ul className="space-y-1">
              {board.map((row) => (
                <li
                  key={row.userId}
                  className="flex items-center justify-between rounded-xl border border-line bg-card px-3 py-2 text-sm"
                >
                  <span className="flex items-center gap-2">
                    {row.place <= 3 && (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={
                          row.place === 1
                            ? "/games/quilt/medal.png"
                            : row.place === 2
                              ? "/games/quilt/medal-silver.png"
                              : "/games/quilt/medal-copper.png"
                        }
                        alt=""
                        className="h-6 w-6 object-contain"
                      />
                    )}
                    <span className="font-bold tabular-nums">{row.place}.</span> {row.name}
                    <span className="text-ink-soft"> · {row.neighborhood}</span>
                  </span>
                  <span className="font-semibold tabular-nums">{row.score}</span>
                </li>
              ))}
            </ul>
          )}
          {demo && (
            <p className="mt-2 text-sm text-ink-soft">
              Log in to appear on the rail and keep weekly coins.
            </p>
          )}
        </div>
      </section>

      {demo && (
        <ButtonLink href="/login?next=/games" size="lg">
          Log in to unlock nights and rank
        </ButtonLink>
      )}

      <p className="text-center text-xs text-ink-soft">
        Weekly coins go to 1st–3rd. They can&apos;t be bought or cashed out.
      </p>
    </div>
  );
}
