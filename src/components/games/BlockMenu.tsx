"use client";

import { ButtonLink } from "@/components/ui";
import { COURSE_ORDER, type LevelId } from "@/lib/games/types";
import { BlockLobby } from "./BlockLobby";

type Course = {
  id: LevelId;
  name: string;
  blurb: string;
  teaches: string;
  mood: "dusk" | "storm" | "night";
  length: number;
};

/** A drifting skyline drawn once and repeated, so the loop is seamless. */
function Skyline({ className, fill }: { className: string; fill: string }) {
  const bars: string[] = [];
  for (let i = 0; i < 26; i++) {
    const x = i * 46;
    const h = 40 + ((i * 37) % 62);
    bars.push(`M${x} 120 L${x} ${120 - h} L${x + 30} ${120 - h} L${x + 30} 120 Z`);
  }
  const d = bars.join(" ");
  return (
    <svg
      aria-hidden
      viewBox="0 0 1196 120"
      preserveAspectRatio="none"
      className={`absolute bottom-0 left-0 h-full w-[200%] ${className}`}
    >
      <path d={d} fill={fill} />
      <path d={d} fill={fill} transform="translate(598 0)" />
    </svg>
  );
}

function Embers() {
  const bits = [
    { left: "12%", dx: "14px", dur: "5.2s", delay: "0s" },
    { left: "28%", dx: "-10px", dur: "6.4s", delay: "1.1s" },
    { left: "46%", dx: "18px", dur: "4.8s", delay: "2.3s" },
    { left: "63%", dx: "-16px", dur: "6.9s", delay: "0.6s" },
    { left: "81%", dx: "9px", dur: "5.6s", delay: "3.1s" },
    { left: "92%", dx: "-12px", dur: "6.1s", delay: "1.8s" },
  ];
  return (
    <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden">
      {bits.map((b, i) => (
        <span
          key={i}
          className="ltb-ember absolute bottom-8 h-1.5 w-1.5 rounded-full bg-porch-300"
          style={
            {
              left: b.left,
              "--dx": b.dx,
              "--dur": b.dur,
              "--delay": b.delay,
            } as React.CSSProperties
          }
        />
      ))}
    </div>
  );
}

export function BlockMenu({
  courses,
  cleared,
  next,
  demo,
  remainingToday,
}: {
  courses: Course[];
  cleared: LevelId[];
  next: LevelId;
  demo: boolean;
  remainingToday: number;
}) {
  const story = courses.filter((c) => c.id !== "daily");
  const daily = courses.find((c) => c.id === "daily");
  const nextCourse = story.find((c) => c.id === next) ?? story[0]!;
  const doneCount = story.filter((c) => cleared.includes(c.id)).length;
  const fresh = doneCount === 0;

  return (
    <div className="space-y-5 pb-8">
      {/* ------------------------------------------------ animated title card */}
      <div className="relative overflow-hidden rounded-card bg-ink shadow-glow">
        <div className="relative h-56">
          <div className="absolute inset-0 bg-gradient-to-b from-[#3a2a4a] via-[#c2661b] to-[#2b2420]" />
          <div className="absolute inset-x-0 bottom-0 h-28 opacity-40">
            <Skyline className="ltb-drift-far" fill="#264536" />
          </div>
          <div className="absolute inset-x-0 bottom-0 h-20 opacity-80">
            <Skyline className="ltb-drift-near" fill="#1c1614" />
          </div>
          <Embers />

          <div className="absolute left-1/2 top-10 -translate-x-1/2">
            <span className="ltb-glow absolute -inset-6 rounded-full bg-porch-400/50 blur-xl" />
            <span className="ltb-bob relative block text-6xl leading-none">🏮</span>
          </div>

          <div className="absolute inset-x-0 bottom-3 text-center">
            <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-porch-200">
              Porchlight Games
            </p>
            <h1 className="font-display text-4xl font-semibold text-cream drop-shadow">
              Light the Block
            </h1>
          </div>
        </div>

        <div className="px-4 pb-4 pt-3 text-cream">
          <p className="text-sm text-porch-100">
            You&apos;re the porch lantern. Run the stoops, light the dark ones, and earn a
            drip of Porch Credits.
          </p>

          <div className="mt-3">
            <div className="flex items-center justify-between text-xs font-semibold text-porch-200">
              <span>{fresh ? "Start the block" : `Up next · ${nextCourse.name}`}</span>
              <span className="tabular-nums">
                {doneCount}/{story.length}
              </span>
            </div>
            <div className="mt-1.5 flex gap-1.5">
              {COURSE_ORDER.map((id) => {
                const done = cleared.includes(id);
                const current = id === next;
                return (
                  <span
                    key={id}
                    className={`h-1.5 flex-1 rounded-full ${
                      done ? "bg-porch-400" : current ? "bg-porch-200/70" : "bg-cream/20"
                    }`}
                  />
                );
              })}
            </div>
          </div>

          <ButtonLink
            href={`/games/light-the-block?level=${nextCourse.id}`}
            size="lg"
            className="mt-4"
          >
            {fresh ? "Start — Kirkwood Dusk" : `Continue — ${nextCourse.name}`}
          </ButtonLink>
          <p className="mt-2 text-center text-xs text-porch-200">
            {nextCourse.teaches}
          </p>
        </div>
      </div>

      <BlockLobby course="lobby" status="lobby" />

      {/* -------------------------------------------------------- daily block */}
      {daily && (
        <ButtonLink
          href="/games/light-the-block?level=daily"
          variant="secondary"
          size="lg"
        >
          Daily Block — everyone runs this one
        </ButtonLink>
      )}

      {/* ------------------------------------------------------------ credits */}
      <div className="surface flex items-center justify-between gap-3 p-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-ink-soft">
            Credits on the drip
          </p>
          <p className="mt-0.5 text-sm text-ink-soft">
            {demo
              ? "Log in to keep what you earn and open the later blocks."
              : `${remainingToday} still available this hour.`}
          </p>
        </div>
        <span className="font-display text-2xl font-semibold tabular-nums text-porch-700">
          {demo ? 0 : remainingToday}
        </span>
      </div>

      {demo && (
        <ButtonLink href="/login?next=/games" size="lg" variant="secondary">
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
