export const COLORS = ["amber", "pine", "cream", "dusk", "clay"] as const;
export const SHAPES = ["lantern", "leaf", "peach", "key", "mug", "star"] as const;
export const BOARD_SIZE = 7;

export type Color = (typeof COLORS)[number];
export type Shape = (typeof SHAPES)[number];

export type Tile = {
  id: number;
  color: Color;
  shape: Shape;
};

export type Cell = { r: number; c: number };

export type Goal =
  | { kind: "matches"; n: number }
  | { kind: "color"; color: Color; n: number }
  | { kind: "shape"; shape: Shape; n: number }
  | { kind: "true"; n: number };

export type NightId =
  | "night-0"
  | "night-1"
  | "night-2"
  | "night-3"
  | "night-4"
  | "night-5"
  | "night-6"
  | "weekly";

export type Night = {
  id: NightId;
  title: string;
  blurb: string;
  ember: string;
  moves: number;
  goals: Goal[];
};

export type Progress = {
  matches: number;
  trueMatches: number;
  byColor: Record<Color, number>;
  byShape: Record<Shape, number>;
};

export type QuiltState = {
  nightId: NightId;
  seed: string;
  board: (Tile | null)[][];
  movesLeft: number;
  score: number;
  combo: number;
  progress: Progress;
  nextId: number;
  failedSwaps: number;
};

export type QuiltMove = { a: Cell; b: Cell };

export const COLOR_HEX: Record<Color, string> = {
  amber: "#e69a41",
  pine: "#3d6b4f",
  cream: "#faf7f2",
  dusk: "#4a3a68",
  clay: "#833e1a",
};
