import { GROUND_Y, PLAYER_START_X, minDurationFor } from "./physics";
import { atlantaDateKey, hashSeed, mulberry32 } from "./prng";
import type {
  LevelDef,
  LevelGate,
  LevelHazard,
  LevelId,
  LevelPlatform,
  LevelProp,
  LevelSpikes,
  LevelSpring,
  LevelSwitch,
  PlatformKind,
} from "./types";

/**
 * Courses are built with a cursor rather than hand-typed coordinates, so the
 * reachability rules live in one place instead of in three hundred literals.
 *
 * Shape of every course follows teach -> test -> twist: the mechanic gets a
 * safe room of its own, then it gets asked for under pressure, then it gets
 * combined with what came before.
 *
 * Reachability budget (see physics.ts): a held jump clears ~135px of height and
 * ~180px of gap; a second air jump roughly doubles both. Ledges therefore stay
 * within 220px of the ground and 300px apart, and the ground runs unbroken
 * beneath the whole course so a missed hop costs seconds, never a lantern.
 */
const LEDGE_MIN_Y = GROUND_Y - 220;
const LEDGE_MAX_Y = GROUND_Y - 80;

class Course {
  x = PLAYER_START_X + 160;
  n = 0;
  platforms: LevelPlatform[] = [];
  porches: LevelProp[] = [];
  coins: LevelProp[] = [];
  puddles: LevelHazard[] = [];
  gusts: LevelHazard[] = [];
  springs: LevelSpring[] = [];
  spikes: LevelSpikes[] = [];
  keys: LevelProp[] = [];
  switches: LevelSwitch[] = [];
  gates: LevelGate[] = [];

  constructor(private prefix: string) {}

  private id(tag: string) {
    this.n += 1;
    return `${this.prefix}${tag}${this.n}`;
  }

  private clampY(y: number) {
    return Math.max(LEDGE_MIN_Y, Math.min(LEDGE_MAX_Y, y));
  }

  /** Empty running room. Use it to let a lesson breathe. */
  gap(px: number) {
    this.x += px;
    return this;
  }

  /** A ledge with optional porch on top and coin above it. */
  ledge(opts: {
    y: number;
    w?: number;
    kind?: PlatformKind;
    porch?: boolean;
    coin?: boolean;
    dropThrough?: boolean;
    move?: LevelPlatform["move"];
    blink?: LevelPlatform["blink"];
    advance?: number;
  }) {
    const w = opts.w ?? 170;
    const y = this.clampY(opts.y);
    this.platforms.push({
      x: this.x,
      y,
      w,
      kind: opts.kind ?? "wood",
      ...(opts.dropThrough ? { dropThrough: true } : {}),
      ...(opts.move ? { move: opts.move } : {}),
      ...(opts.blink ? { blink: opts.blink } : {}),
    });
    if (opts.porch) {
      this.porches.push({ id: this.id("p"), x: this.x + Math.floor(w * 0.5), y });
    }
    if (opts.coin) {
      this.coins.push({ id: this.id("c"), x: this.x + Math.floor(w * 0.5), y: y - 70 });
    }
    this.x += opts.advance ?? w + 150;
    return this;
  }

  /** A coin floating over open ground. */
  coin(dy = 90) {
    this.coins.push({ id: this.id("c"), x: this.x, y: GROUND_Y - dy });
    this.x += 120;
    return this;
  }

  puddle(w = 80) {
    this.puddles.push({ x: this.x, y: GROUND_Y, w });
    this.x += w + 190;
    return this;
  }

  spike(w = 70) {
    this.spikes.push({ x: this.x, y: GROUND_Y, w });
    this.x += w + 210;
    return this;
  }

  gust(dy = 150, period = 1600) {
    this.gusts.push({ x: this.x, y: GROUND_Y - dy, w: 36, period });
    this.x += 230;
    return this;
  }

  spring(power?: number) {
    this.springs.push({ x: this.x, y: GROUND_Y, ...(power ? { power } : {}) });
    this.x += 190;
    return this;
  }

  key() {
    this.keys.push({ id: this.id("k"), x: this.x, y: GROUND_Y - 96 });
    this.x += 150;
    return this;
  }

  /**
   * Pressure plate on the ground, then the gate it opens further along. The
   * run-up gets a coin so the stretch between plate and bars isn't dead ground.
   */
  switchGate(runUp: number, gateH = 190) {
    const gateId = this.id("g");
    this.switches.push({ id: this.id("s"), x: this.x, y: GROUND_Y, gate: gateId });
    this.coins.push({ id: this.id("c"), x: this.x + Math.floor(runUp / 2), y: GROUND_Y - 110 });
    this.x += runUp;
    this.gates.push({ id: gateId, x: this.x, y: GROUND_Y, h: gateH });
    this.x += 220;
    return this;
  }

  build(meta: {
    id: LevelId;
    name: string;
    blurb: string;
    scene: string;
    teaches: string;
    mood: LevelDef["mood"];
    tail?: number;
  }): LevelDef {
    const finishX = this.x + (meta.tail ?? 260);
    const length = finishX + 260;
    return {
      ...meta,
      length,
      finishX,
      minDurationMs: minDurationFor(meta.mood, finishX),
      platforms: [{ x: 0, y: GROUND_Y, w: length, kind: "ground" }, ...this.platforms],
      porches: this.porches,
      coins: this.coins,
      puddles: this.puddles,
      gusts: this.gusts,
      springs: this.springs,
      spikes: this.spikes,
      keys: this.keys,
      switches: this.switches,
      gates: this.gates,
    };
  }
}

// ---------------------------------------------------------------------------
// 1. Kirkwood — teaches the jump itself.
// ---------------------------------------------------------------------------
export const KIRKWOOD: LevelDef = (() => {
  const c = new Course("k");
  // Teach: flat ground, one low ledge, nothing to lose.
  c.coin(90).ledge({ y: 430, porch: true, coin: true }).gap(80);
  c.ledge({ y: 420, porch: true }).gap(120);
  // Test: the same hop with a puddle underneath it.
  c.puddle(80).ledge({ y: 400, porch: true, coin: true }).gap(60);
  c.puddle(90).coin(150).ledge({ y: 380, porch: true }).gap(100);
  // Twist: a stair of ledges, then a drop-through rail.
  c.ledge({ y: 430, w: 150, coin: true }).ledge({ y: 360, w: 150, porch: true });
  c.ledge({ y: 330, w: 150, coin: true, dropThrough: true, kind: "rail" }).gap(140);
  c.puddle(90).ledge({ y: 400, w: 190, porch: true, coin: true }).gap(120);
  c.coin(180).ledge({ y: 370, porch: true, coin: true }).gap(160);
  c.puddle(70).ledge({ y: 410, w: 200, porch: true, coin: true });
  return c.build({
    id: "kirkwood",
    name: "Kirkwood Dusk",
    blurb: "Where you learn the hop. Tap to jump, tap again to float.",
    scene: "The first block to go dark. Six porches, and nobody home to light them.",
    teaches: "Jumping, floating, and lighting a porch.",
    mood: "dusk",
  });
})();

// ---------------------------------------------------------------------------
// 2. Grant Park — teaches springs.
// ---------------------------------------------------------------------------
export const GRANT_PARK: LevelDef = (() => {
  const c = new Course("g");
  c.coin(90).ledge({ y: 430, porch: true }).gap(100);
  // Teach: a spring on open ground with a coin straight above it.
  c.spring();
  c.coins.push({ id: "gc-teach", x: c.x - 60, y: GROUND_Y - 300 });
  c.gap(120).ledge({ y: 340, porch: true, coin: true }).gap(120);
  // Test: spring over a puddle onto a high ledge.
  c.spring().puddle(90).ledge({ y: 330, porch: true, coin: true }).gap(100);
  c.spring().ledge({ y: 310, w: 150, coin: true }).gap(80);
  // Twist: springs into gusts.
  c.gust(220, 1700).spring().gap(60).ledge({ y: 350, porch: true, coin: true }).gap(120);
  c.puddle(90).gust(200, 1500).spring().ledge({ y: 320, porch: true, coin: true }).gap(140);
  c.spring().gust(240, 1400).ledge({ y: 340, w: 190, porch: true, coin: true }).gap(120);
  c.puddle(80).ledge({ y: 400, w: 200, porch: true, coin: true }).gap(100);
  c.spring().ledge({ y: 330, w: 190, porch: true, coin: true });
  return c.build({
    id: "grant-park",
    name: "Grant Park Storm",
    blurb: "Bounce pads and gusts. Ride the spring, then time the wind.",
    scene: "Storm took the lines down. The bounce boards are all that is left standing.",
    teaches: "Springs, and reading a gust before you commit.",
    mood: "storm",
  });
})();

// ---------------------------------------------------------------------------
// 3. East Atlanta — teaches moving and blinking platforms.
// ---------------------------------------------------------------------------
export const EAST_ATLANTA: LevelDef = (() => {
  const c = new Course("e");
  c.coin(90).ledge({ y: 420, porch: true, coin: true }).gap(100);
  // Teach: a platform that slides, over safe ground.
  c.ledge({ y: 400, w: 160, porch: true, move: { dx: 150, period: 2600 } }).gap(150);
  c.ledge({ y: 380, w: 160, coin: true, move: { dx: 170, period: 2400, offset: 0.5 } }).gap(150);
  // Teach: a platform that blinks.
  c.ledge({ y: 400, w: 160, porch: true, blink: { period: 2200, duty: 0.6 } }).gap(140);
  // Test: both, with spikes underneath.
  c.spike(80);
  c.ledge({ y: 380, w: 150, coin: true, move: { dy: -110, period: 2800 } }).gap(140);
  c.spike(80).ledge({ y: 360, w: 150, porch: true, blink: { period: 2000, duty: 0.55 } }).gap(150);
  // Twist: a moving platform that blinks, then a chain of them.
  c.ledge({
    y: 370,
    w: 150,
    coin: true,
    move: { dx: 160, period: 2600 },
    blink: { period: 2400, duty: 0.65 },
  }).gap(160);
  c.spike(90).ledge({ y: 390, w: 160, porch: true, move: { dx: 140, period: 2200 } }).gap(140);
  c.ledge({ y: 350, w: 150, coin: true, blink: { period: 1900, duty: 0.6, offset: 0.3 } }).gap(150);
  c.puddle(80).ledge({ y: 400, w: 200, porch: true, coin: true }).gap(120);
  c.ledge({ y: 370, w: 190, porch: true, coin: true, move: { dy: -120, period: 3000 } });
  return c.build({
    id: "east-atlanta",
    name: "East Atlanta Night",
    blurb: "Nothing holds still. Sliding boards, blinking string lights, spikes below.",
    scene: "The night market packs up around you. The boards move while you stand on them.",
    teaches: "Moving platforms, blinking platforms, and patience.",
    mood: "night",
  });
})();

// ---------------------------------------------------------------------------
// 4. Cabbagetown — teaches crumbling boards and ice.
// ---------------------------------------------------------------------------
export const CABBAGETOWN: LevelDef = (() => {
  const c = new Course("b");
  c.coin(90).ledge({ y: 430, porch: true, coin: true }).gap(100);
  // Teach: a board that gives way, over safe ground.
  c.ledge({ y: 410, w: 160, kind: "crumble", porch: true }).gap(130);
  c.ledge({ y: 400, w: 150, kind: "crumble", coin: true })
    .ledge({ y: 370, w: 150, kind: "crumble", coin: true })
    .gap(140);
  // Teach: ice.
  c.ledge({ y: 420, w: 220, kind: "ice", porch: true }).gap(120);
  // Test: crumble over spikes, ice into a gap.
  c.spike(80).ledge({ y: 390, w: 150, kind: "crumble", porch: true, coin: true }).gap(140);
  c.ledge({ y: 410, w: 200, kind: "ice", coin: true }).spike(80).gap(60);
  // Twist: ice run into a crumble chain over spikes.
  c.ledge({ y: 400, w: 200, kind: "ice", porch: true }).gap(60);
  c.spike(90)
    .ledge({ y: 380, w: 140, kind: "crumble", coin: true })
    .ledge({ y: 350, w: 140, kind: "crumble", porch: true })
    .gap(150);
  c.puddle(90).ledge({ y: 400, w: 190, kind: "ice", porch: true, coin: true }).gap(130);
  c.spike(80).ledge({ y: 380, w: 160, kind: "crumble", coin: true }).gap(150);
  c.ledge({ y: 410, w: 210, porch: true, coin: true });
  return c.build({
    id: "cabbagetown",
    name: "Cabbagetown Frost",
    blurb: "Rotten boards and frozen rails. Keep moving, nothing here holds.",
    scene: "Mill row, first freeze of the year. Half these boards will not take your weight.",
    teaches: "Crumbling boards and ice you cannot stop on.",
    mood: "night",
  });
})();

// ---------------------------------------------------------------------------
// 5. Reynoldstown — the puzzle course: keys, switches, gates.
// ---------------------------------------------------------------------------
export const REYNOLDSTOWN: LevelDef = (() => {
  const c = new Course("r");
  c.coin(90).ledge({ y: 430, porch: true, coin: true }).gap(80);
  // Teach: a plate on the ground opens the gate ahead of it.
  c.switchGate(560);
  c.gap(60).ledge({ y: 410, porch: true, coin: true }).gap(120);
  // Teach: keys. The ribbon stays dark until every one is in hand.
  c.key().ledge({ y: 400, porch: true, coin: true }).gap(120);
  // Test: plate on a ledge, gate right after.
  c.spike(70).ledge({ y: 400, w: 170, coin: true }).gap(40);
  c.switchGate(520);
  c.gap(80).key().ledge({ y: 380, porch: true, coin: true }).gap(140);
  // Twist: everything at once.
  c.spring().ledge({ y: 340, w: 150, kind: "crumble", coin: true }).gap(130);
  c.spike(80).ledge({ y: 370, w: 150, porch: true, move: { dx: 150, period: 2400 } }).gap(140);
  c.switchGate(600, 210);
  c.gap(80).key().ledge({ y: 390, w: 170, kind: "ice", coin: true }).gap(130);
  c.spike(90).ledge({ y: 360, w: 150, porch: true, blink: { period: 2100, duty: 0.6 } }).gap(150);
  c.puddle(90).spring().ledge({ y: 350, w: 190, porch: true, coin: true }).gap(140);
  c.ledge({ y: 400, w: 210, porch: true, coin: true });
  return c.build({
    id: "reynoldstown",
    name: "Reynoldstown Locks",
    blurb: "Keys, plates, and gates. The ribbon stays dark until you've got them all.",
    scene: "Somebody locked the whole street down. The keys are still out here somewhere.",
    teaches: "Keys, pressure plates, and gates — every mechanic at once.",
    mood: "night",
    tail: 320,
  });
})();

const HANDCRAFTED: Record<Exclude<LevelId, "daily">, LevelDef> = {
  kirkwood: KIRKWOOD,
  "grant-park": GRANT_PARK,
  "east-atlanta": EAST_ATLANTA,
  cabbagetown: CABBAGETOWN,
  reynoldstown: REYNOLDSTOWN,
};

export function dailySeed(neighborhoodId?: string | null, at?: Date): string {
  const day = atlantaDateKey(at);
  return neighborhoodId ? `${day}:${neighborhoodId}` : day;
}

/** The daily block mixes every mechanic the story taught, seeded by the date. */
export function buildDailyLevel(seed: string): LevelDef {
  const rng = mulberry32(hashSeed(`ltb-daily:${seed}`));
  const c = new Course("d");
  const pick = <T,>(xs: T[]) => xs[Math.floor(rng() * xs.length)]!;

  c.coin(90).ledge({ y: 430, porch: true, coin: true }).gap(100);

  for (let beat = 0; beat < 16; beat++) {
    const roll = rng();
    const y = 320 + Math.floor(rng() * 110);
    const w = 140 + Math.floor(rng() * 70);
    if (roll < 0.16) {
      c.spring();
    } else if (roll < 0.3) {
      c.spike(70 + Math.floor(rng() * 30));
    } else if (roll < 0.44) {
      c.puddle(70 + Math.floor(rng() * 30));
    } else if (roll < 0.54) {
      c.gust(160 + Math.floor(rng() * 80), 1400 + Math.floor(rng() * 500));
    }
    const kind = pick<PlatformKind>(["wood", "wood", "crumble", "ice", "awning"]);
    c.ledge({
      y,
      w,
      kind,
      porch: rng() > 0.35,
      coin: rng() > 0.4,
      ...(rng() > 0.72 ? { move: { dx: 140, period: 2200 + Math.floor(rng() * 800) } } : {}),
      ...(rng() > 0.82 ? { blink: { period: 1900 + Math.floor(rng() * 700), duty: 0.6 } } : {}),
    });
    c.gap(90 + Math.floor(rng() * 90));
  }

  c.ledge({ y: 400, w: 200, porch: true, coin: true });

  return c.build({
    id: "daily",
    name: "Daily Block",
    blurb: "Today's course — the whole neighborhood runs the same one.",
    scene: "A different block every day. Everyone in the city runs this one tonight.",
    teaches: "Everything the story taught, shuffled.",
    mood: rng() > 0.5 ? "storm" : "dusk",
  });
}

export function getLevel(id: LevelId, seed?: string): LevelDef {
  if (id === "daily") return buildDailyLevel(seed ?? dailySeed());
  return HANDCRAFTED[id];
}

export function listCourses(): Array<{
  id: LevelId;
  name: string;
  blurb: string;
  teaches: string;
  mood: LevelDef["mood"];
  length: number;
}> {
  return [KIRKWOOD, GRANT_PARK, EAST_ATLANTA, CABBAGETOWN, REYNOLDSTOWN, buildDailyLevel(dailySeed())].map(
    (l) => ({
      id: l.id,
      name: l.name,
      blurb: l.blurb,
      teaches: l.teaches,
      mood: l.mood,
      length: l.length,
    })
  );
}
