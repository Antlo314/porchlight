"use client";

import { getLevel } from "@/lib/games/levels";
import { isLevelId } from "@/lib/games/types";
import { useBlockPresence } from "./useBlockPresence";

function courseLabel(id: string): string {
  if (id === "lobby" || id === "daily") return id === "daily" ? "Daily Block" : "the stoops";
  if (!isLevelId(id)) return id;
  return getLevel(id, id).name;
}

export function BlockLobby({
  course = "lobby",
  status = "lobby",
  compact = false,
}: {
  course?: string;
  status?: "lobby" | "running" | "done";
  compact?: boolean;
}) {
  const { others, neighborhood, people } = useBlockPresence({
    course,
    status,
  });

  if (compact) {
    if (others.length === 0) return null;
    return (
      <div className="rounded-card border border-porch-200 bg-ink/70 px-3 py-2 text-sm text-cream backdrop-blur-sm">
        <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-porch-200">
          On this course
        </p>
        <ul className="mt-1 space-y-0.5">
          {others.slice(0, 6).map((p) => (
            <li key={p.id}>
              <span className="font-semibold">{p.name}</span>
              <span className="text-porch-200">
                {" "}
                · {p.status === "running" ? "lighting" : p.status === "done" ? "done" : "waiting"}
                {p.score > 0 ? ` · ${p.score}` : ""}
              </span>
            </li>
          ))}
        </ul>
      </div>
    );
  }

  return (
    <div className="surface p-4">
      <p className="text-xs font-semibold uppercase tracking-wide text-porch-700">
        Live on {neighborhood}
      </p>
      {people.length <= 1 ? (
        <p className="mt-1 text-sm text-ink-soft">
          You&apos;re the only lantern. Invite a neighbor — this block updates live.
        </p>
      ) : (
        <ul className="mt-2 space-y-1.5">
          {others.map((p) => (
            <li key={p.id} className="flex items-center justify-between text-sm">
              <span className="font-semibold">{p.name}</span>
              <span className="text-ink-soft">
                {p.status === "running"
                  ? `lighting ${courseLabel(p.course)}`
                  : p.status === "done"
                    ? `finished ${courseLabel(p.course)}`
                    : "in the lobby"}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
