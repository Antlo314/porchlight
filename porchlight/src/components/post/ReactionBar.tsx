"use client";

import { useOptimistic, useState, useTransition } from "react";
import { useToast } from "@/components/ui";

export type ReactionKind = "LIKE" | "THANKS" | "HELPFUL";

export const REACTION_KINDS: ReactionKind[] = ["LIKE", "THANKS", "HELPFUL"];

/** Display metadata for reactions. The kinds themselves come from
 *  reactionSchema in @/lib/validators. */
export const REACTION_META: Record<
  ReactionKind,
  { label: string; icon: string }
> = {
  LIKE: { label: "Like", icon: "👍" },
  THANKS: { label: "Thanks", icon: "🙏" },
  HELPFUL: { label: "Helpful", icon: "💡" },
};

export type ReactionCounts = Record<ReactionKind, number>;

type State = { mine: ReactionKind | null; counts: ReactionCounts };

/**
 * A member holds at most one reaction per post (Reaction is keyed on
 * userId+postId), so tapping a second kind moves the reaction rather than
 * adding one.
 */
function applyToggle(state: State, kind: ReactionKind): State {
  const counts = { ...state.counts };

  if (state.mine === kind) {
    counts[kind] = Math.max(0, counts[kind] - 1);
    return { mine: null, counts };
  }

  if (state.mine) counts[state.mine] = Math.max(0, counts[state.mine] - 1);
  counts[kind] = counts[kind] + 1;
  return { mine: kind, counts };
}

export function ReactionBar({
  postId,
  initialKind,
  initialCounts,
  toggleReaction,
}: {
  postId: string;
  initialKind: ReactionKind | null;
  initialCounts: ReactionCounts;
  toggleReaction: (input: {
    postId: string;
    kind: ReactionKind;
  }) => Promise<{ error?: string } | undefined>;
}) {
  const toast = useToast();
  const [, startTransition] = useTransition();
  const [state, applyOptimistic] = useOptimistic<State, ReactionKind>(
    { mine: initialKind, counts: initialCounts },
    applyToggle
  );
  // Bumping this replays the pop animation on the icon that was just tapped.
  const [pop, setPop] = useState<{ kind: ReactionKind; seq: number } | null>(
    null
  );

  function onTap(kind: ReactionKind) {
    setPop((prev) => ({ kind, seq: (prev?.seq ?? 0) + 1 }));
    startTransition(async () => {
      applyOptimistic(kind);
      const result = await toggleReaction({ postId, kind });
      if (result?.error) toast(result.error, "error");
    });
  }

  return (
    <div className="flex items-center gap-2">
      {REACTION_KINDS.map((kind) => {
        const active = state.mine === kind;
        const meta = REACTION_META[kind];
        const count = state.counts[kind];
        return (
          <button
            key={kind}
            type="button"
            onClick={() => onTap(kind)}
            aria-pressed={active}
            aria-label={`${meta.label}${count > 0 ? ` (${count})` : ""}`}
            className={`inline-flex min-h-11 flex-1 items-center justify-center gap-1 rounded-card border px-1.5 text-[13px] font-semibold transition-colors duration-100 active:scale-[0.98] ${
              active
                ? "border-porch-600 bg-porch-50 text-porch-800"
                : "border-line bg-card text-ink-soft active:bg-porch-50/60"
            }`}
          >
            <span
              key={pop?.kind === kind ? `${kind}-${pop.seq}` : kind}
              aria-hidden
              className={`text-base leading-none ${
                pop?.kind === kind ? "animate-pop inline-block" : ""
              }`}
            >
              {meta.icon}
            </span>
            <span>{meta.label}</span>
            {count > 0 && <span className="tabular-nums">{count}</span>}
          </button>
        );
      })}
    </div>
  );
}
