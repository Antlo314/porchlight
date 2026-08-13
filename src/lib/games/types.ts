export const GAME_ID = "LIGHT_THE_BLOCK" as const;

export const LEVEL_IDS = [
  "kirkwood",
  "grant-park",
  "east-atlanta",
  "daily",
] as const;

export type LevelId = (typeof LEVEL_IDS)[number];

export function isLevelId(value: string): value is LevelId {
  return (LEVEL_IDS as readonly string[]).includes(value);
}

export type RunEventKind = "porch" | "coin" | "die" | "finish" | "jump";

export type RunEvent = {
  t: number;
  k: RunEventKind;
  id?: string;
};

export type PlatformKind = "ground" | "wood" | "rail" | "awning" | "wet";

export type LevelPlatform = {
  x: number;
  y: number;
  w: number;
  kind: PlatformKind;
  dropThrough?: boolean;
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

export type LevelDef = {
  id: LevelId;
  name: string;
  blurb: string;
  mood: "dusk" | "storm" | "night";
  minDurationMs: number;
  length: number;
  platforms: LevelPlatform[];
  porches: LevelProp[];
  coins: LevelProp[];
  puddles: LevelHazard[];
  gusts: LevelHazard[];
  finishX: number;
};

export const RUN_STATUS = {
  STARTED: "STARTED",
  AWARDED: "AWARDED",
  REJECTED: "REJECTED",
  DEMO: "DEMO",
} as const;

export type RunStatus = (typeof RUN_STATUS)[keyof typeof RUN_STATUS];
