"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { startQuiltAction, submitQuiltAction } from "@/app/(games)/games/actions";
import {
  adjacent,
  createState,
  goalCount,
  goalLabel,
  goalsMet,
  swap,
  type SwapResult,
} from "@/lib/quilt/engine";
import { getNight, nextStoryNight } from "@/lib/quilt/nights";
import { playSfx, startLoop, stopLoop } from "@/lib/quilt/audio";
import { EmberSprite } from "@/components/quilt/EmberSprite";
import { TileView } from "@/components/quilt/Tile";
import { type Cell, type QuiltMove, type QuiltState } from "@/lib/quilt/types";

export function QuiltPlay({
  nightId,
  seed,
  token,
}: {
  nightId: string;
  seed: string;
  token: string;
}) {
  const night = getNight(nightId);
  const router = useRouter();
  const [state, setState] = useState<QuiltState>(() =>
    createState(nightId as QuiltState["nightId"], seed)
  );
  const [selected, setSelected] = useState<Cell | null>(null);
  const [ember, setEmber] = useState(night?.ember ?? "Tap a tile, then a neighbor.");
  const [moves, setMoves] = useState<QuiltMove[]>([]);
  const [shake, setShake] = useState<string | null>(null);
  const [ended, setEnded] = useState<"won" | "lost" | null>(null);
  const [pending, startTransition] = useTransition();
  const [lesson, setLesson] = useState(nightId === "night-0" ? 0 : -1);
  const [emberMood, setEmberMood] = useState<"idle" | "talk" | "cheer">("idle");
  const [freshIds, setFreshIds] = useState<Set<number>>(new Set());
  const [flash, setFlash] = useState(false);

  useEffect(() => {
    startLoop();
    return () => stopLoop();
  }, []);

  const over = ended ?? (goalsMet(state) ? "won" : state.movesLeft <= 0 ? "lost" : null);

  function speak(text: string, mood: "talk" | "cheer" = "talk") {
    setEmber(text);
    setEmberMood(mood);
    window.setTimeout(() => setEmberMood("idle"), 900);
  }

  function tap(cell: Cell) {
    if (over) return;
    startLoop();
    if (!selected) {
      setSelected(cell);
      playSfx("tap", 0.4);
      return;
    }
    if (selected.r === cell.r && selected.c === cell.c) {
      setSelected(null);
      return;
    }
    if (!adjacent(selected, cell)) {
      setSelected(cell);
      speak("Only neighbors. Up, down, left, or right.");
      return;
    }
    const res: SwapResult = swap(state, selected, cell);
    setSelected(null);
    if (!res.ok) {
      playSfx("invalid", 0.4);
      setShake(`${cell.r},${cell.c}`);
      window.setTimeout(() => setShake(null), 240);
      speak(
        res.reason === "no-match"
          ? "That swap doesn't stitch. Need three or more of a color or a shape, in a straight line."
          : "That one won't go."
      );
      return;
    }
    playSfx("swap", 0.45);
    const nextMoves = [...moves, { a: selected, b: cell }];
    setMoves(nextMoves);
    const prev = new Set(
      state.board.flat().map((t) => t?.id).filter((id): id is number => id != null)
    );
    const born = new Set<number>();
    for (const row of res.state.board) {
      for (const t of row) {
        if (t && !prev.has(t.id)) born.add(t.id);
      }
    }
    setFreshIds(born);
    setFlash(res.state.combo > 1);
    window.setTimeout(() => {
      setFreshIds(new Set());
      setFlash(false);
    }, 280);
    setState(res.state);
    const won = goalsMet(res.state);
    if (res.state.progress.trueMatches > state.progress.trueMatches) {
      playSfx("true", 0.65);
      speak("True stitch! Color and shape together. That's the quilt.", "cheer");
    } else if (res.state.combo > 1) {
      playSfx("cascade", 0.55);
      speak(`Cascade — ${res.state.combo} deep. Keep going.`);
    } else {
      playSfx("match", 0.55);
      speak("Glows. Find the next line.");
    }
    if (won || res.state.movesLeft <= 0) {
      const kind = won ? "won" : "lost";
      setEnded(kind);
      playSfx(kind === "won" ? "win" : "lose", 0.7);
      speak(
        won ? "The stoop is lit. That's a night for the rail." : "Moves are gone. Replay and try another stitch.",
        won ? "cheer" : "talk"
      );
      startTransition(async () => {
        await submitQuiltAction({
          token,
          moves: nextMoves,
          claimedScore: res.state.score,
        });
      });
    }
  }

  if (!night) return <p className="p-4">That night isn't on the quilt.</p>;

  return (
    <div className="mx-auto flex min-h-dvh max-w-md flex-col bg-cream px-3 pb-8 pt-3">
      <div className="mb-2 flex items-center justify-between">
        <button
          type="button"
          className="min-h-11 text-sm font-semibold text-porch-700"
          onClick={() => router.push("/games")}
        >
          ← Hub
        </button>
        <p className="text-sm font-bold">{night.title}</p>
        <p className="text-sm tabular-nums text-ink-soft">{state.movesLeft} moves</p>
      </div>

      <div className="mb-2 grid grid-cols-3 gap-2 text-center text-xs">
        {night.goals.map((g, i) => {
          const have = goalCount(state, g);
          const done = have >= g.n;
          return (
            <div
              key={i}
              className={`rounded-xl border px-2 py-1.5 ${
                done ? "border-pine-500 bg-pine-500/10 text-pine-700" : "border-line bg-card"
              }`}
            >
              <p className="font-semibold tabular-nums">
                {Math.min(have, g.n)}/{g.n}
              </p>
              <p className="text-ink-soft">{goalLabel(g)}</p>
            </div>
          );
        })}
      </div>

      <div
        className={`mx-auto grid w-full max-w-[390px] gap-1 rounded-2xl bg-[#2b2420] p-2 ${
          flash ? "quilt-flash" : ""
        }`}
        style={{ gridTemplateColumns: "repeat(7, minmax(0, 1fr))" }}
      >
        {state.board.map((row, r) =>
          row.map((tile, c) => {
            const key = `${r},${c}`;
            return (
              <TileView
                key={tile?.id ?? key}
                tile={tile}
                selected={selected?.r === r && selected?.c === c}
                shaking={shake === key}
                dropping={Boolean(tile && freshIds.has(tile.id))}
                popping={false}
                delay={(r * 7 + c) * 40}
                onTap={() => tap({ r, c })}
              />
            );
          })
        )}
      </div>

      <p className="mt-2 text-center text-sm font-bold tabular-nums">{state.score} glow</p>

      <div className="mt-3 flex gap-3 rounded-card border border-line bg-card p-3">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <EmberSprite mood={emberMood} />
        <p className="text-sm leading-snug text-ink">{ember}</p>
      </div>

      {lesson >= 0 && lesson < 4 && (
        <div className="fixed inset-0 z-40 flex items-end justify-center bg-ink/55 p-4">
          <div className="w-full max-w-md rounded-card border border-porch-200 bg-cream p-4">
            <div className="flex gap-3">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <EmberSprite mood="talk" />
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-porch-700">
                  Ember · walkthrough {lesson + 1}/4
                </p>
                <p className="mt-1 text-[15px] leading-snug">
                  {[
                    "Tap one tile. It will light up. That's your pick.",
                    "Tap a tile next to it — up, down, left, or right. They swap.",
                    "Three or more in a line of the same COLOR or the same SHAPE will glow and vanish.",
                    "Same color AND same shape is a true stitch. Finish my card before moves run out. Then try this week's porch to rank.",
                  ][lesson]}
                </p>
              </div>
            </div>
            <button
              type="button"
              className="mt-4 min-h-11 w-full rounded-card bg-porch-600 font-semibold text-white"
              onClick={() => {
                playSfx("tap", 0.4);
                setLesson((n) => (n < 3 ? n + 1 : -1));
              }}
            >
              {lesson < 3 ? "Next" : "Start stitching"}
            </button>
          </div>
        </div>
      )}

      {over && (
        <div className="mt-4 rounded-card border border-porch-200 bg-porch-50 p-4 text-center">
          <p className="text-lg font-bold">
            {over === "won" ? "Stoop lit" : "Out of moves"}
          </p>
          <p className="mt-1 text-sm text-ink-soft">
            {state.score} glow{pending ? " · saving…" : ""}
          </p>
          <div className="mt-3 flex flex-col gap-2">
            {over === "won" && nextStoryNight(nightId) && (
              <button
                type="button"
                className="min-h-11 w-full rounded-card bg-porch-600 font-semibold text-white"
                onClick={() =>
                  router.push(`/games/quilt?night=${nextStoryNight(nightId)}`)
                }
              >
                Next night →
              </button>
            )}
            <div className="flex gap-2">
              <button
                type="button"
                className="min-h-11 flex-1 rounded-card bg-porch-600 font-semibold text-white"
                onClick={() => window.location.reload()}
              >
                Play again
              </button>
              <button
                type="button"
                className="min-h-11 flex-1 rounded-card border border-line bg-card font-semibold"
                onClick={() => router.push("/games")}
              >
                Hub
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export function QuiltBoot({ nightId }: { nightId: string }) {
  const [boot, setBoot] = useState<
    | { status: "loading" }
    | { status: "ready"; seed: string; token: string; nightId: string }
    | { status: "error"; error: string }
  >({ status: "loading" });

  useEffect(() => {
    let live = true;
    startQuiltAction(nightId).then((res) => {
      if (!live) return;
      if (!res.ok) setBoot({ status: "error", error: res.error });
      else setBoot({ status: "ready", seed: res.seed, token: res.token, nightId: res.nightId });
    });
    return () => {
      live = false;
    };
  }, [nightId]);

  if (boot.status === "loading") {
    return <p className="p-8 text-center text-sm font-semibold">Ember is lighting the quilt…</p>;
  }
  if (boot.status === "error") {
    return <p className="p-8 text-center text-sm">{boot.error}</p>;
  }
  return <QuiltPlay nightId={boot.nightId} seed={boot.seed} token={boot.token} />;
}
