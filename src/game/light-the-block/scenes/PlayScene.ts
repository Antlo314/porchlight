import * as Phaser from "phaser";
import { getLevel } from "@/lib/games/levels";
import {
  AIR_JUMPS,
  BUFFER_MS,
  COYOTE_MS,
  CRUMBLE_MS,
  CRUMBLE_RESPAWN_MS,
  HOLD_V,
  JUMP_V,
  LIVES,
  PLAYER_H,
  PLAYER_START_X,
  PLAYER_W,
  RUN_SPEED,
  SPRING_V,
  WORLD_HEIGHT,
} from "@/lib/games/physics";
import {
  AIR_CONTROL,
  GROUND_Y,
  ICE_ACCEL,
  ICE_FRICTION,
  MOVE_ACCEL,
  MOVE_FRICTION,
} from "@/lib/games/physics";
import { scoreFromCounts } from "@/lib/games/scoring";
import type { LevelDef, LevelPlatform, RunEvent } from "@/lib/games/types";
import { GameMusic } from "../music";
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

const PALETTES: Record<LevelDef["theme"], MoodPalette> = {
  dawn: {
    skyTop: 0x6b4a68,
    skyMid: 0xc2661b,
    skyBot: 0xf6dcae,
    far: 0x3a3050,
    mid: 0x2b2420,
    ground: 0x7a3f1c,
    accent: 0xffd08a,
  },
  fog: {
    skyTop: 0x515f66,
    skyMid: 0x8a9798,
    skyBot: 0xc9cfc8,
    far: 0x5d6a68,
    mid: 0x3c4140,
    ground: 0x4a4a44,
    accent: 0xdfe6e0,
  },
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

const KIND_COLOR: Record<string, number> = {
  wet: 0x4a5a62,
  awning: 0x833e1a,
  ice: 0x9fd4e8,
  crumble: 0x7a5233,
};

type Board = Phaser.GameObjects.Rectangle & {
  body: Phaser.Physics.Arcade.Body;
};

type MovingBoard = {
  obj: Board;
  def: LevelPlatform;
  homeX: number;
  homeY: number;
  prevX: number;
  prevY: number;
};

export class PlayScene extends Phaser.Scene {
  private bridge!: GameBridge;
  private level!: LevelDef;
  private pal!: MoodPalette;

  private player!: Phaser.Physics.Arcade.Sprite;
  private solids!: Phaser.Physics.Arcade.Group;
  private rails!: Phaser.Physics.Arcade.Group;

  private moving: MovingBoard[] = [];
  private blinking: { obj: Board; def: LevelPlatform }[] = [];
  private crumbling = new Set<Board>();
  private gateBodies = new Map<string, Phaser.GameObjects.Rectangle>();
  private finishGate!: Phaser.GameObjects.Rectangle;
  private finishBar!: Phaser.GameObjects.Rectangle;

  private porchZones: Phaser.GameObjects.Zone[] = [];
  private coinSprites: Phaser.GameObjects.GameObject[] = [];
  private keySprites: Phaser.GameObjects.GameObject[] = [];
  private switchPads: Phaser.GameObjects.Rectangle[] = [];
  private puddleSprites: Phaser.GameObjects.GameObject[] = [];
  private spikeSprites: Phaser.GameObjects.GameObject[] = [];
  private springSprites: Phaser.GameObjects.Rectangle[] = [];
  private gustSprites: Array<{ obj: Phaser.GameObjects.GameObject; period: number }> = [];

  private dust!: Phaser.GameObjects.Particles.ParticleEmitter;
  private sparks!: Phaser.GameObjects.Particles.ParticleEmitter;

  private eventsLog: RunEvent[] = [];
  private runStartedAt = 0;
  private pausedAt = 0;
  private pausedMs = 0;
  private lives = LIVES;
  private coins = 0;
  private porchesLit = 0;
  private keysHeld = 0;
  private switchesThrown = 0;
  private deaths = 0;
  private cleared = false;
  private finished = false;
  private submitting = false;
  private paused = false;
  private muted = false;
  private audioUnlocked = false;
  private musicStarted = false;
  /** Held direction from thumb or keyboard. The lantern no longer auto-runs. */
  private heldLeft = false;
  private heldRight = false;
  private facing = 1;
  private onIce = false;
  private wasGrounded = true;
  private music: GameMusic | null = null;

  private checkpointZones: Phaser.GameObjects.GameObject[] = [];
  private guideArrow!: Phaser.GameObjects.Text;

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
    keys: Phaser.GameObjects.Text;
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
    this.pal = PALETTES[this.level.theme] ?? PALETTES.dusk;
    this.runStartedAt = this.time.now;
    this.lastSafe = { x: PLAYER_START_X, y: this.level.platforms[0]!.y - 60 };

    this.physics.world.setBounds(0, 0, this.level.length, WORLD_HEIGHT);
    this.cameras.main.setBounds(0, 0, this.level.length, WORLD_HEIGHT);
    this.cameras.main.setBackgroundColor(this.pal.skyMid);

    this.makeParticleTextures();
    this.drawParallax();
    // Order matters: buildWorld() creates the platform groups, spawnPlayer()
    // collides against them. Spawning first left both colliders bound to
    // `undefined` — Phaser silently drops those, so the lantern fell through
    // the whole block and the run was over before a tap could register.
    this.buildWorld();
    this.drawGuides();
    this.spawnPlayer();
    this.buildParticles();
    this.wireCollisions();
    this.bindInput();
    this.buildHud();
    this.buildPauseVeil();
    this.layout();

    this.scale.on("resize", this.layout, this);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.scale.off("resize", this.layout, this);
      this.music?.destroy();
      this.music = null;
    });

    this.cameras.main.fadeIn(420, 0, 0, 0);
    this.bridge.onReady(this.controls());
    this.pushStatus();
    this.loadAudio();
  }

  private loadAudio() {
    const clips: Array<[string, string]> = [
      ["sfx-jump", "jump"],
      ["sfx-land", "land"],
      ["sfx-coin", "coin"],
      ["sfx-ignite", "ignite"],
      ["sfx-gust", "gust"],
      ["sfx-snuff", "snuff"],
      ["sfx-clear", "clear"],
    ];
    let queued = 0;
    for (const [key, file] of clips) {
      if (this.cache.audio.exists(key)) continue;
      this.load.audio(key, `/games/light-the-block/audio/${file}.mp3`);
      queued += 1;
    }
    if (queued === 0) return;
    this.load.start();
  }

  // ---------------------------------------------------------------- controls

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
      move: (dir) => {
        this.unlockAudio();
        this.heldLeft = dir < 0;
        this.heldRight = dir > 0;
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

  private makeParticleTextures() {
    if (!this.textures.exists("spark-dot")) {
      const g = this.add.graphics();
      g.fillStyle(0xffffff, 1);
      g.fillCircle(6, 6, 6);
      g.generateTexture("spark-dot", 12, 12);
      g.destroy();
    }
  }

  private buildParticles() {
    this.dust = this.add.particles(0, 0, "spark-dot", {
      speed: { min: 30, max: 110 },
      angle: { min: 200, max: 340 },
      scale: { start: 0.5, end: 0 },
      lifespan: 380,
      quantity: 6,
      tint: 0xd9c9b0,
      emitting: false,
    });
    this.dust.setDepth(9);

    this.sparks = this.add.particles(0, 0, "spark-dot", {
      speed: { min: 60, max: 220 },
      scale: { start: 0.6, end: 0 },
      lifespan: 520,
      quantity: 10,
      tint: [0xffe9b8, 0xe69a41, 0xc2661b],
      emitting: false,
    });
    this.sparks.setDepth(12);
  }

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

  /** Platforms are dynamic-but-immovable so the moving ones can actually move. */
  private addBoard(p: LevelPlatform): Board {
    const height = p.kind === "ground" ? 90 : 28;
    const color = KIND_COLOR[p.kind] ?? this.pal.ground;
    const rect = this.add.rectangle(p.x + p.w / 2, p.y + height / 2, p.w, height, color);
    this.physics.add.existing(rect);
    const body = rect.body as Phaser.Physics.Arcade.Body;
    body.setAllowGravity(false);
    body.setImmovable(true);
    body.moves = p.kind !== "ground" && Boolean(p.move);
    rect.setData("kind", p.kind);
    return rect as Board;
  }

  /**
   * Velocity-driven, not position-driven. A dynamic body integrates its own
   * position every step, so writing rect.x by hand just got overwritten and the
   * collision box drifted away from the picture. Applied *after* the board
   * joins its group, because the group's defaults reset velocity on add.
   */
  private startBoardMotion(board: Board, p: LevelPlatform) {
    const body = board.body as Phaser.Physics.Arcade.Body;
    if (!p.move) {
      body.moves = false;
      return;
    }
    body.moves = true;
    const amp = Math.abs(p.move.dx ?? p.move.dy ?? 0);
    const speed = amp > 0 ? (4 * amp) / (p.move.period / 1000) : 0;
    if (p.move.dx) body.setVelocityX(speed);
    else body.setVelocityY(speed);
  }

  private buildWorld() {
    this.solids = this.physics.add.group({ allowGravity: false, immovable: true });
    this.rails = this.physics.add.group({ allowGravity: false, immovable: true });
    this.moving = [];
    this.blinking = [];
    this.crumbling.clear();

    for (const p of this.level.platforms) {
      const board = this.addBoard(p);
      (p.dropThrough ? this.rails : this.solids).add(board);
      this.startBoardMotion(board, p);

      if (p.kind !== "ground" && this.textures.exists("platform")) {
        const deco = this.add.image(board.x, p.y + 6, "platform");
        deco.setDisplaySize(p.w + 16, 36);
        deco.setDepth(2);
        board.setData("deco", deco);
        if (p.kind === "ice") deco.setTint(0xbfe6f5);
        if (p.kind === "crumble") deco.setTint(0xa9793f);
      } else if (p.kind === "ground") {
        this.add.rectangle(board.x, p.y + 6, p.w, 12, 0x2f5540).setDepth(1);
      }

      if (p.move) {
        this.moving.push({
          obj: board,
          def: p,
          homeX: board.x,
          homeY: board.y,
          prevX: board.x,
          prevY: board.y,
        });
      }
      if (p.blink) this.blinking.push({ obj: board, def: p });
      if (p.kind === "crumble") board.setData("crumble", "idle");
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

    for (const key of this.level.keys) {
      const ring = this.add.circle(key.x, key.y, 13, 0xffe9b8, 0.95).setDepth(8);
      ring.setStrokeStyle(4, 0xc2661b, 1);
      ring.setData("id", key.id);
      this.tweens.add({
        targets: ring,
        y: key.y - 10,
        duration: 820,
        yoyo: true,
        repeat: -1,
        ease: "Sine.inOut",
      });
      this.tweens.add({ targets: ring, scaleX: 0.35, duration: 900, yoyo: true, repeat: -1 });
      this.physics.add.existing(ring, true);
      this.keySprites.push(ring);
    }

    for (const sw of this.level.switches) {
      const pad = this.add.rectangle(sw.x, sw.y - 8, 54, 14, 0x8aa0b4, 0.95).setDepth(5);
      pad.setStrokeStyle(2, 0xfaf7f2, 0.5);
      pad.setData("id", sw.id);
      pad.setData("gate", sw.gate);
      pad.setData("thrown", false);
      this.physics.add.existing(pad, true);
      this.switchPads.push(pad);
    }

    for (const cp of this.level.checkpoints) {
      const post = this.add.rectangle(cp.x, cp.y - 40, 8, 80, 0x6b5f56, 1).setDepth(4);
      const lamp = this.add.circle(cp.x, cp.y - 86, 11, 0x6b5f56, 0.85).setDepth(5);
      const zone = this.add.zone(cp.x, cp.y - 50, 60, 110);
      this.physics.add.existing(zone, true);
      zone.setData("id", cp.id);
      zone.setData("post", post);
      zone.setData("lamp", lamp);
      zone.setData("taken", false);
      this.checkpointZones.push(zone);
    }

    for (const gate of this.level.gates) {
      const bar = this.add.rectangle(gate.x, gate.y - gate.h / 2, 18, gate.h, 0x8aa0b4, 0.95);
      bar.setStrokeStyle(2, 0xfaf7f2, 0.6);
      bar.setDepth(6);
      this.physics.add.existing(bar, true);
      this.gateBodies.set(gate.id, bar);
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

    for (const sp of this.level.spikes) {
      const g = this.add.graphics();
      g.fillStyle(0xb8c4d0, 1);
      const teeth = Math.max(3, Math.floor(sp.w / 18));
      const tw = sp.w / teeth;
      for (let i = 0; i < teeth; i++) {
        const x0 = sp.x + i * tw;
        g.fillTriangle(x0, sp.y, x0 + tw / 2, sp.y - 26, x0 + tw, sp.y);
      }
      g.setDepth(5);
      const hit = this.add.rectangle(sp.x + sp.w / 2, sp.y - 12, sp.w, 22, 0x000000, 0);
      this.physics.add.existing(hit, true);
      this.spikeSprites.push(hit);
    }

    for (const spring of this.level.springs) {
      const pad = this.add.rectangle(spring.x, spring.y - 10, 46, 18, 0x3d6b4f, 1);
      pad.setStrokeStyle(2, 0xedb56a, 1);
      pad.setDepth(5);
      pad.setData("power", spring.power ?? SPRING_V);
      this.physics.add.existing(pad, true);
      this.springSprites.push(pad);
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
    this.finishBar = this.add.rectangle(this.level.finishX, 200, 64, 18, 0xedb56a);
    this.finishBar.setDepth(4);
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
    const startY = this.level.platforms[0]!.y - 80;
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

    this.cameras.main.startFollow(this.player, true, 0.12, 0.08, -40, 80);
    this.cameras.main.setDeadzone(40, 80);
  }

  private applySpriteScale(squash = 1) {
    const sx = PLAYER_W / (this.player.width || PLAYER_W);
    const sy = PLAYER_H / (this.player.height || PLAYER_H);
    this.player.setScale(sx / squash, sy * squash);
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
    this.physics.add.collider(this.player, this.solids, (_pl, board) =>
      this.onBoardContact(board as Board)
    );
    this.physics.add.collider(this.player, this.rails, undefined, () => {
      const body = this.player.body as Phaser.Physics.Arcade.Body;
      return body.velocity.y >= 0 && !this.player.getData("drop");
    });

    for (const bar of this.gateBodies.values()) {
      this.physics.add.collider(this.player, bar, () => this.hitGate());
    }
    for (const zone of this.porchZones) {
      this.physics.add.overlap(this.player, zone, () => this.lightPorch(zone));
    }
    for (const cp of this.checkpointZones) {
      this.physics.add.overlap(this.player, cp, () => this.takeCheckpoint(cp));
    }
    for (const coin of this.coinSprites) {
      this.physics.add.overlap(this.player, coin, () => this.takeCoin(coin));
    }
    for (const key of this.keySprites) {
      this.physics.add.overlap(this.player, key, () => this.takeKey(key));
    }
    for (const pad of this.switchPads) {
      this.physics.add.overlap(this.player, pad, () => this.throwSwitch(pad));
    }
    for (const pad of this.springSprites) {
      this.physics.add.overlap(this.player, pad, () => this.bounce(pad));
    }
    for (const puddle of this.puddleSprites) {
      this.physics.add.overlap(this.player, puddle, () => this.hurt("puddle"));
    }
    for (const spike of this.spikeSprites) {
      this.physics.add.overlap(this.player, spike, () => this.hurt("spike"));
    }
    for (const gust of this.gustSprites) {
      this.physics.add.overlap(this.player, gust.obj, () => {
        if (this.runClock() % gust.period < 700) this.hurt("gust");
      });
    }
    this.physics.add.overlap(this.player, this.finishGate, () => this.reachRibbon());
  }

  // ------------------------------------------------------------- new mechanics

  private onBoardContact(board: Board) {
    const body = this.player.body as Phaser.Physics.Arcade.Body;
    if (!body.blocked.down && !body.touching.down) return;
    this.onIce = board.getData("kind") === "ice";
    if (board.getData("kind") === "crumble" && board.getData("crumble") === "idle") {
      this.startCrumble(board);
    }
  }

  private startCrumble(board: Board) {
    board.setData("crumble", "going");
    this.crumbling.add(board);
    const deco = board.getData("deco") as Phaser.GameObjects.Image | undefined;
    const shake = this.tweens.add({
      targets: [board, deco].filter(Boolean),
      x: `+=3`,
      duration: 60,
      yoyo: true,
      repeat: Math.floor(CRUMBLE_MS / 120),
    });
    this.time.delayedCall(CRUMBLE_MS, () => {
      shake.stop();
      if (!board.active) return;
      board.setData("crumble", "gone");
      (board.body as Phaser.Physics.Arcade.Body).enable = false;
      board.setVisible(false);
      deco?.setVisible(false);
      this.sparks.emitParticleAt(board.x, board.y, 6);
      this.time.delayedCall(CRUMBLE_RESPAWN_MS, () => {
        if (!board.active) return;
        board.setData("crumble", "idle");
        (board.body as Phaser.Physics.Arcade.Body).enable = true;
        board.setVisible(true);
        deco?.setVisible(true);
        this.crumbling.delete(board);
      });
    });
  }

  private bounce(pad: Phaser.GameObjects.Rectangle) {
    if (this.finished || this.paused) return;
    const body = this.player.body as Phaser.Physics.Arcade.Body;
    if (body.velocity.y < 0) return;
    const power = (pad.getData("power") as number) ?? SPRING_V;
    body.setVelocityY(power);
    this.airJumpsLeft = AIR_JUMPS;
    this.tweens.add({ targets: pad, scaleY: 0.5, duration: 90, yoyo: true });
    this.sparks.emitParticleAt(pad.x, pad.y, 8);
    this.cameras.main.shake(120, 0.004);
    this.sfx("sfx-jump", () => this.synthBeep(300, 0.16));
  }

  private takeKey(obj: Phaser.GameObjects.GameObject) {
    if (this.finished) return;
    const id = obj.getData("id") as string | undefined;
    if (!id || obj.getData("gone")) return;
    obj.setData("gone", true);
    const body = obj.body as Phaser.Physics.Arcade.StaticBody | null;
    if (body) body.enable = false;
    const ring = obj as Phaser.GameObjects.Arc;
    this.sparks.emitParticleAt(ring.x, ring.y, 14);
    this.tweens.add({
      targets: obj,
      y: ring.y - 40,
      alpha: 0,
      scale: 1.6,
      duration: 260,
      onComplete: () => obj.destroy(),
    });
    this.keysHeld += 1;
    this.logEvent("key", id);
    this.sfx("sfx-ignite", () => this.synthBeep(980, 0.2, "sine"));
    this.cameras.main.shake(140, 0.005);
    if (this.keysHeld >= this.level.keys.length) this.openRibbon();
    this.refreshHud();
  }

  private openRibbon() {
    this.finishBar.setFillStyle(0x8fe08a);
    this.finishGate.setFillStyle(0x8fe08a, 0.55);
    this.tweens.add({ targets: this.finishBar, scaleX: 1.25, duration: 220, yoyo: true });
  }

  private throwSwitch(pad: Phaser.GameObjects.Rectangle) {
    if (this.finished || pad.getData("thrown")) return;
    pad.setData("thrown", true);
    pad.setFillStyle(0x8fe08a, 1);
    this.tweens.add({ targets: pad, scaleY: 0.4, duration: 120 });
    const gateId = pad.getData("gate") as string;
    const bar = this.gateBodies.get(gateId);
    if (bar) {
      (bar.body as Phaser.Physics.Arcade.StaticBody).enable = false;
      this.sparks.emitParticleAt(bar.x, bar.y, 10);
      this.tweens.add({
        targets: bar,
        scaleY: 0,
        alpha: 0.2,
        duration: 280,
        ease: "Back.in",
      });
    }
    this.switchesThrown += 1;
    this.logEvent("switch", pad.getData("id") as string);
    this.sfx("sfx-clear", () => this.synthBeep(520, 0.14, "square"));
    this.cameras.main.shake(160, 0.006);
    this.refreshHud();
  }

  /** Ran into a gate that never opened. */
  private hitGate() {
    if (this.finished) return;
    this.cameras.main.shake(200, 0.008);
    this.endRun(false, "A gate held shut. Find the plate before the bars.");
  }

  private reachRibbon() {
    if (this.finished) return;
    if (this.keysHeld < this.level.keys.length) {
      const short = this.level.keys.length - this.keysHeld;
      this.cameras.main.shake(220, 0.008);
      this.endRun(
        false,
        `The ribbon stayed dark — ${short} key${short === 1 ? "" : "s"} still on the block.`
      );
      return;
    }
    this.finishRun();
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
    const jump = () => {
      this.unlockAudio();
      if (this.paused || this.finished) return;
      this.bufferUntil = this.time.now + BUFFER_MS;
      this.holdingJump = true;
      this.tryJump();
    };
    kb?.on("keydown-SPACE", jump);
    kb?.on("keyup-SPACE", () => (this.holdingJump = false));
    kb?.on("keydown-UP", jump);
    kb?.on("keyup-UP", () => (this.holdingJump = false));
    kb?.on("keydown-W", jump);
    kb?.on("keyup-W", () => (this.holdingJump = false));
    kb?.on("keydown-DOWN", () => this.dropThrough());
    kb?.on("keydown-S", () => this.dropThrough());
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
      keys: this.add
        .text(14, 56, "", { fontSize: "14px", color: "#ffe9b8" })
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
        .text(0, 0, this.level.teaches, {
          fontFamily: "ui-sans-serif, system-ui, sans-serif",
          fontSize: "13px",
          color: "#faeacf",
        })
        .setOrigin(0.5)
        .setScrollFactor(0)
        .setDepth(50),
      barBg: this.add.rectangle(0, 8, 10, 4, 0x2b2420, 0.5).setScrollFactor(0).setDepth(50),
      bar: this.add
        .rectangle(14, 8, 4, 4, 0xe69a41)
        .setOrigin(0, 0.5)
        .setScrollFactor(0)
        .setDepth(51),
    };

    this.guideArrow = this.add
      .text(0, 0, "▶", { fontSize: "30px", color: "#ffe9b8" })
      .setOrigin(0.5)
      .setScrollFactor(0)
      .setDepth(52)
      .setAlpha(0.85)
      .setVisible(false);
    this.tweens.add({
      targets: this.guideArrow,
      alpha: { from: 0.85, to: 0.35 },
      duration: 700,
      yoyo: true,
      repeat: -1,
    });

    this.time.delayedCall(5200, () => {
      if (this.hud?.hint?.active) {
        this.tweens.add({ targets: this.hud.hint, alpha: 0, duration: 600 });
      }
    });
  }

  /** Chevrons painted on the ground so the way forward reads at a glance. */
  private drawGuides() {
    for (let x = 420; x < this.level.finishX - 300; x += 620) {
      const g = this.add.text(x, GROUND_Y - 26, "›››", {
        fontFamily: "ui-sans-serif, system-ui, sans-serif",
        fontSize: "22px",
        color: "#ffe9b8",
      });
      g.setOrigin(0.5).setAlpha(0.28).setDepth(3);
    }
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

  private unlockAudio() {
    if (this.audioUnlocked) return;
    this.audioUnlocked = true;
    const mgr = this.sound as unknown as { context?: AudioContext };
    if (mgr.context?.state === "suspended") {
      void mgr.context.resume().catch(() => undefined);
    }
    this.startMusic();
  }

  /**
   * The score is synthesised live rather than streamed from a file, so each
   * theme is its own progression and nothing has to be downloaded.
   */
  private startMusic() {
    if (this.musicStarted || !this.audioUnlocked || this.muted || this.finished) return;
    if (!this.music) {
      this.music = new GameMusic(
        () => (this.sound as unknown as { context?: AudioContext }).context ?? null
      );
    }
    this.music.start(this.level.theme);
    this.musicStarted = true;
  }

  private stopMusic() {
    this.music?.stop();
    this.musicStarted = false;
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

    // Frost gives nothing to push against, so a jump off ice is a short one.
    body.setVelocityY(this.onIce && grounded ? JUMP_V * 0.82 : JUMP_V);
    this.coyoteUntil = 0;
    this.bufferUntil = 0;
    this.logEvent("jump");
    if (this.textures.exists("lantern-jump")) {
      this.player.setTexture("lantern-jump");
    }
    this.stretch(1.12, 140);
    this.dust.emitParticleAt(this.player.x, this.player.y + 26, 4);
    this.sfx("sfx-jump", () => this.synthBeep(420, 0.1));
    if (typeof navigator !== "undefined" && navigator.vibrate) navigator.vibrate(8);
  }

  /** Squash and stretch, the cheapest juice there is. */
  private stretch(amount: number, ms: number) {
    this.tweens.killTweensOf(this.player);
    this.applySpriteScale(amount);
    this.tweens.addCounter({
      from: amount,
      to: 1,
      duration: ms,
      ease: "Quad.out",
      onUpdate: (tw) => {
        if (this.player?.active) this.applySpriteScale(tw.getValue() ?? 1);
      },
    });
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
    this.sparks.emitParticleAt(zone.x, zone.y - 30, 12);
    this.porchesLit += 1;
    this.logEvent("porch", zone.getData("id"));
    this.sfx("sfx-ignite", () => this.synthBeep(620, 0.18));
    this.cameras.main.shake(90, 0.003);
    if (typeof navigator !== "undefined" && navigator.vibrate) navigator.vibrate(12);
    this.refreshHud();
  }

  /** Respawn point. Only ever moves forward — never back down the block. */
  private takeCheckpoint(zone: Phaser.GameObjects.GameObject) {
    if (this.finished || zone.getData("taken")) return;
    const z = zone as Phaser.GameObjects.Zone;
    if (z.x < this.lastSafe.x) return;
    zone.setData("taken", true);
    const lamp = zone.getData("lamp") as Phaser.GameObjects.Arc;
    const post = zone.getData("post") as Phaser.GameObjects.Rectangle;
    lamp.setFillStyle(0xe69a41, 1);
    post.setFillStyle(0x8a5a2b, 1);
    this.tweens.add({ targets: lamp, scale: 1.6, yoyo: true, duration: 220 });
    this.sparks.emitParticleAt(z.x, z.y - 86, 12);
    this.lastSafe = { x: z.x, y: z.y - 40 };
    this.sfx("sfx-ignite", () => this.synthBeep(700, 0.16, "sine"));
    this.cameras.main.shake(90, 0.003);
    this.flashBanner("Checkpoint");
  }

  /** Short centred message for things the HUD can't say. */
  private flashBanner(text: string) {
    const t = this.add
      .text(this.scale.width / 2, this.scale.height * 0.32, text, {
        fontFamily: "ui-sans-serif, system-ui, sans-serif",
        fontSize: "22px",
        color: "#ffe9b8",
        fontStyle: "700",
      })
      .setOrigin(0.5)
      .setScrollFactor(0)
      .setDepth(60);
    this.tweens.add({
      targets: t,
      y: t.y - 30,
      alpha: 0,
      duration: 1100,
      ease: "Quad.out",
      onComplete: () => t.destroy(),
    });
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
    const img = obj as Phaser.GameObjects.Image;
    this.sparks.emitParticleAt(img.x, img.y, 8);
    this.tweens.add({
      targets: obj,
      y: img.y - 30,
      alpha: 0,
      duration: 180,
      onComplete: () => obj.destroy(),
    });
    this.coins += 1;
    this.logEvent("coin", id);
    this.sfx("sfx-coin", () => this.synthBeep(880, 0.1, "sine"));
    this.refreshHud();
  }

  private hurt(kind: "puddle" | "gust" | "spike") {
    if (this.finished || this.paused || this.time.now < this.invulnUntil) return;
    this.invulnUntil = this.time.now + 900;
    this.deaths += 1;
    this.lives -= 1;
    this.logEvent("die");
    this.sfx(kind === "gust" ? "sfx-gust" : "sfx-snuff", () =>
      this.synthBeep(140, 0.2, "sawtooth")
    );
    this.cameras.main.flash(120, 80, 40, 20);
    this.cameras.main.shake(260, 0.012);
    this.sparks.emitParticleAt(this.player.x, this.player.y, 16);
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
    this.sparks.emitParticleAt(this.player.x, this.player.y, 30);
    this.cameras.main.shake(300, 0.01);
    this.endRun(true);
  }

  private endRun(cleared: boolean, reason?: string) {
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
    this.stopMusic();
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
      .then((result) => this.bridge.onResult(result, cleared, reason))
      .catch(() =>
        this.bridge.onResult(
          { ok: false, error: "Couldn't reach the porch. Your run wasn't saved." },
          cleared,
          reason
        )
      );
  }

  private currentScore() {
    return scoreFromCounts({
      coins: this.coins,
      porchesLit: this.porchesLit,
      keys: this.keysHeld,
      switches: this.switchesThrown,
      finished: this.cleared,
    });
  }

  private refreshHud() {
    if (!this.hud || !this.player) return;
    this.hud.score.setText(String(this.currentScore()));
    this.hud.lives.setText("🏮".repeat(Math.max(0, this.lives)) || "—");
    this.hud.keys.setText(
      this.level.keys.length ? `🔑 ${this.keysHeld}/${this.level.keys.length}` : ""
    );
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
    this.sound.mute = this.muted;
    if (this.muted) this.stopMusic();
    else this.startMusic();
    this.pushStatus();
    return this.muted;
  }

  // ------------------------------------------------------------------ update

  /** Turn each patrolling board around when it reaches the end of its leash. */
  private stepMovingBoards() {
    for (const m of this.moving) {
      const mv = m.def.move!;
      const body = m.obj.body as Phaser.Physics.Arcade.Body;
      m.prevX = m.obj.x;
      m.prevY = m.obj.y;
      if (mv.dx) {
        const amp = Math.abs(mv.dx);
        if (m.obj.x > m.homeX + amp && body.velocity.x > 0) body.setVelocityX(-Math.abs(body.velocity.x));
        else if (m.obj.x < m.homeX - amp && body.velocity.x < 0) body.setVelocityX(Math.abs(body.velocity.x));
      }
      if (mv.dy) {
        const amp = Math.abs(mv.dy);
        if (m.obj.y > m.homeY + amp && body.velocity.y > 0) body.setVelocityY(-Math.abs(body.velocity.y));
        else if (m.obj.y < m.homeY - amp && body.velocity.y < 0) body.setVelocityY(Math.abs(body.velocity.y));
      }
      const deco = m.obj.getData("deco") as Phaser.GameObjects.Image | undefined;
      if (deco) {
        deco.x = m.obj.x;
        deco.y = m.obj.y - 8;
      }
    }
  }

  /**
   * Horizontal only. Arcade already lifts a rider when an immovable body rises
   * into them, so adding the vertical delta here too would apply it twice and
   * jitter the lantern off the board. Sideways is the axis Arcade ignores.
   */
  private carryRider() {
    const body = this.player.body as Phaser.Physics.Arcade.Body;
    if (!body.touching.down && !body.blocked.down) return;
    for (const m of this.moving) {
      if (!m.def.move?.dx) continue;
      const pb = m.obj.body as Phaser.Physics.Arcade.Body;
      const overlapX = Math.abs(this.player.x - m.obj.x) < m.obj.width / 2 + body.halfWidth;
      const restingOn = Math.abs(body.bottom - pb.top) < 10;
      if (overlapX && restingOn) {
        this.player.x += m.obj.x - m.prevX;
        return;
      }
    }
  }

  private stepBlinkingBoards() {
    const t = this.time.now;
    for (const b of this.blinking) {
      const bl = b.def.blink!;
      const phase = (t / bl.period + (bl.offset ?? 0)) % 1;
      const solid = phase < (bl.duty ?? 0.6);
      const body = b.obj.body as Phaser.Physics.Arcade.Body;
      if (body.enable !== solid) {
        body.enable = solid;
        b.obj.setAlpha(solid ? 1 : 0.22);
        const deco = b.obj.getData("deco") as Phaser.GameObjects.Image | undefined;
        deco?.setAlpha(solid ? 1 : 0.22);
      }
    }
  }

  update(_time: number, delta: number) {
    if (!this.player || this.finished || this.paused) return;

    this.stepMovingBoards();
    this.stepBlinkingBoards();

    const body = this.player.body as Phaser.Physics.Arcade.Body;
    const grounded = body.blocked.down || body.touching.down;
    this.driveHorizontal(body, grounded, delta);
    if (grounded) {
      this.coyoteUntil = this.time.now + COYOTE_MS;
      this.airJumpsLeft = AIR_JUMPS;
      if (!this.wasGrounded) {
        this.stretch(0.88, 160);
        this.dust.emitParticleAt(this.player.x, this.player.y + 26, 8);
        this.cameras.main.shake(70, 0.002);
        this.sfx("sfx-land", () => undefined);
      }
      if (this.textures.exists("lantern") && this.player.texture.key !== "lantern") {
        this.player.setTexture("lantern");
      }
    } else {
      this.onIce = false;
      if (this.holdingJump && body.velocity.y < 0) {
        body.setVelocityY(body.velocity.y + HOLD_V * 0.016);
      }
    }
    this.wasGrounded = grounded;

    this.carryRider();
    this.player.setAngle(Phaser.Math.Clamp(body.velocity.y * 0.02, -12, 14));
    this.player.setFlipX(this.facing < 0);
    this.updateGuide();

    if (this.player.y > WORLD_HEIGHT - 40) this.hurt("puddle");
    if (this.time.now < this.bufferUntil) this.tryJump();
    this.refreshHud();
  }

  /**
   * Thumb-driven acceleration rather than a fixed auto-run. Top speed is still
   * RUN_SPEED — the validator's clock floor is derived from it, so letting the
   * player exceed it would make honest runs land before the floor allows.
   */
  private driveHorizontal(
    body: Phaser.Physics.Arcade.Body,
    grounded: boolean,
    deltaMs: number
  ) {
    const max = RUN_SPEED[this.level.mood];
    const keyLeft = !!(this.cursors.left?.isDown || this.cursors.a?.isDown);
    const keyRight = !!(this.cursors.right?.isDown || this.cursors.d?.isDown);
    const left = this.heldLeft || keyLeft;
    const right = this.heldRight || keyRight;
    const want = (right ? 1 : 0) - (left ? 1 : 0);

    // Frame delta comes from update()'s own argument, not game.loop — the loop
    // value is stale whenever the game is stepped by hand, and a zero dt means
    // the lantern silently refuses to accelerate.
    const dt = Math.min(0.05, Math.max(0.001, deltaMs / 1000));
    const accel = (this.onIce && grounded ? ICE_ACCEL : MOVE_ACCEL) * (grounded ? 1 : AIR_CONTROL);
    const friction = this.onIce && grounded ? ICE_FRICTION : MOVE_FRICTION;
    let vx = body.velocity.x;

    if (want !== 0) {
      vx += want * accel * dt;
      this.facing = want;
    } else {
      const drop = friction * dt;
      vx = Math.abs(vx) <= drop ? 0 : vx - Math.sign(vx) * drop;
    }
    body.setVelocityX(Phaser.Math.Clamp(vx, -max, max));
  }

  /** Points at the next thing worth walking toward, so nobody wanders. */
  private updateGuide() {
    if (!this.guideArrow) return;
    const target = this.nextObjectiveX();
    if (target === null) {
      this.guideArrow.setVisible(false);
      return;
    }
    const cam = this.cameras.main;
    const onScreen = target > cam.scrollX + 40 && target < cam.scrollX + cam.width - 40;
    if (onScreen) {
      this.guideArrow.setVisible(false);
      return;
    }
    const right = target > this.player.x;
    this.guideArrow.setVisible(true);
    this.guideArrow.setText(right ? "▶" : "◀");
    this.guideArrow.setPosition(right ? cam.width - 26 : 26, cam.height / 2);
  }

  /** Nearest unlit porch, then an uncollected key, then the ribbon. */
  private nextObjectiveX(): number | null {
    let best: number | null = null;
    for (const z of this.porchZones) {
      const glow = z.getData("glow") as Phaser.GameObjects.Arc | undefined;
      if (glow?.getData("lit")) continue;
      if (best === null || Math.abs(z.x - this.player.x) < Math.abs(best - this.player.x)) {
        best = z.x;
      }
    }
    for (const k of this.keySprites) {
      if (!k.active || k.getData("gone")) continue;
      const kx = (k as Phaser.GameObjects.Arc).x;
      if (best === null || Math.abs(kx - this.player.x) < Math.abs(best - this.player.x)) {
        best = kx;
      }
    }
    return best ?? this.level.finishX;
  }
}
