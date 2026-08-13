import Link from "next/link";
import { ButtonLink, Card } from "@/components/ui";
import { NIGHTS } from "@/lib/quilt/nights";
import { WEEKLY_PRIZES } from "@/lib/quilt/week";
import type { BoardRow } from "@/lib/quilt/weekly";
import { listCourses } from "@/lib/games/levels";

export function GamesHub({
  demo,
  weekKey,
  board,
}: {
  demo: boolean;
  weekKey: string;
  board: BoardRow[];
}) {
  const story = NIGHTS.filter((n) => n.id !== "weekly");

  return (
    <div className="space-y-5 pb-8">
      <div className="overflow-hidden rounded-card border border-line bg-ink">
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
          <h1 className="mt-1 text-2xl font-bold">Ember&apos;s Quilt</h1>
          <p className="mt-1 text-sm text-porch-100">
            The porches went dark. Match three of a color or a shape to stitch
            the glow back. True matches — color and shape — fill the quilt
            fastest.
          </p>
        </div>
      </div>

      <Card className="border-porch-200 bg-porch-50">
        <p className="text-xs font-semibold uppercase tracking-wide text-ink-soft">
          How to play
        </p>
        <ol className="mt-2 list-decimal space-y-1.5 pl-5 text-sm text-ink">
          <li>
            <span className="font-semibold">Tap one tile</span> so it lights up.
          </li>
          <li>
            <span className="font-semibold">Tap a neighbor</span> — only up,
            down, left, or right. They swap.
          </li>
          <li>
            <span className="font-semibold">Three in a line</span> of the same
            color or the same shape glow and fall away.
          </li>
          <li>
            <span className="font-semibold">True stitch</span> = same color and
            same shape. Those fill Ember&apos;s card fastest.
          </li>
          <li>Finish the card before moves run out.</li>
        </ol>
        <Link
          href="/games/quilt?night=night-0"
          className="mt-3 inline-flex min-h-11 items-center font-semibold text-porch-700"
        >
          Start Night 0 — Ember walks you through it →
        </Link>
      </Card>

      <div>
        <p className="mb-2 text-sm font-semibold uppercase tracking-wide text-ink-soft">
          Ember&apos;s nights
        </p>
        <ul className="space-y-2">
          {story.map((n, i) => (
            <li key={n.id}>
              <Link
                href={`/games/quilt?night=${n.id}`}
                className="block rounded-card border border-line bg-card p-4 active:bg-porch-50/50"
              >
                <p className="text-[15px] font-semibold">
                  Night {i} · {n.title}
                </p>
                <p className="mt-0.5 text-sm text-ink-soft">{n.blurb}</p>
              </Link>
            </li>
          ))}
        </ul>
      </div>

      <Link
        href="/games/quilt?night=weekly"
        className="block rounded-card border border-porch-200 bg-porch-50 p-4"
      >
        <p className="text-[15px] font-semibold">This week&apos;s block</p>
        <p className="mt-0.5 text-sm text-ink-soft">
          Same board for everyone. Best score this week (week of {weekKey})
          ranks for coins.
        </p>
      </Link>

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
          spend them on the block. Guests can play; only logged-in neighbors
          rank.
        </p>
      </Card>

      <div>
        <p className="mb-2 text-sm font-semibold uppercase tracking-wide text-ink-soft">
          This week&apos;s rail
        </p>
        {board.length === 0 ? (
          <Card>
            <p className="text-sm text-ink-soft">
              No scores this week yet. Play the weekly block to put a name on
              the rail.
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
          Log in to rank
        </ButtonLink>
      )}

      <details className="rounded-card border border-line bg-card p-3">
        <summary className="min-h-11 cursor-pointer text-sm font-semibold">
          Classic: Light the Block (beta)
        </summary>
        <p className="mt-2 text-sm text-ink-soft">
          The lantern runner is still here. Controls are rough — Ember&apos;s
          Quilt is the game that counts this week.
        </p>
        <ul className="mt-2 space-y-1">
          {listCourses().map((c) => (
            <li key={c.id}>
              <Link
                href={`/games/light-the-block?level=${c.id}`}
                className="text-sm font-semibold text-porch-700"
              >
                {c.name} →
              </Link>
            </li>
          ))}
        </ul>
      </details>

      <p className="text-center text-xs text-ink-soft">
        Weekly coins go to 1st–3rd. They can&apos;t be bought or cashed out.
      </p>
    </div>
  );
}
