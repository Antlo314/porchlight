"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { startRunAction, submitRunAction } from "@/app/(games)/games/actions";
import { Button, ButtonLink } from "@/components/ui";
import type { GameControls, RunOutcome } from "@/game/light-the-block/boot";
import { getLevel } from "@/lib/games/levels";
import { COURSE_ORDER, type LevelId } from "@/lib/games/types";
import { isLevelId } from "@/lib/games/types";
import { BlockLobby } from "./BlockLobby";

const PAD =
  "pointer-events-auto select-none touch-none flex items-center justify-center rounded-full border border-cream/25 bg-ink/55 font-semibold text-cream backdrop-blur-sm transition-transform duration-100 active:scale-95 active:bg-porch-600/80";

const MOOD_WASH: Record<string, string> = {
  dusk: "linear-gradient(160deg, #3a2a4a 0%, #c2661b 55%, #2b2420 100%)",
  storm: "linear-gradient(160deg, #1a2430 0%, #3d4a58 55%, #1c1614 100%)",
  night: "linear-gradient(160deg, #0d1020 0%, #1b2450 55%, #14181c 100%)",
};

export function LightTheBlockCanvas({ levelId }: { levelId: string }) {
  const hostRef = useRef<HTMLDivElement>(null);
  const controlsRef = useRef<GameControls | null>(null);
  const router = useRouter();

  const id: LevelId = isLevelId(levelId) ? levelId : "kirkwood";
  const level = getLevel(id, id);

  const [phase, setPhase] = useState<"intro" | "play">("intro");
  const [error, setError] = useState<string | null>(null);
  const [booting, setBooting] = useState(true);
  const [ready, setReady] = useState(false);
  const [paused, setPaused] = useState(false);
  const [muted, setMuted] = useState(false);
  const [outcome, setOutcome] = useState<{
    result: RunOutcome;
    cleared: boolean;
    reason?: string;
  } | null>(null);
  const [replayKey, setReplayKey] = useState(0);
  const presenceStatus = outcome ? "done" : phase === "play" ? "running" : "lobby";

  const nextCourse = (() => {
    const i = COURSE_ORDER.indexOf(id);
    return i >= 0 && i < COURSE_ORDER.length - 1 ? COURSE_ORDER[i + 1]! : null;
  })();

  const replay = useCallback(() => {
    controlsRef.current = null;
    setError(null);
    setOutcome(null);
    setReady(false);
    setPaused(false);
    setBooting(true);
    setPhase("intro");
    setReplayKey((n) => n + 1);
  }, []);

  const exit = useCallback(() => router.push("/games"), [router]);

  useEffect(() => {
    if (phase !== "play") return;
    const el = hostRef.current;
    if (!el) return;
    let game: { destroy: (remove: boolean) => void } | null = null;
    let cancelled = false;

    (async () => {
      const started = await startRunAction(id);
      if (cancelled) return;
      if (!started.ok) {
        setError(started.error);
        setBooting(false);
        return;
      }
      const { createLightTheBlockGame } = await import("@/game/light-the-block/boot");
      if (cancelled) return;
      game = await createLightTheBlockGame(el, {
        levelId: id,
        seed: started.seed,
        token: started.token,
        demo: started.demo,
        remainingToday: started.remainingToday,
        onSubmit: (input) => submitRunAction(input),
        onExit: exit,
        onReplay: replay,
        onReady: (controls) => {
          if (cancelled) return;
          controlsRef.current = controls;
          setReady(true);
          setBooting(false);
        },
        onStatus: (status) => {
          if (cancelled) return;
          setPaused(status.paused);
          setMuted(status.muted);
        },
        onResult: (result, cleared, reason) => {
          if (cancelled) return;
          setOutcome({ result, cleared, reason });
        },
      });
    })().catch((err: unknown) => {
      if (!cancelled) {
        setError(err instanceof Error ? err.message : "The lantern wouldn't light.");
        setBooting(false);
      }
    });

    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const prevent = (e: TouchEvent) => {
      if (e.target instanceof HTMLElement && el.contains(e.target)) e.preventDefault();
    };
    document.addEventListener("touchmove", prevent, { passive: false });

    return () => {
      cancelled = true;
      controlsRef.current = null;
      document.body.style.overflow = prevOverflow;
      document.removeEventListener("touchmove", prevent);
      game?.destroy(true);
    };
  }, [id, replayKey, phase, exit, replay]);

  if (phase === "intro") {
    return (
      <div
        className="fixed inset-0 z-50 flex flex-col justify-between overflow-y-auto px-5 pb-[max(1.5rem,env(safe-area-inset-bottom))] pt-[max(1.5rem,env(safe-area-inset-top))]"
        style={{ background: MOOD_WASH[level.mood] }}
      >
        <button
          type="button"
          className="min-h-11 self-start text-sm font-semibold text-cream/80"
          onClick={exit}
        >
          ← Games
        </button>

        <div className="animate-fade-in mx-auto w-full max-w-md text-center text-cream">
          <div className="relative mx-auto mb-4 h-20 w-20">
            <span className="ltb-glow absolute -inset-4 rounded-full bg-porch-400/50 blur-xl" />
            <span className="ltb-bob relative block text-6xl leading-none">🏮</span>
          </div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-porch-200">
            {id === "daily" ? "Daily Block" : `Block ${COURSE_ORDER.indexOf(id) + 1} of ${COURSE_ORDER.length}`}
          </p>
          <h1 className="mt-2 font-display text-4xl font-semibold">{level.name}</h1>
          <p className="mx-auto mt-3 max-w-xs text-[15px] leading-snug text-cream/85">
            {level.scene}
          </p>

          <div className="mt-6 rounded-card border border-cream/15 bg-ink/40 p-4 text-left backdrop-blur-sm">
            <p className="text-xs font-semibold uppercase tracking-wide text-porch-200">
              This block teaches
            </p>
            <p className="mt-1 text-sm text-cream/90">{level.teaches}</p>
            <dl className="mt-3 grid grid-cols-3 gap-2 text-center">
              {[
                ["Porches", level.porches.length],
                ["Coins", level.coins.length],
                ["Keys", level.keys.length],
              ].map(([label, n]) => (
                <div key={label as string} className="rounded-xl bg-cream/10 py-2">
                  <dd className="font-display text-lg font-semibold tabular-nums">{n}</dd>
                  <dt className="text-[11px] text-cream/70">{label}</dt>
                </div>
              ))}
            </dl>
          </div>

          <p className="mt-4 text-xs text-cream/70">
            ◀ ▶ to walk · Jump, then Jump again to float · ↓ to drop through a rail
            <br />
            Keyboard: arrows or WASD, space to jump
          </p>
        </div>

        <div className="mx-auto w-full max-w-md">
          <Button size="lg" className="mt-6" onClick={() => setPhase("play")}>
            Light it up
          </Button>
        </div>
      </div>
    );
  }

  const playing = ready && !outcome && !error;

  return (
    <div className="fixed inset-0 z-50 touch-none select-none bg-ink">
      <div ref={hostRef} className="absolute inset-0" />

      {booting && (
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center text-sm font-semibold text-cream">
          Lighting the porch…
        </div>
      )}

      <div className="pointer-events-none absolute left-3 top-16 z-10 w-[min(16rem,calc(100%-1.5rem))] pt-[max(0.2rem,env(safe-area-inset-top))]">
        <div className="pointer-events-auto">
          <BlockLobby course={id} status={presenceStatus} compact />
        </div>
      </div>

      <div className="pointer-events-none absolute inset-x-0 top-0 z-10 flex items-start justify-between px-3 pt-[max(0.6rem,env(safe-area-inset-top))]">
        <button type="button" className={`${PAD} h-11 min-w-11 px-4 text-sm`} onClick={exit}>
          Exit
        </button>
        {playing && (
          <div className="flex gap-2">
            <button
              type="button"
              aria-label={muted ? "Unmute" : "Mute"}
              aria-pressed={muted}
              className={`${PAD} h-11 w-11 text-lg`}
              onClick={() => setMuted(controlsRef.current?.toggleMute() ?? muted)}
            >
              {muted ? "🔇" : "🔊"}
            </button>
            <button
              type="button"
              aria-label={paused ? "Resume" : "Pause"}
              aria-pressed={paused}
              className={`${PAD} h-11 min-w-11 px-4 text-sm`}
              onClick={() => setPaused(controlsRef.current?.togglePause() ?? paused)}
            >
              {paused ? "Resume" : "Pause"}
            </button>
          </div>
        )}
      </div>

      {playing && (
        <div className="pointer-events-none absolute inset-x-0 bottom-0 z-10 flex items-end justify-between px-4 pb-[max(1.25rem,env(safe-area-inset-bottom))]">
          {/* Left thumb: walk. Capture the pointer so a finger that slides off
              the pad still releases it instead of sticking on. */}
          <div className="flex gap-2">
            {([-1, 1] as const).map((dir) => (
              <button
                key={dir}
                type="button"
                aria-label={dir < 0 ? "Move left" : "Move right"}
                className={`${PAD} h-16 w-16 text-2xl`}
                onContextMenu={(e) => e.preventDefault()}
                onPointerDown={(e) => {
                  e.preventDefault();
                  try {
                    e.currentTarget.setPointerCapture(e.pointerId);
                  } catch {
                    /* capture is a nicety, not a requirement */
                  }
                  controlsRef.current?.move(dir);
                }}
                onPointerUp={() => controlsRef.current?.move(0)}
                onPointerCancel={() => controlsRef.current?.move(0)}
              >
                {dir < 0 ? "◀" : "▶"}
              </button>
            ))}
          </div>
          <div className="flex items-end gap-2">
          <button
            type="button"
            aria-label="Drop through the rail"
            className={`${PAD} h-16 w-16 text-2xl`}
            onContextMenu={(e) => e.preventDefault()}
            onPointerDown={(e) => {
              e.preventDefault();
              controlsRef.current?.drop();
            }}
          >
            ↓
          </button>
          <button
            type="button"
            aria-label="Jump — hold to float higher"
            className={`${PAD} h-24 w-24 text-base`}
            onContextMenu={(e) => e.preventDefault()}
            onPointerDown={(e) => {
              e.preventDefault();
              try {
                e.currentTarget.setPointerCapture(e.pointerId);
              } catch {
                /* capture is a nicety, not a requirement */
              }
              controlsRef.current?.jumpStart();
            }}
            onPointerUp={() => controlsRef.current?.jumpEnd()}
            onPointerCancel={() => controlsRef.current?.jumpEnd()}
          >
            Jump
          </button>
          </div>
        </div>
      )}

      {outcome && (
        <div className="absolute inset-0 z-20 flex items-center justify-center bg-ink/70 px-4">
          <ResultPanel
            outcome={outcome}
            levelName={level.name}
            nextCourse={nextCourse}
            onReplay={replay}
            onExit={exit}
          />
        </div>
      )}

      {error && (
        <div className="absolute inset-x-4 top-1/3 z-20 rounded-card border border-line bg-card p-4 text-center">
          <p className="font-semibold">{error}</p>
          <ButtonLink href="/games" variant="secondary" className="mt-3">
            Back to games
          </ButtonLink>
        </div>
      )}
    </div>
  );
}

function ResultPanel({
  outcome,
  levelName,
  nextCourse,
  onReplay,
  onExit,
}: {
  outcome: { result: RunOutcome; cleared: boolean; reason?: string };
  levelName: string;
  nextCourse: LevelId | null;
  onReplay: () => void;
  onExit: () => void;
}) {
  const { result, cleared, reason } = outcome;
  const title = !result.ok ? "Run ended" : cleared ? "Block lit" : "Lantern snuffed";

  return (
    <div className="w-full max-w-xs rounded-card border border-line bg-card p-5 text-center shadow-lift animate-pop">
      <p className="text-xs font-semibold uppercase tracking-wide text-ink-soft">
        {levelName}
      </p>
      <h2 className="mt-1 font-display text-2xl font-semibold">{title}</h2>

      {result.ok ? (
        <>
          <p className="mt-3 font-display text-4xl font-semibold tabular-nums text-porch-700">
            {result.score}
          </p>
          <p className="text-sm text-ink-soft">glow</p>
          <p className="mt-2 text-sm text-ink-soft">
            {result.porchesLit} porches · {result.coins} coins
          </p>
          {reason && <p className="mt-2 text-sm font-semibold text-ink">{reason}</p>}
          <p className="mt-3 text-sm font-semibold">
            {result.demo
              ? "Log in to keep these Porch Credits"
              : result.credits > 0
                ? `+${result.credits} Porch Credit${result.credits === 1 ? "" : "s"}`
                : result.reason === "COOLDOWN" || result.reason === "DAILY_CAP"
                  ? "The drip is full for now — come back in a bit"
                  : "Nice run. The drip needs a stronger score."}
          </p>
        </>
      ) : (
        <p className="mt-3 text-sm text-ink-soft">{result.error}</p>
      )}

      {cleared && nextCourse && result.ok && !result.demo && (
        <ButtonLink
          size="lg"
          href={`/games/light-the-block?level=${nextCourse}`}
          className="mt-4"
        >
          Next block →
        </ButtonLink>
      )}

      <Button size="lg" variant={cleared && nextCourse ? "secondary" : "primary"} className="mt-2" onClick={onReplay}>
        Play again
      </Button>
      <Button size="lg" variant="ghost" className="mt-2" onClick={onExit}>
        Back to games
      </Button>
    </div>
  );
}
