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
export const GROUND_Y = 520;
export const GRAVITY_Y = 1180;

/**
 * Top speed under the player's own thumb. Mood is the course's pace dial.
 *
 * The validator derives its clock floor from this, so nothing in the game may
 * ever push the lantern sideways faster than this — a speed boost would make
 * honest runs arrive before the floor allows and get rejected as TOO_FAST.
 */
export const RUN_SPEED: Record<Mood, number> = {
  dusk: 228,
  storm: 242,
  night: 252,
};

/** How fast the lantern gets up to speed, and how fast it gives it up. */
export const MOVE_ACCEL = 2400;
export const MOVE_FRICTION = 1900;
/** Ice keeps you going: far less grip in both directions. */
export const ICE_ACCEL = 900;
export const ICE_FRICTION = 260;
/** Air control is weaker than ground control, so commitment matters. */
export const AIR_CONTROL = 0.62;

export const JUMP_V = -520;
/** Extra lift while the jump is held, applied per frame on the way up. */
export const HOLD_V = -92;
/** Jumps available after leaving the ground. A lantern gets one float. */
export const AIR_JUMPS = 1;
export const COYOTE_MS = 110;
export const BUFFER_MS = 130;
export const LIVES = 3;

/** Bounce pads. Roughly double a normal jump. */
export const SPRING_V = -880;
/** How long a crumbling board holds once it takes weight. */
export const CRUMBLE_MS = 420;
/** How long before a crumbled board comes back. */
export const CRUMBLE_RESPAWN_MS = 2600;
/** Ice keeps the lantern drifting for a beat after the ground changes. */
export const ICE_DRAG = 0.055;

/** Peak of a single jump, in pixels. Level geometry has to fit under this. */
export function jumpHeight(): number {
  return (JUMP_V * JUMP_V) / (2 * GRAVITY_Y);
}

/** Peak of a spring launch, in pixels. */
export function springHeight(): number {
  return (SPRING_V * SPRING_V) / (2 * GRAVITY_Y);
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
