/**
 * Procedural score for Light the Block.
 *
 * There is no music asset to ship — this builds the track live out of Web Audio
 * oscillators, which means every course gets its own theme for zero kilobytes
 * and the whole thing stays in sync with the game clock rather than drifting
 * against a looping file.
 *
 * Each theme is a chord progression plus a bass line and an arpeggio. The
 * scheduler runs a lookahead loop: it queues the next bar a little ahead of
 * real time so timing never depends on setInterval being punctual.
 */

export type ThemeName = "dusk" | "storm" | "night" | "dawn" | "fog";

type Theme = {
  /** Root of each bar, as semitone offsets from A2. */
  progression: number[];
  /** Chord shape over the root, in semitones. */
  chord: number[];
  bpm: number;
  padType: OscillatorType;
  leadType: OscillatorType;
  bassType: OscillatorType;
  /** 0-1, how much the arpeggio sings over the pad. */
  leadGain: number;
  filterHz: number;
};

const A2 = 110;

const THEMES: Record<ThemeName, Theme> = {
  // Warm, unhurried, major-ish. Golden hour on the porch.
  dusk: {
    progression: [0, 5, 7, 5],
    chord: [0, 4, 7, 11],
    bpm: 92,
    padType: "triangle",
    leadType: "sine",
    bassType: "sine",
    leadGain: 0.5,
    filterHz: 1800,
  },
  // Restless, minor, faster. Weather coming in.
  storm: {
    progression: [0, 3, 5, 3],
    chord: [0, 3, 7, 10],
    bpm: 116,
    padType: "sawtooth",
    leadType: "square",
    bassType: "triangle",
    leadGain: 0.38,
    filterHz: 1100,
  },
  // Sparse and low. Night market after closing.
  night: {
    progression: [0, -2, 3, 5],
    chord: [0, 3, 7, 12],
    bpm: 78,
    padType: "triangle",
    leadType: "sine",
    bassType: "sine",
    leadGain: 0.42,
    filterHz: 1400,
  },
  // Bright and rising. The block coming back on.
  dawn: {
    progression: [0, 7, 9, 5],
    chord: [0, 4, 7, 12],
    bpm: 104,
    padType: "triangle",
    leadType: "triangle",
    bassType: "sine",
    leadGain: 0.55,
    filterHz: 2200,
  },
  // Muffled, drifting, unresolved.
  fog: {
    progression: [0, 2, -3, 0],
    chord: [0, 5, 7, 10],
    bpm: 84,
    padType: "sine",
    leadType: "sine",
    bassType: "sine",
    leadGain: 0.3,
    filterHz: 700,
  },
};

const SCALE = [0, 2, 3, 5, 7, 9, 10];

function hz(semitones: number) {
  return A2 * Math.pow(2, semitones / 12);
}

export class GameMusic {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private filter: BiquadFilterNode | null = null;
  private timer: number | null = null;
  private nextNoteAt = 0;
  private bar = 0;
  private theme: Theme = THEMES.dusk;
  private running = false;
  private volume = 0.22;
  /** Deterministic wobble so the arpeggio isn't the same four bars forever. */
  private step = 0;

  constructor(private getContext: () => AudioContext | null | undefined) {}

  setTheme(name: ThemeName) {
    this.theme = THEMES[name] ?? THEMES.dusk;
    if (this.filter && this.ctx) {
      this.filter.frequency.setTargetAtTime(this.theme.filterHz, this.ctx.currentTime, 0.4);
    }
  }

  start(name?: ThemeName) {
    if (name) this.setTheme(name);
    if (this.running) return;
    const ctx = this.getContext();
    if (!ctx) return;
    this.ctx = ctx;

    if (!this.master) {
      this.filter = ctx.createBiquadFilter();
      this.filter.type = "lowpass";
      this.filter.frequency.value = this.theme.filterHz;
      this.master = ctx.createGain();
      this.master.gain.value = 0;
      this.filter.connect(this.master);
      this.master.connect(ctx.destination);
    }
    this.master.gain.cancelScheduledValues(ctx.currentTime);
    this.master.gain.setTargetAtTime(this.volume, ctx.currentTime, 0.8);

    this.running = true;
    this.nextNoteAt = ctx.currentTime + 0.1;
    this.timer = window.setInterval(() => this.schedule(), 120);
  }

  stop() {
    this.running = false;
    if (this.timer !== null) {
      window.clearInterval(this.timer);
      this.timer = null;
    }
    if (this.master && this.ctx) {
      this.master.gain.setTargetAtTime(0, this.ctx.currentTime, 0.25);
    }
  }

  destroy() {
    this.stop();
    try {
      this.master?.disconnect();
      this.filter?.disconnect();
    } catch {
      /* context may already be closed */
    }
    this.master = null;
    this.filter = null;
  }

  /** Duck the score briefly so a big moment reads over it. */
  duck(ms = 500) {
    if (!this.master || !this.ctx) return;
    const t = this.ctx.currentTime;
    this.master.gain.cancelScheduledValues(t);
    this.master.gain.setTargetAtTime(this.volume * 0.28, t, 0.05);
    this.master.gain.setTargetAtTime(this.volume, t + ms / 1000, 0.3);
  }

  private schedule() {
    const ctx = this.ctx;
    if (!ctx || !this.running || !this.filter) return;
    const beat = 60 / this.theme.bpm;
    // Queue anything falling inside the next quarter second.
    while (this.nextNoteAt < ctx.currentTime + 0.25) {
      this.playBeat(this.nextNoteAt, beat);
      this.nextNoteAt += beat / 2;
      this.step += 1;
    }
  }

  private playBeat(at: number, beat: number) {
    const ctx = this.ctx;
    const out = this.filter;
    if (!ctx || !out) return;

    const t = this.theme;
    const eighth = this.step % 8;
    if (eighth === 0) this.bar = (this.bar + 1) % t.progression.length;
    const root = t.progression[this.bar]!;

    // Bass on the downbeat and the and-of-three.
    if (eighth === 0 || eighth === 5) {
      this.tone(hz(root - 12), at, beat * 0.9, t.bassType, 0.5, out);
    }

    // Pad chord swells at the top of the bar.
    if (eighth === 0) {
      for (const iv of t.chord) {
        this.tone(hz(root + iv), at, beat * 3.4, t.padType, 0.1, out, 0.9);
      }
    }

    // Arpeggio walks the scale; the pattern shifts every bar so it breathes.
    if (eighth % 2 === 0) {
      const idx = (this.step * 3 + this.bar * 2) % SCALE.length;
      const octave = ((this.step >> 2) % 2) * 12;
      this.tone(hz(root + SCALE[idx]! + 12 + octave), at, beat * 0.45, t.leadType, 0.09 * t.leadGain, out, 0.02);
    }
  }

  private tone(
    freq: number,
    at: number,
    dur: number,
    type: OscillatorType,
    peak: number,
    out: AudioNode,
    attack = 0.01
  ) {
    const ctx = this.ctx;
    if (!ctx) return;
    try {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = type;
      osc.frequency.setValueAtTime(freq, at);
      gain.gain.setValueAtTime(0.0001, at);
      gain.gain.exponentialRampToValueAtTime(Math.max(0.0002, peak), at + attack);
      gain.gain.exponentialRampToValueAtTime(0.0001, at + dur);
      osc.connect(gain);
      gain.connect(out);
      osc.start(at);
      osc.stop(at + dur + 0.05);
    } catch {
      /* a dropped note is not worth throwing over */
    }
  }
}
