"use client";

import { useCallback, useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { startQuiltAction, submitQuiltAction } from "@/app/(games)/games/actions";
import {
  adjacent,
  createState,
  findHint,
  goalCount,
  goalLabel,
  goalsMet,
  isBoarded,
  swap,
  type SwapResult,
} from "@/lib/quilt/engine";
import { STORY_NIGHTS, getNight, nextStoryNight, nightIndex } from "@/lib/quilt/nights";
import { playSfx, startLoop, stopLoop } from "@/lib/quilt/audio";
import { EmberSprite } from "@/components/quilt/EmberSprite";
import { TileView } from "@/components/quilt/Tile";
import { Button, ButtonLink } from "@/components/ui";
import {
  MOOD_WASH,
  type Cell,
  type Goal,
  type Night,
  type QuiltMove,
  type QuiltState,
} from "@/lib/quilt/types";

const WIN_HOLD_MS = 2400;

function wash(night: Night) {
  return MOOD_WASH[night.mood ?? "dusk"];
}

function GoalChip({ state, goal }: { state: QuiltState; goal: Goal }) {
  const have = goalCount(state, goal);
  const done = have >= goal.n;
  const pct = Math.min(100, Math.round((have / goal.n) * 100));
  return (
    <div
      className={`relative min-w-[4.5rem] flex-1 overflow-hidden rounded-xl border px-2 py-1.5 text-center ${
        done ? "border-pine-500 bg-pine-500/10 text-pine-700" : "border-line bg-card"
      }`}
    >
      <span
        aria-hidden
        className="absolute inset-y-0 left-0 bg-porch-200/40 transition-[width] duration-300"
        style={{ width: `${pct}%` }}
      />
      <p className="relative font-semibold tabular-nums">
        {done ? "✓ " : ""}
        {Math.min(have, goal.n)}/{goal.n}
      </p>
      <p className="relative text-[11px] leading-tight text-ink-soft">{goalLabel(goal)}</p>
    </div>
  );
}

/** The card that plays before every night. */
function NightIntro({
  night,
  onBegin,
  onExit,
}: {
  night: Night;
  onBegin: () => void;
  onExit: () => void;
}) {
  const idx = nightIndex(night.id);
  const label =
    idx < 0 ? "This week's porch" : `Night ${idx} of ${STORY_NIGHTS.length - 1}`;

  return (
    <div
      className="flex min-h-dvh flex-col justify-between px-4 pb-[max(1.5rem,env(safe-area-inset-bottom))] pt-[max(1.5rem,env(safe-area-inset-top))]"
      style={{ background: wash(night) }}
    >
      <button
        type="button"
        className="min-h-11 self-start text-sm font-semibold text-cream/80"
        onClick={onExit}
      >
        ← Hub
      </button>

      <div className="animate-fade-in mx-auto w-full max-w-md text-center text-cream">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-porch-200">
          {label}
        </p>
        <h1 className="mt-2 font-display text-4xl font-semibold">{night.title}</h1>
        <p className="mx-auto mt-3 max-w-xs text-[15px] leading-snug text-cream/85">
          {night.scene}
        </p>

        <div className="mt-6 flex items-start gap-3 rounded-card border border-cream/15 bg-ink/45 p-3 text-left backdrop-blur-sm">
          <EmberSprite mood="talk" className="h-14 w-14" />
          <p className="text-sm leading-snug text-cream/90">{night.ember}</p>
        </div>

        <div className="mt-4 rounded-card border border-cream/15 bg-ink/35 p-3 backdrop-blur-sm">
          <p className="text-xs font-semibold uppercase tracking-wide text-porch-200">
            Tonight&apos;s card · {night.moves} moves
          </p>
          <ul className="mt-2 space-y-1 text-sm text-cream/90">
            {night.goals.map((g, i) => (
              <li key={i} className="flex items-center justify-between gap-3">
                <span className="capitalize">{goalLabel(g)}</span>
                <span className="font-bold tabular-nums">{g.n}</span>
              </li>
            ))}
            {night.boards ? (
              <li className="flex items-center justify-between gap-3 border-t border-cream/15 pt-1.5">
                <span>Boarded windows</span>
                <span className="font-bold tabular-nums">{night.boards}</span>
              </li>
            ) : null}
          </ul>
        </div>
      </div>

      <div className="mx-auto w-full max-w-md">
        <Button size="lg" className="mt-6" onClick={onBegin}>
          Begin
        </Button>
      </div>
    </div>
  );
}

function QuiltRun({
  nightId,
  seed,
  token,
  demo,
  onNext,
  onReplay,
  onExit,
}: {
  nightId: string;
  seed: string;
  token: string;
  demo: boolean;
  onNext: (next: string) => void;
  onReplay: () => void;
  onExit: () => void;
}) {
  const night = getNight(nightId);
  const [phase, setPhase] = useState<"intro" | "play">("intro");
  const [state, setState] = useState<QuiltState>(() =>
    createState(nightId as QuiltState["nightId"], seed)
  );
  const [selected, setSelected] = useState<Cell | null>(null);
  const [ember, setEmber] = useState(night?.ember ?? "Tap a tile, then a neighbor.");
  const [moves, setMoves] = useState<QuiltMove[]>([]);
  const [shake, setShake] = useState<string | null>(null);
  const [ended, setEnded] = useState<"won" | "lost" | null>(null);
  const [, startTransition] = useTransition();
  const [lesson, setLesson] = useState(-1);
  const [emberMood, setEmberMood] = useState<"idle" | "talk" | "cheer">("idle");
  const [freshIds, setFreshIds] = useState<Set<number>>(new Set());
  const [burst, setBurst] = useState<{ key: number; cells: Cell[]; gain: number } | null>(
    null
  );
  const [flash, setFlash] = useState(false);
  const [fails, setFails] = useState(0);
  const [hint, setHint] = useState<{ a: Cell; b: Cell } | null>(null);
  const [saving, setSaving] = useState(false);

  const savedRef = useRef<Promise<unknown> | null>(null);
  const burstKey = useRef(0);

  useEffect(() => {
    if (phase !== "play") return;
    startLoop();
    return () => stopLoop();
  }, [phase]);

  const over = ended ?? (goalsMet(state) ? "won" : state.movesLeft <= 0 ? "lost" : null);
  const next = nextStoryNight(nightId);
  const canAdvance = over === "won" && next !== null && !demo;

  // Roll into the next night — but only once the run is actually saved, since
  // the server unlocks the next night by reading this run's finished row.
  useEffect(() => {
    if (!canAdvance || !next) return;
    let cancelled = false;
    (async () => {
      try {
        await savedRef.current;
      } catch {
        /* a failed save still shouldn't trap the player here */
      }
      if (cancelled) return;
      await new Promise((r) => window.setTimeout(r, WIN_HOLD_MS));
      if (!cancelled) onNext(next);
    })();
    return () => {
      cancelled = true;
    };
  }, [canAdvance, next, onNext]);

  const speak = useCallback((text: string, mood: "talk" | "cheer" = "talk") => {
    setEmber(text);
    setEmberMood(mood);
    window.setTimeout(() => setEmberMood("idle"), 900);
  }, []);

  function finish(kind: "won" | "lost", finalMoves: QuiltMove[], finalScore: number) {
    setEnded(kind);
    setSaving(true);
    playSfx(kind === "won" ? "win" : "lose", 0.7);
    speak(
      kind === "won"
        ? "The stoop is lit. That's a night for the rail."
        : "Moves are gone. Replay and try another stitch.",
      kind === "won" ? "cheer" : "talk"
    );
    startTransition(() => {
      const p = submitQuiltAction({
        token,
        moves: finalMoves,
        claimedScore: finalScore,
      }).finally(() => setSaving(false));
      savedRef.current = p;
    });
  }

  function tap(cell: Cell) {
    if (over || phase !== "play") return;
    startLoop();
    const tile = state.board[cell.r]?.[cell.c];
    if (isBoarded(tile)) {
      playSfx("invalid", 0.35);
      setShake(`${cell.r},${cell.c}`);
      window.setTimeout(() => setShake(null), 240);
      speak("That window's boarded. Match a line through it to pull the boards off.");
      return;
    }
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
    setHint(null);
    if (!res.ok) {
      playSfx("invalid", 0.4);
      setShake(`${cell.r},${cell.c}`);
      window.setTimeout(() => setShake(null), 240);
      const nextFails = fails + 1;
      setFails(nextFails);
      speak(
        res.reason === "boarded"
          ? "Boarded tiles won't move. Stitch a line through one instead."
          : res.reason === "no-match"
            ? nextFails >= 2
              ? "That swap doesn't stitch. Tap Show a stitch if you want a hint."
              : "That swap doesn't stitch. Need three or more of a color or a shape, in a straight line."
            : "That one won't go."
      );
      return;
    }

    setFails(0);
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
    burstKey.current += 1;
    setBurst({
      key: burstKey.current,
      cells: res.state.lastCleared,
      gain: res.state.score - state.score,
    });
    window.setTimeout(() => {
      setFreshIds(new Set());
      setFlash(false);
    }, 300);
    window.setTimeout(() => setBurst(null), 1000);

    setState(res.state);

    const boardsOff = res.state.progress.boardsFreed > state.progress.boardsFreed;
    const won = goalsMet(res.state);
    if (boardsOff) {
      playSfx("true", 0.6);
      speak("There — the boards come off. That window's ours again.", "cheer");
    } else if (res.state.progress.trueMatches > state.progress.trueMatches) {
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
      finish(won ? "won" : "lost", nextMoves, res.state.score);
    }
  }

  if (!night) return <p className="p-4">That night isn&apos;t on the quilt.</p>;

  if (phase === "intro") {
    return (
      <NightIntro
        night={night}
        onExit={onExit}
        onBegin={() => {
          startLoop();
          playSfx("tap", 0.4);
          setPhase("play");
          if (nightId === "night-0") setLesson(0);
        }}
      />
    );
  }

  const idx = nightIndex(nightId);
  const cols = `repeat(${state.size}, minmax(0, 1fr))`;

  return (
    <div className="min-h-dvh" style={{ background: wash(night) }}>
      <div className="mx-auto flex min-h-dvh max-w-md flex-col px-3 pb-[max(1.5rem,env(safe-area-inset-bottom))] pt-[max(0.75rem,env(safe-area-inset-top))]">
        <div className="mb-2 flex items-center justify-between text-cream">
          <button
            type="button"
            className="min-h-11 text-sm font-semibold text-cream/80"
            onClick={onExit}
          >
            ← Hub
          </button>
          <div className="text-center">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-porch-200">
              {idx < 0 ? "Weekly" : `Night ${idx}`}
            </p>
            <p className="text-sm font-bold leading-tight">{night.title}</p>
          </div>
          <p className="min-w-14 text-right text-sm font-semibold tabular-nums">
            {state.movesLeft}
            <span className="text-cream/70"> left</span>
          </p>
        </div>

        <div className="mb-2 flex flex-wrap gap-1.5 text-xs">
          {night.goals.map((g, i) => (
            <GoalChip key={i} state={state} goal={g} />
          ))}
        </div>

        <div className="relative">
          <div
            className={`mx-auto grid w-full gap-1 rounded-2xl bg-[#2b2420]/90 p-2 shadow-lift ${
              flash ? "quilt-flash" : ""
            }`}
            style={{ gridTemplateColumns: cols }}
          >
            {state.board.map((row, r) =>
              row.map((tile, c) => (
                <TileView
                  key={tile?.id ?? `${r},${c}`}
                  tile={tile}
                  selected={selected?.r === r && selected?.c === c}
                  hinted={Boolean(
                    hint &&
                      ((hint.a.r === r && hint.a.c === c) ||
                        (hint.b.r === r && hint.b.c === c))
                  )}
                  shaking={shake === `${r},${c}`}
                  dropping={Boolean(tile && freshIds.has(tile.id))}
                  popping={false}
                  delay={(r * state.size + c) * 30}
                  onTap={() => tap({ r, c })}
                />
              ))
            )}
          </div>

          {burst && (
            <div
              key={burst.key}
              aria-hidden
              className="pointer-events-none absolute inset-0 grid gap-1 p-2"
              style={{ gridTemplateColumns: cols }}
            >
              {burst.cells.map((cell, i) => (
                <span
                  key={i}
                  className="quilt-spark rounded-full"
                  style={{ gridRow: cell.r + 1, gridColumn: cell.c + 1 }}
                />
              ))}
            </div>
          )}

          {burst && burst.gain > 0 && (
            <p
              key={`gain-${burst.key}`}
              aria-hidden
              className="quilt-rise pointer-events-none absolute inset-x-0 top-1/3 text-center font-display text-3xl font-semibold text-porch-100 drop-shadow"
            >
              +{burst.gain}
            </p>
          )}

          {state.combo > 1 && flash && (
            <p
              aria-hidden
              className="animate-pop pointer-events-none absolute inset-x-0 top-2 text-center text-sm font-bold uppercase tracking-widest text-porch-100"
            >
              Cascade ×{state.combo}
            </p>
          )}
        </div>

        <p className="mt-2 text-center font-display text-xl font-semibold tabular-nums text-cream">
          {state.score}
          <span className="text-sm font-normal text-cream/70"> glow</span>
        </p>

        {fails >= 2 && !over && (
          <button
            type="button"
            className="mx-auto mt-1 min-h-11 px-4 text-sm font-semibold text-porch-200"
            onClick={() => {
              const pair = findHint(state.board);
              setHint(pair);
              speak(
                pair
                  ? "Those two dashed tiles will stitch. Tap one, then the other."
                  : "I don't see a stitch. Try another pair."
              );
            }}
          >
            Show a stitch
          </button>
        )}

        <div className="mt-3 flex gap-3 rounded-card border border-cream/15 bg-ink/45 p-3 backdrop-blur-sm">
          <EmberSprite mood={emberMood} />
          <p className="text-sm leading-snug text-cream/90">{ember}</p>
        </div>

        {lesson >= 0 && lesson < 4 && (
          <div className="fixed inset-0 z-40 flex items-end justify-center bg-ink/60 p-4">
            <div className="animate-slide-up w-full max-w-md rounded-card border border-porch-200 bg-cream p-4">
              <div className="flex gap-3">
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
                      "Same color AND same shape is a true stitch. Finish my card before moves run out, and the next night opens on its own.",
                    ][lesson]}
                  </p>
                </div>
              </div>
              <Button
                size="lg"
                className="mt-4"
                onClick={() => {
                  playSfx("tap", 0.4);
                  setLesson((n) => (n < 3 ? n + 1 : -1));
                }}
              >
                {lesson < 3 ? "Next" : "Start stitching"}
              </Button>
            </div>
          </div>
        )}

        {over && (
          <div className="fixed inset-0 z-40 flex items-center justify-center bg-ink/70 p-4">
            <div className="animate-pop w-full max-w-xs rounded-card border border-line bg-card p-5 text-center shadow-lift">
              <p className="text-xs font-semibold uppercase tracking-wide text-ink-soft">
                {night.title}
              </p>
              <h2 className="mt-1 font-display text-2xl font-semibold">
                {over === "won" ? "Stoop lit" : "Out of moves"}
              </h2>
              <p className="mt-3 font-display text-4xl font-semibold tabular-nums text-porch-700">
                {state.score}
              </p>
              <p className="text-sm text-ink-soft">glow{saving ? " · saving…" : ""}</p>

              {over === "won" && demo && (
                <p className="mt-3 text-sm text-ink-soft">
                  Log in to keep this and open the next night.
                </p>
              )}

              {canAdvance && next && (
                <>
                  <p className="mt-3 text-sm font-semibold text-pine-700">
                    {getNight(next)?.title} opens next…
                  </p>
                  <Button size="lg" className="mt-3" onClick={() => onNext(next)}>
                    Go now →
                  </Button>
                </>
              )}

              {over === "won" && !next && !demo && (
                <>
                  <p className="mt-3 text-sm font-semibold text-pine-700">
                    That&apos;s the whole story. The week&apos;s porch is yours.
                  </p>
                  <Button size="lg" className="mt-3" onClick={() => onNext("weekly")}>
                    This week&apos;s porch →
                  </Button>
                </>
              )}

              {over === "won" && demo && (
                <ButtonLink size="lg" href="/login?next=/games" className="mt-3">
                  Log in
                </ButtonLink>
              )}

              <div className="mt-2 flex gap-2">
                <Button variant="secondary" className="flex-1" onClick={onReplay}>
                  Replay
                </Button>
                <Button variant="ghost" className="flex-1" onClick={onExit}>
                  Hub
                </Button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

type Boot =
  | { status: "loading" }
  | { status: "ready"; seed: string; token: string; nightId: string; demo: boolean }
  | { status: "error"; error: string };

export function QuiltBoot({ nightId: startId }: { nightId: string }) {
  const router = useRouter();
  const [nightId, setNightId] = useState(startId);
  const [attempt, setAttempt] = useState(0);
  const [boot, setBoot] = useState<Boot>({ status: "loading" });

  useEffect(() => {
    let live = true;
    setBoot({ status: "loading" });
    startQuiltAction(nightId)
      .then((res) => {
        if (!live) return;
        if (!res.ok) setBoot({ status: "error", error: res.error });
        else
          setBoot({
            status: "ready",
            seed: res.seed,
            token: res.token,
            nightId: res.nightId,
            demo: res.demo,
          });
      })
      .catch(() => {
        if (live) setBoot({ status: "error", error: "Ember couldn't reach the quilt." });
      });
    return () => {
      live = false;
    };
  }, [nightId, attempt]);

  const exit = useCallback(() => router.push("/games"), [router]);

  if (boot.status === "loading") {
    return (
      <div className="flex min-h-dvh items-center justify-center bg-ink">
        <div className="text-center">
          <EmberSprite mood="idle" className="mx-auto h-20 w-20" />
          <p className="mt-2 text-sm font-semibold text-cream">
            Ember is lighting the quilt…
          </p>
        </div>
      </div>
    );
  }

  if (boot.status === "error") {
    return (
      <div className="flex min-h-dvh items-center justify-center bg-ink px-4">
        <div className="w-full max-w-xs rounded-card border border-line bg-card p-5 text-center">
          <EmberSprite mood="talk" className="mx-auto h-16 w-16" />
          <p className="mt-2 text-sm">{boot.error}</p>
          <ButtonLink size="lg" href="/login?next=/games" className="mt-4">
            Log in
          </ButtonLink>
          <Button variant="ghost" size="lg" className="mt-2" onClick={exit}>
            Back to hub
          </Button>
        </div>
      </div>
    );
  }

  return (
    <QuiltRun
      key={`${boot.nightId}:${attempt}`}
      nightId={boot.nightId}
      seed={boot.seed}
      token={boot.token}
      demo={boot.demo}
      onNext={(id) => setNightId(id)}
      onReplay={() => setAttempt((n) => n + 1)}
      onExit={exit}
    />
  );
}
