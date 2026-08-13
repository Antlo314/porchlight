"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { startRunAction, submitRunAction } from "@/app/(games)/games/actions";
import type { LevelId } from "@/lib/games/types";
import { isLevelId } from "@/lib/games/types";

export function LightTheBlockCanvas({
  levelId,
}: {
  levelId: string;
}) {
  const hostRef = useRef<HTMLDivElement>(null);
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [booting, setBooting] = useState(true);
  const [replayKey, setReplayKey] = useState(0);

  useEffect(() => {
    const el = hostRef.current;
    if (!el) return;
    const id: LevelId = isLevelId(levelId) ? levelId : "kirkwood";
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
        onExit: () => router.push("/games"),
        onReplay: () => {
          setError(null);
          setBooting(true);
          setReplayKey((n) => n + 1);
        },
      });
      setBooting(false);
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
      document.body.style.overflow = prevOverflow;
      document.removeEventListener("touchmove", prevent);
      game?.destroy(true);
    };
  }, [levelId, router, replayKey]);

  return (
    <div className="fixed inset-0 z-50 touch-none bg-ink">
      <div ref={hostRef} className="absolute inset-0" />
      {booting && (
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center text-sm font-semibold text-cream">
          Lighting the porch…
        </div>
      )}
      <div className="pointer-events-none absolute inset-x-0 top-0 z-10 flex justify-between px-3 pt-[max(0.6rem,env(safe-area-inset-top))]">
        <button
          type="button"
          className="pointer-events-auto flex h-11 min-w-11 items-center justify-center rounded-full bg-ink/55 px-3 text-sm font-semibold text-cream"
          onClick={() => router.push("/games")}
        >
          Exit
        </button>
      </div>
      {error && (
        <div className="absolute inset-x-4 top-1/3 rounded-card border border-line bg-card p-4 text-center">
          <p className="font-semibold">{error}</p>
          <button
            type="button"
            className="mt-3 text-sm font-semibold text-porch-700"
            onClick={() => router.push("/games")}
          >
            Back to games
          </button>
        </div>
      )}
    </div>
  );
}
