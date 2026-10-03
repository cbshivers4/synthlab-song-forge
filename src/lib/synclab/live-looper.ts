import { getEngine } from "./audio-engine";
import { getBeatsPerBar } from "./timebase";
import { borrowActiveMic, openMic, releaseMic } from "./mic";
import { encodeWav } from "./bounce";

/**
 * Loopy-style clip looper. Loops play on one shared cycle so they stay in time:
 * - "sync": the cycle is N bars at the project tempo.
 * - "free": the first loop you record sets the cycle length.
 * Later loops start on the next cycle and record exactly one cycle.
 */
export type LoopMode = "sync" | "free";
export type LoopSource = "mic" | "output";
export type SlotState = "empty" | "armed" | "recording" | "playing" | "stopped";

export interface LoopSlot {
  index: number;
  state: SlotState;
  buffer: AudioBuffer | null;
  volume: number;
  /** audio-clock time the loop's first sample aligns to */
  start: number;
  recStart: number;
  recEnd: number | null;
  overdubbing: boolean;
  muted: boolean;
  reversed: boolean;
  color: string;
}

type Chunk = { t: number; l: Float32Array; r: Float32Array };

const SLOTS = 8;
const BLOCK = 2048;
const DEFAULT_COLORS = [
  "oklch(0.78 0.16 195)",
  "oklch(0.75 0.19 330)",
  "oklch(0.82 0.17 80)",
  "oklch(0.78 0.18 145)",
  "oklch(0.72 0.18 285)",
  "oklch(0.75 0.19 45)",
  "oklch(0.8 0.14 220)",
  "oklch(0.72 0.2 5)",
];

export class LiveLooper {
  private ctx: AudioContext;
  private bus: GainNode;
  private gains: GainNode[] = [];
  private sources: (AudioBufferSourceNode | null)[] = [];
  slots: LoopSlot[];
  mode: LoopMode = "sync";
  bars = 2;
  bpm = 120;
  source: LoopSource = "mic";
  /** bars of clicked count-in before the first loop records (0 = off) */
  precount = 0;
  /** audio time the current count-in started, or null when none is running */
  precountStart: number | null = null;
  /** Input threshold in dB (null = off). When on, the first loop waits for signal above it. */
  threshold: number | null = null;
  /** slot waiting for the input to cross the threshold */
  private waitingSlot: number | null = null;
  /** true when the input belongs to another SYNCLAB tool and must not be stopped here */
  private micBorrowed = false;
  /** recent input peak (0..1) for the threshold meter */
  inputPeak = 0;
  origin: number | null = null;
  cycle: number | null = null;

  private proc: ScriptProcessorNode | null = null;
  private procSink: GainNode | null = null;
  private inputNode: AudioNode | null = null;
  private micStream: MediaStream | null = null;
  private chunks: Chunk[] = [];
  private timer: number | null = null;
  private listeners = new Set<() => void>();
  private opening: Promise<void> | null = null;
  private waveCache = new WeakMap<AudioBuffer, Map<number, number[]>>();

  constructor() {
    const engine = getEngine();
    this.ctx = engine.init();
    this.bus = this.ctx.createGain();
    // Keep loop playback out of the app-output capture tap: routing it into
    // master would record the existing loops again on every new layer.
    this.bus.connect(this.ctx.destination);
    let savedColors: string[] = [];
    try {
      const stored = window.localStorage.getItem("synclab.looper.colors");
      savedColors = stored ? JSON.parse(stored) as string[] : [];
    } catch { /* use the professional default palette */ }
    this.slots = Array.from({ length: SLOTS }, (_, index) => ({
      index,
      state: "empty" as SlotState,
      buffer: null,
      volume: 0.9,
      start: 0,
      recStart: 0,
      recEnd: null,
      overdubbing: false,
      muted: false,
      reversed: false,
      color: savedColors[index] ?? DEFAULT_COLORS[index] ?? "oklch(0.78 0.16 195)",
    }));
    try {
      const pc = Number(window.localStorage.getItem("synclab.looper.precount"));
      const raw = window.localStorage.getItem("synclab.looper.precount");
      if (raw === null) this.precount = 1;
      else if ([1, 2, 4].includes(pc)) this.precount = pc;
      const th = window.localStorage.getItem("synclab.looper.threshold");
      if (th && th !== "off" && Number.isFinite(Number(th))) this.threshold = Math.max(-60, Math.min(0, Number(th)));
    } catch { /* */ }
    for (let i = 0; i < SLOTS; i++) {
      const g = this.ctx.createGain();
      g.gain.value = 0.9;
      g.connect(this.bus);
      this.gains.push(g);
      this.sources.push(null);
    }
  }

  subscribe(cb: () => void) {
    this.listeners.add(cb);
    return () => {
      this.listeners.delete(cb);
    };
  }
  private emit() {
    for (const cb of this.listeners) cb();
  }

  get now() {
    return this.ctx.currentTime;
  }
  get isEmpty() {
    return this.slots.every((s) => s.state === "empty");
  }
  /** 0..1 position in the shared cycle, for the UI */
  get phase() {
    if (this.origin === null || !this.cycle) return 0;
    const p = (this.ctx.currentTime - this.origin) / this.cycle;
    return p < 0 ? 0 : p % 1;
  }

  setMode(m: LoopMode) {
    if (!this.isEmpty) return;
    this.mode = m;
    this.emit();
  }
  setBars(b: number) {
    if (!this.isEmpty || ![1, 2, 4, 8, 16, 32].includes(b)) return;
    this.bars = b;
    this.emit();
  }
  setPrecount(b: number) {
    if (![0, 1, 2, 4].includes(b)) return;
    this.precount = b;
    try { window.localStorage.setItem("synclab.looper.precount", String(b)); } catch { /* */ }
    this.emit();
  }

  setThreshold(db: number | null) {
    this.threshold = db === null ? null : Math.max(-60, Math.min(0, db));
    try { window.localStorage.setItem("synclab.looper.threshold", this.threshold === null ? "off" : String(this.threshold)); } catch { /* */ }
    this.emit();
  }
  get isWaitingForSignal() { return this.waitingSlot !== null; }

  private click(at: number, accent: boolean) {
    const o = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    o.frequency.value = accent ? 1760 : 1100;
    g.gain.setValueAtTime(0, at);
    g.gain.linearRampToValueAtTime(accent ? 0.5 : 0.3, at + 0.002);
    g.gain.exponentialRampToValueAtTime(0.0001, at + 0.06);
    o.connect(g).connect(this.bus);
    o.start(at);
    o.stop(at + 0.08);
  }

  setSource(s: LoopSource) {
    if (this.slots.some((x) => x.state === "armed" || x.state === "recording")) return;
    this.source = s;
    this.closeInput();
    this.emit();
  }

  /* ---------- input capture ---------- */

  private async openInput() {
    if (this.proc) return;
    if (this.opening) return this.opening;
    this.opening = this.connectInput();
    try { await this.opening; } finally { this.opening = null; }
  }

  private async connectInput() {
    let node: AudioNode | null = null;
    if (this.source === "mic") {
      // share an input another SYNCLAB tool (e.g. an armed track) already holds instead of failing
      const shared = borrowActiveMic();
      let stream: MediaStream;
      if (shared) {
        stream = shared;
        this.micBorrowed = true;
      } else {
        const res = await openMic(undefined, "looper");
        if ("error" in res) throw new Error(res.error);
        stream = res.stream;
        this.micBorrowed = false;
      }
      this.micStream = stream;
      node = this.ctx.createMediaStreamSource(stream);
    } else {
      node = getEngine().outputNode;
    }
    if (!node) throw new Error("Audio output is not ready yet.");
    const proc = this.ctx.createScriptProcessor(BLOCK, 2, 2);
    const sink = this.ctx.createGain();
    sink.gain.value = 0;
    proc.onaudioprocess = (e) => {
      const l = e.inputBuffer.getChannelData(0);
      const r = e.inputBuffer.numberOfChannels > 1 ? e.inputBuffer.getChannelData(1) : l;
      // the input block was rendered one block before its playback time
      const t0 = e.playbackTime - BLOCK / this.ctx.sampleRate;
      this.chunks.push({ t: t0, l: new Float32Array(l), r: new Float32Array(r) });
      let peak = 0; let hit = -1;
      const lin = this.threshold === null ? 2 : Math.pow(10, this.threshold / 20);
      for (let i = 0; i < l.length; i++) {
        const v = Math.max(Math.abs(l[i]!), Math.abs(r[i]!));
        if (v > peak) peak = v;
        if (hit < 0 && v >= lin) hit = i;
      }
      this.inputPeak = peak;
      if (this.waitingSlot !== null) {
        const ws = this.slots[this.waitingSlot];
        if (ws && hit >= 0) {
          // start ~10 ms before the crossing so the attack is kept
          const start = Math.max(this.chunks[0]!.t, t0 + hit / this.ctx.sampleRate - 0.01);
          ws.recStart = start;
          ws.recEnd = this.mode === "sync" ? start + (this.bars * getBeatsPerBar() * 60) / (this.bpm || 120) : null;
          ws.state = "recording";
          this.waitingSlot = null;
          this.emit();
        } else if (ws) {
          ws.recStart = this.ctx.currentTime; // keep only a short pre-roll while waiting
        }
      }
      // Retain the entire active take, including 32-bar takes at slow tempos.
      const activeStarts = this.slots.filter((s) => s.state === "armed" || s.state === "recording").map((s) => s.recStart);
      const oldest = activeStarts.length ? Math.min(...activeStarts) - 0.1 : this.ctx.currentTime - 1;
      while (this.chunks.length && this.chunks[0]!.t + BLOCK / this.ctx.sampleRate < oldest) this.chunks.shift();
    };
    node.connect(proc);
    proc.connect(sink).connect(this.ctx.destination);
    this.inputNode = node;
    this.proc = proc;
    this.procSink = sink;
  }

  private closeInput() {
    if (!this.proc) return;
    this.proc.onaudioprocess = null;
    try { this.inputNode?.disconnect(this.proc); } catch { /* */ }
    this.proc.disconnect();
    this.procSink?.disconnect();
    if (this.inputNode && this.source === "mic") try { this.inputNode.disconnect(); } catch { /* */ }
    if (!this.micBorrowed) releaseMic(this.micStream);
    this.micBorrowed = false;
    this.micStream = null;
    this.proc = null;
    this.procSink = null;
    this.inputNode = null;
    this.chunks = [];
  }

  private slice(from: number, to: number): AudioBuffer | null {
    const sr = this.ctx.sampleRate;
    const frames = Math.round((to - from) * sr);
    if (frames < 256) return null;
    const buf = this.ctx.createBuffer(2, frames, sr);
    const L = buf.getChannelData(0);
    const R = buf.getChannelData(1);
    for (const c of this.chunks) {
      const off = Math.round((c.t - from) * sr);
      if (off + c.l.length <= 0 || off >= frames) continue;
      for (let i = Math.max(0, -off); i < c.l.length && off + i < frames; i++) {
        L[off + i] = c.l[i]!;
        R[off + i] = c.r[i]!;
      }
    }
    const fade = Math.min(Math.round(sr * 0.004), Math.floor(frames / 4));
    for (let i = 0; i < fade; i++) {
      const g = i / fade;
      L[i]! *= g; R[i]! *= g;
      L[frames - 1 - i]! *= g; R[frames - 1 - i]! *= g;
    }
    return buf;
  }

  /* ---------- transport ---------- */

  private ensureTimer() {
    if (this.timer !== null) return;
    this.timer = window.setInterval(() => this.pump(), 25);
  }

  private pump() {
    const now = this.ctx.currentTime;
    let changed = false;
    for (const s of this.slots) {
      if (s.state === "armed" && s.index !== this.waitingSlot && now >= s.recStart) {
        s.state = "recording";
        this.precountStart = null;
        changed = true;
      }
      if (s.state === "recording" && s.recEnd !== null && now >= s.recEnd + (BLOCK * 2) / this.ctx.sampleRate) {
        this.finish(s);
        changed = true;
      }
    }
    if (!this.slots.some((s) => s.state === "armed" || s.state === "recording")) {
      // nothing capturing: free the microphone
      if (this.proc) this.closeInput();
      if (this.isEmpty && this.timer !== null) {
        window.clearInterval(this.timer);
        this.timer = null;
      }
    }
    if (changed) this.emit();
  }

  private finish(s: LoopSlot) {
    const end = s.recEnd;
    if (end === null) return;
    const buf = this.slice(s.recStart, end);
    if (!buf) {
      s.state = s.buffer ? "playing" : "empty";
      s.overdubbing = false;
      return;
    }
    if (this.cycle === null) {
      this.cycle = end - s.recStart;
      this.origin = s.recStart;
    }
    if (s.overdubbing && s.buffer) {
      const original = s.buffer;
      const merged = this.ctx.createBuffer(2, original.length, original.sampleRate);
      for (let channel = 0; channel < 2; channel++) {
        const output = merged.getChannelData(channel);
        const old = original.getChannelData(channel);
        const added = buf.getChannelData(channel);
        for (let j = 0; j < output.length; j++) output[j] = Math.max(-1, Math.min(1, old[j]! + (added[j] ?? 0) * 0.8));
      }
      s.buffer = merged;
      s.overdubbing = false;
    } else {
      s.buffer = buf;
      s.start = s.recStart;
    }
    s.recEnd = null;
    this.play(s.index);
  }

  private nextBoundary(after: number) {
    if (this.origin === null || !this.cycle) return after;
    const n = Math.ceil((after - this.origin) / this.cycle - 1e-6);
    return this.origin + Math.max(0, n) * this.cycle;
  }

  /** Main slot button: record → (free first loop) stop → play/stop toggles. */
  async tap(i: number) {
    const s = this.slots[i]!;
    const now = this.ctx.currentTime;
    if (this.ctx.state === "suspended") await this.ctx.resume();
    if (s.state === "recording" && s.recEnd === null) {
      // free mode first loop: this tap closes it
      s.recEnd = now;
      this.emit();
      return;
    }
    if (s.state === "armed") {
      if (this.waitingSlot === i) this.waitingSlot = null;
      s.state = "empty";
      this.precountStart = null;
      this.emit();
      return;
    }
    if (s.state === "recording") return;
    if (s.state === "playing") return this.stop(i);
    if (s.state === "stopped") return this.play(i);
    await this.record(i);
  }

  /** Record on this slot with a pre-count (at least 1 bar), ignoring start-on-sound. */
  async recordCounted(i: number) {
    if (this.ctx.state === "suspended") await this.ctx.resume();
    const th = this.threshold, pc = this.precount;
    this.threshold = null;
    this.precount = pc || 1;
    try { await this.record(i); } finally { this.threshold = th; this.precount = pc; }
  }

  /** Record immediately on this slot, skipping the pre-count and start-on-sound wait. */
  async recordNow(i: number) {
    if (this.ctx.state === "suspended") await this.ctx.resume();
    const th = this.threshold, pc = this.precount;
    this.threshold = null;
    this.precount = 0;
    try { await this.record(i); } finally { this.threshold = th; this.precount = pc; }
  }

  async record(i: number) {
    const s = this.slots[i];
    if (!s || s.state !== "empty") return;
    if (this.slots.some((slot) => slot.state === "armed" || slot.state === "recording")) throw new Error("Another loop is still recording — finish or cancel it first.");
    await this.openInput();
    if (s.state !== "empty" || this.slots.some((slot) => slot.state === "armed" || slot.state === "recording")) { if (!this.slots.some((slot) => slot.state === "armed" || slot.state === "recording")) this.closeInput(); return; }
    let now = this.ctx.currentTime + 0.03;
    if (this.cycle === null && this.threshold !== null) {
      // wait for the player: recording starts the moment the input crosses the threshold
      s.recStart = this.ctx.currentTime;
      s.recEnd = null;
      s.state = "armed";
      this.waitingSlot = i;
      this.ensureTimer();
      this.emit();
      return;
    }
    if (this.cycle === null && this.precount > 0) {
      // metronome count-in on the audio clock; recording starts only after the last beat
      const beat = 60 / (this.bpm || 120);
      const bpb = getBeatsPerBar();
      const beats = this.precount * bpb;
      this.precountStart = now;
      for (let b = 0; b < beats; b++) this.click(now + b * beat, b % bpb === 0);
      now += beats * beat;
    }
    if (this.cycle === null) {
      if (this.mode === "sync") {
        const len = (this.bars * getBeatsPerBar() * 60) / (this.bpm || 120);
        s.recStart = now;
        s.recEnd = now + len;
      } else {
        s.recStart = now;
        s.recEnd = null; // closed by the next tap
      }
    } else {
      s.recStart = this.nextBoundary(now);
      s.recEnd = s.recStart + this.cycle;
    }
    s.state = s.recStart <= this.ctx.currentTime ? "recording" : "armed";
    this.ensureTimer();
    this.emit();
  }

  play(i: number) {
    const s = this.slots[i];
    if (!s) return;
    if (!s.buffer) return;
    if (this.ctx.state === "suspended") void this.ctx.resume();
    try { this.sources[i]?.stop(); } catch { /* already ended */ }
    const src = this.ctx.createBufferSource();
    src.buffer = s.buffer;
    src.loop = true;
    src.connect(this.gains[i]!);
    const when = Math.max(this.ctx.currentTime + 0.02, s.start);
    const len = s.buffer.duration;
    const offset = (((when - s.start) % len) + len) % len;
    const g = this.gains[i]!.gain;
    g.cancelScheduledValues(when);
    g.setValueAtTime(0, when);
    g.linearRampToValueAtTime(s.muted ? 0 : s.volume, when + 0.01);
    src.start(when, offset);
    this.sources[i] = src;
    s.state = "playing";
    this.emit();
  }

  stop(i: number) {
    const s = this.slots[i]!;
    const src = this.sources[i];
    if (src) {
      const now = this.ctx.currentTime;
      const g = this.gains[i]!.gain;
      g.cancelScheduledValues(now);
      g.setValueAtTime(g.value, now);
      g.linearRampToValueAtTime(0, now + 0.015);
      src.stop(now + 0.02);
    }
    this.sources[i] = null;
    if (s.buffer) s.state = "stopped";
    this.emit();
  }

  setVolume(i: number, v: number) {
    const s = this.slots[i]!;
    s.volume = v;
    if (s.state === "playing" || s.overdubbing) this.gains[i]!.gain.setTargetAtTime(s.muted ? 0 : v, this.ctx.currentTime, 0.02);
    this.emit();
  }

  setColor(i: number, color: string) {
    const slot = this.slots[i];
    if (!slot || !/^(#[0-9a-fA-F]{6}|oklch\(.+\))$/.test(color)) return;
    slot.color = color;
    window.localStorage.setItem("synclab.looper.colors", JSON.stringify(this.slots.map((item) => item.color)));
    this.emit();
  }

  toggleMute(i: number) {
    const s = this.slots[i];
    if (!s?.buffer) return;
    s.muted = !s.muted;
    this.gains[i]?.gain.setTargetAtTime(s.muted ? 0 : s.volume, this.ctx.currentTime, 0.02);
    this.emit();
  }

  toggleReverse(i: number) {
    const s = this.slots[i];
    if (!s?.buffer || s.overdubbing || s.state === "recording" || s.state === "armed") return;
    const reversed = this.ctx.createBuffer(s.buffer.numberOfChannels, s.buffer.length, s.buffer.sampleRate);
    for (let c = 0; c < s.buffer.numberOfChannels; c++) {
      const input = s.buffer.getChannelData(c);
      const output = reversed.getChannelData(c);
      for (let j = 0; j < input.length; j++) output[j] = input[input.length - 1 - j]!;
    }
    s.buffer = reversed;
    s.reversed = !s.reversed;
    if (s.state === "playing") this.play(i);
    this.emit();
  }

  async overdub(i: number) {
    const s = this.slots[i];
    if (!s?.buffer || s.state !== "playing" || !this.cycle || this.source !== "mic" || this.slots.some((slot) => slot.state === "armed" || slot.state === "recording")) return;
    if (this.ctx.state === "suspended") await this.ctx.resume();
    await this.openInput();
    if (s.state !== "playing" || this.slots.some((slot) => slot.state === "armed" || slot.state === "recording")) return;
    s.recStart = this.nextBoundary(this.ctx.currentTime + 0.05);
    s.recEnd = s.recStart + this.cycle;
    s.overdubbing = true;
    s.state = "armed";
    this.ensureTimer();
    this.emit();
  }

  /** Downsampled amplitudes around the ring, including a live recording. */
  levels(i: number, count = 64): number[] {
    const s = this.slots[i];
    if (!s) return [];
    let values = new Array<number>(count).fill(0);
    if (s.buffer) {
      let byCount = this.waveCache.get(s.buffer);
      const cached = byCount?.get(count);
      if (cached) values = cached;
      else {
        const data = s.buffer.getChannelData(0);
        for (let n = 0; n < count; n++) {
          let peak = 0;
          const from = Math.floor(n * data.length / count);
          const to = Math.floor((n + 1) * data.length / count);
          for (let j = from; j < to; j += Math.max(1, Math.floor((to - from) / 32))) peak = Math.max(peak, Math.abs(data[j] ?? 0));
          values[n] = peak;
        }
        if (!byCount) { byCount = new Map(); this.waveCache.set(s.buffer, byCount); }
        byCount.set(count, values);
      }
    }
    if (s.state === "recording") {
      values = [...values];
      const length = s.recEnd ? s.recEnd - s.recStart : Math.max(1, this.now - s.recStart);
      for (const chunk of this.chunks) {
        const n = Math.floor(((chunk.t - s.recStart) / length) * count);
        if (n < 0 || n >= count) continue;
        let peak = 0;
        for (let j = 0; j < chunk.l.length; j += 64) peak = Math.max(peak, Math.abs(chunk.l[j] ?? 0));
        values[n] = Math.max(values[n] ?? 0, peak);
      }
    }
    return values;
  }

  clear(i: number) {
    this.stop(i);
    const s = this.slots[i]!;
    s.buffer = null;
    if (this.waitingSlot === i) this.waitingSlot = null;
    s.state = "empty";
    s.recEnd = null;
    s.overdubbing = false;
    s.muted = false;
    s.reversed = false;
    if (!this.slots.some((slot) => slot.state === "armed" || slot.state === "recording")) this.closeInput();
    if (this.isEmpty) {
      this.cycle = null;
      this.origin = null;
    }
    this.emit();
  }

  stopAll() {
    for (let i = 0; i < SLOTS; i++) if (this.slots[i]!.state === "playing") this.stop(i);
  }
  playAll() {
    for (let i = 0; i < SLOTS; i++) if (this.slots[i]!.state === "stopped") this.play(i);
  }
  clearAll() {
    for (let i = 0; i < SLOTS; i++) this.clear(i);
  }

  /** WAV of a loop, for sending to the timeline. */
  wav(i: number): Blob | null {
    const b = this.slots[i]!.buffer;
    if (!b) return null;
    return encodeWav({ left: b.getChannelData(0), right: b.getChannelData(1), sampleRate: b.sampleRate });
  }
}

let looper: LiveLooper | null = null;
export function getLooper() {
  if (!looper) looper = new LiveLooper();
  return looper;
}
