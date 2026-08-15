import { BlockMenu } from "@/components/games/BlockMenu";
import { listCourses } from "@/lib/games/levels";
import type { LevelId } from "@/lib/games/types";

/**
 * Light the Block only. Ember's Quilt is parked — its routes and engine are
 * untouched at /games/quilt, it just isn't surfaced here.
 */
export function GamesHub({
  demo,
  remainingToday,
  cleared,
  next,
}: {
  demo: boolean;
  remainingToday: number;
  cleared: LevelId[];
  next: LevelId;
}) {
  return (
    <BlockMenu
      courses={listCourses()}
      cleared={cleared}
      next={next}
      demo={demo}
      remainingToday={remainingToday}
    />
  );
}
