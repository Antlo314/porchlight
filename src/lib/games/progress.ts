import { COURSE_ORDER, type LevelId } from "./types";

/**
 * The story ladder opens one course at a time. Kirkwood and the Daily Block are
 * always open; everything else wants the course before it finished first.
 *
 * Lives here rather than in the actions file because a `"use server"` module
 * may only export async functions — a sync helper in there is a build error.
 */
export function courseLocked(levelId: LevelId, cleared: LevelId[]): LevelId | null {
  if (levelId === "daily") return null;
  const i = COURSE_ORDER.indexOf(levelId);
  if (i <= 0) return null;
  const prev = COURSE_ORDER[i - 1]!;
  return cleared.includes(prev) ? null : prev;
}

/** The furthest course the player has earned their way to. */
export function nextCourse(cleared: LevelId[]): LevelId {
  return COURSE_ORDER.find((id) => !cleared.includes(id)) ?? COURSE_ORDER[0]!;
}
