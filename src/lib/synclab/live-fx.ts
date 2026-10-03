import { getEngine } from "./audio-engine";

/**
 * Live performance effects that sit on the whole-song (master) output.
 * Each effect is silent (fully dry) until it is engaged from its X-Y pad.
 */
export type LiveFxId =
  | "tapestop"
  | "filter"
  | "compressor"
  | "beatrepeat"
  | "isolator"
  | "grain"
  | "vinyl"
  | "crusher";

export interface LiveFxInfo {
  id: LiveFxId;
  name: string;
  x: string;
  y: string;
  /** Pad identity color (hex) — shown on the Live View pad. */
  color: string;
}

export const LIVE_FX: LiveFxInfo[] = [
  { id: "tapestop", name: "Tape Stop", x: "Stop time", y: "Spin-up", color: "#f97316" },
  { id: "filter", name: "Filter", x: "Low-pass ← → High-pass", y: "Resonance", color: "#38bdf8" },
  { id: "compressor", name: "Compressor", x: "Threshold", y: "Ratio", color: "#a3e635" },
  { id: "beatrepeat", name: "Beat Repeat", x: "Division", y: "Repeat decay", color: "#f43f5e" },
  { id: "isolator", name: "Isolator", x: "Lows · Mids · Highs", y: "Kill depth", color: "#facc15" },
  { id: "grain", name: "Grain Scatter", x: "Grain size", y: "Scatter", color: "#c084fc" },
  { id: "vinyl", name: "Vinyl Warp", x: "Wow speed", y: "Warp depth", color: "#fb7185" },
  { id: "crusher", name: "Crusher", x: "Bit depth", y: "Rate (darkening)", color: "#2dd4bf" },
];

const clamp01 = (v: number) => Math.min(1, Math.max(0, v));
const expMap = (lo: number, hi: number, t: number) => Math.exp(Math.log(lo) + (Math.log(hi) - Math.log(lo)) * clamp01(t));

interface Fx {
  input: GainNode;
  output: GainNode;
  engage(x: number, y: number): void;
  move(x: number, y: number): void;
  release(): void;
}

function shell(ctx: AudioContext) {
  const input = ctx.createGain();
  const output = ctx.createGain();
  const dry = ctx.createGain();
  const wet = ctx.createGain();
  wet.gain.value = 0;
  input.connect(dry).connect(output);
  wet.connect(output);
  const mix = (d: number, w: number, t = 0.02) => {
    const now = ctx.currentTime;
    dry.gain.cancelScheduledValues(now);
    wet.gain.cancelScheduledValues(now);
    dry.gain.setTargetAtTime(d, now, t);
    wet.gain.setTargetAtTime(w, now, t);
  };
  return { input, output, dry, wet, mix };
}

export class LiveFxRack {
  private ctx: AudioContext;
  private fx = new Map<LiveFxId, Fx>();
  private input: GainNode;
  private output: GainNode;
  bpm = 120;
  attached = false;
  private crushCurves = new Map<number, Float32Array<ArrayBuffer>>();

  constructor() {
    this.ctx = getEngine().init();
    const ctx = this.ctx;
    this.input = ctx.createGain();
    this.output = ctx.createGain();
    const order: LiveFxId[] = ["beatrepeat", "tapestop", "grain", "vinyl", "crusher", "isolator", "filter", "compressor"];
    const builders: Record<LiveFxId, () => Fx> = {
      tapestop: () => this.tapeStop(),
      filter: () => this.filter(),
      compressor: () => this.compressor(),
      beatrepeat: () => this.beatRepeat(),
      isolator: () => this.isolator(),
      grain: () => this.grain(),
      vinyl: () => this.vinyl(),
      crusher: () => this.crusher(),
    };
    let prev: AudioNode = this.input;
    for (const id of order) {
      const f = builders[id]();
      this.fx.set(id, f);
      prev.connect(f.input);
      prev = f.output;
    }
    prev.connect(this.output);
  }

  attach() {
    if (this.attached) return;
    getEngine().setMasterInsert({ input: this.input, output: this.output });
    this.attached = true;
  }

  detach() {
    if (!this.attached) return;
    for (const f of this.fx.values()) f.release();
    getEngine().setMasterInsert(null);
    this.attached = false;
  }

  engage(id: LiveFxId, x: number, y: number) {
    this.attach();
    if (this.ctx.state === "suspended") void this.ctx.resume();
    this.fx.get(id)?.engage(clamp01(x), clamp01(y));
  }
  move(id: LiveFxId, x: number, y: number) {
    this.fx.get(id)?.move(clamp01(x), clamp01(y));
  }
  release(id: LiveFxId) {
    this.fx.get(id)?.release();
  }

  /* ---------- effects ---------- */

  private tapeStop(): Fx {
    const ctx = this.ctx;
    const s = shell(ctx);
    const delay = ctx.createDelay(3);
    const fade = ctx.createGain();
    s.input.connect(delay).connect(fade).connect(s.wet);
    let spinUp = 0.1;
    return {
      ...s,
      engage: (x, y) => {
        const now = ctx.currentTime;
        const T = 0.3 + x * 2.2;
        spinUp = 0.02 + y * 0.6;
        // speed falls linearly 1 → 0: delay(t) = t² / 2T
        const n = 64;
        const curve = new Float32Array(n);
        for (let i = 0; i < n; i++) {
          const t = (i / (n - 1)) * T;
          curve[i] = (t * t) / (2 * T);
        }
        delay.delayTime.cancelScheduledValues(now);
        delay.delayTime.setValueAtTime(0, now);
        delay.delayTime.setValueCurveAtTime(curve, now + 0.005, T);
        fade.gain.cancelScheduledValues(now);
        fade.gain.setValueAtTime(1, now);
        fade.gain.setValueAtTime(1, now + T * 0.7);
        fade.gain.linearRampToValueAtTime(0, now + T);
        s.dry.gain.cancelScheduledValues(now);
        s.wet.gain.cancelScheduledValues(now);
        s.dry.gain.setValueAtTime(s.dry.gain.value, now);
        s.dry.gain.linearRampToValueAtTime(0, now + 0.005);
        s.wet.gain.setValueAtTime(1, now);
      },
      move: () => undefined,
      release: () => {
        const now = ctx.currentTime;
        s.wet.gain.cancelScheduledValues(now);
        s.wet.gain.setValueAtTime(s.wet.gain.value, now);
        s.wet.gain.linearRampToValueAtTime(0, now + 0.01);
        s.dry.gain.cancelScheduledValues(now);
        s.dry.gain.setValueAtTime(0, now);
        s.dry.gain.linearRampToValueAtTime(1, now + spinUp);
        delay.delayTime.cancelScheduledValues(now);
        delay.delayTime.setValueAtTime(0, now + 0.02);
        fade.gain.cancelScheduledValues(now);
        fade.gain.setValueAtTime(1, now + 0.02);
      },
    };
  }

  private filter(): Fx {
    const ctx = this.ctx;
    const s = shell(ctx);
    const f = ctx.createBiquadFilter();
    s.input.connect(f).connect(s.wet);
    const set = (x: number, y: number) => {
      const now = ctx.currentTime;
      if (x < 0.5) {
        if (f.type !== "lowpass") f.type = "lowpass";
        f.frequency.setTargetAtTime(expMap(80, 20000, x * 2), now, 0.02);
      } else {
        if (f.type !== "highpass") f.type = "highpass";
        f.frequency.setTargetAtTime(expMap(20, 8000, (x - 0.5) * 2), now, 0.02);
      }
      f.Q.setTargetAtTime(0.7 + y * 18, now, 0.02);
    };
    return {
      ...s,
      engage: (x, y) => {
        set(x, y);
        s.mix(0, 1);
      },
      move: set,
      release: () => s.mix(1, 0),
    };
  }

  private compressor(): Fx {
    const ctx = this.ctx;
    const s = shell(ctx);
    const c = ctx.createDynamicsCompressor();
    c.knee.value = 6;
    c.attack.value = 0.003;
    c.release.value = 0.15;
    const makeup = ctx.createGain();
    s.input.connect(c).connect(makeup).connect(s.wet);
    const set = (x: number, y: number) => {
      const now = ctx.currentTime;
      const thr = -x * 50;
      const ratio = 1 + y * 19;
      c.threshold.setTargetAtTime(thr, now, 0.02);
      c.ratio.setTargetAtTime(ratio, now, 0.02);
      const db = Math.min(18, -thr * (1 - 1 / ratio) * 0.5);
      makeup.gain.setTargetAtTime(Math.pow(10, db / 20), now, 0.05);
    };
    return {
      ...s,
      engage: (x, y) => {
        set(x, y);
        s.mix(0, 1);
      },
      move: set,
      release: () => s.mix(1, 0),
    };
  }

  private beatRepeat(): Fx {
    const ctx = this.ctx;
    const s = shell(ctx);
    const gate = ctx.createGain();
    const delay = ctx.createDelay(4);
    const fb = ctx.createGain();
    fb.gain.value = 0;
    s.input.connect(gate).connect(delay);
    delay.connect(fb).connect(delay);
    delay.connect(s.wet);
    const divisions = [1, 0.5, 0.25, 0.125, 0.0625];
    const lenFor = (x: number) => {
      const beat = 60 / (this.bpm || 120);
      return beat * divisions[Math.min(divisions.length - 1, Math.floor(x * divisions.length))]!;
    };
    const fbFor = (y: number) => 0.7 + y * 0.3;
    let active = false;
    return {
      ...s,
      engage: (x, y) => {
        const now = ctx.currentTime;
        const len = lenFor(x);
        delay.delayTime.cancelScheduledValues(now);
        // fill the line with the most recent slice, then freeze it
        delay.delayTime.setValueAtTime(len, now);
        gate.gain.cancelScheduledValues(now);
        gate.gain.setValueAtTime(1, now);
        gate.gain.setValueAtTime(0, now + len);
        fb.gain.cancelScheduledValues(now);
        fb.gain.setValueAtTime(0, now);
        fb.gain.setValueAtTime(fbFor(y), now + len);
        s.dry.gain.cancelScheduledValues(now);
        s.wet.gain.cancelScheduledValues(now);
        s.dry.gain.setValueAtTime(1, now);
        s.dry.gain.setValueAtTime(0, now + len);
        s.wet.gain.setValueAtTime(0, now);
        s.wet.gain.setValueAtTime(1, now + len);
        active = true;
      },
      move: (_x, y) => {
        if (active) fb.gain.setTargetAtTime(fbFor(y), ctx.currentTime, 0.03);
      },
      release: () => {
        active = false;
        const now = ctx.currentTime;
        s.mix(1, 0, 0.01);
        fb.gain.cancelScheduledValues(now);
        fb.gain.setTargetAtTime(0, now, 0.02);
        gate.gain.cancelScheduledValues(now);
        gate.gain.setValueAtTime(0, now);
      },
    };
  }

  private isolator(): Fx {
    const ctx = this.ctx;
    const s = shell(ctx);
    const lo = ctx.createBiquadFilter();
    lo.type = "lowshelf";
    lo.frequency.value = 250;
    const mid = ctx.createBiquadFilter();
    mid.type = "peaking";
    mid.frequency.value = 1500;
    mid.Q.value = 0.7;
    const hi = ctx.createBiquadFilter();
    hi.type = "highshelf";
    hi.frequency.value = 4000;
    s.input.connect(lo).connect(mid).connect(hi).connect(s.wet);
    const set = (x: number, y: number) => {
      const now = ctx.currentTime;
      const keepLow = Math.max(0, 1 - 2 * x);
      const keepHigh = Math.max(0, 2 * x - 1);
      const keepMid = 1 - Math.abs(2 * x - 1);
      const depth = 6 + y * 34;
      lo.gain.setTargetAtTime(-depth * (1 - keepLow), now, 0.02);
      mid.gain.setTargetAtTime(-depth * (1 - keepMid), now, 0.02);
      hi.gain.setTargetAtTime(-depth * (1 - keepHigh), now, 0.02);
    };
    return {
      ...s,
      engage: (x, y) => {
        set(x, y);
        s.mix(0, 1);
      },
      move: set,
      release: () => s.mix(1, 0),
    };
  }

  private grain(): Fx {
    const ctx = this.ctx;
    const s = shell(ctx);
    const voices = [0, 1, 2].map(() => {
      const d = ctx.createDelay(1);
      const g = ctx.createGain();
      g.gain.value = 0;
      s.input.connect(d).connect(g).connect(s.wet);
      return { d, g };
    });
    let size = 0.1;
    let scatter = 0.3;
    let timer: number | null = null;
    let next = 0;
    let v = 0;
    const pump = () => {
      const now = ctx.currentTime;
      if (next < now) next = now + 0.01;
      while (next < now + 0.12) {
        const voice = voices[v % voices.length]!;
        v++;
        const t = next;
        voice.d.delayTime.setValueAtTime(Math.random() * (0.02 + scatter * 0.7), t);
        voice.g.gain.setValueAtTime(0, t);
        voice.g.gain.linearRampToValueAtTime(0.7, t + size / 2);
        voice.g.gain.linearRampToValueAtTime(0, t + size);
        next += size / 3;
      }
    };
    const set = (x: number, y: number) => {
      size = 0.03 + x * 0.25;
      scatter = y;
      s.mix(1 - y * 0.8, 1, 0.03);
    };
    return {
      ...s,
      engage: (x, y) => {
        set(x, y);
        next = 0;
        if (timer === null) timer = window.setInterval(pump, 30);
        pump();
      },
      move: set,
      release: () => {
        if (timer !== null) window.clearInterval(timer);
        timer = null;
        s.mix(1, 0);
      },
    };
  }

  private vinyl(): Fx {
    const ctx = this.ctx;
    const s = shell(ctx);
    const d = ctx.createDelay(0.1);
    d.delayTime.value = 0.012;
    const lfo = ctx.createOscillator();
    const depth = ctx.createGain();
    depth.gain.value = 0;
    lfo.connect(depth).connect(d.delayTime);
    lfo.start();
    const tone = ctx.createBiquadFilter();
    tone.type = "lowpass";
    tone.frequency.value = 12000;
    s.input.connect(d).connect(tone).connect(s.wet);
    // crackle: sparse clicks in a looping noise buffer
    const len = ctx.sampleRate * 2;
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = Math.random() < 0.0006 ? (Math.random() * 2 - 1) : (Math.random() * 2 - 1) * 0.01;
    const noise = ctx.createBufferSource();
    noise.buffer = buf;
    noise.loop = true;
    const noiseGain = ctx.createGain();
    noiseGain.gain.value = 0;
    noise.connect(noiseGain).connect(s.wet);
    noise.start();
    const set = (x: number, y: number) => {
      const now = ctx.currentTime;
      lfo.frequency.setTargetAtTime(0.3 + x * 6, now, 0.05);
      depth.gain.setTargetAtTime(0.0005 + y * 0.006, now, 0.05);
      tone.frequency.setTargetAtTime(12000 - y * 8500, now, 0.05);
      noiseGain.gain.setTargetAtTime(0.1 + y * 0.4, now, 0.05);
    };
    return {
      ...s,
      engage: (x, y) => {
        set(x, y);
        s.mix(0, 1);
      },
      move: set,
      release: () => {
        s.mix(1, 0);
        depth.gain.setTargetAtTime(0, ctx.currentTime, 0.05);
        noiseGain.gain.setTargetAtTime(0, ctx.currentTime, 0.02);
      },
    };
  }

  private crushCurve(bits: number) {
    const cached = this.crushCurves.get(bits);
    if (cached) return cached;
    const n = 4096;
    const steps = Math.pow(2, bits);
    const c = new Float32Array(n);
    for (let i = 0; i < n; i++) {
      const x = (i / (n - 1)) * 2 - 1;
      c[i] = Math.round(x * steps) / steps;
    }
    this.crushCurves.set(bits, c);
    return c;
  }

  private crusher(): Fx {
    const ctx = this.ctx;
    const s = shell(ctx);
    const shaper = ctx.createWaveShaper();
    const lp = ctx.createBiquadFilter();
    lp.type = "lowpass";
    s.input.connect(shaper).connect(lp).connect(s.wet);
    let bits = -1;
    const set = (x: number, y: number) => {
      const b = Math.round(12 - x * 10);
      if (b !== bits) {
        bits = b;
        shaper.curve = this.crushCurve(b);
      }
      lp.frequency.setTargetAtTime(500 + 19500 * Math.pow(1 - y, 2), ctx.currentTime, 0.02);
    };
    return {
      ...s,
      engage: (x, y) => {
        set(x, y);
        s.mix(0, 1);
      },
      move: set,
      release: () => s.mix(1, 0),
    };
  }
}

let rack: LiveFxRack | null = null;
export function getLiveFx() {
  if (!rack) rack = new LiveFxRack();
  return rack;
}
