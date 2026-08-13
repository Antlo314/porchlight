import * as Phaser from "phaser";
import { getLevel } from "@/lib/games/levels";
import { scoreFromCounts } from "@/lib/games/scoring";
import type { LevelDef, RunEvent } from "@/lib/games/types";
import type { GameBridge } from "../boot";

const PLAYER_W = 44;
const PLAYER_H = 62;
const RUN_SPEED: Record<LevelDef["mood"], number> = {
  dusk: 228,
  storm: 242,
  night: 252,
};
const JUMP_V = -470;
const HOLD_V = -92;
const COYOTE_MS = 110;
const BUFFER_MS = 130;
const LIVES = 3;

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

  private eventsLog: RunEvent[] = [];
  private runStartedAt = 0;
  private lives = LIVES;
  private coins = 0;
  private porchesLit = 0;
  private deaths = 0;
  private finished = false;
  private submitting = false;
  private paused = false;
  private muted = false;
  private classic = false;
  private dir = 1;

  private coyoteUntil = 0;
  private bufferUntil = 0;
  private holdingJump = false;
  private invulnUntil = 0;
  private lastSafe = { x: 80, y: 400 };
  private swipeStart: { y: number; t: number } | null = null;
  private cursors: {
    left?: Phaser.Input.Keyboard.Key;
    right?: Phaser.Input.Keyboard.Key;
    a?: Phaser.Input.Keyboard.Key;
    d?: Phaser.Input.Keyboard.Key;
  } = {};

  private hud!: {
    score: Phaser.GameObjects.Text;
    lives: Phaser.GameObjects.Text;
    hint: Phaser.GameObjects.Text;
    bar: Phaser.GameObjects.Rectangle;
    barBg: Phaser.GameObjects.Rectangle;
  };

  constructor() {
    super("play");
  }

  preload() {
    this.load.on("loaderror", () => undefined);
    this.load.image("lantern", "/games/light-the-block/sprites/lantern.png");
    this.load.image("lantern-jump", "/games/light-the-block/sprites/lantern-jump.png");
    this.load.image("coin", "/games/light-the-block/sprites/coin.png");
    this.load.image("platform", "/games/light-the-block/sprites/platform.png");
    this.load.image("porch-unlit", "/games/light-the-block/sprites/porch-unlit.png");
    this.load.image("puddle", "/games/light-the-block/sprites/puddle.png");
    this.load.audio("sfx-jump", "/games/light-the-block/audio/jump.mp3");
    this.load.audio("sfx-land", "/games/light-the-block/audio/land.mp3");
    this.load.audio("sfx-coin", "/games/light-the-block/audio/coin.mp3");
    this.load.audio("sfx-ignite", "/games/light-the-block/audio/ignite.mp3");
    this.load.audio("sfx-gust", "/games/light-the-block/audio/gust.mp3");
    this.load.audio("sfx-snuff", "/games/light-the-block/audio/snuff.mp3");
    this.load.audio("sfx-clear", "/games/light-the-block/audio/clear.mp3");
    this.load.audio("bgm", "/games/light-the-block/audio/dusk-loop.mp3");
  }

  create() {
    this.bridge = this.game.registry.get("bridge") as GameBridge;
    this.level = getLevel(this.bridge.levelId, this.bridge.seed);
    this.pal = PALETTES[this.level.mood];
    this.runStartedAt = this.time.now;
    this.lastSafe = { x: 90, y: this.level.platforms[0]?.y ?? 480 };

    this.physics.world.setBounds(0, 0, this.level.length, 720);
    this.cameras.main.setBounds(0, 0, this.level.length, 720);
    this.cameras.main.setBackgroundColor(this.pal.skyMid);

    this.drawSky();
    this.drawParallax();
    this.spawnPlayer();
    this.buildWorld();
    this.bindInput();
    this.buildHud();
    this.maybeMusic();

    this.scale.on("resize", this.onResize, this);
  }

  private onResize(gameSize: Phaser.Structs.Size) {
    this.cameras.main.setViewport(0, 0, gameSize.width, gameSize.height);
  }

  private drawSky() {
    const w = Math.max(this.scale.width, 420);
    const h = 720;
    const g = this.add.graphics().setScrollFactor(0).setDepth(-40);
    g.fillGradientStyle(this.pal.skyTop, this.pal.skyTop, this.pal.skyMid, this.pal.skyMid, 1);
    g.fillRect(0, 0, w, h * 0.42);
    g.fillGradientStyle(this.pal.skyMid, this.pal.skyMid, this.pal.skyBot, this.pal.skyBot, 1);
    g.fillRect(0, h * 0.4, w, h * 0.6);
    if (this.level.mood !== "storm") {
      const sun = this.add.circle(w * 0.78, h * 0.22, 28, this.pal.accent, 0.9).setScrollFactor(0).setDepth(-39);
      this.add.circle(sun.x, sun.y, 54, this.pal.accent, 0.18).setScrollFactor(0).setDepth(-39);
    }
    if (this.level.mood === "night") {
      for (let i = 0; i < 28; i++) {
        this.add
          .circle(20 + ((i * 97) % (w - 20)), 16 + ((i * 53) % 180), i % 4 === 0 ? 1.6 : 1, 0xfaf7f2, 0.7)
          .setScrollFactor(0)
          .setDepth(-38);
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

  private buildWorld() {
    this.platforms = this.physics.add.staticGroup();
    this.rails = this.physics.add.staticGroup();

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
        const top = this.add.rectangle(p.x + p.w / 2, p.y + 6, p.w, 12, 0x2f5540);
        top.setDepth(1);
      }
    }

    for (const porch of this.level.porches) {
      const glow = this.add.circle(porch.x, porch.y - 36, 10, 0x6b5f56, 0.7);
      glow.setData("lit", false);
      glow.setData("id", porch.id);
      glow.setDepth(6);
      const lamp = this.textures.exists("porch-unlit")
        ? this.add.image(porch.x, porch.y - 46, "porch-unlit").setDisplaySize(28, 40).setDepth(6)
        : this.add.rectangle(porch.x, porch.y - 48, 14, 22, 0x6b5f56).setDepth(6);
      const zone = this.add.zone(porch.x, porch.y - 20, 56, 70);
      this.physics.add.existing(zone, true);
      zone.setData("glow", glow);
      zone.setData("lamp", lamp);
      zone.setData("id", porch.id);
      this.physics.add.overlap(this.player, zone, (_pl, z) =>
        this.lightPorch(z as Phaser.GameObjects.Zone)
      );
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
      this.physics.add.overlap(this.player, spr, (_pl, c) =>
        this.takeCoin(c as Phaser.GameObjects.GameObject)
      );
    }

    for (const puddle of this.level.puddles) {
      const spr = this.textures.exists("puddle")
        ? this.add.image(puddle.x + puddle.w / 2, puddle.y - 8, "puddle").setDisplaySize(puddle.w + 20, 22)
        : this.add.ellipse(puddle.x + puddle.w / 2, puddle.y - 6, puddle.w, 16, 0x1a1a28, 0.85);
      spr.setDepth(5);
      this.physics.add.existing(spr, true);
      this.physics.add.overlap(this.player, spr, () => this.hurt("puddle"));
    }

    for (const gust of this.level.gusts) {
      const spr = this.add.ellipse(gust.x, gust.y, 34, 70, 0x8aa0b4, 0.22);
      spr.setDepth(8);
      this.tweens.add({
        targets: spr,
        alpha: { from: 0.08, to: 0.38 },
        scaleX: { from: 0.7, to: 1.2 },
        duration: gust.period ?? 1600,
        yoyo: true,
        repeat: -1,
      });
      this.physics.add.existing(spr, true);
      this.physics.add.overlap(this.player, spr, () => {
        if (this.time.now % (gust.period ?? 1600) < 700) this.hurt("gust");
      });
    }

    const finish = this.add.rectangle(this.level.finishX, 360, 18, 320, 0xc2661b, 0.55);
    this.add.rectangle(this.level.finishX, 200, 64, 18, 0xedb56a).setDepth(4);
    this.physics.add.existing(finish, true);
    this.physics.add.overlap(this.player, finish, () => this.finishRun());

    if (this.level.mood === "storm") {
      const drop = this.add.graphics();
      drop.fillStyle(0xb8c4d0, 0.7);
      drop.fillRect(0, 0, 2, 10);
      drop.generateTexture("rain-drop", 2, 10);
      drop.destroy();
      this.add.particles(0, 0, "rain-drop", {
        x: { min: 0, max: this.level.length },
        y: 0,
        lifespan: 1400,
        speedY: { min: 380, max: 620 },
        speedX: { min: -80, max: -20 },
        scale: { start: 0.6, end: 0.2 },
        quantity: 3,
        frequency: 30,
      }).setDepth(20);
    }
  }

  private spawnPlayer() {
    const startY = (this.level.platforms[0]?.y ?? 500) - 80;
    const key = this.textures.exists("lantern") ? "lantern" : undefined;
    this.player = this.physics.add.sprite(90, startY, key ?? "__DEFAULT");
    if (!key) {
      const g = this.add.graphics();
      g.fillStyle(0xc2661b, 1);
      g.fillRoundedRect(0, 0, PLAYER_W, PLAYER_H, 8);
      g.generateTexture("lantern-fallback", PLAYER_W, PLAYER_H);
      g.destroy();
      this.player.setTexture("lantern-fallback");
    }
    this.player.setDisplaySize(PLAYER_W, PLAYER_H);
    this.player.setCollideWorldBounds(true);
    this.player.setDepth(10);
    this.player.setBounce(0.02);
    this.player.body?.setSize(28, 46);
    this.player.body?.setOffset(8, 12);
    this.physics.add.collider(this.player, this.platforms);
    this.physics.add.collider(this.player, this.rails, undefined, () => {
      const body = this.player.body as Phaser.Physics.Arcade.Body;
      return body.velocity.y >= 0 && !this.player.getData("drop");
    });
    this.cameras.main.startFollow(this.player, true, 0.12, 0.08, -40, 80);
    this.cameras.main.setDeadzone(40, 80);
  }

  private bindInput() {
    this.input.on("pointerdown", (p: Phaser.Input.Pointer) => {
      if (this.paused || this.finished) return;
      this.swipeStart = { y: p.y, t: this.time.now };
      this.bufferUntil = this.time.now + BUFFER_MS;
      this.holdingJump = true;
      this.tryJump();
    });
    this.input.on("pointerup", (p: Phaser.Input.Pointer) => {
      this.holdingJump = false;
      if (this.swipeStart && p.y - this.swipeStart.y > 48 && this.time.now - this.swipeStart.t < 420) {
        this.dropThrough();
      }
      this.swipeStart = null;
    });

    const kb = this.input.keyboard;
    kb?.on("keydown-SPACE", () => {
      this.bufferUntil = this.time.now + BUFFER_MS;
      this.holdingJump = true;
      this.tryJump();
    });
    kb?.on("keyup-SPACE", () => {
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

  private buildHud() {
    const style: Phaser.Types.GameObjects.Text.TextStyle = {
      fontFamily: "ui-sans-serif, system-ui, sans-serif",
      fontSize: "15px",
      color: "#faf7f2",
      fontStyle: "700",
    };
    this.hud = {
      score: this.add.text(14, 12, "0", style).setScrollFactor(0).setDepth(50),
      lives: this.add.text(14, 34, "🏮🏮🏮", { fontSize: "16px" }).setScrollFactor(0).setDepth(50),
      hint: this.add
        .text(this.scale.width / 2, this.scale.height - 28, "Tap to jump · hold longer · swipe down", {
          fontFamily: "ui-sans-serif, system-ui, sans-serif",
          fontSize: "13px",
          color: "#faeacf",
        })
        .setOrigin(0.5)
        .setScrollFactor(0)
        .setDepth(50),
      barBg: this.add.rectangle(this.scale.width / 2, 8, this.scale.width - 28, 4, 0x2b2420, 0.5).setScrollFactor(0).setDepth(50),
      bar: this.add.rectangle(14, 8, 4, 4, 0xe69a41).setOrigin(0, 0.5).setScrollFactor(0).setDepth(51),
    };
    this.add
      .text(this.scale.width - 14, 12, this.level.name, {
        fontFamily: "ui-sans-serif, system-ui, sans-serif",
        fontSize: "13px",
        color: "#faeacf",
      })
      .setOrigin(1, 0)
      .setScrollFactor(0)
      .setDepth(50);

    this.time.delayedCall(4200, () => {
      this.tweens.add({ targets: this.hud.hint, alpha: 0, duration: 600 });
    });
  }

  private maybeMusic() {
    if (this.cache.audio.exists("bgm")) {
      this.sound.play("bgm", { loop: true, volume: 0.28 });
    }
  }

  private sfx(key: string, synth: () => void) {
    if (this.muted) return;
    if (this.cache.audio.exists(key)) this.sound.play(key, { volume: 0.55 });
    else synth();
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

  private tryJump() {
    if (this.paused || this.finished) return;
    const body = this.player.body as Phaser.Physics.Arcade.Body;
    const grounded = body.blocked.down || body.touching.down || this.time.now < this.coyoteUntil;
    if (!grounded || this.time.now > this.bufferUntil) return;
    body.setVelocityY(JUMP_V);
    this.coyoteUntil = 0;
    this.bufferUntil = 0;
    this.logEvent("jump");
    if (this.textures.exists("lantern-jump")) this.player.setTexture("lantern-jump");
    this.sfx("sfx-jump", () => this.synthBeep(420, 0.1));
    if (typeof navigator !== "undefined" && navigator.vibrate) navigator.vibrate(8);
  }

  private dropThrough() {
    this.player.setData("drop", true);
    this.time.delayedCall(220, () => this.player.setData("drop", false));
  }

  private lightPorch(zone: Phaser.GameObjects.Zone) {
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
    const id = obj.getData("id") as string | undefined;
    if (!id || obj.getData("gone")) return;
    obj.setData("gone", true);
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
    if (this.finished || this.time.now < this.invulnUntil) return;
    this.invulnUntil = this.time.now + 900;
    this.deaths += 1;
    this.lives -= 1;
    this.logEvent("die");
    this.sfx(kind === "gust" ? "sfx-gust" : "sfx-snuff", () => this.synthBeep(140, 0.2, "sawtooth"));
    this.cameras.main.flash(120, 80, 40, 20);
    this.player.setTint(0x6b5f56);
    this.time.delayedCall(180, () => this.player.clearTint());
    if (this.lives <= 0) {
      this.endRun(false);
      return;
    }
    this.player.setPosition(this.lastSafe.x, this.lastSafe.y);
    (this.player.body as Phaser.Physics.Arcade.Body).setVelocity(0, 0);
    this.refreshHud();
  }

  private finishRun() {
    if (this.finished) return;
    this.finished = true;
    this.logEvent("finish");
    this.sfx("sfx-clear", () => this.synthBeep(740, 0.3));
    this.endRun(true);
  }

  private endRun(cleared: boolean) {
    if (this.submitting) return;
    this.submitting = true;
    this.finished = true;
    this.physics.pause();
    const durationMs = Math.max(1, Math.round(this.time.now - this.runStartedAt));
    const score = this.currentScore();
    this.bridge
      .onSubmit({
        token: this.bridge.token,
        events: this.eventsLog,
        durationMs,
        claimedScore: score,
      })
      .then((result) => {
        this.showResult(result, cleared);
      })
      .catch(() => {
        this.showResult(
          {
            ok: false,
            error: "Couldn't reach the porch. Your run is saved on this phone only.",
          },
          cleared
        );
      });
  }

  private showResult(
    result: Awaited<ReturnType<GameBridge["onSubmit"]>> | { ok: false; error: string },
    cleared: boolean
  ) {
    const w = this.scale.width;
    const h = this.scale.height;
    const panel = this.add.rectangle(w / 2, h / 2, Math.min(340, w - 28), 320, 0x2b2420, 0.94).setScrollFactor(0).setDepth(80);
    panel.setStrokeStyle(2, 0xe69a41, 0.8);
    const title = result.ok
      ? cleared
        ? "Block lit"
        : "Lantern snuffed"
      : "Run ended";
    this.add
      .text(w / 2, h / 2 - 120, title, {
        fontFamily: "ui-sans-serif, system-ui, sans-serif",
        fontSize: "26px",
        color: "#faf7f2",
        fontStyle: "700",
      })
      .setOrigin(0.5)
      .setScrollFactor(0)
      .setDepth(81);

    const lines = result.ok
      ? [
          `${result.score} glow`,
          `${result.porchesLit} porches · ${result.coins} coins`,
          result.demo
            ? "Log in to keep these Porch Credits"
            : result.credits > 0
              ? `+${result.credits} Porch Credit${result.credits === 1 ? "" : "s"}`
              : result.reason === "DAILY_CAP"
                ? "Daily drip is full — come back tomorrow"
                : result.reason === "COOLDOWN"
                  ? "Take a breath — try again in a minute"
                  : "Nice run. The drip needs a stronger score.",
        ]
      : [result.error];

    lines.forEach((line, i) => {
      this.add
        .text(w / 2, h / 2 - 60 + i * 28, line, {
          fontFamily: "ui-sans-serif, system-ui, sans-serif",
          fontSize: i === 0 ? "20px" : "15px",
          color: "#faeacf",
          align: "center",
          wordWrap: { width: 280 },
        })
        .setOrigin(0.5)
        .setScrollFactor(0)
        .setDepth(81);
    });

    const again = this.add
      .text(w / 2, h / 2 + 110, "Play again", {
        fontFamily: "ui-sans-serif, system-ui, sans-serif",
        fontSize: "16px",
        color: "#2b2420",
        backgroundColor: "#e69a41",
        padding: { x: 18, y: 10 },
      })
      .setOrigin(0.5)
      .setScrollFactor(0)
      .setDepth(81)
      .setInteractive({ useHandCursor: true });
    const leave = this.add
      .text(w / 2, h / 2 + 148, "Back to courses", {
        fontFamily: "ui-sans-serif, system-ui, sans-serif",
        fontSize: "14px",
        color: "#faeacf",
      })
      .setOrigin(0.5)
      .setScrollFactor(0)
      .setDepth(81)
      .setInteractive({ useHandCursor: true });
    again.on("pointerup", () => this.bridge.onReplay());
    leave.on("pointerup", () => this.bridge.onExit());
  }

  private currentScore() {
    return scoreFromCounts({
      coins: this.coins,
      porchesLit: this.porchesLit,
      finished: this.finished,
    });
  }

  private refreshHud() {
    this.hud.score.setText(String(this.currentScore()));
    this.hud.lives.setText("🏮".repeat(Math.max(0, this.lives)) || "—");
    const progress = Phaser.Math.Clamp(this.player.x / this.level.finishX, 0, 1);
    this.hud.bar.width = (this.scale.width - 28) * progress;
  }

  private logEvent(k: RunEvent["k"], id?: string) {
    this.eventsLog.push({
      t: Math.round(this.time.now - this.runStartedAt),
      k,
      ...(id ? { id } : {}),
    });
  }

  private togglePause() {
    this.paused = !this.paused;
    if (this.paused) this.physics.pause();
    else this.physics.resume();
  }

  private toggleMute() {
    this.muted = !this.muted;
    this.sound.mute = this.muted;
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

    if (body.blocked.down || body.touching.down) {
      this.coyoteUntil = this.time.now + COYOTE_MS;
      if (this.textures.exists("lantern") && this.player.texture.key !== "lantern") {
        this.player.setTexture("lantern");
      }
    } else if (this.holdingJump && body.velocity.y < 0) {
      body.setVelocityY(body.velocity.y + HOLD_V * 0.016);
    }

    this.player.setAngle(Phaser.Math.Clamp(body.velocity.y * 0.02, -12, 14));
    const bob = Math.sin(this.time.now / 140) * 1.4;
    this.player.setScale(
      (PLAYER_W / (this.player.width || PLAYER_W)) * (1 + (body.blocked.down ? 0 : 0.02)),
      (PLAYER_H / (this.player.height || PLAYER_H)) * (1 + bob * 0.004)
    );

    if (this.player.y > 680) this.hurt("puddle");
    if (this.time.now < this.bufferUntil) this.tryJump();
    this.refreshHud();
  }
}
