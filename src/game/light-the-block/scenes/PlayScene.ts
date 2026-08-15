import * as Phaser from "phaser";
import { getLevel } from "@/lib/games/levels";
import {
  AIR_JUMPS,
  BUFFER_MS,
  COYOTE_MS,
  HOLD_V,
  JUMP_V,
  LIVES,
  PLAYER_H,
  PLAYER_START_X,
  PLAYER_W,
  RUN_SPEED,
  WORLD_HEIGHT,
} from "@/lib/games/physics";
import { scoreFromCounts } from "@/lib/games/scoring";
import type { LevelDef, RunEvent } from "@/lib/games/types";
import type { GameBridge, GameControls, RunStatusSnapshot } from "../boot";

type MoodPalette = {
  skyTop: number;
  skyMid: number;
  skyBot: number;
  far: number;
  mid: number;
  ground: number;
  accent: number;
};

const PALETTES: Record<LevelDef["mood"], MoodPalette> = {
  dusk: {
    skyTop: 0x3a2a4a,
    skyMid: 0xc2661b,
    skyBot: 0xf4d29e,
    far: 0x264536,
    mid: 0x2b2420,
    ground: 0x6c3418,
    accent: 0xedb56a,
  },
  storm: {
    skyTop: 0x1a2430,
    skyMid: 0x3d4a58,
    skyBot: 0x6b5f56,
    far: 0x1b2a22,
    mid: 0x2b2420,
    ground: 0x3a2a22,
    accent: 0x8aa0b4,
  },
  night: {
    skyTop: 0x0d1020,
    skyMid: 0x1b2450,
    skyBot: 0x3d2a4a,
    far: 0x14181c,
    mid: 0x1c1614,
    ground: 0x2b2420,
    accent: 0xe69a41,
  },
};

export class PlayScene extends Phaser.Scene {
  private bridge!: GameBridge;
  private level!: LevelDef;
  private pal!: MoodPalette;

  private player!: Phaser.Physics.Arcade.Sprite;
  private platforms!: Phaser.Physics.Arcade.StaticGroup;
  private rails!: Phaser.Physics.Arcade.StaticGroup;

  /** Built by buildWorld(), wired to the player by wireCollisions(). */
  private porchZones: Phaser.GameObjects.Zone[] = [];
  private coinSprites: Phaser.GameObjects.GameObject[] = [];
  private puddleSprites: Phaser.GameObjects.GameObject[] = [];
  private gustSprites: Array<{ obj: Phaser.GameObjects.GameObject; period: number }> = [];
  private finishGate!: Phaser.GameObjects.Rectangle;

  private eventsLog: RunEvent[] = [];
  private runStartedAt = 0;
  private pausedAt = 0;
  private pausedMs = 0;
  private lives = LIVES;
  private coins = 0;
  private porchesLit = 0;
  private deaths = 0;
  private cleared = false;
  private finished = false;
  private submitting = false;
  private paused = false;
  private muted = false;
  private classic = false;
  private audioUnlocked = false;
  private musicStarted = false;
  private dir = 1;

  private coyoteUntil = 0;
  private bufferUntil = 0;
  private airJumpsLeft = AIR_JUMPS;
  private holdingJump = false;
  private invulnUntil = 0;
  private lastSafe = { x: PLAYER_START_X, y: 400 };
  private swipeStart: { y: number; t: number } | null = null;
  private cursors: {
    left?: Phaser.Input.Keyboard.Key;
    right?: Phaser.Input.Keyboard.Key;
    a?: Phaser.Input.Keyboard.Key;
    d?: Phaser.Input.Keyboard.Key;
  } = {};

  private backdrop: Phaser.GameObjects.GameObject[] = [];
  private hud!: {
    score: Phaser.GameObjects.Text;
    lives: Phaser.GameObjects.Text;
    course: Phaser.GameObjects.Text;
    hint: Phaser.GameObjects.Text;
    bar: Phaser.GameObjects.Rectangle;
    barBg: Phaser.GameObjects.Rectangle;
  };
  private pauseVeil!: Phaser.GameObjects.Container;

  constructor() {
    super("play");
  }

  /** Art only. Audio streams in after create() — see loadAudio(). */
  preload() {
    this.load.on("loaderror", () => undefined);
    this.load.image("lantern", "/games/light-the-block/sprites/lantern.png");
    this.load.image("lantern-jump", "/games/light-the-block/sprites/lantern-jump.png");
    this.load.image("coin", "/games/light-the-block/sprites/coin.png");
    this.load.image("platform", "/games/light-the-block/sprites/platform.png");
    this.load.image("porch-unlit", "/games/light-the-block/sprites/porch-unlit.png");
    this.load.image("puddle", "/games/light-the-block/sprites/puddle.png");
  }

  create() {
    this.bridge = this.game.registry.get("bridge") as GameBridge;
    this.level = getLevel(this.bridge.levelId, this.bridge.seed);
    this.pal = PALETTES[this.level.mood];
    this.runStartedAt = this.time.now;
    this.lastSafe = {
      x: PLAYER_START_X,
      y: (this.level.platforms[0]?.y ?? 480) - 60,
    };

    this.physics.world.setBounds(0, 0, this.level.length, WORLD_HEIGHT);
    this.cameras.main.setBounds(0, 0, this.level.length, WORLD_HEIGHT);
    this.cameras.main.setBackgroundColor(this.pal.skyMid);

    this.drawParallax();
    // Order matters: buildWorld() creates the platform groups, spawnPlayer()
    // collides against them. Spawning first left both colliders bound to
    // `undefined` — Phaser silently drops those, so the lantern fell through
    // the whole block and the run was over before a tap could register.
    this.buildWorld();
    this.spawnPlayer();
    this.wireCollisions();
    this.bindInput();
    this.buildHud();
    this.buildPauseVeil();
    this.layout();

    this.scale.on("resize", this.layout, this);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.scale.off("resize", this.layout, this);
    });

    this.bridge.onReady(this.controls());
    this.pushStatus();
    this.loadAudio();
  }

  /**
   * A quarter-megabyte of MP3 has no business holding up the first frame, and
   * every cue already has a synth fallback. Fetch it in the background and let
   * the clips swap in whenever they land.
   */
  private loadAudio() {
    const clips: Array<[string, string]> = [
      ["sfx-jump", "jump"],
      ["sfx-land", "land"],
      ["sfx-coin", "coin"],
      ["sfx-ignite", "ignite"],
      ["sfx-gust", "gust"],
      ["sfx-snuff", "snuff"],
      ["sfx-clear", "clear"],
      ["bgm", "dusk-loop"],
    ];
    let queued = 0;
    for (const [key, file] of clips) {
      if (this.cache.audio.exists(key)) continue;
      this.load.audio(key, `/games/light-the-block/audio/${file}.mp3`);
      queued += 1;
    }
    if (queued === 0) return;
    this.load.once(Phaser.Loader.Events.COMPLETE, () => this.startMusic());
    this.load.start();
  }

  // ---------------------------------------------------------------- controls

  /** Handle the React overlay drives, so the on-screen buttons are real input. */
  private controls(): GameControls {
    return {
      jumpStart: () => {
        this.unlockAudio();
        if (this.paused || this.finished) return;
        this.bufferUntil = this.time.now + BUFFER_MS;
        this.holdingJump = true;
        this.tryJump();
      },
      jumpEnd: () => {
        this.holdingJump = false;
      },
      drop: () => {
        this.unlockAudio();
        this.dropThrough();
      },
      togglePause: () => this.togglePause(),
      toggleMute: () => this.toggleMute(),
    };
  }

  private pushStatus() {
    const snapshot: RunStatusSnapshot = {
      paused: this.paused,
      muted: this.muted,
      finished: this.finished,
    };
    this.bridge.onStatus(snapshot);
  }

  // ------------------------------------------------------------------ visual

  private drawBackdrop() {
    this.backdrop.forEach((o) => o.destroy());
    this.backdrop = [];

    const w = Math.max(this.scale.width, 420);
    const h = Math.max(this.scale.height, WORLD_HEIGHT);
    const g = this.add.graphics().setScrollFactor(0).setDepth(-40);
    g.fillGradientStyle(this.pal.skyTop, this.pal.skyTop, this.pal.skyMid, this.pal.skyMid, 1);
    g.fillRect(0, 0, w, h * 0.42);
    g.fillGradientStyle(this.pal.skyMid, this.pal.skyMid, this.pal.skyBot, this.pal.skyBot, 1);
    g.fillRect(0, h * 0.4, w, h * 0.6);
    this.backdrop.push(g);

    if (this.level.mood !== "storm") {
      const sun = this.add
        .circle(w * 0.78, h * 0.22, 28, this.pal.accent, 0.9)
        .setScrollFactor(0)
        .setDepth(-39);
      const halo = this.add
        .circle(sun.x, sun.y, 54, this.pal.accent, 0.18)
        .setScrollFactor(0)
        .setDepth(-39);
      this.backdrop.push(sun, halo);
    }
    if (this.level.mood === "night") {
      for (let i = 0; i < 28; i++) {
        this.backdrop.push(
          this.add
            .circle(
              20 + ((i * 97) % Math.max(1, w - 20)),
              16 + ((i * 53) % 180),
              i % 4 === 0 ? 1.6 : 1,
              0xfaf7f2,
              0.7
            )
            .setScrollFactor(0)
            .setDepth(-38)
        );
      }
    }
  }

  private drawParallax() {
    const far = this.add.graphics().setScrollFactor(0.12).setDepth(-30);
    far.fillStyle(this.pal.far, 1);
    for (let x = -40; x < this.level.length; x += 140) {
      const h = 120 + ((x * 7) % 80);
      far.fillTriangle(x, 430, x + 70, 430 - h, x + 140, 430);
    }
    const mid = this.add.graphics().setScrollFactor(0.32).setDepth(-20);
    mid.fillStyle(this.pal.mid, 1);
    for (let x = 0; x < this.level.length; x += 220) {
      const h = 160 + ((x * 13) % 70);
      const w = 90 + ((x * 5) % 40);
      mid.fillRect(x, 520 - h, w, h);
      mid.fillRect(x + 18, 520 - h - 36, 22, 36);
      mid.fillStyle(this.pal.accent, 0.35);
      mid.fillRect(x + 14, 520 - h + 40, 12, 16);
      mid.fillRect(x + w - 28, 520 - h + 48, 12, 16);
      mid.fillStyle(this.pal.mid, 1);
    }
  }

  // ------------------------------------------------------------------- world

  private buildWorld() {
    this.platforms = this.physics.add.staticGroup();
    this.rails = this.physics.add.staticGroup();
    this.porchZones = [];
    this.coinSprites = [];
    this.puddleSprites = [];
    this.gustSprites = [];

    for (const p of this.level.platforms) {
      const group = p.dropThrough ? this.rails : this.platforms;
      const height = p.kind === "ground" ? 90 : 28;
      const sprite = this.add.rectangle(
        p.x + p.w / 2,
        p.y + height / 2,
        p.w,
        height,
        p.kind === "wet" ? 0x4a5a62 : p.kind === "awning" ? 0x833e1a : this.pal.ground
      );
      sprite.setData("kind", p.kind);
      sprite.setData("drop", !!p.dropThrough);
      this.physics.add.existing(sprite, true);
      group.add(sprite);

      if (p.kind !== "ground" && this.textures.exists("platform")) {
        const deco = this.add.image(p.x + p.w / 2, p.y + 6, "platform");
        deco.setDisplaySize(p.w + 16, 36);
        deco.setDepth(2);
      } else if (p.kind === "ground") {
        this.add.rectangle(p.x + p.w / 2, p.y + 6, p.w, 12, 0x2f5540).setDepth(1);
      }
    }

    for (const porch of this.level.porches) {
      const glow = this.add.circle(porch.x, porch.y - 36, 10, 0x6b5f56, 0.7);
      glow.setData("lit", false);
      glow.setDepth(6);
      const lamp = this.textures.exists("porch-unlit")
        ? this.add.image(porch.x, porch.y - 46, "porch-unlit").setDisplaySize(28, 40).setDepth(6)
        : this.add.rectangle(porch.x, porch.y - 48, 14, 22, 0x6b5f56).setDepth(6);
      const zone = this.add.zone(porch.x, porch.y - 20, 56, 70);
      this.physics.add.existing(zone, true);
      zone.setData("glow", glow);
      zone.setData("lamp", lamp);
      zone.setData("id", porch.id);
      this.porchZones.push(zone);
    }

    for (const coin of this.level.coins) {
      const spr = this.textures.exists("coin")
        ? this.add.image(coin.x, coin.y, "coin").setDisplaySize(28, 28)
        : this.add.circle(coin.x, coin.y, 11, 0xe69a41);
      spr.setData("id", coin.id);
      spr.setDepth(7);
      this.tweens.add({
        targets: spr,
        y: coin.y - 8,
        duration: 700,
        yoyo: true,
        repeat: -1,
        ease: "Sine.inOut",
      });
      this.physics.add.existing(spr, true);
      this.coinSprites.push(spr);
    }

    for (const puddle of this.level.puddles) {
      const spr = this.textures.exists("puddle")
        ? this.add
            .image(puddle.x + puddle.w / 2, puddle.y - 8, "puddle")
            .setDisplaySize(puddle.w + 20, 22)
        : this.add.ellipse(puddle.x + puddle.w / 2, puddle.y - 6, puddle.w, 16, 0x1a1a28, 0.85);
      spr.setDepth(5);
      this.physics.add.existing(spr, true);
      this.puddleSprites.push(spr);
    }

    for (const gust of this.level.gusts) {
      const spr = this.add.ellipse(gust.x, gust.y, 34, 70, 0x8aa0b4, 0.22);
      spr.setDepth(8);
      const period = gust.period ?? 1600;
      this.tweens.add({
        targets: spr,
        alpha: { from: 0.08, to: 0.38 },
        scaleX: { from: 0.7, to: 1.2 },
        duration: period,
        yoyo: true,
        repeat: -1,
      });
      this.physics.add.existing(spr, true);
      this.gustSprites.push({ obj: spr, period });
    }

    this.finishGate = this.add.rectangle(this.level.finishX, 360, 18, 320, 0xc2661b, 0.55);
    this.add.rectangle(this.level.finishX, 200, 64, 18, 0xedb56a).setDepth(4);
    this.physics.add.existing(this.finishGate, true);

    if (this.level.mood === "storm") {
      const drop = this.add.graphics();
      drop.fillStyle(0xb8c4d0, 0.7);
      drop.fillRect(0, 0, 2, 10);
      drop.generateTexture("rain-drop", 2, 10);
      drop.destroy();
      this.add
        .particles(0, 0, "rain-drop", {
          x: { min: 0, max: this.level.length },
          y: 0,
          lifespan: 1400,
          speedY: { min: 380, max: 620 },
          speedX: { min: -80, max: -20 },
          scale: { start: 0.6, end: 0.2 },
          quantity: 3,
          frequency: 30,
        })
        .setDepth(20);
    }
  }

  private spawnPlayer() {
    const startY = (this.level.platforms[0]?.y ?? 500) - 80;
    const hasArt = this.textures.exists("lantern");
    if (!hasArt) {
      const g = this.add.graphics();
      g.fillStyle(0xc2661b, 1);
      g.fillRoundedRect(0, 0, PLAYER_W, PLAYER_H, 8);
      g.generateTexture("lantern-fallback", PLAYER_W, PLAYER_H);
      g.destroy();
    }
    this.player = this.physics.add.sprite(
      PLAYER_START_X,
      startY,
      hasArt ? "lantern" : "lantern-fallback"
    );
    this.applySpriteScale();
    this.sizePlayerBody();
    this.player.setCollideWorldBounds(true);
    this.player.setDepth(10);
    this.player.setBounce(0.02);

    this.cameras.main.startFollow(this.player, true, 0.12, 0.08, -40, 80);
    this.cameras.main.setDeadzone(40, 80);
  }

  /** Keep the drawn lantern at PLAYER_W x PLAYER_H whichever frame is showing. */
  private applySpriteScale() {
    const sx = PLAYER_W / (this.player.width || PLAYER_W);
    const sy = PLAYER_H / (this.player.height || PLAYER_H);
    this.player.setScale(sx, sy);
  }

  /**
   * Arcade body sizes are in SOURCE-texture pixels, then multiplied by the
   * sprite's scale. lantern.png is 230x384, so the old hard-coded 28x46 became
   * a 5x7 display-pixel hitbox — small enough to miss most platforms.
   */
  private sizePlayerBody() {
    const body = this.player.body as Phaser.Physics.Arcade.Body | null;
    if (!body) return;
    const w = this.player.width || PLAYER_W;
    const h = this.player.height || PLAYER_H;
    body.setSize(w * 0.56, h * 0.9);
    body.setOffset(w * 0.22, h * 0.08);
  }

  private wireCollisions() {
    this.physics.add.collider(this.player, this.platforms);
    this.physics.add.collider(this.player, this.rails, undefined, () => {
      const body = this.player.body as Phaser.Physics.Arcade.Body;
      return body.velocity.y >= 0 && !this.player.getData("drop");
    });

    for (const zone of this.porchZones) {
      this.physics.add.overlap(this.player, zone, () => this.lightPorch(zone));
    }
    for (const coin of this.coinSprites) {
      this.physics.add.overlap(this.player, coin, () => this.takeCoin(coin));
    }
    for (const puddle of this.puddleSprites) {
      this.physics.add.overlap(this.player, puddle, () => this.hurt("puddle"));
    }
    for (const gust of this.gustSprites) {
      this.physics.add.overlap(this.player, gust.obj, () => {
        if (this.runClock() % gust.period < 700) this.hurt("gust");
      });
    }
    this.physics.add.overlap(this.player, this.finishGate, () => this.finishRun());
  }

  // ------------------------------------------------------------------- input

  private bindInput() {
    this.input.on("pointerdown", (p: Phaser.Input.Pointer) => {
      this.unlockAudio();
      if (this.paused || this.finished) return;
      this.swipeStart = { y: p.y, t: this.time.now };
      this.bufferUntil = this.time.now + BUFFER_MS;
      this.holdingJump = true;
      this.tryJump();
    });
    this.input.on("pointerup", (p: Phaser.Input.Pointer) => {
      this.holdingJump = false;
      if (
        this.swipeStart &&
        p.y - this.swipeStart.y > 48 &&
        this.time.now - this.swipeStart.t < 420
      ) {
        this.dropThrough();
      }
      this.swipeStart = null;
    });

    const kb = this.input.keyboard;
    kb?.on("keydown-SPACE", () => {
      this.unlockAudio();
      if (this.paused || this.finished) return;
      this.bufferUntil = this.time.now + BUFFER_MS;
      this.holdingJump = true;
      this.tryJump();
    });
    kb?.on("keyup-SPACE", () => {
      this.holdingJump = false;
    });
    kb?.on("keydown-UP", () => {
      this.unlockAudio();
      if (this.paused || this.finished) return;
      this.bufferUntil = this.time.now + BUFFER_MS;
      this.holdingJump = true;
      this.tryJump();
    });
    kb?.on("keyup-UP", () => {
      this.holdingJump = false;
    });
    kb?.on("keydown-DOWN", () => this.dropThrough());
    kb?.on("keydown-S", () => this.dropThrough());
    kb?.on("keydown-LEFT", () => {
      this.classic = true;
      this.dir = -1;
    });
    kb?.on("keydown-RIGHT", () => {
      this.classic = true;
      this.dir = 1;
    });
    kb?.on("keydown-A", () => {
      this.classic = true;
      this.dir = -1;
    });
    kb?.on("keydown-D", () => {
      this.classic = true;
      this.dir = 1;
    });
    this.cursors.left = kb?.addKey("LEFT");
    this.cursors.right = kb?.addKey("RIGHT");
    this.cursors.a = kb?.addKey("A");
    this.cursors.d = kb?.addKey("D");
    kb?.on("keydown-P", () => this.togglePause());
    kb?.on("keydown-M", () => this.toggleMute());
    kb?.on("keydown-ESC", () => this.bridge.onExit());
  }

  // --------------------------------------------------------------------- HUD

  private buildHud() {
    const style: Phaser.Types.GameObjects.Text.TextStyle = {
      fontFamily: "ui-sans-serif, system-ui, sans-serif",
      fontSize: "15px",
      color: "#faf7f2",
      fontStyle: "700",
    };
    this.hud = {
      score: this.add.text(14, 12, "0", style).setScrollFactor(0).setDepth(50),
      lives: this.add
        .text(14, 34, "🏮".repeat(LIVES), { fontSize: "16px" })
        .setScrollFactor(0)
        .setDepth(50),
      course: this.add
        .text(0, 12, this.level.name, {
          fontFamily: "ui-sans-serif, system-ui, sans-serif",
          fontSize: "13px",
          color: "#faeacf",
        })
        .setOrigin(1, 0)
        .setScrollFactor(0)
        .setDepth(50),
      hint: this.add
        .text(0, 0, "Tap to jump · tap again to float · swipe down to drop", {
          fontFamily: "ui-sans-serif, system-ui, sans-serif",
          fontSize: "13px",
          color: "#faeacf",
        })
        .setOrigin(0.5)
        .setScrollFactor(0)
        .setDepth(50),
      barBg: this.add
        .rectangle(0, 8, 10, 4, 0x2b2420, 0.5)
        .setScrollFactor(0)
        .setDepth(50),
      bar: this.add
        .rectangle(14, 8, 4, 4, 0xe69a41)
        .setOrigin(0, 0.5)
        .setScrollFactor(0)
        .setDepth(51),
    };

    this.time.delayedCall(5200, () => {
      if (this.hud?.hint?.active) {
        this.tweens.add({ targets: this.hud.hint, alpha: 0, duration: 600 });
      }
    });
  }

  private buildPauseVeil() {
    const veil = this.add.rectangle(0, 0, 10, 10, 0x1b1410, 0.72).setOrigin(0.5);
    const label = this.add
      .text(0, 0, "Paused", {
        fontFamily: "ui-sans-serif, system-ui, sans-serif",
        fontSize: "24px",
        color: "#faf7f2",
        fontStyle: "700",
      })
      .setOrigin(0.5);
    this.pauseVeil = this.add
      .container(0, 0, [veil, label])
      .setScrollFactor(0)
      .setDepth(70)
      .setVisible(false);
    this.pauseVeil.setData("veil", veil);
  }

  /** Runs on create and on every resize — nothing here may assume a fixed size. */
  private layout() {
    const w = this.scale.width;
    const h = this.scale.height;
    this.cameras.main.setViewport(0, 0, w, h);
    this.drawBackdrop();

    if (this.hud) {
      this.hud.course.setPosition(w - 14, 12);
      this.hud.hint.setPosition(w / 2, h - 30);
      this.hud.barBg.setPosition(w / 2, 8);
      this.hud.barBg.setSize(Math.max(10, w - 28), 4);
      this.refreshHud();
    }
    if (this.pauseVeil) {
      const veil = this.pauseVeil.getData("veil") as Phaser.GameObjects.Rectangle;
      veil.setSize(w, h);
      this.pauseVeil.setPosition(w / 2, h / 2);
    }
  }

  // ------------------------------------------------------------------- audio

  /**
   * Browsers keep the audio context suspended until a gesture lands. The old
   * code started the loop inside create(), where it was always blocked.
   */
  private unlockAudio() {
    if (this.audioUnlocked) return;
    this.audioUnlocked = true;
    const mgr = this.sound as unknown as { context?: AudioContext };
    if (mgr.context?.state === "suspended") {
      void mgr.context.resume().catch(() => undefined);
    }
    this.startMusic();
  }

  /** Safe to call from either side of the race: the gesture or the download. */
  private startMusic() {
    if (this.musicStarted || !this.audioUnlocked || this.muted) return;
    if (this.finished || !this.cache.audio.exists("bgm")) return;
    try {
      this.sound.play("bgm", { loop: true, volume: 0.28 });
      this.musicStarted = true;
    } catch {
      /* audio is optional */
    }
  }

  private sfx(key: string, synth: () => void) {
    if (this.muted) return;
    if (this.cache.audio.exists(key)) {
      try {
        this.sound.play(key, { volume: 0.55 });
        return;
      } catch {
        /* fall through to the synth */
      }
    }
    synth();
  }

  private synthBeep(freq: number, dur = 0.12, type: OscillatorType = "triangle") {
    try {
      const manager = this.sound as { context?: AudioContext };
      const ctx = manager.context;
      if (!ctx) return;
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.type = type;
      o.frequency.value = freq;
      g.gain.value = 0.05;
      o.connect(g);
      g.connect(ctx.destination);
      o.start();
      g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + dur);
      o.stop(ctx.currentTime + dur);
    } catch {
      /* audio optional */
    }
  }

  // ------------------------------------------------------------------- moves

  private tryJump() {
    if (this.paused || this.finished) return;
    if (this.time.now > this.bufferUntil) return;
    const body = this.player.body as Phaser.Physics.Arcade.Body;
    const grounded =
      body.blocked.down || body.touching.down || this.time.now < this.coyoteUntil;
    if (!grounded && this.airJumpsLeft <= 0) return;
    if (!grounded) this.airJumpsLeft -= 1;

    body.setVelocityY(JUMP_V);
    this.coyoteUntil = 0;
    this.bufferUntil = 0;
    this.logEvent("jump");
    if (this.textures.exists("lantern-jump")) {
      this.player.setTexture("lantern-jump");
      this.applySpriteScale();
    }
    this.sfx("sfx-jump", () => this.synthBeep(420, 0.1));
    if (typeof navigator !== "undefined" && navigator.vibrate) navigator.vibrate(8);
  }

  private dropThrough() {
    if (this.paused || this.finished) return;
    this.player.setData("drop", true);
    this.time.delayedCall(220, () => this.player?.setData("drop", false));
  }

  private lightPorch(zone: Phaser.GameObjects.Zone) {
    if (this.finished) return;
    const glow = zone.getData("glow") as Phaser.GameObjects.Arc | undefined;
    if (!glow || glow.getData("lit")) return;
    glow.setData("lit", true);
    glow.setFillStyle(0xe69a41, 0.95);
    glow.setRadius(18);
    const lamp = zone.getData("lamp") as Phaser.GameObjects.GameObject;
    this.tweens.add({ targets: [glow, lamp], scale: 1.18, yoyo: true, duration: 180 });
    this.porchesLit += 1;
    this.logEvent("porch", zone.getData("id"));
    this.lastSafe = { x: zone.x, y: zone.y - 30 };
    this.sfx("sfx-ignite", () => this.synthBeep(620, 0.18));
    if (typeof navigator !== "undefined" && navigator.vibrate) navigator.vibrate(12);
    this.refreshHud();
  }

  private takeCoin(obj: Phaser.GameObjects.GameObject) {
    if (this.finished) return;
    const id = obj.getData("id") as string | undefined;
    if (!id || obj.getData("gone")) return;
    obj.setData("gone", true);
    // Disable, don't destroy: the pickup tween destroys the Image on complete,
    // and that frees the body again. Destroying it here double-frees.
    const body = obj.body as Phaser.Physics.Arcade.StaticBody | null;
    if (body) body.enable = false;
    this.tweens.add({
      targets: obj,
      y: (obj as Phaser.GameObjects.Image).y - 30,
      alpha: 0,
      duration: 180,
      onComplete: () => obj.destroy(),
    });
    this.coins += 1;
    this.logEvent("coin", id);
    this.sfx("sfx-coin", () => this.synthBeep(880, 0.1, "sine"));
    this.refreshHud();
  }

  private hurt(kind: "puddle" | "gust") {
    if (this.finished || this.paused || this.time.now < this.invulnUntil) return;
    this.invulnUntil = this.time.now + 900;
    this.deaths += 1;
    this.lives -= 1;
    this.logEvent("die");
    this.sfx(kind === "gust" ? "sfx-gust" : "sfx-snuff", () =>
      this.synthBeep(140, 0.2, "sawtooth")
    );
    this.cameras.main.flash(120, 80, 40, 20);
    this.player.setTint(0x6b5f56);
    this.time.delayedCall(180, () => this.player?.clearTint());
    if (this.lives <= 0) {
      this.refreshHud();
      this.endRun(false);
      return;
    }
    this.player.setPosition(this.lastSafe.x, this.lastSafe.y);
    (this.player.body as Phaser.Physics.Arcade.Body).setVelocity(0, 0);
    this.airJumpsLeft = AIR_JUMPS;
    this.refreshHud();
  }

  private finishRun() {
    if (this.finished) return;
    this.cleared = true;
    this.logEvent("finish");
    this.sfx("sfx-clear", () => this.synthBeep(740, 0.3));
    this.endRun(true);
  }

  private endRun(cleared: boolean) {
    if (this.submitting) return;
    this.submitting = true;
    // `cleared`, not `finished`. The server rebuilds the score from the event
    // log, and a snuffed run never logs a "finish". Flipping `finished` before
    // scoring handed the finish bonus to every death, so the server's total
    // disagreed and the run came back SCORE_MISMATCH.
    this.cleared = cleared;
    this.finished = true;
    this.paused = false;
    this.pauseVeil.setVisible(false);
    this.physics.pause();
    this.pushStatus();

    const durationMs = Math.max(1, Math.round(this.runClock()));
    const score = this.currentScore();
    this.bridge
      .onSubmit({
        token: this.bridge.token,
        events: this.eventsLog,
        durationMs,
        claimedScore: score,
      })
      .then((result) => this.bridge.onResult(result, cleared))
      .catch(() =>
        this.bridge.onResult(
          {
            ok: false,
            error: "Couldn't reach the porch. Your run wasn't saved.",
          },
          cleared
        )
      );
  }

  private currentScore() {
    return scoreFromCounts({
      coins: this.coins,
      porchesLit: this.porchesLit,
      finished: this.cleared,
    });
  }

  private refreshHud() {
    if (!this.hud || !this.player) return;
    this.hud.score.setText(String(this.currentScore()));
    this.hud.lives.setText("🏮".repeat(Math.max(0, this.lives)) || "—");
    const progress = Phaser.Math.Clamp(this.player.x / this.level.finishX, 0, 1);
    this.hud.bar.width = Math.max(4, (this.scale.width - 28) * progress);
  }

  /** Run time with paused stretches removed, so the server clock stays honest. */
  private runClock() {
    const pausedNow = this.paused ? this.time.now - this.pausedAt : 0;
    return this.time.now - this.runStartedAt - this.pausedMs - pausedNow;
  }

  private logEvent(k: RunEvent["k"], id?: string) {
    this.eventsLog.push({
      t: Math.max(0, Math.round(this.runClock())),
      k,
      ...(id ? { id } : {}),
    });
  }

  private togglePause(): boolean {
    if (this.finished) return false;
    this.paused = !this.paused;
    if (this.paused) {
      this.pausedAt = this.time.now;
      this.physics.pause();
    } else {
      this.pausedMs += this.time.now - this.pausedAt;
      this.physics.resume();
    }
    this.pauseVeil.setVisible(this.paused);
    this.holdingJump = false;
    this.pushStatus();
    return this.paused;
  }

  private toggleMute(): boolean {
    this.muted = !this.muted;
    // `sound.mute` rides a WebAudio gain node that does not reliably take the
    // change (Chromium keeps reporting gain 1 after the set), so our own flag
    // is the source of truth: sfx() already checks it, and the looping track
    // gets stopped outright rather than trusted to go quiet.
    this.sound.mute = this.muted;
    if (this.muted) {
      this.sound.stopByKey("bgm");
      this.musicStarted = false;
    } else {
      this.startMusic();
    }
    this.pushStatus();
    return this.muted;
  }

  update() {
    if (!this.player || this.finished || this.paused) return;
    const body = this.player.body as Phaser.Physics.Arcade.Body;
    const speed = RUN_SPEED[this.level.mood];
    if (this.classic) {
      const left = !!(this.cursors.left?.isDown || this.cursors.a?.isDown);
      const right = !!(this.cursors.right?.isDown || this.cursors.d?.isDown);
      if (left) this.dir = -1;
      else if (right) this.dir = 1;
      else this.dir = 0;
    } else {
      this.dir = 1;
    }
    body.setVelocityX(this.dir * speed);

    const grounded = body.blocked.down || body.touching.down;
    if (grounded) {
      this.coyoteUntil = this.time.now + COYOTE_MS;
      this.airJumpsLeft = AIR_JUMPS;
      if (this.textures.exists("lantern") && this.player.texture.key !== "lantern") {
        this.player.setTexture("lantern");
        this.applySpriteScale();
      }
    } else if (this.holdingJump && body.velocity.y < 0) {
      body.setVelocityY(body.velocity.y + HOLD_V * 0.016);
    }

    this.player.setAngle(Phaser.Math.Clamp(body.velocity.y * 0.02, -12, 14));

    if (this.player.y > WORLD_HEIGHT - 40) this.hurt("puddle");
    if (this.time.now < this.bufferUntil) this.tryJump();
    this.refreshHud();
  }
}
