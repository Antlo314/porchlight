export const COLORS = ["amber", "pine", "cream", "dusk", "clay"] as const;
export const SHAPES = ["lantern", "leaf", "peach", "key", "mug", "star"] as const;

/** Nights start here and grow; the engine reads the size off the board it is given. */
export const DEFAULT_BOARD_SIZE = 7;
export const MAX_BOARD_SIZE = 9;

export const NIGHT_IDS = [
  "night-0",
  "night-1",
  "night-2",
  "night-3",
  "night-4",
  "night-5",
  "night-6",
  "night-7",
  "night-8",
  "night-9",
  "night-10",
  "night-11",
  "night-12",
  "night-13",
  "night-14",
  "weekly",
] as const;

export type Color = (typeof COLORS)[number];
export type Shape = (typeof SHAPES)[number];
export type NightId = (typeof NIGHT_IDS)[number];

export type Tile = {
  id: number;
  color: Color;
  shape: Shape;
  /**
   * Boarded-up window. A tile with boards left can't be picked up, and being
   * caught in a match strips one board instead of clearing it.
   */
  boards?: number;
};

export type Cell = { r: number; c: number };

export type Goal =
  | { kind: "matches"; n: number }
  | { kind: "color"; color: Color; n: number }
  | { kind: "shape"; shape: Shape; n: number }
  | { kind: "true"; n: number }
  | { kind: "boards"; n: number }
  | { kind: "score"; n: number };

export type Night = {
  id: NightId;
  title: string;
  blurb: string;
  /** Ember's line on the intro card. */
  ember: string;
  /** One short sentence of setup shown above the goals on the intro card. */
  scene: string;
  moves: number;
  goals: Goal[];
  /** Board is size x size. Defaults to DEFAULT_BOARD_SIZE. */
  size?: number;
  /** How many tiles start boarded up. */
  boards?: number;
  /** Boards stacked on each of those tiles. */
  boardLayers?: number;
  /** Drives the backdrop wash behind the board. */
  mood?: "dusk" | "storm" | "deep" | "dawn";
};

export type Progress = {
  matches: number;
  trueMatches: number;
  boardsFreed: number;
  byColor: Record<Color, number>;
  byShape: Record<Shape, number>;
};

export type QuiltState = {
  nightId: NightId;
  seed: string;
  size: number;
  board: (Tile | null)[][];
  movesLeft: number;
  score: number;
  combo: number;
  progress: Progress;
  nextId: number;
  failedSwaps: number;
  /** Cells cleared by the most recent swap — presentation only. */
  lastCleared: Cell[];
};

export type QuiltMove = { a: Cell; b: Cell };

export const COLOR_HEX: Record<Color, string> = {
  amber: "#e69a41",
  pine: "#3d6b4f",
  cream: "#faf7f2",
  dusk: "#4a3a68",
  clay: "#833e1a",
};

export const MOOD_WASH: Record<NonNullable<Night["mood"]>, string> = {
  dusk: "linear-gradient(160deg, #4a3a68 0%, #833e1a 55%, #2b2420 100%)",
  storm: "linear-gradient(160deg, #26323d 0%, #3d4a58 55%, #1c1614 100%)",
  deep: "linear-gradient(160deg, #12142c 0%, #2b2450 55%, #14100f 100%)",
  dawn: "linear-gradient(160deg, #6b4a68 0%, #c2661b 55%, #3a2a20 100%)",
};
