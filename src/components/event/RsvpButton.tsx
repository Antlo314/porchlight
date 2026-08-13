"use client";

import { useOptimistic, useTransition } from "react";
import { useToast } from "@/components/ui";
import { rsvpAction } from "@/app/(app)/events/actions";

export type RsvpStatus = "GOING" | "MAYBE";

type State = { status: RsvpStatus | null; goingCount: number };

/**
 * A member holds at most one RSVP per event (EventRsvp is keyed on
 * eventId+userId), so tapping the status you already have clears it and tapping
 * the other one moves it. The going count only tracks GOING, so a move between
 * the two statuses shifts it in exactly one direction.
 */
function applyRsvp(state: State, next: RsvpStatus): State {
  if (state.status === next) {
    return {
      status: null,
      goingCount:
        next === "GOING" ? Math.max(0, state.goingCount - 1) : state.goingCount,
    };
  }

  let goingCount = state.goingCount;
  if (next === "GOING") goingCount += 1;
  else if (state.status === "GOING") goingCount = Math.max(0, goingCount - 1);

  return { status: next, goingCount };
}

const OPTIONS: { status: RsvpStatus; label: string; icon: string }[] = [
  { status: "GOING", label: "Going", icon: "✓" },
  { status: "MAYBE", label: "Maybe", icon: "?" },
];

/**
 * Shared across verticals — the events calendar and the feed's event post both
 * render this — so it deliberately depends on nothing but the design system,
 * @/lib, and the events server action.
 */
export function RsvpButton({
  eventId,
  initialStatus,
  initialGoingCount,
}: {
  eventId: string;
  initialStatus: RsvpStatus | null;
  initialGoingCount: number;
}): React.ReactElement {
  const toast = useToast();
  const [pending, startTransition] = useTransition();
  const [state, applyOptimistic] = useOptimistic<State, RsvpStatus>(
    { status: initialStatus, goingCount: initialGoingCount },
    applyRsvp
  );

  function onTap(next: RsvpStatus) {
    startTransition(async () => {
      applyOptimistic(next);
      const result = await rsvpAction({ eventId, status: next });
      if (!result.ok) toast(result.error, "error");
    });
  }

  return (
    <div
      className="flex items-center gap-2"
      aria-busy={pending}
      aria-label="RSVP"
    >
      {OPTIONS.map((opt) => {
        const active = state.status === opt.status;
        const showCount = opt.status === "GOING" && state.goingCount > 0;
        return (
          <button
            key={opt.status}
            type="button"
            onClick={() => onTap(opt.status)}
            aria-pressed={active}
            aria-label={
              active
                ? `${opt.label} — tap to remove your RSVP`
                : `RSVP ${opt.label}`
            }
            className={`inline-flex min-h-11 flex-1 items-center justify-center gap-1.5 rounded-card border px-3 text-[15px] font-semibold transition-colors duration-100 active:scale-[0.98] ${
              active
                ? "border-porch-600 bg-porch-600 text-white"
                : "border-line bg-card text-ink-soft active:bg-porch-50"
            }`}
          >
            <span aria-hidden className="leading-none">
              {opt.icon}
            </span>
            <span>{opt.label}</span>
            {showCount && (
              <span
                className={`tabular-nums ${active ? "text-white/80" : "text-ink-soft"}`}
              >
                {state.goingCount}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}
