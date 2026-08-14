import type { Night, NightId } from "./types";

export const NIGHTS: Night[] = [
  {
    id: "night-0",
    title: "Ember wakes",
    blurb: "Learn the stitch. Color or shape — three or more in a line.",
    ember: "I'm Ember. The porches went dark. Tap a tile, then tap a neighbor to swap. Three or more of a color *or* a shape will glow.",
    moves: 18,
    goals: [{ kind: "matches", n: 4 }],
  },
  {
    id: "night-1",
    title: "The tutor's stoop",
    blurb: "Amber first. Warm the tutor's lamp.",
    ember: "Amber tiles are my fire. Line up three or more amber — shape doesn't have to match.",
    moves: 20,
    goals: [{ kind: "color", color: "amber", n: 10 }],
  },
  {
    id: "night-2",
    title: "The gardener's rail",
    blurb: "Leaves for the gardener who shares starts.",
    ember: "Same shape counts too. Three or more leaves in a line, any color.",
    moves: 20,
    goals: [{ kind: "shape", shape: "leaf", n: 8 }],
  },
  {
    id: "night-3",
    title: "True stitch",
    blurb: "Color and shape together. That's a true match.",
    ember: "When color *and* shape agree, that's a true stitch. The quilt drinks those up.",
    moves: 22,
    goals: [{ kind: "true", n: 2 }],
  },
  {
    id: "night-4",
    title: "Pine and dusk",
    blurb: "Two colors at once. Don't get greedy.",
    ember: "Pine for the trees, dusk for the hour. Both. Moves are short tonight.",
    moves: 20,
    goals: [
      { kind: "color", color: "pine", n: 8 },
      { kind: "color", color: "dusk", n: 8 },
    ],
  },
  {
    id: "night-5",
    title: "Keys and mugs",
    blurb: "Neighbors are swapping again.",
    ember: "Keys for who locks up. Mugs for who stays late. Stitch both.",
    moves: 22,
    goals: [
      { kind: "shape", shape: "key", n: 7 },
      { kind: "shape", shape: "mug", n: 7 },
    ],
  },
  {
    id: "night-6",
    title: "The whole stoop",
    blurb: "A full quilt card. This is the one that ranks.",
    ember: "Last night of the story. Finish the card. Your glow is what the week remembers.",
    moves: 24,
    goals: [
      { kind: "matches", n: 8 },
      { kind: "true", n: 2 },
      { kind: "color", color: "amber", n: 8 },
    ],
  },
  {
    id: "weekly",
    title: "This week's porch",
    blurb: "Same board for the whole neighborhood. Best score this week ranks.",
    ember: "Everyone plays this one. Your best finish is what goes on the rail.",
    moves: 26,
    goals: [
      { kind: "matches", n: 10 },
      { kind: "true", n: 3 },
    ],
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
