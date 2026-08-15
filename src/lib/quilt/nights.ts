import type { Night, NightId } from "./types";

/**
 * Fifteen story nights, then the ranked weekly board. The arc introduces one
 * idea at a time: colour, shape, true stitches, boarded windows, then wider
 * boards, then everything at once.
 */
export const NIGHTS: Night[] = [
  {
    id: "night-0",
    title: "Ember wakes",
    blurb: "Learn the stitch. Color or shape — three or more in a line.",
    scene: "The whole block went dark at once. Ember is the last lit thing on it.",
    ember:
      "I'm Ember. The porches went dark. Tap a tile, then tap a neighbor to swap. Three or more of one color — or one shape — will glow.",
    moves: 18,
    goals: [{ kind: "matches", n: 6 }],
    mood: "dusk",
  },
  {
    id: "night-1",
    title: "The tutor's stoop",
    blurb: "Amber first. Warm the tutor's lamp.",
    scene: "She grades papers on the steps every night. Tonight she can't see them.",
    ember: "Amber tiles are my fire. Line up three or more amber — shape doesn't have to match.",
    moves: 20,
    goals: [{ kind: "color", color: "amber", n: 10 }],
    mood: "dusk",
  },
  {
    id: "night-2",
    title: "The gardener's rail",
    blurb: "Leaves for the gardener who shares starts.",
    scene: "Every spring he leaves seedlings on the rail with a sign that says take one.",
    ember: "Same shape counts too. Three or more leaves in a line, any color.",
    moves: 20,
    goals: [{ kind: "shape", shape: "leaf", n: 8 }],
    mood: "dusk",
  },
  {
    id: "night-3",
    title: "True stitch",
    blurb: "Color and shape together. That's a true match.",
    scene: "The old quilt on the porch swing was stitched this way, every square.",
    ember:
      "When color and shape both agree, that's a true stitch. The quilt drinks those up.",
    moves: 24,
    goals: [
      { kind: "true", n: 1 },
      { kind: "matches", n: 6 },
    ],
    mood: "dusk",
  },
  {
    id: "night-4",
    title: "Boarded windows",
    blurb: "Some windows are boarded. Match across them to pull the boards off.",
    scene: "The corner house has been empty since spring. Someone nailed it shut.",
    ember:
      "Boarded tiles won't move for you. But catch one inside a match and a board comes off. Two matches, two boards.",
    moves: 26,
    goals: [{ kind: "boards", n: 3 }],
    boards: 8,
    boardLayers: 1,
    mood: "storm",
  },
  {
    id: "night-5",
    title: "Pine and dusk",
    blurb: "Two colors at once. Don't get greedy.",
    scene: "The pines behind the block hold the last of the light.",
    ember: "Pine for the trees, dusk for the hour. Both. Moves are short tonight.",
    moves: 22,
    goals: [
      { kind: "color", color: "pine", n: 8 },
      { kind: "color", color: "dusk", n: 8 },
    ],
    mood: "storm",
  },
  {
    id: "night-6",
    title: "Keys and mugs",
    blurb: "Neighbors are swapping again.",
    scene: "Someone's watching someone's cat. The key changed hands over coffee.",
    ember: "Keys for who locks up. Mugs for who stays late. Stitch both.",
    moves: 22,
    goals: [
      { kind: "shape", shape: "key", n: 7 },
      { kind: "shape", shape: "mug", n: 7 },
    ],
    mood: "storm",
  },
  {
    id: "night-7",
    title: "The wide porch",
    blurb: "A bigger board. More room, more to keep track of.",
    scene: "The wraparound on the corner lot. Eight windows across the front.",
    ember: "Bigger stoop tonight. More lines to read — take your time, the moves are generous.",
    moves: 26,
    goals: [{ kind: "matches", n: 14 }],
    size: 8,
    mood: "storm",
  },
  {
    id: "night-8",
    title: "Storm boards",
    blurb: "Boarded windows on the wide porch, in the rain.",
    scene: "The storm came through and half the block went back to plywood.",
    ember: "Boards again, and more of them. Strip them while you stitch — don't chase one thing.",
    moves: 28,
    goals: [
      { kind: "boards", n: 4 },
      { kind: "matches", n: 8 },
    ],
    size: 8,
    boards: 9,
    boardLayers: 1,
    mood: "storm",
  },
  {
    id: "night-9",
    title: "Lantern row",
    blurb: "Lanterns down the whole row, and glow to spare.",
    scene: "Someone hung paper lanterns the length of the street. They just need lighting.",
    ember: "Lanterns are my own shape. Ten of them, and I want the glow to show for it.",
    moves: 26,
    goals: [
      { kind: "shape", shape: "lantern", n: 10 },
      { kind: "score", n: 2200 },
    ],
    size: 8,
    mood: "deep",
  },
  {
    id: "night-10",
    title: "The long block",
    blurb: "No shape to chase. Just glow, and enough of it.",
    scene: "The block runs four hundred feet end to end. All of it dark.",
    ember: "No list tonight. Cascades are worth more than singles — set them up and let them fall.",
    moves: 24,
    goals: [{ kind: "score", n: 3200 }],
    size: 8,
    mood: "deep",
  },
  {
    id: "night-11",
    title: "Double stitch",
    blurb: "Two true stitches, and plenty of ordinary ones on the way.",
    scene: "The quilt is half finished. The hard squares are the ones left.",
    ember:
      "Two true stitches — color and shape both. They're rare on purpose. Watch for two of a kind already sitting in a row.",
    moves: 30,
    goals: [
      { kind: "true", n: 2 },
      { kind: "matches", n: 10 },
    ],
    size: 8,
    mood: "deep",
  },
  {
    id: "night-12",
    title: "Cream and clay",
    blurb: "Two more colors, and the moves run tight.",
    scene: "Whitewash and brick — the two oldest houses on the street, side by side.",
    ember: "Cream and clay. Tight on moves, so make every swap do two jobs.",
    moves: 22,
    goals: [
      { kind: "color", color: "cream", n: 9 },
      { kind: "color", color: "clay", n: 9 },
    ],
    size: 8,
    mood: "deep",
  },
  {
    id: "night-13",
    title: "The whole stoop",
    blurb: "Nine across, six boards, and a full card.",
    scene: "The biggest house on the block, and the one that's been dark longest.",
    ember: "Nine across. Six boarded. This is the one I've been getting you ready for.",
    moves: 32,
    goals: [
      { kind: "matches", n: 12 },
      { kind: "boards", n: 5 },
    ],
    size: 9,
    boards: 10,
    boardLayers: 1,
    mood: "deep",
  },
  {
    id: "night-14",
    title: "Last light",
    blurb: "Everything at once. Finish the quilt.",
    scene: "One porch left. If it lights, the whole block is lit.",
    ember:
      "Last night of the story. Boards, true stitches, and glow — all of it. Then the week's porch is yours.",
    moves: 36,
    goals: [
      { kind: "true", n: 1 },
      { kind: "boards", n: 4 },
      { kind: "color", color: "amber", n: 10 },
      { kind: "score", n: 3500 },
    ],
    size: 9,
    boards: 10,
    boardLayers: 1,
    mood: "dawn",
  },
  {
    id: "weekly",
    title: "This week's porch",
    blurb: "Same board for the whole neighborhood. Best score this week ranks.",
    scene: "Everyone on the block is stitching this exact quilt this week.",
    ember:
      "Everyone plays this one. Finish the card, then keep stitching for glow — the score is what goes on the rail.",
    moves: 30,
    goals: [
      { kind: "matches", n: 14 },
      { kind: "score", n: 3000 },
    ],
    size: 8,
    mood: "dawn",
  },
];

export function getNight(id: string): Night | null {
  return NIGHTS.find((n) => n.id === id) ?? null;
}

export function isNightId(id: string): id is NightId {
  return NIGHTS.some((n) => n.id === id);
}

export const STORY_NIGHTS = NIGHTS.filter((n) => n.id !== "weekly");

export function nextStoryNight(id: string): NightId | null {
  const i = STORY_NIGHTS.findIndex((n) => n.id === id);
  if (i < 0 || i >= STORY_NIGHTS.length - 1) return null;
  return STORY_NIGHTS[i + 1]!.id;
}

/** 0-based position in the story, or -1 for the weekly board. */
export function nightIndex(id: string): number {
  return STORY_NIGHTS.findIndex((n) => n.id === id);
}
