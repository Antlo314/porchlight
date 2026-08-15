"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { startRunAction, submitRunAction } from "@/app/(games)/games/actions";
import { Button, ButtonLink } from "@/components/ui";
import type { GameControls, RunOutcome } from "@/game/light-the-block/boot";
import { listCourses } from "@/lib/games/levels";
import type { LevelId } from "@/lib/games/types";
import { isLevelId } from "@/lib/games/types";

const PAD =
  "pointer-events-auto select-none touch-none flex items-center justify-center rounded-full border border-cream/25 bg-ink/55 font-semibold text-cream backdrop-blur-sm transition-transform duration-100 active:scale-95 active:bg-porch-600/80";

export function LightTheBlockCanvas({ levelId }: { levelId: string }) {
  const hostRef = useRef<HTMLDivElement>(null);
  const controlsRef = useRef<GameControls | null>(null);
  const router = useRouter();

  const [error, setError] = useState<string | null>(null);
  const [booting, setBooting] = useState(true);
  const [ready, setReady] = useState(false);
  const [paused, setPaused] = useState(false);
  const [muted, setMuted] = useState(false);
  const [outcome, setOutcome] = useState<{ result: RunOutcome; cleared: boolean } | null>(
    null
  );
  const [replayKey, setReplayKey] = useState(0);

  const id: LevelId = isLevelId(levelId) ? levelId : "kirkwood";
  const levelName = listCourses().find((c) => c.id === id)?.name ?? "Light the Block";

  const replay = useCallback(() => {
    controlsRef.current = null;
    setError(null);
    setOutcome(null);
    setReady(false);
    setPaused(false);
    setBooting(true);
    setReplayKey((n) => n + 1);
  }, []);

  const exit = useCallback(() => router.push("/games"), [router]);

  useEffect(() => {
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
        onResult: (result, cleared) => {
          if (cancelled) return;
          setOutcome({ result, cleared });
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
  }, [id, replayKey, exit, replay]);

  const playing = ready && !outcome && !error;

  return (
    <div className="fixed inset-0 z-50 touch-none select-none bg-ink">
      <div ref={hostRef} className="absolute inset-0" />

      {booting && (
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center text-sm font-semibold text-cream">
          Lighting the porch…
        </div>
      )}

      {/* Top chrome. The wrapper stays click-through so taps land on the canvas. */}
      <div className="pointer-events-none absolute inset-x-0 top-0 z-10 flex items-start justify-between px-3 pt-[max(0.6rem,env(safe-area-inset-top))]">
        <button
          type="button"
          className={`${PAD} h-11 min-w-11 px-4 text-sm`}
          onClick={exit}
        >
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

      {/* Thumb controls. Tapping the canvas anywhere also jumps. */}
      {playing && (
        <div className="pointer-events-none absolute inset-x-0 bottom-0 z-10 flex items-end justify-between px-4 pb-[max(1.25rem,env(safe-area-inset-bottom))]">
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
              // Capture so a thumb that slides off the pad still ends the hold.
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
      )}

      {outcome && (
        <div className="absolute inset-0 z-20 flex items-center justify-center bg-ink/70 px-4">
          <ResultPanel
            outcome={outcome}
            levelName={levelName}
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
  onReplay,
  onExit,
}: {
  outcome: { result: RunOutcome; cleared: boolean };
  levelName: string;
  onReplay: () => void;
  onExit: () => void;
}) {
  const { result, cleared } = outcome;
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

      <Button size="lg" className="mt-5" onClick={onReplay}>
        Play again
      </Button>
      <Button size="lg" variant="ghost" className="mt-2" onClick={onExit}>
        Back to games
      </Button>
    </div>
  );
}
