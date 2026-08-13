import type { LevelId } from "@/lib/games/types";
import type { SubmitRunResult } from "@/app/(games)/games/actions";
import type { RunEvent } from "@/lib/games/types";

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
      autoCenter: Phaser.Scale.CENTER_BOTH,
      width: parent.clientWidth || 390,
      height: parent.clientHeight || 700,
    },
    physics: {
      default: "arcade",
      arcade: { gravity: { x: 0, y: 1180 }, debug: false },
    },
    input: { activePointers: 3 },
    render: { antialias: true, pixelArt: false, roundPixels: true },
    audio: { disableWebAudio: false },
    scene: [PlayScene],
  });

  game.registry.set("bridge", bridge);
  return game;
}
