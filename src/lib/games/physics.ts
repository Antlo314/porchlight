// Movement numbers for Light the Block, shared by the Phaser scene and the
// server-side run validator.
//
// These MUST live in one place. When the scene owned the run speed and
// levels.ts hand-wrote `minDurationMs`, the two drifted: every course demanded
// more seconds than the lantern physically needed to reach the ribbon, so every
// honest finish came back TOO_FAST.
import type { LevelDef } from "./types";

type Mood = LevelDef["mood"];

export const PLAYER_START_X = 90;
export const PLAYER_W = 44;
export const PLAYER_H = 62;
export const WORLD_HEIGHT = 720;
export const GRAVITY_Y = 1180;

/** The lantern auto-runs; mood is the course's difficulty dial. */
export const RUN_SPEED: Record<Mood, number> = {
  dusk: 228,
  storm: 242,
  night: 252,
};

export const JUMP_V = -520;
/** Extra lift while the jump is held, applied per frame on the way up. */
export const HOLD_V = -92;
/** Jumps available after leaving the ground. A lantern gets one float. */
export const AIR_JUMPS = 1;
export const COYOTE_MS = 110;
export const BUFFER_MS = 130;
export const LIVES = 3;

/** Peak of a single jump, in pixels. Level geometry has to fit under this. */
export function jumpHeight(): number {
  return (JUMP_V * JUMP_V) / (2 * GRAVITY_Y);
}

/** Fastest an honest run can reach the ribbon: full speed, never stopped. */
export function fastestClearMs(mood: Mood, finishX: number): number {
  return ((finishX - PLAYER_START_X) / RUN_SPEED[mood]) * 1000;
}

/**
 * Anti-cheat floor for a claimed finish. Sits under the fastest possible clean
 * run — frame pacing and the spawn drop both shave real milliseconds — while
 * still rejecting a client that claims it cleared the block in two seconds.
 */
export function minDurationFor(mood: Mood, finishX: number): number {
  return Math.floor(fastestClearMs(mood, finishX) * 0.8);
}
