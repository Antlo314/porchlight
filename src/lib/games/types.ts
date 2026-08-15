export const GAME_ID = "LIGHT_THE_BLOCK" as const;

export const LEVEL_IDS = [
  "kirkwood",
  "grant-park",
  "east-atlanta",
  "cabbagetown",
  "reynoldstown",
  "daily",
] as const;

export type LevelId = (typeof LEVEL_IDS)[number];

/** Story order. `daily` sits outside the ladder — it is always open. */
export const COURSE_ORDER: LevelId[] = [
  "kirkwood",
  "grant-park",
  "east-atlanta",
  "cabbagetown",
  "reynoldstown",
];

export function isLevelId(value: string): value is LevelId {
  return (LEVEL_IDS as readonly string[]).includes(value);
}

export type RunEventKind =
  | "porch"
  | "coin"
  | "die"
  | "finish"
  | "jump"
  | "key"
  | "switch";

export type RunEvent = {
  t: number;
  k: RunEventKind;
  id?: string;
};

export type PlatformKind =
  | "ground"
  | "wood"
  | "rail"
  | "awning"
  | "wet"
  /** Low friction — the lantern slides. */
  | "ice"
  /** Collapses a beat after it takes weight. */
  | "crumble";

/** Patrol path for a moving platform, relative to its authored position. */
export type PlatformMotion = {
  dx?: number;
  dy?: number;
  /** Full round trip in ms. */
  period: number;
  /** 0-1 phase offset so a row of platforms can move out of step. */
  offset?: number;
};

/** On/off cycle for a blinking platform. */
export type PlatformBlink = {
  period: number;
  /** Fraction of the cycle the platform is solid. */
  duty?: number;
  offset?: number;
};

export type LevelPlatform = {
  x: number;
  y: number;
  w: number;
  kind: PlatformKind;
  dropThrough?: boolean;
  move?: PlatformMotion;
  blink?: PlatformBlink;
};

export type LevelProp = {
  id: string;
  x: number;
  y: number;
};

export type LevelHazard = {
  x: number;
  y: number;
  w: number;
  period?: number;
};

/** Launches the lantern straight up. */
export type LevelSpring = {
  x: number;
  y: number;
  /** Upward velocity, defaults to SPRING_V. */
  power?: number;
};

/** A bed of spikes. Touching it costs a lantern. */
export type LevelSpikes = {
  x: number;
  y: number;
  w: number;
};

/** Hit the switch, the gate with the matching id opens. */
export type LevelSwitch = {
  id: string;
  x: number;
  y: number;
  gate: string;
};

export type LevelGate = {
  id: string;
  x: number;
  y: number;
  h: number;
};

export type LevelDef = {
  id: LevelId;
  name: string;
  blurb: string;
  /** One line shown on the intro card, in Ember's register. */
  scene: string;
  /** What this course is built to teach. */
  teaches: string;
  mood: "dusk" | "storm" | "night";
  minDurationMs: number;
  length: number;
  platforms: LevelPlatform[];
  porches: LevelProp[];
  coins: LevelProp[];
  puddles: LevelHazard[];
  gusts: LevelHazard[];
  springs: LevelSpring[];
  spikes: LevelSpikes[];
  /** Every key must be collected before the ribbon opens. */
  keys: LevelProp[];
  switches: LevelSwitch[];
  gates: LevelGate[];
  finishX: number;
};

export const RUN_STATUS = {
  STARTED: "STARTED",
  AWARDED: "AWARDED",
  REJECTED: "REJECTED",
  DEMO: "DEMO",
} as const;

export type RunStatus = (typeof RUN_STATUS)[keyof typeof RUN_STATUS];
