import type { SubmitRunResult } from "@/app/(games)/games/actions";
import { GRAVITY_Y, WORLD_HEIGHT } from "@/lib/games/physics";
import type { LevelId, RunEvent } from "@/lib/games/types";

/** What the on-screen buttons call. The scene owns the behaviour. */
export type GameControls = {
  jumpStart: () => void;
  jumpEnd: () => void;
  drop: () => void;
  /** Returns the new paused state. */
  togglePause: () => boolean;
  /** Returns the new muted state. */
  toggleMute: () => boolean;
};

export type RunStatusSnapshot = {
  paused: boolean;
  muted: boolean;
  finished: boolean;
};

export type RunOutcome = SubmitRunResult | { ok: false; error: string };

export type GameBridge = {
  levelId: LevelId;
  seed: string;
  token: string;
  demo: boolean;
  remainingToday: number;
  onSubmit: (input: {
    token: string;
    events: RunEvent[];
    durationMs: number;
    claimedScore: number;
  }) => Promise<SubmitRunResult>;
  onExit: () => void;
  onReplay: () => void;
  /** Fires once the scene can take input, handing over the control surface. */
  onReady: (controls: GameControls) => void;
  onStatus: (status: RunStatusSnapshot) => void;
  /** `reason` explains a loss the score alone can't — a locked ribbon, a gate. */
  onResult: (result: RunOutcome, cleared: boolean, reason?: string) => void;
};

export async function createLightTheBlockGame(
  parent: HTMLElement,
  bridge: GameBridge
) {
  const Phaser = await import("phaser");
  const { PlayScene } = await import("./scenes/PlayScene");

  const game = new Phaser.Game({
    type: Phaser.AUTO,
    parent,
    backgroundColor: "#1b1410",
    scale: {
      mode: Phaser.Scale.RESIZE,
      width: parent.clientWidth || 390,
      height: parent.clientHeight || 700,
    },
    physics: {
      default: "arcade",
      arcade: { gravity: { x: 0, y: GRAVITY_Y }, debug: false },
    },
    // Phaser's loader only pumps one batch of maxParallelDownloads here: after
    // the first six files land it never refills the queue, so anything past
    // slot six sits PENDING forever and the scene never starts. Keeping the
    // window wider than any single load pass means one batch is always enough.
    loader: { maxParallelDownloads: 32 },
    input: { activePointers: 3 },
    render: { antialias: true, pixelArt: false, roundPixels: true },
    audio: { disableWebAudio: false },
    // preBoot lands before any scene runs, so create() can never race the
    // registry write the way a post-construction set() could.
    callbacks: {
      preBoot: (g) => {
        g.registry.set("bridge", bridge);
        g.registry.set("worldHeight", WORLD_HEIGHT);
      },
    },
    scene: [PlayScene],
  });

  return game;
}
