import Link from "next/link";
import { ButtonLink, Card } from "@/components/ui";
import { STORY_NIGHTS } from "@/lib/quilt/nights";
import { WEEKLY_PRIZES } from "@/lib/quilt/week";
import type { BoardRow } from "@/lib/quilt/weekly";

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
  const currentIndex = STORY_NIGHTS.findIndex((n) => !cleared.includes(n.id));
  const current =
    currentIndex === -1
      ? STORY_NIGHTS[STORY_NIGHTS.length - 1]!
      : STORY_NIGHTS[currentIndex]!;
  const pathIndex = currentIndex === -1 ? STORY_NIGHTS.length : currentIndex + 1;
  const weeklyOpen = cleared.includes("night-0") && !demo;

  return (
    <div className="space-y-5 pb-8">
      <div className="overflow-hidden rounded-card bg-ink shadow-glow">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/images/quilt-hub.jpg"
          alt=""
          className="h-40 w-full object-cover"
        />
        <div className="px-4 pb-4 pt-3 text-cream">
          <p className="text-xs font-semibold uppercase tracking-wide text-porch-200">
            Porchlight Games
          </p>
          <h1 className="mt-1 font-display text-3xl font-semibold">
            Ember&apos;s Quilt
          </h1>
          <p className="mt-1 text-sm text-porch-100">
            The porches went dark. Match three or more of a color or a shape.
            Nights unlock in order.
          </p>
          <p className="mt-3 text-sm font-semibold text-porch-200">
            Night {pathIndex} of {STORY_NIGHTS.length}
          </p>
        </div>
      </div>

      <Card className="border-porch-200 bg-porch-50">
        <p className="text-xs font-semibold uppercase tracking-wide text-ink-soft">
          Play now
        </p>
        <p className="mt-1 font-display text-xl font-semibold">{current.title}</p>
        <p className="mt-0.5 text-sm text-ink-soft">{current.blurb}</p>
        <ButtonLink
          href={`/games/quilt?night=${current.id}`}
          size="lg"
          className="mt-4"
        >
          {cleared.includes(current.id)
            ? `Replay ${current.title}`
            : current.id === "night-0"
              ? "Start Night 0 — Ember walks you through it"
              : `Continue — ${current.title}`}
        </ButtonLink>
      </Card>

      <div>
        <p className="mb-2 text-sm font-semibold uppercase tracking-wide text-ink-soft">
          Ember&apos;s nights
        </p>
        <ul className="space-y-2">
          {STORY_NIGHTS.map((n, i) => {
            const done = cleared.includes(n.id);
            const unlocked =
              n.id === "night-0" ||
              done ||
              (i > 0 && cleared.includes(STORY_NIGHTS[i - 1]!.id));
            const prev = i > 0 ? STORY_NIGHTS[i - 1]! : null;
            return (
              <li key={n.id}>
                {unlocked ? (
                  <Link
                    href={`/games/quilt?night=${n.id}`}
                    className={`surface flex items-start gap-3 p-4 active:bg-porch-50/50 ${
                      n.id === current.id && !done ? "ring-2 ring-porch-400" : ""
                    }`}
                  >
                    <span
                      className={`mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-sm font-bold ${
                        done
                          ? "bg-pine-600 text-cream"
                          : "bg-porch-600 text-white"
                      }`}
                    >
                      {done ? "✓" : i}
                    </span>
                    <div className="min-w-0">
                      <p className="text-[15px] font-semibold">
                        Night {i} · {n.title}
                        {done ? " · lit" : n.id === current.id ? " · current" : ""}
                      </p>
                      <p className="mt-0.5 text-sm text-ink-soft">{n.blurb}</p>
                    </div>
                  </Link>
                ) : (
                  <div className="surface flex items-start gap-3 p-4">
                    <span
                      aria-hidden
                      className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-line bg-line/70 text-sm font-bold text-ink-soft"
                    >
                      ⌁
                    </span>
                    <div className="min-w-0">
                      <p className="text-[15px] font-semibold text-ink-soft">
                        Locked · Night {i} · {n.title}
                      </p>
                      <p className="mt-0.5 text-sm text-ink-soft">
                        Finish {prev?.title ?? "the night before"} first.
                      </p>
                    </div>
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      </div>

      {weeklyOpen ? (
        <Link
          href="/games/quilt?night=weekly"
          className="glow-ring block rounded-card border border-porch-200 bg-porch-50 p-4"
        >
          <p className="text-[15px] font-semibold">This week&apos;s porch</p>
          <p className="mt-0.5 text-sm text-ink-soft">
            Same board for everyone. Best score this week (week of {weekKey})
            ranks for coins.
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
          Atlanta week: Monday through Sunday. Your <strong>best score</strong>{" "}
          this week is what ranks — play as many times as you want; only the
          high score sticks.
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
          Coins post Monday morning when the week rolls. Ties go to whoever
          posted the score first. Credits can&apos;t be bought or cashed out —
          spend them with neighbors. Guests can play Night 0; only logged-in
          neighbors rank.
        </p>
      </Card>

      <div>
        <p className="mb-2 text-sm font-semibold uppercase tracking-wide text-ink-soft">
          This week&apos;s rail
        </p>
        {board.length === 0 ? (
          <Card>
            <p className="text-sm text-ink-soft">
              No scores this week yet. Play this week&apos;s porch to put a
              name on the rail.
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
                  <span className="font-bold tabular-nums">{row.place}.</span>{" "}
                  {row.name}
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
