import { atlantaDateKey, hashSeed, mulberry32 } from "./prng";
import type { LevelDef, LevelId, LevelPlatform, LevelProp } from "./types";

const GROUND_Y = 520;

function ground(length: number): LevelPlatform {
  return { x: 0, y: GROUND_Y, w: length, kind: "ground" };
}

export const KIRKWOOD: LevelDef = {
  id: "kirkwood",
  name: "Kirkwood Dusk",
  blurb: "Light the first porches on the block. Tap to jump.",
  mood: "dusk",
  minDurationMs: 16_000,
  length: 3400,
  finishX: 3180,
  platforms: [
    ground(3400),
    { x: 420, y: 430, w: 180, kind: "wood" },
    { x: 780, y: 360, w: 160, kind: "wood" },
    { x: 1180, y: 400, w: 200, kind: "wood" },
    { x: 1600, y: 330, w: 150, kind: "rail", dropThrough: true },
    { x: 1980, y: 410, w: 190, kind: "wood" },
    { x: 2400, y: 350, w: 170, kind: "wood" },
    { x: 2780, y: 420, w: 200, kind: "wood" },
  ],
  porches: [
    { id: "k1", x: 500, y: 430 },
    { id: "k2", x: 860, y: 360 },
    { id: "k3", x: 1280, y: 400 },
    { id: "k4", x: 2060, y: 410 },
    { id: "k5", x: 2480, y: 350 },
    { id: "k6", x: 2880, y: 420 },
  ],
  coins: [
    { id: "kc1", x: 300, y: 460 },
    { id: "kc2", x: 640, y: 300 },
    { id: "kc3", x: 980, y: 280 },
    { id: "kc4", x: 1450, y: 320 },
    { id: "kc5", x: 1720, y: 250 },
    { id: "kc6", x: 2200, y: 300 },
    { id: "kc7", x: 2620, y: 260 },
    { id: "kc8", x: 3050, y: 360 },
  ],
  puddles: [{ x: 1500, y: GROUND_Y, w: 70 }],
  gusts: [],
};

export const GRANT_PARK: LevelDef = {
  id: "grant-park",
  name: "Grant Park Storm",
  blurb: "Hold to leap the gusts. Swipe down through wet rails.",
  mood: "storm",
  minDurationMs: 20_000,
  length: 4000,
  finishX: 3780,
  platforms: [
    ground(4000),
    { x: 360, y: 420, w: 150, kind: "wet" },
    { x: 680, y: 340, w: 140, kind: "rail", dropThrough: true },
    { x: 1040, y: 380, w: 180, kind: "wet" },
    { x: 1400, y: 300, w: 130, kind: "wood" },
    { x: 1760, y: 420, w: 160, kind: "wet" },
    { x: 2140, y: 330, w: 150, kind: "rail", dropThrough: true },
    { x: 2520, y: 370, w: 190, kind: "wood" },
    { x: 2940, y: 290, w: 140, kind: "wet" },
    { x: 3320, y: 400, w: 180, kind: "wood" },
  ],
  porches: [
    { id: "g1", x: 420, y: 420 },
    { id: "g2", x: 1120, y: 380 },
    { id: "g3", x: 1480, y: 300 },
    { id: "g4", x: 1840, y: 420 },
    { id: "g5", x: 2600, y: 370 },
    { id: "g6", x: 3020, y: 290 },
    { id: "g7", x: 3400, y: 400 },
  ],
  coins: [
    { id: "gc1", x: 260, y: 450 },
    { id: "gc2", x: 760, y: 250 },
    { id: "gc3", x: 980, y: 240 },
    { id: "gc4", x: 1320, y: 220 },
    { id: "gc5", x: 1680, y: 280 },
    { id: "gc6", x: 2020, y: 250 },
    { id: "gc7", x: 2280, y: 230 },
    { id: "gc8", x: 2760, y: 260 },
    { id: "gc9", x: 3180, y: 210 },
    { id: "gc10", x: 3600, y: 320 },
  ],
  puddles: [
    { x: 560, y: GROUND_Y, w: 80 },
    { x: 1580, y: GROUND_Y, w: 90 },
    { x: 2380, y: GROUND_Y, w: 70 },
    { x: 3180, y: GROUND_Y, w: 85 },
  ],
  gusts: [
    { x: 900, y: 280, w: 40, period: 1800 },
    { x: 2000, y: 240, w: 40, period: 1600 },
    { x: 2860, y: 220, w: 40, period: 1500 },
  ],
};

export const EAST_ATLANTA: LevelDef = {
  id: "east-atlanta",
  name: "East Atlanta Night",
  blurb: "String-light awnings and a greedy last stretch.",
  mood: "night",
  minDurationMs: 24_000,
  length: 4600,
  finishX: 4380,
  platforms: [
    ground(4600),
    { x: 320, y: 410, w: 140, kind: "wood" },
    { x: 620, y: 330, w: 160, kind: "awning" },
    { x: 980, y: 380, w: 150, kind: "wood" },
    { x: 1320, y: 290, w: 170, kind: "awning" },
    { x: 1700, y: 400, w: 140, kind: "rail", dropThrough: true },
    { x: 2060, y: 320, w: 180, kind: "awning" },
    { x: 2460, y: 260, w: 130, kind: "wood" },
    { x: 2820, y: 370, w: 160, kind: "awning" },
    { x: 3200, y: 300, w: 150, kind: "wood" },
    { x: 3560, y: 240, w: 140, kind: "awning" },
    { x: 3920, y: 360, w: 190, kind: "wood" },
  ],
  porches: [
    { id: "e1", x: 380, y: 410 },
    { id: "e2", x: 700, y: 330 },
    { id: "e3", x: 1060, y: 380 },
    { id: "e4", x: 1400, y: 290 },
    { id: "e5", x: 2140, y: 320 },
    { id: "e6", x: 2540, y: 260 },
    { id: "e7", x: 2900, y: 370 },
    { id: "e8", x: 3280, y: 300 },
    { id: "e9", x: 4000, y: 360 },
  ],
  coins: [
    { id: "ec1", x: 240, y: 450 },
    { id: "ec2", x: 500, y: 280 },
    { id: "ec3", x: 860, y: 250 },
    { id: "ec4", x: 1200, y: 240 },
    { id: "ec5", x: 1560, y: 210 },
    { id: "ec6", x: 1880, y: 280 },
    { id: "ec7", x: 2300, y: 200 },
    { id: "ec8", x: 2680, y: 180 },
    { id: "ec9", x: 3080, y: 230 },
    { id: "ec10", x: 3440, y: 170 },
    { id: "ec11", x: 3720, y: 180 },
    { id: "ec12", x: 4180, y: 280 },
  ],
  puddles: [
    { x: 480, y: GROUND_Y, w: 60 },
    { x: 1180, y: GROUND_Y, w: 75 },
    { x: 1920, y: GROUND_Y, w: 80 },
    { x: 2740, y: GROUND_Y, w: 70 },
    { x: 3480, y: GROUND_Y, w: 90 },
  ],
  gusts: [
    { x: 1500, y: 200, w: 36, period: 1400 },
    { x: 2400, y: 180, w: 36, period: 1300 },
    { x: 3680, y: 160, w: 36, period: 1200 },
  ],
};

const HANDCRAFTED: Record<Exclude<LevelId, "daily">, LevelDef> = {
  kirkwood: KIRKWOOD,
  "grant-park": GRANT_PARK,
  "east-atlanta": EAST_ATLANTA,
};

export function dailySeed(neighborhoodId?: string | null, at?: Date): string {
  const day = atlantaDateKey(at);
  return neighborhoodId ? `${day}:${neighborhoodId}` : day;
}

export function buildDailyLevel(seed: string): LevelDef {
  const rng = mulberry32(hashSeed(`ltb-daily:${seed}`));
  const length = 3800;
  const platforms: LevelPlatform[] = [ground(length)];
  const porches: LevelProp[] = [];
  const coins: LevelProp[] = [];
  const puddles: LevelDef["puddles"] = [];
  const gusts: LevelDef["gusts"] = [];

  let x = 340;
  let n = 0;
  while (x < length - 420) {
    const gap = 280 + Math.floor(rng() * 160);
    const y = 280 + Math.floor(rng() * 150);
    const w = 130 + Math.floor(rng() * 70);
    const kinds: LevelPlatform["kind"][] = ["wood", "rail", "awning", "wet"];
    const kind = kinds[Math.floor(rng() * kinds.length)]!;
    platforms.push({
      x,
      y,
      w,
      kind,
      dropThrough: kind === "rail",
    });
    porches.push({ id: `d${n}`, x: x + Math.floor(w * 0.45), y });
    if (rng() > 0.25) {
      coins.push({
        id: `dc${n}a`,
        x: x + Math.floor(w * 0.2),
        y: y - 70 - Math.floor(rng() * 40),
      });
    }
    if (rng() > 0.45) {
      coins.push({
        id: `dc${n}b`,
        x: x + w + 40,
        y: y - 30,
      });
    }
    if (rng() > 0.55) {
      puddles.push({
        x: x + w + 30,
        y: GROUND_Y,
        w: 55 + Math.floor(rng() * 40),
      });
    }
    if (rng() > 0.7) {
      gusts.push({
        x: x + Math.floor(w / 2),
        y: y - 80,
        w: 36,
        period: 1200 + Math.floor(rng() * 800),
      });
    }
    n += 1;
    x += gap;
  }

  coins.push({ id: "dc-end", x: length - 280, y: 360 });

  return {
    id: "daily",
    name: "Daily Block",
    blurb: "Today's course — the whole neighborhood runs the same one.",
    mood: rng() > 0.5 ? "storm" : "dusk",
    minDurationMs: 20_000,
    length,
    finishX: length - 220,
    platforms,
    porches,
    coins,
    puddles,
    gusts,
  };
}

export function getLevel(id: LevelId, seed?: string): LevelDef {
  if (id === "daily") return buildDailyLevel(seed ?? dailySeed());
  return HANDCRAFTED[id];
}

export function listCourses(): Array<{
  id: LevelId;
  name: string;
  blurb: string;
  mood: LevelDef["mood"];
}> {
  return [
    KIRKWOOD,
    GRANT_PARK,
    EAST_ATLANTA,
    {
      id: "daily",
      name: "Daily Block",
      blurb: "Today's course — the whole neighborhood runs the same one.",
      mood: "dusk",
    },
  ];
}
