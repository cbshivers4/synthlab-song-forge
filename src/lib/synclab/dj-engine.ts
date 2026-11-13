import { Mp3Encoder } from "@breezystack/lamejs";
import { getEngine } from "./audio-engine";
import { findCoverArt } from "./cover-art";
import { bandWave, beatPhase, crossfade, detectBpm, eqDb, filterFor, phaseShift, phonesBlend, phonesRoute, snapToBeat, speedFactor, syncRate, wavFromPcm16, type BandWave, type PhonesMode } from "./dj";
import { ScratchVoice } from "./dj-scratch";
import { frameAt, loadsUsed, pushFrame, type DeckFrame, type MixFrame } from "./dj-moves";
import { isAppleMobile } from "./mic";

/**
 * DJ decks: two players, a 3-band EQ + filter per channel, channel faders, an equal-power
 * crossfader and a mix recorder. It is a session singleton so a mix keeps playing while you
 * move around the app. The DJ output goes straight to the speakers (not through the song's
 * master), so the song's mastering never colours the mix and the recorder captures exactly
 * what you hear from the decks.
 */
export type DeckId = "A" | "B";

/** Left/right peak meter: mono sources are spread to both sides first so both meters move. */
class StereoMeter {
  readonly input: GainNode;
  private l: AnalyserNode; private r: AnalyserNode;
  private buf = new Float32Array(2048);
  constructor(ctx: AudioContext) {
    this.input = ctx.createGain();
    this.input.channelCount = 2; this.input.channelCountMode = "explicit"; this.input.channelInterpretation = "speakers";
    const split = ctx.createChannelSplitter(2);
    // 2048 samples cover the ~33 ms between screen frames, so short drum hits are never missed
    this.l = ctx.createAnalyser(); this.l.fftSize = 2048;
    this.r = ctx.createAnalyser(); this.r.fftSize = 2048;
    this.input.connect(split);
    split.connect(this.l, 0); split.connect(this.r, 1);
  }
  /** Peak sample level of the left and right side (1 = 0 dBFS). */
  levels(): [number, number] { return [this.peak(this.l), this.peak(this.r)]; }
  private peak(a: AnalyserNode) {
    a.getFloatTimeDomainData(this.buf);
    let p = 0;
    for (let i = 0; i < this.buf.length; i++) { const v = Math.abs(this.buf[i]!); if (v > p) p = v; }
    return p;
  }
}
export interface DeckState {
  id: DeckId;
  name: string | null;
  loading: boolean;
  error: string | null;
  duration: number;
  bpm: number;
  firstBeat: number;
  playing: boolean;
  /** pitch fader −range…+range as a rate offset (0.04 = +4 %) */
  pitch: number;
  range: number;
  cue: number;
  hotCues: (number | null)[];
  loop: { start: number; end: number; beats: number } | null;
  gain: number;
  eq: { high: number; mid: number; low: number };
  filter: number;
  fader: number;
  /** picture on the record label: from the file's cover art or one you picked (object URL) */
  art: string | null;
  artFrom: "file" | "you" | null;
  /** headphone CUE button: this deck is in the headphones (pre-fader, so you can hear it with its fader down) */
  phones: boolean;
  /** turntable speed button */
  rpm: 33 | 45;
  /** counts up on every successful load (also a reload of the same song) — drives the record-drop animation */
  loadSeq: number;
}
export interface MixState {
  crossfader: number; master: number; recording: boolean; recSeconds: number; hasMix: boolean; recLimit: number;
  /** headphone output: off, MONO SPLIT on the one output, or a second output device */
  phonesMode: PhonesMode; phonesDevice: string | null; phonesMix: number; phonesLevel: number; phonesError: string | null;
}

/** A second output (USB headphones, a DJ interface) can be chosen where the browser lets a page pick outputs. */
export function canPickPhonesDevice() {
  return typeof HTMLMediaElement !== "undefined" && typeof (HTMLMediaElement.prototype as unknown as { setSinkId?: unknown }).setSinkId === "function" && !isAppleMobile();
}

const REC_LIMIT = 30 * 60;
/** Each successful load on either deck gets the next number, so replay knows which record was on. */
let loadCounter = 0;
/** What a load put on the deck, kept a while so a replayed mix can show earlier records and waveforms. */
interface LoadInfo { name: string; wave: BandWave | null; overview: Float32Array | null; duration: number; bpm: number; firstBeat: number; art: string | null }
const KEEP_LOADS = 16;
const captureCode = `class DjCapture extends AudioWorkletProcessor {
  constructor() { super(); this.on = false; this.buf = new Int16Array(16384); this.n = 0;
    this.port.onmessage = ({ data }) => { if (data === 'start') { this.n = 0; this.on = true; } if (data === 'stop') { this.flush(); this.on = false; } }; }
  flush() { if (!this.n) return; const out = this.buf.slice(0, this.n); this.n = 0; this.port.postMessage(out, [out.buffer]); }
  process(inputs) { const i = inputs[0]; if (this.on && i && i[0]) { const l = i[0], r = i[1] || i[0];
    for (let k = 0; k < l.length; k++) { const a = Math.max(-1, Math.min(1, l[k])), b = Math.max(-1, Math.min(1, r[k])); this.buf[this.n++] = a < 0 ? a * 32768 : a * 32767; this.buf[this.n++] = b < 0 ? b * 32768 : b * 32767; if (this.n >= this.buf.length) this.flush(); }
  } return true; }
}
registerProcessor('synclab-dj-capture', DjCapture);`;

class Deck {
  state: DeckState;
  buffer: AudioBuffer | null = null;
  wave: BandWave | null = null;
  overview: Float32Array | null = null;
  private src: AudioBufferSourceNode | null = null;
  private startedAt = 0;
  private offset = 0;
  private nudge = 0;
  readonly trim: GainNode; readonly low: BiquadFilterNode; readonly mid: BiquadFilterNode; readonly high: BiquadFilterNode;
  readonly filter: BiquadFilterNode; readonly fader: GainNode; readonly xfade: GainNode; readonly meter: StereoMeter;
  /** pre-fader tap into the headphone bus (open while CUE is lit) */
  readonly phonesSend: GainNode;

  constructor(private ctx: AudioContext, id: DeckId, out: AudioNode, cueOut: AudioNode, private onChange: () => void) {
    this.state = { id, name: null, loading: false, error: null, duration: 0, bpm: 0, firstBeat: 0, playing: false, pitch: 0, range: 0.08, cue: 0,
      hotCues: [null, null, null, null], loop: null, gain: 1, eq: { high: 0.5, mid: 0.5, low: 0.5 }, filter: 0.5, fader: 0.85, art: null, artFrom: null, phones: false, rpm: 33, loadSeq: 0 };
    this.trim = ctx.createGain();
    this.low = ctx.createBiquadFilter(); this.low.type = "lowshelf"; this.low.frequency.value = 250;
    this.mid = ctx.createBiquadFilter(); this.mid.type = "peaking"; this.mid.frequency.value = 1100; this.mid.Q.value = 0.8;
    this.high = ctx.createBiquadFilter(); this.high.type = "highshelf"; this.high.frequency.value = 3800;
    this.filter = ctx.createBiquadFilter(); this.filter.type = "allpass";
    this.fader = ctx.createGain(); this.fader.gain.value = this.state.fader ** 2;
    this.xfade = ctx.createGain();
    this.meter = new StereoMeter(ctx);
    this.trim.connect(this.low).connect(this.mid).connect(this.high).connect(this.filter).connect(this.fader);
    this.fader.connect(this.meter.input);
    this.fader.connect(this.xfade).connect(out);
    this.phonesSend = ctx.createGain(); this.phonesSend.gain.value = 0;
    this.filter.connect(this.phonesSend).connect(cueOut);
  }

  get rate() { return (1 + this.state.pitch) * (1 + this.nudge) * speedFactor(this.state.rpm); }
  get effectiveBpm() { return this.state.bpm * (1 + this.state.pitch) * speedFactor(this.state.rpm); }

  /** Headphone CUE on/off for this deck. */
  setPhones(on: boolean) {
    this.state = { ...this.state, phones: on };
    this.phonesSend.gain.setTargetAtTime(on ? 1 : 0, this.ctx.currentTime, 0.01);
    this.onChange();
  }
  /** 33 / 45 speed buttons: like the turntable, tempo and key change together. */
  setRpm(rpm: 33 | 45) {
    if (rpm === this.state.rpm) return;
    const pos = this.position();
    this.state = { ...this.state, rpm };
    this.reanchor(pos);
    this.onChange();
  }

  position(): number {
    if (!this.buffer) return 0;
    let pos = this.offset + (this.state.playing ? (this.ctx.currentTime - this.startedAt) * this.rate : 0);
    const loop = this.state.loop;
    if (loop && this.state.playing && pos > loop.end) pos = loop.start + ((pos - loop.start) % (loop.end - loop.start));
    return Math.max(0, Math.min(this.buffer.duration, pos));
  }

  async load(blob: Blob, name: string) {
    this.stopSource();
    this.scratch?.stop(); this.scratch = null; this.held = null;
    this.releaseArt();
    this.state = { ...this.state, name, loading: true, error: null, playing: false, loop: null, hotCues: [null, null, null, null], cue: 0, art: null, artFrom: null };
    this.onChange();
    try {
      const bytes = await blob.arrayBuffer();
      // read the cover picture before the decoder takes the bytes
      const cover = findCoverArt(new Uint8Array(bytes));
      if (cover) this.state = { ...this.state, art: URL.createObjectURL(new Blob([cover.data.slice().buffer as ArrayBuffer], { type: cover.mime })), artFrom: "file" };
      const buf = await this.ctx.decodeAudioData(bytes);
      const chans = Array.from({ length: buf.numberOfChannels }, (_, c) => buf.getChannelData(c));
      const mono = new Float32Array(buf.length);
      for (const ch of chans) for (let i = 0; i < ch.length; i++) mono[i] = (mono[i] ?? 0) + (ch[i] ?? 0) / chans.length;
      await new Promise((r) => setTimeout(r, 0));
      const { bpm, firstBeat } = detectBpm(mono, buf.sampleRate);
      this.wave = bandWave(chans, buf.sampleRate, 120);
      this.overview = overviewOf(this.wave.peak, 900);
      this.buffer = buf;
      this.offset = firstBeat;
      const loadSeq = ++loadCounter;
      this.state = { ...this.state, loading: false, duration: buf.duration, bpm, firstBeat, cue: firstBeat, pitch: 0, loadSeq };
      this.remember(loadSeq);
    } catch {
      this.buffer = null; this.wave = null; this.overview = null;
      this.state = { ...this.state, loading: false, name: null, error: `Couldn't read ${name} — try an MP3, WAV, AAC or FLAC file.` };
    }
    this.onChange();
  }

  play() {
    if (!this.buffer || this.state.playing) return;
    // phones suspend or interrupt the sound (lock screen, calls, other apps): wake it so Play is always heard
    if (this.ctx.state !== "running") void this.ctx.resume().catch(() => undefined);
    this.startSource(this.offset);
    this.state = { ...this.state, playing: true };
    this.onChange();
  }
  pause() {
    if (!this.state.playing) return;
    this.offset = this.position();
    this.stopSource();
    this.state = { ...this.state, playing: false };
    this.onChange();
  }
  toggle() { if (this.state.playing) this.pause(); else this.play(); }

  /** CUE: while stopped it sets the cue point here; while playing it jumps back to the cue and stops. */
  cue() {
    if (!this.buffer) return;
    if (this.state.playing) { this.pause(); this.seek(this.state.cue); return; }
    const pos = this.position();
    if (Math.abs(pos - this.state.cue) < 0.01) return;
    this.state = { ...this.state, cue: pos };
    this.onChange();
  }

  seek(pos: number) {
    if (!this.buffer) return;
    const p = Math.max(0, Math.min(this.buffer.duration - 0.01, pos));
    const loop = this.state.loop;
    // jumping out of an active loop releases it
    if (loop && (p < loop.start - 0.001 || p > loop.end + 0.001)) this.state = { ...this.state, loop: null };
    this.offset = p;
    this.startedAt = this.ctx.currentTime;
    if (this.state.playing) this.startSource(p);
    this.onChange();
  }

  /** ⏮ Back to the very beginning of the track. Keeps playing if it was playing, stays stopped if not. */
  toStart() { this.seek(0); }

  /**
   * Hand on the record, the waveform or the tone arm. Letting go plays on if it was playing.
   * `sound`: true for the record — you hear it move forwards or backwards at your hand's speed
   * (ScratchVoice). The waveform and a lifted tone arm move silently.
   */
  private held: boolean | null = null;
  private scratch: ScratchVoice | null = null;
  get isHeld() { return this.held != null; }
  grab(opts: { sound?: boolean } = {}) {
    if (!this.buffer || this.held != null) return;
    this.held = this.state.playing;
    if (this.state.playing) this.pause();
    if (opts.sound) this.scratch = new ScratchVoice(this.ctx, this.buffer, this.trim, this.position());
  }
  dragTo(pos: number) {
    if (this.held == null) return;
    this.seek(pos);
    this.scratch?.moveTo(this.position());
  }
  release() {
    const was = this.held;
    this.held = null;
    this.scratch?.stop();
    this.scratch = null;
    if (was) this.play();
  }

  hotCue(i: number) {
    const at = this.state.hotCues[i];
    if (at == null) { const cues = [...this.state.hotCues]; cues[i] = this.position(); this.state = { ...this.state, hotCues: cues }; this.onChange(); return; }
    this.seek(at);
    if (!this.state.playing) this.play();
  }
  clearHotCue(i: number) { const cues = [...this.state.hotCues]; cues[i] = null; this.state = { ...this.state, hotCues: cues }; this.onChange(); }

  setPitch(p: number) {
    const pos = this.position();
    this.state = { ...this.state, pitch: Math.max(-this.state.range, Math.min(this.state.range, p)) };
    this.reanchor(pos);
    this.onChange();
  }
  setRange(r: number) { this.state = { ...this.state, range: r }; this.setPitch(this.state.pitch); }
  /** Hold to push/pull the record: a temporary ±4 % speed change. */
  setNudge(n: number) { const pos = this.position(); this.nudge = n; this.reanchor(pos); }
  setBpm(bpm: number) { if (bpm > 20 && bpm < 300) { this.state = { ...this.state, bpm: Math.round(bpm * 10) / 10 }; this.onChange(); } }

  /** Match tempo to the other deck and line the beats up. */
  sync(other: Deck) {
    if (!this.buffer || !other.buffer || !(this.state.bpm > 0) || !(other.state.bpm > 0)) return false;
    const rate = syncRate(this.state.bpm * speedFactor(this.state.rpm), other.effectiveBpm, this.state.range);
    this.setPitch(rate - 1);
    if (this.state.playing && other.state.playing) {
      const shift = phaseShift(this.position(), this.state.firstBeat, this.state.bpm, beatPhase(other.position(), other.state.firstBeat, other.state.bpm));
      this.seek(this.position() + shift);
    }
    return true;
  }

  /** Loop the next `beats` beats from the last beat line (exactly on the grid, seamless). */
  loop(beats: number) {
    if (!this.buffer || !(this.state.bpm > 0)) return;
    if (this.state.loop?.beats === beats) { this.exitLoop(); return; }
    const beat = 60 / this.state.bpm;
    const start = this.state.loop ? this.state.loop.start : snapToBeat(this.position(), this.state.firstBeat, this.state.bpm);
    const end = Math.min(this.buffer.duration, start + beats * beat);
    this.state = { ...this.state, loop: { start: Math.max(0, start), end, beats } };
    if (this.src) { this.src.loopStart = Math.max(0, start); this.src.loopEnd = end; this.src.loop = true; }
    this.onChange();
  }
  exitLoop() {
    const pos = this.position();
    this.state = { ...this.state, loop: null };
    if (this.src) this.src.loop = false;
    this.reanchor(pos);
    this.onChange();
  }

  setGain(v: number) { this.state = { ...this.state, gain: v }; this.trim.gain.setTargetAtTime(v, this.ctx.currentTime, 0.01); this.onChange(); }
  setEq(band: "high" | "mid" | "low", v: number) {
    this.state = { ...this.state, eq: { ...this.state.eq, [band]: v } };
    this[band].gain.setTargetAtTime(eqDb(v), this.ctx.currentTime, 0.01);
    this.onChange();
  }
  setFilter(v: number) {
    this.state = { ...this.state, filter: v };
    const f = filterFor(v);
    const t = this.ctx.currentTime;
    if (f.type === "off") { this.filter.type = "allpass"; this.filter.frequency.setTargetAtTime(1000, t, 0.01); }
    else { this.filter.type = f.type; this.filter.Q.value = 0.9; this.filter.frequency.setTargetAtTime(f.freq, t, 0.015); }
    this.onChange();
  }
  setFader(v: number) { this.state = { ...this.state, fader: v }; this.fader.gain.setTargetAtTime(v * v, this.ctx.currentTime, 0.01); this.onChange(); }

  /** Left/right level after EQ, filter and channel fader. */
  levels(): [number, number] { return this.meter.levels(); }

  /** Put your own picture on the record label (null puts back the file's picture, if any). */
  setArt(image: Blob | null) {
    this.releaseArt();
    this.state = { ...this.state, art: image ? URL.createObjectURL(image) : null, artFrom: image ? "you" : null };
    this.onChange();
  }
  /** A picture still shown by a remembered load (for replay) is freed when that load is forgotten. */
  private releaseArt() {
    const art = this.state.art;
    if (art && ![...this.loads.values()].some((l) => l.art === art)) URL.revokeObjectURL(art);
  }

  // ---- replay of a recorded mix: what the deck SHOWS (never changes what it plays) ----
  readonly loads = new Map<number, LoadInfo>();
  /** set by the mixer while a recorded mix replays */
  replayFrame: (() => DeckFrame | null) | null = null;
  /** loads a recorded mix still needs, so they aren't forgotten */
  keepLoads: Set<number> = new Set();
  private remember(seq: number) {
    const s = this.state;
    this.loads.set(seq, { name: s.name ?? "", wave: this.wave, overview: this.overview, duration: s.duration, bpm: s.bpm, firstBeat: s.firstBeat, art: s.art });
    for (const [k, l] of this.loads) {
      if (this.loads.size <= KEEP_LOADS) break;
      if (k === seq || this.keepLoads.has(k)) continue;
      this.loads.delete(k);
      if (l.art && l.art !== this.state.art && ![...this.loads.values()].some((x) => x.art === l.art)) URL.revokeObjectURL(l.art);
    }
  }
  /** Snapshot for the move recorder. */
  frame(): DeckFrame {
    const s = this.state;
    return { load: s.loadSeq, name: s.name, playing: s.playing, pos: this.position(), pitch: s.pitch, gain: s.gain, eq: s.eq, filter: s.filter,
      fader: s.fader, loop: s.loop, phones: s.phones, rpm: s.rpm };
  }
  private replayed(): { f: DeckFrame; l: LoadInfo | undefined } | null {
    const f = this.replayFrame?.();
    return f ? { f, l: this.loads.get(f.load) } : null;
  }
  /** The state to draw: the live deck, or the recorded performance during a replay. */
  get shown(): DeckState {
    const r = this.replayed();
    if (!r) return this.state;
    const { f, l } = r;
    return { ...this.state, name: f.load ? l?.name ?? f.name : null, loading: false, error: null, playing: f.playing, pitch: f.pitch, gain: f.gain, eq: f.eq,
      filter: f.filter, fader: f.fader, loop: f.loop, phones: f.phones, rpm: f.rpm, loadSeq: f.load, art: l?.art ?? null, artFrom: l?.art ? "file" : null,
      duration: l?.duration ?? 0, bpm: l?.bpm ?? 0, firstBeat: l?.firstBeat ?? 0, hotCues: [null, null, null, null] };
  }
  shownPosition(): number { const r = this.replayed(); return r ? r.f.pos : this.position(); }
  get shownWave(): BandWave | null { const r = this.replayed(); return r ? r.l?.wave ?? null : this.wave; }
  get shownOverview(): Float32Array | null { const r = this.replayed(); return r ? r.l?.overview ?? null : this.overview; }
  get shownDuration(): number { const r = this.replayed(); return r ? r.l?.duration ?? 0 : this.buffer?.duration ?? 0; }
  get shownEffectiveBpm(): number { const s = this.shown; return s.bpm * (1 + s.pitch) * speedFactor(s.rpm); }

  private reanchor(pos: number) {
    this.offset = pos;
    this.startedAt = this.ctx.currentTime;
    if (this.src) this.src.playbackRate.setValueAtTime(this.rate, this.ctx.currentTime);
  }

  private startSource(at: number) {
    this.stopSource();
    if (!this.buffer) return;
    const src = this.ctx.createBufferSource();
    src.buffer = this.buffer;
    src.playbackRate.value = this.rate;
    const loop = this.state.loop;
    if (loop) { src.loop = true; src.loopStart = loop.start; src.loopEnd = loop.end; }
    src.connect(this.trim);
    src.onended = () => {
      if (this.src !== src) return;
      this.src = null;
      this.offset = this.buffer?.duration ?? 0;
      this.state = { ...this.state, playing: false };
      this.onChange();
    };
    src.start(this.ctx.currentTime + 0.005, at);
    this.src = src;
    this.offset = at;
    this.startedAt = this.ctx.currentTime + 0.005;
  }
  private stopSource() {
    const s = this.src;
    this.src = null;
    if (!s) return;
    try { s.stop(); } catch { /* already stopped */ }
    try { s.disconnect(); } catch { /* already disconnected */ }
  }
}

function overviewOf(peak: Float32Array, cols: number) {
  const out = new Float32Array(cols);
  const per = peak.length / cols;
  for (let c = 0; c < cols; c++) {
    let p = 0;
    for (let i = Math.floor(c * per); i < Math.min(peak.length, Math.floor((c + 1) * per)); i++) p = Math.max(p, peak[i]!);
    out[c] = p;
  }
  return out;
}

class DjMixer {
  readonly ctx: AudioContext;
  readonly A: Deck; readonly B: Deck;
  private bus: GainNode; private out: GainNode;
  readonly masterMeter: StereoMeter;
  private mix: MixState = { crossfader: 0, master: 0.9, recording: false, recSeconds: 0, hasMix: false, recLimit: REC_LIMIT,
    phonesMode: "off", phonesDevice: null, phonesMix: 0, phonesLevel: 0.8, phonesError: null };
  // headphone path: cued decks + master → MIXING → LEVEL, then off / split / second device
  private cueBus: GainNode; private phCue: GainNode; private phMaster: GainNode; private phLevel: GainNode;
  private splitL: GainNode; private splitR: GainNode; private splitMerge: ChannelMergerNode;
  private phStream: MediaStreamAudioDestinationNode | null = null;
  private phAudio: HTMLAudioElement | null = null;
  private listeners = new Set<() => void>();
  private recNode: AudioWorkletNode | null = null;
  private recSilent: GainNode | null = null;
  private chunks: Int16Array[] = [];
  private recFrames = 0;
  private moduleReady: Promise<void> | null = null;
  version = 0;
  // the DJ's moves while recording, for "Replay moves"
  private moves: MixFrame[] = [];
  private recT0 = 0;
  private moveTimer: ReturnType<typeof setInterval> | null = null;
  private replaySrc: AudioBufferSourceNode | null = null;
  private replayT0 = 0;
  private replayTimer: ReturnType<typeof setInterval> | null = null;

  constructor() {
    this.ctx = getEngine().init();
    this.bus = this.ctx.createGain();
    this.out = this.ctx.createGain();
    this.out.gain.value = this.mix.master;
    this.masterMeter = new StereoMeter(this.ctx);
    this.bus.connect(this.out);
    this.out.connect(this.ctx.destination);
    this.out.connect(this.masterMeter.input);
    const c = this.ctx;
    this.cueBus = c.createGain();
    this.phCue = c.createGain(); this.phMaster = c.createGain(); this.phLevel = c.createGain();
    this.cueBus.connect(this.phCue).connect(this.phLevel);
    this.out.connect(this.phMaster).connect(this.phLevel);
    // MONO SPLIT: left ear = headphone mix, right ear = master, both folded to mono
    const mono = (g: GainNode) => { g.channelCount = 1; g.channelCountMode = "explicit"; g.channelInterpretation = "speakers"; return g; };
    this.splitL = mono(c.createGain()); this.splitR = mono(c.createGain());
    this.splitMerge = c.createChannelMerger(2);
    this.splitL.connect(this.splitMerge, 0, 0); this.splitR.connect(this.splitMerge, 0, 1);
    this.applyPhonesLevels();
    const changed = () => this.emit();
    this.A = new Deck(this.ctx, "A", this.bus, this.cueBus, changed);
    this.B = new Deck(this.ctx, "B", this.bus, this.cueBus, changed);
    this.applyCrossfader();
  }

  setPhonesMix(v: number) { this.mix = { ...this.mix, phonesMix: Math.max(0, Math.min(1, v)) }; this.applyPhonesLevels(); this.emit(); }
  setPhonesLevel(v: number) { this.mix = { ...this.mix, phonesLevel: Math.max(0, Math.min(1.5, v)) }; this.applyPhonesLevels(); this.emit(); }
  private applyPhonesLevels() {
    const t = this.ctx.currentTime;
    const [cue, master] = phonesBlend(this.mix.phonesMix);
    this.phCue.gain.setTargetAtTime(cue, t, 0.01);
    this.phMaster.gain.setTargetAtTime(master, t, 0.01);
    this.phLevel.gain.setTargetAtTime(this.mix.phonesLevel, t, 0.01);
    this.splitR.gain.setTargetAtTime(this.mix.phonesLevel, t, 0.01);
  }

  /** Choose where the headphones go. Call from a tap so a second output can start playing. */
  async setPhonesMode(mode: PhonesMode, deviceId: string | null = this.mix.phonesDevice) {
    this.mix = { ...this.mix, phonesMode: mode, phonesDevice: deviceId, phonesError: null };
    const want = phonesRoute(mode, canPickPhonesDevice(), deviceId);
    this.unroute();
    try {
      if (want === "split") {
        this.out.disconnect(this.ctx.destination);
        this.phLevel.connect(this.splitL);
        this.out.connect(this.splitR);
        this.splitMerge.connect(this.ctx.destination);
      } else if (want === "device" && deviceId) {
        this.phStream ??= this.ctx.createMediaStreamDestination();
        this.phLevel.connect(this.phStream);
        const el = (this.phAudio ??= new Audio());
        el.srcObject = this.phStream.stream;
        await (el as HTMLAudioElement & { setSinkId: (id: string) => Promise<void> }).setSinkId(deviceId);
        await el.play();
      }
    } catch (e) {
      this.unroute();
      this.mix = { ...this.mix, phonesMode: "off", phonesError: (e as Error)?.message || "That output couldn't be opened." };
    }
    this.emit();
  }
  private unroute() {
    const off = (a: AudioNode, b: AudioNode) => { try { a.disconnect(b); } catch { /* not connected */ } };
    off(this.phLevel, this.splitL); off(this.out, this.splitR); off(this.splitMerge, this.ctx.destination);
    // the speakers always get the master back (connecting twice is harmless)
    this.out.connect(this.ctx.destination);
    if (this.phStream) off(this.phLevel, this.phStream);
    if (this.phAudio) { this.phAudio.pause(); this.phAudio.srcObject = null; }
  }

  deck(id: DeckId) { return id === "A" ? this.A : this.B; }
  other(id: DeckId) { return id === "A" ? this.B : this.A; }
  get state() { return this.mix; }

  setCrossfader(x: number) { this.mix = { ...this.mix, crossfader: x }; this.applyCrossfader(); this.emit(); }
  setMaster(v: number) { this.mix = { ...this.mix, master: v }; this.out.gain.setTargetAtTime(v, this.ctx.currentTime, 0.01); this.emit(); }

  private applyCrossfader() {
    const [a, b] = crossfade(this.mix.crossfader);
    this.A.xfade.gain.setTargetAtTime(a, this.ctx.currentTime, 0.008);
    this.B.xfade.gain.setTargetAtTime(b, this.ctx.currentTime, 0.008);
  }

  async startRecording() {
    if (this.mix.recording) return;
    if (!this.ctx.audioWorklet) throw new Error("This browser can't record the mix.");
    this.moduleReady ??= this.ctx.audioWorklet.addModule(URL.createObjectURL(new Blob([captureCode], { type: "application/javascript" })));
    await this.moduleReady;
    if (!this.recNode) {
      this.recNode = new AudioWorkletNode(this.ctx, "synclab-dj-capture", { numberOfInputs: 1, numberOfOutputs: 1, outputChannelCount: [2], channelCount: 2, channelCountMode: "explicit" });
      this.recSilent = this.ctx.createGain(); this.recSilent.gain.value = 0;
      this.out.connect(this.recNode); this.recNode.connect(this.recSilent).connect(this.ctx.destination);
      this.recNode.port.onmessage = ({ data }) => {
        if (!(data instanceof Int16Array)) return;
        this.chunks.push(data);
        this.recFrames += data.length / 2;
        const secs = this.recFrames / this.ctx.sampleRate;
        // the last slice arrives just after Stop
        if (!this.mix.recording) { this.mix = { ...this.mix, recSeconds: secs, hasMix: true }; this.emit(); return; }
        if (Math.floor(secs * 4) !== Math.floor(this.mix.recSeconds * 4)) { this.mix = { ...this.mix, recSeconds: secs }; this.emit(); }
        if (secs >= REC_LIMIT) this.stopRecording();
      };
    }
    this.chunks = []; this.recFrames = 0;
    this.stopReplay();
    this.mix = { ...this.mix, recording: true, recSeconds: 0, hasMix: false };
    this.recNode.port.postMessage("start");
    this.moves = []; this.recT0 = this.ctx.currentTime;
    this.snapshot();
    if (this.moveTimer) clearInterval(this.moveTimer);
    this.moveTimer = setInterval(() => this.snapshot(), 50);
    this.emit();
  }

  stopRecording() {
    if (!this.mix.recording) return;
    this.recNode?.port.postMessage("stop");
    this.snapshot();
    if (this.moveTimer) { clearInterval(this.moveTimer); this.moveTimer = null; }
    const keep = loadsUsed(this.moves);
    this.A.keepLoads = keep; this.B.keepLoads = keep;
    this.mix = { ...this.mix, recording: false, hasMix: this.recFrames > 0 };
    this.emit();
  }

  get recordedSeconds() { return this.recFrames / this.ctx.sampleRate; }

  wav(): Blob { return wavFromPcm16(this.chunks, this.ctx.sampleRate); }

  /** MP3 at 320 kbps, encoded in slices so the app stays responsive during long mixes. */
  async mp3(onProgress?: (f: number) => void): Promise<Blob> {
    const enc = new Mp3Encoder(2, this.ctx.sampleRate, 320);
    const parts: BlobPart[] = [];
    const block = 1152;
    for (let c = 0; c < this.chunks.length; c++) {
      const chunk = this.chunks[c]!;
      const n = chunk.length / 2;
      const l = new Int16Array(n), r = new Int16Array(n);
      for (let i = 0; i < n; i++) { l[i] = chunk[2 * i]!; r[i] = chunk[2 * i + 1]!; }
      for (let i = 0; i < n; i += block) {
        const out = enc.encodeBuffer(l.subarray(i, i + block), r.subarray(i, i + block));
        if (out.length) parts.push(new Uint8Array(out));
      }
      if (c % 200 === 0) { onProgress?.(c / this.chunks.length); await new Promise((res) => setTimeout(res, 0)); }
    }
    const end = enc.flush();
    if (end.length) parts.push(new Uint8Array(end));
    onProgress?.(1);
    return new Blob(parts, { type: "audio/mpeg" });
  }

  discardRecording() {
    this.stopReplay();
    this.chunks = []; this.recFrames = 0; this.moves = [];
    this.A.keepLoads = new Set(); this.B.keepLoads = new Set();
    this.mix = { ...this.mix, hasMix: false, recSeconds: 0 }; this.emit();
  }

  private snapshot() {
    if (!this.mix.recording) return;
    pushFrame(this.moves, { t: this.ctx.currentTime - this.recT0, A: this.A.frame(), B: this.B.frame(), crossfader: this.mix.crossfader, master: this.mix.master });
  }

  /** True once a recorded mix has moves to watch again. */
  get canReplay() { return this.moves.length > 0 && this.mix.hasMix && !this.mix.recording; }
  get replaying() { return this.replaySrc != null; }
  /** Seconds into the replayed mix. */
  get replaySeconds() { return this.replaySrc ? Math.max(0, this.ctx.currentTime - this.replayT0) : 0; }
  private replayAt(): MixFrame | null { return this.replaySrc ? frameAt(this.moves, this.ctx.currentTime - this.replayT0) : null; }
  /** Crossfader / master as drawn: live, or the recorded ones during a replay. */
  get shownMix(): MixState {
    const f = this.replayAt();
    return f ? { ...this.mix, crossfader: f.crossfader, master: f.master } : this.mix;
  }

  /**
   * Plays the recorded mix and shows the decks, records, knobs and faders moving exactly as you
   * played them. Only the picture follows the recording: the decks themselves aren't touched, so
   * when the replay ends (or you stop it) everything is as you left it.
   */
  startReplay() {
    if (!this.canReplay) throw new Error("Record a mix first — your moves are captured while it records.");
    if (this.A.state.playing || this.B.state.playing) throw new Error("Stop both decks first, so the replay isn't mixed with live music.");
    this.stopReplay();
    if (this.ctx.state !== "running") void this.ctx.resume().catch(() => undefined);
    const frames = this.recFrames;
    const buf = this.ctx.createBuffer(2, Math.max(1, frames), this.ctx.sampleRate);
    const l = buf.getChannelData(0), r = buf.getChannelData(1);
    let i = 0;
    for (const c of this.chunks) for (let k = 0; k + 1 < c.length && i < frames; k += 2, i++) { l[i] = c[k]! / 32768; r[i] = c[k + 1]! / 32768; }
    const src = this.ctx.createBufferSource();
    src.buffer = buf;
    src.connect(this.ctx.destination);
    src.connect(this.masterMeter.input);
    src.onended = () => { if (this.replaySrc === src) this.stopReplay(); };
    this.replayT0 = this.ctx.currentTime + 0.05;
    src.start(this.replayT0);
    this.replaySrc = src;
    const at = () => this.replayAt();
    this.A.replayFrame = () => at()?.A ?? null;
    this.B.replayFrame = () => at()?.B ?? null;
    // knobs and faders follow the recording at 20 fps
    this.replayTimer = setInterval(() => this.emit(), 50);
    this.emit();
  }
  stopReplay() {
    const src = this.replaySrc;
    if (!src) return;
    this.replaySrc = null;
    try { src.stop(); } catch { /* ended */ }
    try { src.disconnect(); } catch { /* gone */ }
    if (this.replayTimer) { clearInterval(this.replayTimer); this.replayTimer = null; }
    this.A.replayFrame = null; this.B.replayFrame = null;
    this.emit();
  }

  subscribe(fn: () => void) { this.listeners.add(fn); return () => void this.listeners.delete(fn); }
  private emit() {
    this.version++;
    if (this.mix.recording) this.snapshot();
    this.listeners.forEach((l) => l());
  }
}

let mixer: DjMixer | null = null;
/** Created on the first tap in the DJ panel (so phone audio unlocks in that gesture). */
export function getDj() { return (mixer ??= new DjMixer()); }
export function peekDj() { return mixer; }
