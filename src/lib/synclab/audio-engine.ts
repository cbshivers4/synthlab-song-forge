import { VOICE_SHAPER_IN, voiceDriveAmount, voiceSaturationCurve } from "./voice-saturation";
import { meterWindowSize } from "./meter-window";
import { nativeInsertMode } from "./native-insert";
import { lfoHz } from "./synth-timing";
import { centerOneSided } from "./one-sided-audio";
import { buildCreativeFx, isCreativeKind } from "./creative-fx";
import { phasedHarmonics } from "./oscillator-phase";
import { envelopePoints } from "./live-envelope";
import { renderVintageDrum } from "./vintage-drums";
import { playModularVoice } from "./modular";
import { GRANULAR_ROOT, builtInSource, playGranularVoice, warmBuiltInSource, type GranularPatch, type GranularVoice } from "./granular";
import { MODULAR_SCOPE_TYPES, attachModularScope, modularScopeId } from './modular-scopes';
import { playbackPreferences } from "./preferences";
import { encodeWav } from "./bounce";
import { isExternal, sendExternalNote, stopExternalNotes } from "./external-midi";
import { keysSnapshot, subscribeKeys } from "./active-keys";
import type { DrumKitId, DrumPad, PluginInstance, SynthPatch, Track } from "./types";
import { getInputChannel, getInputGainDb, getOutputDevice, isAppleMobile, openMicOrThrow, outputRoutingHint, preferredRecordingMime, releaseMic } from "./mic";

type KitVoice = {
  kick: [number, number, number, OscillatorType];
  snare: [number, number, number];
  clap: number;
  hatF: number;
  hatD: number;
  tom: [number, number];
  perc: number;
  crash: number;
  ride: number;
  click: number;
  body: number;
};

/** Voice shaping per classic drum machine (synthesised, not sampled). */
export const DRUM_KIT_VOICES: Record<DrumKitId, KitVoice> = {
  "909": { kick: [120, 45, 0.38, "sine"], snare: [190, 1800, 1], clap: 1500, hatF: 8200, hatD: 0.9, tom: [180, 85], perc: 620, crash: 5600, ride: 9200, click: 1, body: 1 },
  "808": { kick: [90, 30, 1.1, "sine"], snare: [200, 1200, 0.8], clap: 1100, hatF: 9500, hatD: 0.55, tom: [140, 60], perc: 520, crash: 4800, ride: 8200, click: 0.4, body: 0.8 },
  "727": { kick: [230, 180, 0.24, "sine"], snare: [620, 2600, 0.5], clap: 5200, hatF: 11000, hatD: 0.5, tom: [290, 200], perc: 540, crash: 880, ride: 380, click: 0.5, body: 0.8 },
  r8: { kick: [125, 55, 0.38, "sine"], snare: [205, 2200, 1.1], clap: 1700, hatF: 9000, hatD: 0.8, tom: [190, 90], perc: 640, crash: 5300, ride: 9100, click: 1.2, body: 1.2 },
  "707": { kick: [110, 50, 0.3, "triangle"], snare: [230, 2000, 0.7], clap: 1600, hatF: 7800, hatD: 0.7, tom: [190, 95], perc: 700, crash: 5400, ride: 9000, click: 1.2, body: 1 },
  "606": { kick: [105, 48, 0.28, "triangle"], snare: [240, 2600, 0.6], clap: 1800, hatF: 10000, hatD: 0.5, tom: [210, 110], perc: 760, crash: 6200, ride: 9600, click: 1.4, body: 0.9 },
  linn: { kick: [95, 52, 0.42, "sine"], snare: [180, 1500, 1.1], clap: 1300, hatF: 7000, hatD: 0.8, tom: [160, 80], perc: 560, crash: 5000, ride: 8600, click: 0.9, body: 1.15 },
  acoustic: { kick: [80, 55, 0.5, "sine"], snare: [170, 1200, 1.3], clap: 1200, hatF: 6400, hatD: 0.85, tom: [150, 75], perc: 480, crash: 4600, ride: 8000, click: 0.7, body: 1.3 },
  detroit: { kick: [140, 40, 0.34, "sine"], snare: [210, 2200, 0.9], clap: 1700, hatF: 8800, hatD: 0.6, tom: [200, 90], perc: 660, crash: 5800, ride: 9400, click: 1.3, body: 1 },
  lofi: { kick: [85, 38, 0.45, "triangle"], snare: [160, 1000, 1], clap: 900, hatF: 5600, hatD: 0.7, tom: [130, 65], perc: 440, crash: 4000, ride: 7200, click: 0.5, body: 1.2 },
  trap: { kick: [70, 28, 1.4, "sine"], snare: [220, 2400, 0.75], clap: 1400, hatF: 11000, hatD: 0.35, tom: [170, 70], perc: 600, crash: 5200, ride: 8800, click: 0.6, body: 0.85 },
  cr78: { kick: [100, 60, 0.26, "sine"], snare: [250, 2800, 0.6], clap: 1900, hatF: 9000, hatD: 0.45, tom: [200, 105], perc: 820, crash: 6000, ride: 9400, click: 1.1, body: 0.8 },
  simmons: { kick: [130, 35, 0.5, "sine"], snare: [300, 900, 1.1], clap: 1200, hatF: 7400, hatD: 0.6, tom: [220, 60], perc: 700, crash: 5200, ride: 8600, click: 1.5, body: 1.4 },
  dmx: { kick: [98, 46, 0.4, "sine"], snare: [195, 1700, 1.05], clap: 1450, hatF: 7600, hatD: 0.75, tom: [170, 85], perc: 580, crash: 5200, ride: 8800, click: 1, body: 1.1 },
  mpc60: { kick: [92, 44, 0.44, "sine"], snare: [185, 1450, 1.15], clap: 1250, hatF: 6800, hatD: 0.7, tom: [155, 78], perc: 520, crash: 4800, ride: 8200, click: 0.8, body: 1.2 },
  jazz: { kick: [75, 52, 0.42, "sine"], snare: [165, 1100, 1.25], clap: 1150, hatF: 6000, hatD: 0.9, tom: [145, 72], perc: 460, crash: 4400, ride: 7800, click: 0.6, body: 1.25 },
  rock: { kick: [82, 50, 0.52, "sine"], snare: [175, 1350, 1.45], clap: 1300, hatF: 6600, hatD: 0.95, tom: [150, 70], perc: 500, crash: 4200, ride: 7600, click: 0.9, body: 1.45 },
  latin: { kick: [88, 58, 0.36, "sine"], snare: [230, 1600, 0.95], clap: 1500, hatF: 7200, hatD: 0.7, tom: [210, 120], perc: 900, crash: 5000, ride: 8400, click: 1, body: 1.1 },
  afrobeat: { kick: [86, 54, 0.4, "sine"], snare: [205, 1400, 1.1], clap: 1350, hatF: 6900, hatD: 0.8, tom: [190, 100], perc: 840, crash: 4700, ride: 8000, click: 0.8, body: 1.2 },
  drill: { kick: [68, 26, 1.5, "sine"], snare: [215, 2600, 0.8], clap: 1600, hatF: 11500, hatD: 0.3, tom: [165, 68], perc: 620, crash: 5400, ride: 9000, click: 0.6, body: 0.8 },
  ghettotech: { kick: [135, 42, 0.3, "sine"], snare: [225, 2400, 0.85], clap: 1800, hatF: 9800, hatD: 0.5, tom: [205, 95], perc: 720, crash: 6000, ride: 9600, click: 1.35, body: 0.95 },
  jungle: { kick: [78, 40, 0.6, "sine"], snare: [190, 1900, 1.3], clap: 1400, hatF: 8000, hatD: 0.65, tom: [160, 80], perc: 640, crash: 5000, ride: 8600, click: 0.9, body: 1.15 },
  boombap: { kick: [84, 42, 0.48, "triangle"], snare: [178, 1300, 1.35], clap: 1150, hatF: 6200, hatD: 0.7, tom: [150, 74], perc: 500, crash: 4400, ride: 7600, click: 0.7, body: 1.3 },
  house: { kick: [105, 48, 0.36, "sine"], snare: [215, 1800, 0.85], clap: 1550, hatF: 8400, hatD: 0.65, tom: [185, 90], perc: 680, crash: 5400, ride: 9000, click: 1.05, body: 1.05 },
  techno: { kick: [128, 38, 0.32, "sine"], snare: [205, 2300, 0.8], clap: 1700, hatF: 9200, hatD: 0.55, tom: [195, 88], perc: 700, crash: 5900, ride: 9400, click: 1.4, body: 0.95 },
  industrial: { kick: [150, 34, 0.42, "square"], snare: [240, 3000, 1.2], clap: 2000, hatF: 12000, hatD: 0.5, tom: [230, 90], perc: 980, crash: 6600, ride: 10200, click: 1.8, body: 1.35 },
};

const clamp = (v: number, a: number, b: number) => Math.min(b, Math.max(a, v));

export const midiToFreq = (n: number) => 440 * Math.pow(2, (n - 69) / 12);

/** Loudest absolute value inside a 0..1 window of some channels. */
export function peakInWindow(channels: Float32Array[], start: number, end: number): number {
  let peak = 0;
  for (const data of channels) {
    const from = Math.max(0, Math.floor(clamp(start, 0, 1) * data.length));
    const to = Math.min(data.length, Math.ceil(clamp(end, 0, 1) * data.length));
    for (let i = from; i < to; i++) { const v = Math.abs(data[i]!); if (v > peak) peak = v; }
  }
  return peak;
}

/** Trim window (0..1) to read from the (possibly reversed) buffer so reverse plays the selected part backwards. */
export function sampleWindow(start: number, end: number, reverse: boolean): [number, number] {
  const a0 = clamp(start, 0, 0.999);
  const b0 = clamp(end, a0 + 0.001, 1);
  if (!reverse) return [a0, b0];
  return [clamp(1 - b0, 0, 0.999), clamp(1 - a0, 1 - b0 + 0.001, 1)];
}

function makeImpulse(ctx: AudioContext, decay: number) {
  const rate = ctx.sampleRate;
  const len = Math.max(1, Math.floor(rate * decay));
  const buf = ctx.createBuffer(2, len, rate);
  for (let ch = 0; ch < 2; ch++) {
    const d = buf.getChannelData(ch);
    for (let i = 0; i < len; i++) {
      d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 2.4);
    }
  }
  return buf;
}

function makeBitcrushCurve(bits: number) {
  const steps = Math.pow(2, bits);
  const n = 8192;
  const curve = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const x = (i / (n - 1)) * 2 - 1;
    curve[i] = Math.round(x * steps) / steps;
  }
  return curve;
}


function makeDistortionCurve(amount: number) {
  const k = amount * 100;
  const n = 1025; // Odd size maps silence to exactly zero, avoiding a DC floor.
  const curve = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const x = (i * 2) / (n - 1) - 1;
    curve[i] = ((1 + k) * x) / (1 + k * Math.abs(x));
  }
  return curve;
}

interface ChannelStrip {
  input: GainNode;
  /** pre-fader trim driven by the mixer channel's GAIN knob */
  trim: GainNode;
  gain: GainNode;
  pan: StereoPannerNode;
  meter: AnalyserNode;
  sendReverb: GainNode;
  sendDelay: GainNode;
  sendChorus: GainNode;
  /** Scales per-voice synth FX taps (chorus/reverb) so they follow track mute/volume/VCA. */
  synthReverbScale: GainNode;
  synthChorusScale: GainNode;
  bus: string;
  insertNodes: AudioNode[];
  insertKey: string;
  insertOut: GainNode;
}

type AutomatableAudioParam = { param: AudioParam; min: number; max: number; logarithmic?: boolean };

const vocoderCleanups = new Map<string, () => void>();

/* holds the current value so live envelope edits don't jump */
const holdAt = (pr: AudioParam, tm: number) => { const x = pr as AudioParam & { cancelAndHoldAtTime?: (t: number) => AudioParam }; if (x.cancelAndHoldAtTime) x.cancelAndHoldAtTime(tm); else { const v = pr.value; pr.cancelScheduledValues(tm); pr.setValueAtTime(v, tm); } };

export class SyncLabEngine {
  ctx: AudioContext | null = null;
  master: GainNode | null = null;
  reverb: ConvolverNode | null = null;
  reverbSend: GainNode | null = null;
  delaySend: GainNode | null = null;
  chorusSend: GainNode | null = null;
  private buses = new Map<string, GainNode>();
  private busStates: Record<string, { volume: number; muted: boolean; gain?: number }> = {};
  private mixTracks: Track[] = [];
  private mixerInputs = new WeakMap<ChannelStrip, string>();
  private insertInputs = new WeakMap<ChannelStrip, PluginInstance[]>();
  private busMeters = new Map<string, AnalyserNode>();
  private auxReturns = new Map<string, GainNode>();
  private auxMeters = new Map<string, AnalyserNode>();
  private auxStates: Record<string, { volume: number; muted: boolean }> = {};
  private vcaStates: Record<string, { volume: number; muted: boolean }> = {};
  private vcaMeters = new Map<string, AnalyserNode>();
  private trackVcas = new Map<string, string>();
  private trackAudible = new Map<string, boolean>();
  private automatedPluginParams = new Map<string, AutomatableAudioParam>();
  /** Knob setters that update a running effect in place (no chain rebuild, tails keep ringing). */
  private liveParams = new Map<string, (v: number, t: number) => void>();
  private insertParamMap = new Map<string, string>();
  private sendOut = new Map<string, AudioNode>();
  private sendFeedback = new Map<string, AudioNode>();
  private fxInserts = new Map<string, { key: string; nodes: AudioNode[]; input: GainNode }>();
  /** Post-EQ analysers for the Pro-EQ display, keyed by plugin instance id. */
  private eqAnalysers = new Map<string, AnalyserNode>();
  private pluginScopes = new Map<string, AnalyserNode>();
  private channels = new Map<string, ChannelStrip>();
  private analyser: AnalyserNode | null = null;
  private masterL: AnalyserNode | null = null;
  private masterR: AnalyserNode | null = null;
  private masterBufs = new Map<string, Float32Array>();
  /** One high-resolution branch analyser for the expanded scope window; never feeds back into the mix. */
  private detail: { id: string; source: AnalyserNode; node: AnalyserNode; wave: Float32Array; spec: Float32Array } | null = null;
  private resumeListenersInstalled = false;
  private unlockMedia: HTMLAudioElement | null = null;
  private mediaUnlocked = false;
  private monitorGeneration = 0;
  private recordingStart: Promise<void> | null = null;
  private distortionCurves = new Map<string, Float32Array<ArrayBuffer>>();

  /** Called inside the same user gesture as a pad tap, including the first tap. */
  private unlockAudio() {
    const ctx = this.ctx;
    if (!ctx) return;
    if (ctx.state === "suspended" || (ctx.state as string) === "interrupted") {
      void ctx.resume().catch(() => undefined);
    }
    if (this.mediaUnlocked) return;
    const session = (navigator as Navigator & { audioSession?: { type: string } }).audioSession;
    try { if (session) session.type = "playback"; } catch { /* unsupported */ }
    try {
      // A valid, non-empty silent WAV is required by older iOS media playback.
      const el = this.unlockMedia ?? new Audio("data:audio/wav;base64,UklGRnQAAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YVAAAACAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgA==");
      el.setAttribute("playsinline", "");
      this.unlockMedia = el;
      this.mediaUnlocked = true;
      void el.play().catch(() => { this.mediaUnlocked = false; });
    } catch { this.mediaUnlocked = false; }
  }

  init() {
    if (this.ctx) {
      this.unlockAudio();
      return this.ctx;
    }
    const Ctor: typeof AudioContext =
      (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext ??
      window.AudioContext;
    const ctx = new Ctor({ latencyHint: "interactive" });
    const savedOut = getOutputDevice();
    const sinkCtx = ctx as AudioContext & { setSinkId?: (id: string) => Promise<void> };
    if (savedOut && sinkCtx.setSinkId) void sinkCtx.setSinkId(savedOut).catch(() => undefined);
    this.ctx = ctx;
    if (!this.resumeListenersInstalled) {
      this.resumeListenersInstalled = true;
      const resume = () => this.unlockAudio();
      window.addEventListener("touchend", resume, { passive: true });
      document.addEventListener("visibilitychange", () => {
        if (document.visibilityState === "visible") resume();
      });
      window.addEventListener("pageshow", resume);
      window.addEventListener("pointerdown", resume, { passive: true });
      window.addEventListener("keydown", resume);
    }
    this.buildGraph(ctx);
    this.unlockAudio();
    return ctx;
  }

  /** Master, send returns and buses. Shared by the live context and offline song renders. */
  protected buildGraph(ctx: BaseAudioContext) {
    const master = ctx.createGain();
    master.gain.value = this.busStates["master"]?.muted ? 0 : 0.85 * (this.busStates["master"]?.volume ?? 1);
    const analyser = ctx.createAnalyser();
    analyser.fftSize = 1024;
    master.connect(analyser);
    analyser.connect(ctx.destination);
    this.analyser = analyser;
    this.master = master;
    // the master output doubles as a scope source
    this.pluginScopes.set("master", analyser);
    // stereo taps for the master meter / scope (analysers pass audio through, splitter is a dead end)
    const split = ctx.createChannelSplitter(2);
    analyser.connect(split);
    const anL = ctx.createAnalyser();
    const anR = ctx.createAnalyser();
    for (const a of [anL, anR]) { a.fftSize = 2048; a.smoothingTimeConstant = 0.6; }
    split.connect(anL, 0);
    split.connect(anR, 1);
    this.masterL = anL;
    this.masterR = anR;

    // simple algorithmic reverb
    const conv = ctx.createConvolver();
    const len = ctx.sampleRate * 2.2;
    const buf = ctx.createBuffer(2, len, ctx.sampleRate);
    for (let c = 0; c < 2; c++) {
      const d = buf.getChannelData(c);
      for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 2.6);
    }
    conv.buffer = buf;
    const send = ctx.createGain();
    send.gain.value = 1;
    send.connect(conv);
    const reverbReturn = ctx.createGain();
    conv.connect(reverbReturn);
    const reverbMeter = ctx.createAnalyser();
    reverbMeter.fftSize = 1024;
    reverbReturn.connect(reverbMeter);
    reverbMeter.connect(master);
    this.auxMeters.set("reverb", reverbMeter);
    reverbReturn.gain.value = this.auxStates["reverb"]?.muted ? 0 : this.auxStates["reverb"]?.volume ?? 1;
    this.auxReturns.set("reverb", reverbReturn);
    this.reverb = conv;
    this.reverbSend = send;

    // delay send bus
    const dSend = ctx.createGain();
    dSend.gain.value = 1;
    const delay = ctx.createDelay(1.5);
    delay.delayTime.value = 0.32;
    const fb = ctx.createGain();
    fb.gain.value = 0.35;
    dSend.connect(delay);
    delay.connect(fb);
    fb.connect(delay);
    const delayReturn = ctx.createGain();
    delay.connect(delayReturn);
    const delayMeter = ctx.createAnalyser();
    delayMeter.fftSize = 1024;
    delayReturn.connect(delayMeter);
    delayMeter.connect(master);
    this.auxMeters.set("delay", delayMeter);
    delayReturn.gain.value = this.auxStates["delay"]?.muted ? 0 : this.auxStates["delay"]?.volume ?? 1;
    this.auxReturns.set("delay", delayReturn);
    this.delaySend = dSend;
    this.sendOut.set("delay", delay);
    this.sendFeedback.set("delay", fb);

    // chorus send bus
    const cSend = ctx.createGain();
    cSend.gain.value = 1;
    const cDelay = ctx.createDelay(0.05);
    cDelay.delayTime.value = 0.018;
    const lfo = ctx.createOscillator();
    const lfoGain = ctx.createGain();
    lfo.frequency.value = 0.5;
    lfoGain.gain.value = 0.006;
    lfo.connect(lfoGain);
    lfoGain.connect(cDelay.delayTime);
    lfo.start();
    cSend.connect(cDelay);
    const chorusReturn = ctx.createGain();
    cDelay.connect(chorusReturn);
    const chorusMeter = ctx.createAnalyser();
    chorusMeter.fftSize = 1024;
    chorusReturn.connect(chorusMeter);
    chorusMeter.connect(master);
    this.auxMeters.set("chorus", chorusMeter);
    chorusReturn.gain.value = this.auxStates["chorus"]?.muted ? 0 : this.auxStates["chorus"]?.volume ?? 1;
    this.auxReturns.set("chorus", chorusReturn);
    this.chorusSend = cSend;
    this.sendOut.set("chorus", cDelay);
    this.sendOut.set("reverb", conv);


    for (const id of ["drums", "vocals", "instruments", "synths", "fx", "master"]) {
      const g = ctx.createGain();
      g.gain.value = id === "master" ? 1 : this.busStates[id]?.muted ? 0 : this.busStates[id]?.volume ?? 1;
      const busScope = ctx.createAnalyser();
      busScope.fftSize = 1024;
      busScope.smoothingTimeConstant = 0.6;
      const busMeter = ctx.createAnalyser();
      busMeter.fftSize = 1024;
      g.connect(busScope);
      busScope.connect(busMeter);
      busMeter.connect(master);
      this.pluginScopes.set(`bus:${id}`, busScope);
      this.busMeters.set(id, busMeter);
      this.buses.set(id, g);
    }
    // Meter VCA members without routing this tap to the speakers a second time.
    for (const id of ["A", "B", "C", "D"]) {
      const meter = ctx.createAnalyser();
      meter.fftSize = 1024;
      const silentSink = ctx.createGain();
      silentSink.gain.value = 0;
      meter.connect(silentSink);
      silentSink.connect(ctx.destination);
      this.vcaMeters.set(id, meter);
    }
  }

  /**
   * Voice saturation curve. Normal voices always carry a little warmth; clean voices skip it,
   * but still distort once DRIVE / DISTORTION / SATURATION are turned up, so those knobs keep working.
   */
  private voiceCurve(patch: SynthPatch) {
    const key = voiceDriveAmount(patch).toFixed(2);
    let curve = this.voiceCurves.get(key);
    if (!curve) { curve = voiceSaturationCurve(Number(key)); this.voiceCurves.set(key, curve); }
    return curve;
  }
  private voiceCurves = new Map<string, Float32Array>();

  private distortionCurve(amount: number) {
    const key = clamp(amount, 0, 1).toFixed(2);
    const cached = this.distortionCurves.get(key);
    if (cached) return cached;
    const curve = makeDistortionCurve(Number(key));
    this.distortionCurves.set(key, curve);
    return curve;
  }

  /* ---------------- live performance insert (post-master) ---------------- */
  private masterInsert: { input: AudioNode; output: AudioNode } | null = null;

  /** Routes the master through a performance chain before the meters/speakers. */
  setMasterInsert(chain: { input: AudioNode; output: AudioNode } | null) {
    this.init();
    if (!this.master || !this.analyser) return;
    try { this.master.disconnect(this.analyser); } catch { /* not connected */ }
    if (this.masterInsert) {
      try { this.master.disconnect(this.masterInsert.input); } catch { /* */ }
      try { this.masterInsert.output.disconnect(this.analyser); } catch { /* */ }
    }
    this.masterInsert = chain;
    if (chain) {
      this.master.connect(chain.input);
      chain.output.connect(this.analyser);
    } else {
      this.master.connect(this.analyser);
    }
  }

  /** Final signal that reaches the speakers (after live FX). */
  get outputNode(): AudioNode | null {
    return this.masterInsert?.output ?? this.master;
  }

  /** Stable final tap (after master FX, mutes and bypass); survives master-chain rebuilds, unlike outputNode. */
  get songTap(): AudioNode | null {
    return this.analyser ?? this.outputNode;
  }

  /* ---------------- master capture (bounce / export) ---------------- */
  private capture: {
    proc: ScriptProcessorNode;
    /** the node actually feeding the capture, so Stop disconnects that same node */
    source: AudioNode;
    sink: GainNode;
    left: Float32Array[];
    right: Float32Array[];
    frames: number;
  } | null = null;

  /** Start recording the main output in real time. */
  startCapture() {
    const ctx = this.init();
    if (this.capture || !this.master) return;
    const proc = ctx.createScriptProcessor(4096, 2, 2);
    const left: Float32Array[] = [];
    const right: Float32Array[] = [];
    const source = this.outputNode ?? this.master;
    const cap = { proc, source, sink: ctx.createGain(), left, right, frames: 0 };
    proc.onaudioprocess = (e) => {
      const l = e.inputBuffer.getChannelData(0);
      const r = e.inputBuffer.numberOfChannels > 1 ? e.inputBuffer.getChannelData(1) : l;
      left.push(new Float32Array(l));
      right.push(new Float32Array(r));
      cap.frames += l.length;
    };
    cap.sink.gain.value = 0;
    source.connect(proc);
    proc.connect(cap.sink);
    cap.sink.connect(ctx.destination);
    this.capture = cap;
  }

  get capturedSeconds() {
    if (!this.capture || !this.ctx) return 0;
    return this.capture.frames / this.ctx.sampleRate;
  }

  get capturing() {
    return this.capture !== null;
  }

  /** Stop capture and return the interleaved-free stereo buffers. */
  stopCapture(): { left: Float32Array; right: Float32Array; sampleRate: number } | null {
    const cap = this.capture;
    if (!cap || !this.ctx || !this.master) return null;
    this.capture = null;
    cap.proc.onaudioprocess = null;
    try {
      cap.source.disconnect(cap.proc);
    } catch {
      /* already detached */
    }
    cap.proc.disconnect();
    cap.sink.disconnect();
    const join = (chunks: Float32Array[]) => {
      const out = new Float32Array(cap.frames);
      let o = 0;
      for (const c of chunks) {
        out.set(c, o);
        o += c.length;
      }
      return out;
    };
    return { left: join(cap.left), right: join(cap.right), sampleRate: this.ctx.sampleRate };
  }

  busNode(id: string) {
    this.init();
    return this.buses.get(id) ?? this.buses.get("master")!;
  }

  setBus(id: string, volume: number, muted: boolean, gain = 1) {
    this.busStates[id] = { volume, muted, gain };
    if (!this.ctx) return;
    // The master fader controls the complete mix, including every bus and FX return.
    // The "master" routing bus stays at unity so direct tracks are not attenuated twice.
    if (id === "master") {
      this.master?.gain.setTargetAtTime(muted ? 0 : 0.85 * clamp(volume, 0, 2) * clamp(gain, 0, 2), this.ctx.currentTime, 0.02);
      return;
    }
    this.busNode(id).gain.setTargetAtTime(muted ? 0 : clamp(volume, 0, 2), this.ctx.currentTime, 0.02);
    // Sends leave the track before the subgroup, so follow its fader/mute too.
    for (const track of this.mixTracks) {
      if ((track.bus ?? "master") !== id) continue;
      const ch = this.channels.get(track.id);
      if (ch) this.syncTrackSends(ch, track, this.ctx.currentTime);
    }
  }

  private syncTrackSends(ch: ChannelStrip, track: Track, time: number) {
    if (!this.ctx) return;
    const bus = this.busStates[track.bus ?? "master"];
    const scale = track.bus === "master" || !bus ? 1 : bus.muted ? 0 : clamp(bus.volume, 0, 2);
    const sends = track.sends ?? { reverb: 0, delay: 0, chorus: 0 };
    ch.sendReverb.gain.setTargetAtTime(clamp(sends.reverb * scale, 0, 1.5), time, 0.02);
    ch.sendDelay.gain.setTargetAtTime(clamp(sends.delay * scale, 0, 1.5), time, 0.02);
    ch.sendChorus.gain.setTargetAtTime(clamp(sends.chorus * scale, 0, 1.5), time, 0.02);
  }

  setAuxReturn(id: string, volume: number, muted: boolean) {
    this.auxStates[id] = { volume, muted };
    const node = this.auxReturns.get(id);
    if (!node || !this.ctx) return;
    node.gain.setTargetAtTime(muted ? 0 : clamp(volume, 0, 2), this.ctx.currentTime, 0.02);
  }

  setVcaStates(states: Record<string, { volume: number; muted: boolean }>, tracks: Track[]) {
    this.vcaStates = states;
    this.syncMix(tracks);
  }

  getLevel() {
    return this.peakOf(this.analyser);
  }

  /** Long-window peak taps beside each meter/scope analyser, so short hits between 20 fps reads still register. */
  private peakTaps = new WeakMap<AnalyserNode, AnalyserNode>();
  private peakSink: GainNode | null = null;
  private peakBuf: Float32Array<ArrayBuffer> | null = null;

  private peakOf(node: AnalyserNode | null | undefined) {
    const ctx = this.ctx;
    if (!node || !ctx) return 0;
    let tap = this.peakTaps.get(node);
    if (!tap) {
      tap = ctx.createAnalyser();
      tap.fftSize = meterWindowSize(ctx.sampleRate);
      tap.smoothingTimeConstant = 0;
      if (!this.peakSink || this.peakSink.context !== ctx) {
        // Silent pull so every browser keeps processing the dead-end taps.
        this.peakSink = ctx.createGain();
        this.peakSink.gain.value = 0;
        this.peakSink.connect(ctx.destination);
      }
      node.connect(tap);
      tap.connect(this.peakSink);
      this.peakTaps.set(node, tap);
    }
    if (!this.peakBuf || this.peakBuf.length !== tap.fftSize) this.peakBuf = new Float32Array(tap.fftSize);
    const data = this.peakBuf;
    tap.getFloatTimeDomainData(data);
    let peak = 0;
    for (let i = 0; i < data.length; i++) { const a = Math.abs(data[i]!); if (a > peak) peak = a; }
    return peak;
  }

  getBusLevel(id: string) { return this.peakOf(this.busMeters.get(id)); }

  getAuxLevel(id: string) { return this.peakOf(this.auxMeters.get(id)); }

  getVcaLevel(id: string) { return this.peakOf(this.vcaMeters.get(id)); }

  /** Real post-master audio for one channel (0 = left, 1 = right); buffers are reused, so copy if you keep them. */
  getMasterChannel(ch: 0 | 1, kind: "wave" | "spectrum"): Float32Array | null {
    const an = ch === 0 ? this.masterL : this.masterR;
    if (!an) return null;
    const key = `${ch}${kind}`;
    const len = kind === "wave" ? an.fftSize : an.frequencyBinCount;
    let buf = this.masterBufs.get(key);
    if (!buf || buf.length !== len) { buf = new Float32Array(len); this.masterBufs.set(key, buf); }
    if (kind === "wave") an.getFloatTimeDomainData(buf as Float32Array<ArrayBuffer>);
    else an.getFloatFrequencyData(buf as Float32Array<ArrayBuffer>);
    return buf;
  }

  get audioState(): AudioContextState | "off" {
    return this.ctx?.state ?? "off";
  }

  get sampleRate() {
    return this.ctx?.sampleRate ?? 48000;
  }

  /** Post-EQ magnitude spectrum in dB for a Pro-EQ instance, or null when it is not running. */
  getEqSpectrum(pluginId: string): Float32Array | null {
    const an = this.eqAnalysers.get(pluginId);
    if (!an) return null;
    const data = new Float32Array(an.frequencyBinCount);
    an.getFloatFrequencyData(data);
    return data;
  }

  /**
   * Live detail data for the expanded scope window: an 8192-point analyser branched off the
   * same post-insert / channel / bus / master tap the small scopes read. The branch is a dead
   * end (analysers are pulled automatically), so it never changes what you hear. When the
   * channel is rebuilt the branch follows the new tap.
   */
  getDetailScope(scopeId: string, kind: "wave" | "spectrum"): Float32Array | null {
    const source = this.pluginScopes.get(scopeId);
    const ctx = this.ctx;
    if (!source || !ctx) { if (this.detail && this.detail.id !== scopeId) this.releaseDetailScope(); return null; }
    if (!this.detail || this.detail.id !== scopeId || this.detail.source !== source) {
      this.releaseDetailScope();
      const node = ctx.createAnalyser();
      node.fftSize = 8192;
      node.smoothingTimeConstant = 0.72;
      source.connect(node);
      this.detail = { id: scopeId, source, node, wave: new Float32Array(node.fftSize), spec: new Float32Array(node.frequencyBinCount) };
    }
    const d = this.detail;
    if (kind === "wave") { d.node.getFloatTimeDomainData(d.wave as Float32Array<ArrayBuffer>); return d.wave; }
    d.node.getFloatFrequencyData(d.spec as Float32Array<ArrayBuffer>);
    return d.spec;
  }

  /** Disconnect only the expanded-window branch; the source tap keeps its other connections. */
  releaseDetailScope() {
    const d = this.detail;
    this.detail = null;
    if (!d) return;
    try { d.source.disconnect(d.node); } catch { /* source already rebuilt */ }
  }

  /** Output waveform of one effect insert, or null when that effect is not running. */
  getScopeWave(scopeId: string): Float32Array | null {
    const an = this.pluginScopes.get(scopeId);
    if (!an) return null;
    const data = new Float32Array(an.fftSize);
    an.getFloatTimeDomainData(data);
    return data;
  }

  /** Output magnitude spectrum (dB) of one effect insert. */
  getScopeSpectrum(scopeId: string): Float32Array | null {
    const an = this.pluginScopes.get(scopeId);
    if (!an) return null;
    const data = new Float32Array(an.frequencyBinCount);
    an.getFloatFrequencyData(data);
    return data;
  }

  getTrackLevel(id: string) {
    const ch = this.channels.get(id);
    return this.peakOf(ch?.meter);
  }

  /** Restore mixer routing and inserts when Stop has retired a playback channel. */
  private playbackChannel(id: string): ChannelStrip {
    if (!this.channels.has(id)) {
      this.syncMix(this.mixTracks);
      const track = this.mixTracks.find(track => track.id === id);
      if (track) this.setInserts(id, track.plugins ?? []);
    }
    return this.channel(id);
  }

  channel(id: string): ChannelStrip {
    const ctx = this.init();
    let ch = this.channels.get(id);
    if (!ch) {
      const input = ctx.createGain();
      const trim = ctx.createGain();
      const gain = ctx.createGain();
      const pan = ctx.createStereoPanner();
      const meter = ctx.createAnalyser();
      meter.fftSize = 1024;
      meter.smoothingTimeConstant = 0.55;
      // channel meter doubles as the strip scope source
      this.pluginScopes.set(`ch:${id}`, meter);
      input.connect(trim);
      trim.connect(gain);
      const insertOut = ctx.createGain();
      gain.connect(insertOut);
      insertOut.connect(meter);
      meter.connect(pan);
      pan.connect(this.busNode("master"));
      const sendReverb = ctx.createGain();
      const sendDelay = ctx.createGain();
      const sendChorus = ctx.createGain();
      sendReverb.gain.value = 0;
      sendDelay.gain.value = 0;
      sendChorus.gain.value = 0;
      pan.connect(sendReverb);
      pan.connect(sendDelay);
      pan.connect(sendChorus);
      if (this.reverbSend) sendReverb.connect(this.reverbSend);
      if (this.delaySend) sendDelay.connect(this.delaySend);
      if (this.chorusSend) sendChorus.connect(this.chorusSend);
      // Independent destinations prevent one patch effect from exciting both returns.
      const synthReverbScale = ctx.createGain();
      const synthChorusScale = ctx.createGain();
      synthReverbScale.gain.value = 1;
      synthChorusScale.gain.value = 1;
      if (this.reverbSend) synthReverbScale.connect(this.reverbSend);
      if (this.chorusSend) synthChorusScale.connect(this.chorusSend);
      ch = { input, trim, gain, pan, meter, sendReverb, sendDelay, sendChorus, synthReverbScale, synthChorusScale, bus: "master", insertNodes: [], insertKey: "", insertOut };
      this.channels.set(id, ch);
    }
    return ch;
  }

  /** Rebuild the insert (plugin) chain between gain and meter for a track. */
  /** Turning a knob on a running effect: update it in place when every changed
   *  knob has a live setter, so playback and effect tails never drop out. */
  private tryLiveUpdate(targetId: string, active: PluginInstance[], prevKey: string): boolean {
    const ctx = this.ctx;
    if (!ctx || !prevKey) return false;
    let prev: [string, string, number[]][];
    try { prev = JSON.parse(this.insertParamMap.get(targetId) ?? "null"); } catch { return false; }
    if (!prev || prev.length !== active.length) return false;
    const changes: (() => void)[] = [];
    const t = ctx.currentTime;
    for (let i = 0; i < active.length; i++) {
      const pl = active[i]!;
      const [id, kind, values] = prev[i]!;
      if (id !== pl.id || kind !== pl.kind || values.length !== pl.params.length) return false;
      for (let j = 0; j < pl.params.length; j++) {
        const p = pl.params[j]!;
        if (p.value === values[j]) continue;
        const fn = this.liveParams.get(`${targetId}:${pl.id}:${p.id}`);
        if (!fn) return false;
        changes.push(() => fn(p.value, t));
      }
    }
    for (const c of changes) c();
    return true;
  }

  private rememberParams(targetId: string, active: PluginInstance[]) {
    this.insertParamMap.set(targetId, JSON.stringify(active.map((pl) => [pl.id, pl.kind, pl.params.map((x) => x.value)])));
  }

  setInserts(trackId: string, plugins: PluginInstance[]) {
    const ctx = this.init();
    const ch = this.channel(trackId);
    // Store edits are immutable; note/name changes retain the rack reference.
    if (this.insertInputs.get(ch) === plugins) return;
    this.insertInputs.set(ch, plugins);
    const active = plugins.filter((pl) => !pl.bypass);
    const key = JSON.stringify(active.map((pl) => [pl.kind, pl.params.map((x) => x.value)]));
    if (key === ch.insertKey) return;
    if (this.tryLiveUpdate(trackId, active, ch.insertKey)) {
      ch.insertKey = key;
      this.rememberParams(trackId, active);
      return;
    }
    this.rememberParams(trackId, active);
    ch.insertKey = key;

    const oldOut = ch.insertOut;
    const oldNodes = ch.insertNodes;
    for (const key of [...this.automatedPluginParams.keys()]) if (key.startsWith(`${trackId}:`)) this.automatedPluginParams.delete(key);
    const nodes = this.buildInsertNodes(ctx, active, trackId);
    ch.insertNodes = nodes;
    const nextOut = ctx.createGain();
    nextOut.gain.setValueAtTime(0, ctx.currentTime);
    ch.gain.connect(nextOut);
    this.linkInsertChain(nextOut, nodes, active, ch.meter);
    ch.insertOut = nextOut;
    nextOut.gain.linearRampToValueAtTime(1, ctx.currentTime + 0.015);
    oldOut.gain.setValueAtTime(oldOut.gain.value, ctx.currentTime);
    oldOut.gain.linearRampToValueAtTime(0, ctx.currentTime + 0.015);
    window.setTimeout(() => {
      try { ch.gain.disconnect(oldOut); oldOut.disconnect(); } catch { /* already disconnected */ }
      for (const n of oldNodes) try { n.disconnect(); } catch { /* already disconnected */ }
    }, 40);
  }

  /** Inserts on a bus ("bus:drums") or an FX send ("send:reverb"). */
  setFxInserts(targetId: string, plugins: PluginInstance[]) {
    const ctx = this.init();
    const master = this.master;
    if (!master) return;
    const [kind = "", name = ""] = targetId.split(":");
    const source: AudioNode | null =
      kind === "bus"
        ? (this.pluginScopes.get(`bus:${name}`) ?? this.busNode(name))
        : name === "reverb"
          ? this.reverb
          : name === "delay"
            ? this.sendOut.get("delay") ?? null
            : this.sendOut.get("chorus") ?? null;
    if (!source) return;

    const active = plugins.filter((pl) => !pl.bypass);
    const key = JSON.stringify(active.map((pl) => [pl.kind, pl.params.map((x) => x.value)]));
    const prev = this.fxInserts.get(targetId);
    if (prev?.key === key) return;
    if (prev && this.tryLiveUpdate(targetId, active, prev.key)) {
      prev.key = key;
      this.rememberParams(targetId, active);
      return;
    }
    this.rememberParams(targetId, active);

    // The source is disconnected only on its first insert. Subsequent edits
    // crossfade two parallel paths; disconnecting it every time cuts the sound.
    if (!prev) {
      source.disconnect();
      if (kind === "send" && name === "delay") {
        const fb = this.sendFeedback.get("delay");
        if (fb) source.connect(fb);
      }
    }
    for (const key of [...this.automatedPluginParams.keys()]) if (key.startsWith(`${targetId}:`)) this.automatedPluginParams.delete(key);
    const nodes = this.buildInsertNodes(ctx, active, targetId);
    const input = ctx.createGain();
    input.gain.setValueAtTime(0, ctx.currentTime);
    source.connect(input);
    this.linkInsertChain(input, nodes, active, kind === "send" ? this.auxReturns.get(name) ?? master : this.busMeters.get(name) ?? master);
    this.fxInserts.set(targetId, { key, nodes, input });
    input.gain.linearRampToValueAtTime(1, ctx.currentTime + 0.02);
    if (prev) {
      prev.input.gain.cancelScheduledValues(ctx.currentTime);
      prev.input.gain.setValueAtTime(prev.input.gain.value, ctx.currentTime);
      prev.input.gain.linearRampToValueAtTime(0, ctx.currentTime + 0.02);
      window.setTimeout(() => {
        try { source.disconnect(prev.input); prev.input.disconnect(); } catch { /* already detached */ }
        for (const node of prev.nodes) try { node.disconnect(); } catch { /* already detached */ }
      }, 45);
    }
  }

  private linkInsertChain(from: AudioNode, nodes: AudioNode[], active: PluginInstance[], to: AudioNode) {
    let cursor: AudioNode = from;
    let idx = 0;
    for (const pl of active) {
      const size = {
        eq: 4,
        paraeq: 10,
        filter: 5,
        drive: 7,
        compressor: 3,
        delay: 7,
        width: 3,
        gain: 3,
        reverb: 7,
        chorus: 5,
        flanger: 5,
        phaser: 3,
        tremolo: 2,
        autopan: 1,
        limiter: 3,
        bitcrusher: 6,
        vocoder: 2,
        gate: 3,
        stepfilter: 5,
        resonator: 12,
        scalechord: 1,
        transient: 5,
      }[pl.kind as string] ?? (isCreativeKind(pl.kind) ? 2 : 0);
      const head = nodes[idx];
      const tail = nodes[idx + size - 1];
      if (head && tail) {
        cursor.connect(head);
        cursor = tail;
        const ctx = this.ctx;
        if (ctx) {
          const scope = ctx.createAnalyser();
          scope.fftSize = 1024;
          scope.smoothingTimeConstant = 0.7;
          tail.connect(scope);
          this.pluginScopes.set(pl.id, scope);
          cursor = scope;
        }
      }
      idx += size;
    }
    cursor.connect(to);
  }

  private buildInsertNodes(ctx: AudioContext, active: PluginInstance[], targetId: string) {
    const nodes: AudioNode[] = [];
    const val = (pl: PluginInstance, id: string, fallback: number) =>
      pl.params.find((x) => x.id === id)?.value ?? fallback;
    const dbToGain = (db: number) => Math.pow(10, db / 20);
    const bind = (pl: PluginInstance, id: string, param: AudioParam, min: number, max: number, logarithmic = false) =>
      this.automatedPluginParams.set(`${targetId}:${pl.id}:${id}`, { param, min, max, logarithmic });
    const live = (pl: PluginInstance, id: string, fn: (v: number, t: number) => void) =>
      this.liveParams.set(`${targetId}:${pl.id}:${id}`, fn);
    const glide = (param: AudioParam, v: number, t: number) => param.setTargetAtTime(v, t, 0.015);
    const LFO_SHAPES: OscillatorType[] = ["sine", "triangle", "square"];
    const lfoShape = (v: number) => LFO_SHAPES[clamp(Math.round(v), 0, 2)] ?? "sine";
    const dbLive = (pl: PluginInstance, id: string, node: GainNode, fallback = 0) => {
      node.gain.value = dbToGain(val(pl, id, fallback));
      live(pl, id, (v, t) => glide(node.gain, dbToGain(v), t));
    };
    const mixLive = (pl: PluginInstance, wet: GainNode, dry: GainNode, fallback = 1) => {
      const m = clamp(val(pl, "mix", fallback), 0, 1);
      wet.gain.value = m; dry.gain.value = 1 - m;
      live(pl, "mix", (v, t) => { const x = clamp(v, 0, 1); glide(wet.gain, x, t); glide(dry.gain, 1 - x, t); });
    };
    for (const k of [...this.liveParams.keys()]) if (k.startsWith(`${targetId}:`)) this.liveParams.delete(k);
    /** Heavy live changes (new reverb impulse) run at most every `ms` while a knob is dragged, plus once at the end. */
    const throttled = (fn: (v: number) => void, ms = 140) => {
      let timer: ReturnType<typeof setTimeout> | null = null;
      let pending: number | null = null;
      const run = (v: number) => {
        if (timer) { pending = v; return; }
        fn(v);
        timer = setTimeout(() => { timer = null; if (pending !== null) { const next = pending; pending = null; run(next); } }, ms);
      };
      return run;
    };
    /** Swap a convolver's impulse while playing: the old one stops taking input but rings out its tail. */
    const swapConvolver = (from: AudioNode, to: AudioNode, first: ConvolverNode, make: (v: number) => AudioBuffer, ringSec: (v: number) => number, initial: number) => {
      let current = first;
      let ring = ringSec(initial);
      return throttled((v: number) => {
        const next = ctx.createConvolver();
        next.buffer = make(v);
        next.connect(to);
        from.connect(next);
        const old = current;
        current = next;
        try { from.disconnect(old); } catch { /* already gone */ }
        setTimeout(() => { try { old.disconnect(); } catch { /* already gone */ } }, ring * 1000 + 250);
        ring = ringSec(v);
      });
    };


    for (const pl of active) {
      // Real desktop plugins run in the native host; until it's attached they pass audio through
      // untouched instead of being imitated by a built-in effect.
      if (nativeInsertMode(pl, false) !== "builtin") continue;
      switch (pl.kind) {
        case "eq": {
          const low = ctx.createBiquadFilter();
          low.type = "lowshelf";
          low.frequency.value = 180;
          low.gain.value = val(pl, "low", 0);
          const mid = ctx.createBiquadFilter();
          mid.type = "peaking";
          mid.frequency.value = val(pl, "midFreq", 900);
          mid.Q.value = 1;
          mid.gain.value = val(pl, "mid", 0);
          const high = ctx.createBiquadFilter();
          high.type = "highshelf";
          high.frequency.value = 4500;
          high.gain.value = val(pl, "high", 0);
          const out = ctx.createGain();
          out.gain.value = dbToGain(val(pl, "mix", 0));
          low.connect(mid);
          mid.connect(high);
          high.connect(out);
          live(pl, "low", (v, t) => glide(low.gain, v, t));
          live(pl, "mid", (v, t) => glide(mid.gain, v, t));
          live(pl, "midFreq", (v, t) => glide(mid.frequency, v, t));
          live(pl, "high", (v, t) => glide(high.gain, v, t));
          live(pl, "mix", (v, t) => glide(out.gain, dbToGain(v), t));
          nodes.push(low, mid, high, out);
          break;
        }
        case "paraeq": {
          const types: BiquadFilterType[] = ["lowshelf", "highpass", "peaking", "notch", "highshelf", "lowpass"];
          const bands: BiquadFilterNode[] = [];
          for (let i = 1; i <= 8; i++) {
            const f = ctx.createBiquadFilter();
            const on = val(pl, `b${i}on`, 0) >= 0.5;
            const t = types[clamp(Math.round(val(pl, `b${i}type`, 2)), 0, 5)] ?? "peaking";
            f.type = on ? t : "peaking";
            f.frequency.value = clamp(val(pl, `b${i}freq`, 1000), 20, 20000);
            f.Q.value = clamp(val(pl, `b${i}q`, 1), 0.1, 18);
            f.gain.value = on ? clamp(val(pl, `b${i}gain`, 0), -30, 30) : 0;
            bands.push(f);
            // Every band control updates the running filter, so sweeping an EQ never rebuilds it.
            const band = { on: val(pl, `b${i}on`, 0), type: val(pl, `b${i}type`, 2), gain: val(pl, `b${i}gain`, 0) };
            const applyBand = (t: number) => {
              const isOn = band.on >= 0.5;
              const kind = types[clamp(Math.round(band.type), 0, 5)] ?? "peaking";
              const nextType = isOn ? kind : "peaking";
              if (f.type !== nextType) f.type = nextType;
              glide(f.gain, isOn ? clamp(band.gain, -30, 30) : 0, t);
            };
            live(pl, `b${i}on`, (v, t) => { band.on = v; applyBand(t); });
            live(pl, `b${i}type`, (v, t) => { band.type = v; applyBand(t); });
            live(pl, `b${i}gain`, (v, t) => { band.gain = v; applyBand(t); });
            live(pl, `b${i}freq`, (v, t) => glide(f.frequency, clamp(v, 20, 20000), t));
            live(pl, `b${i}q`, (v, t) => glide(f.Q, clamp(v, 0.1, 18), t));
          }
          const out = ctx.createGain();
          dbLive(pl, "output", out);
          const spectrum = ctx.createAnalyser();
          spectrum.fftSize = 2048;
          spectrum.smoothingTimeConstant = 0.72;
          for (let i = 0; i < bands.length - 1; i++) bands[i]!.connect(bands[i + 1]!);
          bands[bands.length - 1]!.connect(out);
          out.connect(spectrum);
          this.eqAnalysers.set(pl.id, spectrum);
          nodes.push(...bands, out, spectrum);
          break;
        }
        case "filter": {
          const f = ctx.createBiquadFilter();
          const mode = Math.round(val(pl, "type", 0));
          f.type = mode === 1 ? "highpass" : mode === 2 ? "bandpass" : "lowpass";
          f.frequency.value = val(pl, "cutoff", 8000);
          f.Q.value = val(pl, "resonance", 1);
          bind(pl, "cutoff", f.frequency, 60, 18000, true);
          bind(pl, "resonance", f.Q, 0.1, 20);
          live(pl, "cutoff", (v, t) => glide(f.frequency, v, t));
          live(pl, "resonance", (v, t) => glide(f.Q, v, t));
          live(pl, "type", (v) => { const m = Math.round(v); f.type = m === 1 ? "highpass" : m === 2 ? "bandpass" : "lowpass"; });
          const fIn = ctx.createGain(), fWet = ctx.createGain(), fDry = ctx.createGain(), fOut = ctx.createGain();
          dbLive(pl, "input", fIn); dbLive(pl, "output", fOut); mixLive(pl, fWet, fDry);
          fIn.connect(f); f.connect(fWet); fWet.connect(fOut); fIn.connect(fDry); fDry.connect(fOut);
          nodes.push(fIn, f, fWet, fDry, fOut);
          break;
        }
        case "drive": {
          const ws = ctx.createWaveShaper();
          ws.curve = makeDistortionCurve(clamp(val(pl, "drive", 0.3), 0, 1));
          ws.oversample = "2x";
          const tone = ctx.createBiquadFilter();
          tone.type = "lowpass";
          tone.frequency.value = val(pl, "tone", 6000);
          const out = ctx.createGain();
          out.gain.value = dbToGain(val(pl, "output", 0));
          const dIn = ctx.createGain(), hp = ctx.createBiquadFilter(), dWet = ctx.createGain(), dDry = ctx.createGain();
          hp.type = "highpass"; hp.frequency.value = clamp(val(pl, "lowcut", 20), 20, 1000);
          dbLive(pl, "input", dIn); mixLive(pl, dWet, dDry);
          dIn.connect(hp); hp.connect(ws);
          ws.connect(tone);
          tone.connect(dWet); dWet.connect(out); dIn.connect(dDry); dDry.connect(out);
          live(pl, "drive", (v) => { ws.curve = makeDistortionCurve(clamp(v, 0, 1)); });
          live(pl, "tone", (v, t) => glide(tone.frequency, v, t));
          live(pl, "lowcut", (v, t) => glide(hp.frequency, clamp(v, 20, 1000), t));
          live(pl, "output", (v, t) => glide(out.gain, dbToGain(v), t));
          nodes.push(dIn, hp, ws, tone, dWet, dDry, out);
          break;
        }
        case "compressor": {
          const c = ctx.createDynamicsCompressor();
          c.threshold.value = val(pl, "threshold", -18);
          c.ratio.value = val(pl, "ratio", 4);
          c.attack.value = val(pl, "attack", 8) / 1000;
          c.release.value = val(pl, "release", 140) / 1000;
          const out = ctx.createGain();
          out.gain.value = dbToGain(val(pl, "makeup", 0));
          c.connect(out);
          live(pl, "threshold", (v, t) => glide(c.threshold, v, t));
          live(pl, "ratio", (v, t) => glide(c.ratio, v, t));
          live(pl, "attack", (v, t) => glide(c.attack, v / 1000, t));
          live(pl, "release", (v, t) => glide(c.release, v / 1000, t));
          live(pl, "makeup", (v, t) => glide(out.gain, dbToGain(v), t));
          c.knee.value = clamp(val(pl, "knee", 6), 0, 40);
          live(pl, "knee", (v, t) => glide(c.knee, clamp(v, 0, 40), t));
          const cIn = ctx.createGain(); dbLive(pl, "input", cIn); cIn.connect(c);
          nodes.push(cIn, c, out);
          break;
        }
        case "delay": {
          const inNode = ctx.createGain();
          const d = ctx.createDelay(2);
          d.delayTime.value = clamp(val(pl, "time", 320) / 1000, 0.01, 2);
          const fb = ctx.createGain();
          fb.gain.value = clamp(val(pl, "feedback", 0.35), 0, 0.92);
          const wet = ctx.createGain();
          wet.gain.value = clamp(val(pl, "mix", 0.25), 0, 1);
          const out = ctx.createGain();
          inNode.connect(out);
          inNode.connect(d);
          const lp = ctx.createBiquadFilter(); lp.type = "lowpass"; lp.frequency.value = clamp(val(pl, "tone", 12000), 800, 18000);
          const hp = ctx.createBiquadFilter(); hp.type = "highpass"; hp.frequency.value = clamp(val(pl, "lowcut", 40), 20, 2000);
          d.connect(lp); lp.connect(hp);
          hp.connect(fb);
          fb.connect(d);
          hp.connect(wet);
          wet.connect(out);
          dbLive(pl, "output", out);
          live(pl, "time", (v, t) => d.delayTime.setTargetAtTime(clamp(v / 1000, 0.01, 2), t, 0.05));
          live(pl, "feedback", (v, t) => glide(fb.gain, clamp(v, 0, 0.92), t));
          live(pl, "mix", (v, t) => glide(wet.gain, clamp(v, 0, 1), t));
          live(pl, "tone", (v, t) => glide(lp.frequency, clamp(v, 800, 18000), t));
          live(pl, "lowcut", (v, t) => glide(hp.frequency, clamp(v, 20, 2000), t));
          nodes.push(inNode, d, lp, hp, fb, wet, out);
          break;
        }
        case "width": {
          // Mid/side width: L' = M + S*w, R' = M - S*w.
          const input = ctx.createGain();
          input.channelCount = 2; input.channelCountMode = "explicit";
          const split = ctx.createChannelSplitter(2);
          const merge = ctx.createChannelMerger(2);
          const mid = ctx.createGain(); mid.gain.value = 0.5;
          const sideL = ctx.createGain(); sideL.gain.value = 0.5;
          const sideR = ctx.createGain(); sideR.gain.value = -0.5;
          const side = ctx.createGain();
          const sideOutL = ctx.createGain();
          const sideOutR = ctx.createGain(); sideOutR.gain.value = -1;
          const w = ctx.createGain();
          const setW = (v: number, t?: number) => { const g = clamp(v, 0, 2); if (t === undefined) side.gain.value = g; else glide(side.gain, g, t); };
          setW(val(pl, "width", 1));
          input.connect(split);
          split.connect(mid, 0); split.connect(mid, 1);
          split.connect(sideL, 0); split.connect(sideR, 1);
          sideL.connect(side); sideR.connect(side);
          side.connect(sideOutL); side.connect(sideOutR);
          mid.connect(merge, 0, 0); mid.connect(merge, 0, 1);
          sideOutL.connect(merge, 0, 0); sideOutR.connect(merge, 0, 1);
          merge.connect(w);
          w.gain.value = dbToGain(val(pl, "output", 0));
          live(pl, "width", (v, t) => setW(v, t));
          live(pl, "output", (v, t) => glide(w.gain, dbToGain(v), t));
          const wPan = ctx.createStereoPanner(); wPan.pan.value = clamp(val(pl, "pan", 0), -1, 1);
          live(pl, "pan", (v, t) => glide(wPan.pan, clamp(v, -1, 1), t));
          w.connect(wPan);
          nodes.push(input, w, wPan);
          break;
        }
        case "gain": {
          const g2 = ctx.createGain();
          g2.gain.value = dbToGain(val(pl, "gain", 0));
          live(pl, "gain", (v, t) => glide(g2.gain, dbToGain(v), t));
          const pol = ctx.createGain(); pol.gain.value = val(pl, "phase", 0) >= 0.5 ? -1 : 1;
          live(pl, "phase", (v, t) => glide(pol.gain, v >= 0.5 ? -1 : 1, t));
          const gPan = ctx.createStereoPanner(); gPan.pan.value = clamp(val(pl, "pan", 0), -1, 1);
          live(pl, "pan", (v, t) => glide(gPan.pan, clamp(v, -1, 1), t));
          g2.connect(pol); pol.connect(gPan);
          nodes.push(g2, pol, gPan);
          break;
        }
        case "reverb": {
          const inNode = ctx.createGain();
          const pre = ctx.createDelay(0.5);
          pre.delayTime.value = clamp(val(pl, "predelay", 20) / 1000, 0, 0.5);
          const conv = ctx.createConvolver();
          conv.buffer = makeImpulse(ctx, clamp(val(pl, "decay", 1.8), 0.2, 8));
          const wet = ctx.createGain();
          wet.gain.value = clamp(val(pl, "mix", 0.3), 0, 1);
          const out = ctx.createGain();
          inNode.connect(out);
          inNode.connect(pre);
          pre.connect(conv);
          const rHp = ctx.createBiquadFilter(); rHp.type = "highpass"; rHp.frequency.value = clamp(val(pl, "lowcut", 120), 20, 1000);
          const rLp = ctx.createBiquadFilter(); rLp.type = "lowpass"; rLp.frequency.value = clamp(val(pl, "tone", 9000), 800, 18000);
          conv.connect(rHp); rHp.connect(rLp); rLp.connect(wet);
          wet.connect(out);
          dbLive(pl, "output", out);
          live(pl, "predelay", (v, t) => glide(pre.delayTime, clamp(v / 1000, 0, 0.5), t));
          live(pl, "mix", (v, t) => glide(wet.gain, clamp(v, 0, 1), t));
          live(pl, "lowcut", (v, t) => glide(rHp.frequency, clamp(v, 20, 1000), t));
          live(pl, "tone", (v, t) => glide(rLp.frequency, clamp(v, 800, 18000), t));
          const decay = (v: number) => clamp(v, 0.2, 8);
          live(pl, "decay", swapConvolver(pre, rHp, conv, (v) => makeImpulse(ctx, decay(v)), decay, val(pl, "decay", 1.8)));
          nodes.push(inNode, pre, conv, rHp, rLp, wet, out);
          break;
        }
        case "chorus": {
          const inNode = ctx.createGain();
          const d = ctx.createDelay(0.1);
          d.delayTime.value = clamp(val(pl, "delay", 20), 5, 40) / 1000;
          const cFb = ctx.createGain(); cFb.gain.value = clamp(val(pl, "feedback", 0), 0, 0.8);
          d.connect(cFb); cFb.connect(d);
          live(pl, "delay", (v, t) => glide(d.delayTime, clamp(v, 5, 40) / 1000, t));
          live(pl, "feedback", (v, t) => glide(cFb.gain, clamp(v, 0, 0.8), t));
          const lfo = ctx.createOscillator();
          lfo.frequency.value = clamp(val(pl, "rate", 1.2), 0.05, 8);
          const lfoGain = ctx.createGain();
          lfoGain.gain.value = clamp(val(pl, "depth", 0.5), 0, 1) * 0.008;
          lfo.connect(lfoGain);
          lfoGain.connect(d.delayTime);
          lfo.start();
          const wet = ctx.createGain();
          wet.gain.value = clamp(val(pl, "mix", 0.5), 0, 1);
          const out = ctx.createGain();
          inNode.connect(out);
          inNode.connect(d);
          d.connect(wet);
          wet.connect(out);
          live(pl, "rate", (v, t) => glide(lfo.frequency, clamp(v, 0.05, 8), t));
          live(pl, "depth", (v, t) => glide(lfoGain.gain, clamp(v, 0, 1) * 0.008, t));
          live(pl, "mix", (v, t) => glide(wet.gain, clamp(v, 0, 1), t));
          nodes.push(inNode, d, cFb, wet, out);
          break;
        }
        case "flanger": {
          const inNode = ctx.createGain();
          const d = ctx.createDelay(0.05);
          d.delayTime.value = clamp(val(pl, "manual", 4), 1, 15) / 1000;
          live(pl, "manual", (v, t) => glide(d.delayTime, clamp(v, 1, 15) / 1000, t));
          const lfo = ctx.createOscillator();
          lfo.frequency.value = clamp(val(pl, "rate", 0.4), 0.05, 5);
          const lfoGain = ctx.createGain();
          lfoGain.gain.value = clamp(val(pl, "depth", 0.7), 0, 1) * 0.003;
          lfo.connect(lfoGain);
          lfoGain.connect(d.delayTime);
          lfo.start();
          const fb = ctx.createGain();
          fb.gain.value = clamp(val(pl, "feedback", 0.5), 0, 0.95);
          d.connect(fb);
          fb.connect(d);
          const wet = ctx.createGain();
          wet.gain.value = clamp(val(pl, "mix", 0.5), 0, 1);
          const out = ctx.createGain();
          inNode.connect(out);
          inNode.connect(d);
          d.connect(wet);
          wet.connect(out);
          live(pl, "rate", (v, t) => glide(lfo.frequency, clamp(v, 0.05, 5), t));
          live(pl, "depth", (v, t) => glide(lfoGain.gain, clamp(v, 0, 1) * 0.003, t));
          live(pl, "feedback", (v, t) => glide(fb.gain, clamp(v, 0, 0.95), t));
          live(pl, "mix", (v, t) => glide(wet.gain, clamp(v, 0, 1), t));
          nodes.push(inNode, d, fb, wet, out);
          break;
        }
        case "phaser": {
          const inNode = ctx.createGain();
          const out = ctx.createGain();
          const wet = ctx.createGain();
          wet.gain.value = clamp(val(pl, "mix", 0.5), 0, 1);
          const center = clamp(val(pl, "center", 800), 200, 4000);
          const depth = clamp(val(pl, "depth", 0.7), 0, 1);
          const lfo = ctx.createOscillator();
          lfo.frequency.value = clamp(val(pl, "rate", 0.5), 0.05, 8);
          const lfoGain = ctx.createGain();
          lfoGain.gain.value = center * 0.7 * depth;
          lfo.connect(lfoGain);
          const stages: BiquadFilterNode[] = [];
          let liveCenter = center, liveDepth = depth;
          let cur: AudioNode = inNode;
          const stageCount = Math.round(clamp(val(pl, "stages", 4), 2, 8));
          const q = clamp(val(pl, "resonance", 0.8), 0.2, 8);
          for (let i = 0; i < stageCount; i++) {
            const ap = ctx.createBiquadFilter();
            ap.type = "allpass";
            ap.frequency.value = center * (1 + i * 0.5);
            ap.Q.value = q;
            lfoGain.connect(ap.frequency);
            cur.connect(ap);
            cur = ap;
            stages.push(ap);
          }
          lfo.start();
          cur.connect(wet);
          inNode.connect(out);
          wet.connect(out);
          live(pl, "rate", (v, t) => glide(lfo.frequency, clamp(v, 0.05, 8), t));
          live(pl, "depth", (v, t) => { liveDepth = clamp(v, 0, 1); glide(lfoGain.gain, liveCenter * 0.7 * liveDepth, t); });
          live(pl, "center", (v, t) => { liveCenter = clamp(v, 200, 4000); stages.forEach((ap, i) => glide(ap.frequency, liveCenter * (1 + i * 0.5), t)); glide(lfoGain.gain, liveCenter * 0.7 * liveDepth, t); });
          live(pl, "mix", (v, t) => glide(wet.gain, clamp(v, 0, 1), t));
          live(pl, "resonance", (v, t) => stages.forEach((ap) => glide(ap.Q, clamp(v, 0.2, 8), t)));
          nodes.push(inNode, wet, out);
          break;
        }
        case "tremolo": {
          const g = ctx.createGain();
          const depth = clamp(val(pl, "depth", 0.6), 0, 1);
          g.gain.value = 1 - depth / 2;
          const lfo = ctx.createOscillator();
          lfo.frequency.value = clamp(val(pl, "rate", 5), 0.1, 20);
          lfo.type = lfoShape(val(pl, "shape", 0));
          live(pl, "shape", (v) => { lfo.type = lfoShape(v); });
          const lfoGain = ctx.createGain();
          lfoGain.gain.value = depth / 2;
          lfo.connect(lfoGain);
          lfoGain.connect(g.gain);
          lfo.start();
          live(pl, "rate", (v, t) => glide(lfo.frequency, clamp(v, 0.1, 20), t));
          live(pl, "depth", (v, t) => { const d = clamp(v, 0, 1); glide(g.gain, 1 - d / 2, t); glide(lfoGain.gain, d / 2, t); });
          const tOut = ctx.createGain(); dbLive(pl, "output", tOut); g.connect(tOut);
          nodes.push(g, tOut);
          break;
        }
        case "autopan": {
          const pan = ctx.createStereoPanner();
          const lfo = ctx.createOscillator();
          lfo.frequency.value = clamp(val(pl, "rate", 1), 0.05, 10);
          lfo.type = lfoShape(val(pl, "shape", 0));
          live(pl, "shape", (v) => { lfo.type = lfoShape(v); });
          pan.pan.value = clamp(val(pl, "center", 0), -1, 1);
          live(pl, "center", (v, t) => glide(pan.pan, clamp(v, -1, 1), t));
          const lfoGain = ctx.createGain();
          lfoGain.gain.value = clamp(val(pl, "depth", 0.8), 0, 1);
          lfo.connect(lfoGain);
          lfoGain.connect(pan.pan);
          lfo.start();
          live(pl, "rate", (v, t) => glide(lfo.frequency, clamp(v, 0.05, 10), t));
          live(pl, "depth", (v, t) => glide(lfoGain.gain, clamp(v, 0, 1), t));
          nodes.push(pan);
          break;
        }
        case "limiter": {
          const c = ctx.createDynamicsCompressor();
          c.threshold.value = clamp(val(pl, "ceiling", -0.3), -12, 0);
          c.knee.value = 0;
          c.ratio.value = 20;
          c.attack.value = 0.002;
          c.release.value = clamp(val(pl, "release", 60), 5, 500) / 1000;
          live(pl, "ceiling", (v, t) => glide(c.threshold, clamp(v, -12, 0), t));
          live(pl, "release", (v, t) => glide(c.release, clamp(v, 5, 500) / 1000, t));
          const lIn = ctx.createGain(), lOut = ctx.createGain();
          dbLive(pl, "input", lIn); dbLive(pl, "output", lOut);
          lIn.connect(c); c.connect(lOut);
          nodes.push(lIn, c, lOut);
          break;
        }
        case "bitcrusher": {
          const bits = Math.round(clamp(val(pl, "bits", 8), 2, 16));
          const ws = ctx.createWaveShaper();
          ws.curve = makeBitcrushCurve(bits);
          const mix = clamp(val(pl, "mix", 1), 0, 1);
          const inNode = ctx.createGain();
          const wet = ctx.createGain();
          wet.gain.value = mix;
          const dry = ctx.createGain();
          dry.gain.value = 1 - mix;
          const out = ctx.createGain();
          inNode.connect(dry);
          dry.connect(out);
          inNode.connect(ws);
          const bLp = ctx.createBiquadFilter(); bLp.type = "lowpass"; bLp.frequency.value = clamp(val(pl, "tone", 18000), 800, 18000);
          ws.connect(bLp); bLp.connect(wet);
          wet.connect(out);
          dbLive(pl, "input", inNode); dbLive(pl, "output", out);
          live(pl, "tone", (v, t) => glide(bLp.frequency, clamp(v, 800, 18000), t));
          live(pl, "bits", v => { ws.curve = makeBitcrushCurve(Math.round(clamp(v, 2, 16))); });
          live(pl, "mix", (v, t) => { const m = clamp(v, 0, 1); glide(wet.gain, m, t); glide(dry.gain, 1 - m, t); });
          nodes.push(inNode, ws, bLp, wet, dry, out);
          break;
        }
        case "vocoder": {
          // Analogue-style channel vocoder. The incoming channel signal is the
          // modulator (voice); an internal oscillator bank is the carrier.
          const inNode = ctx.createGain();
          const out = ctx.createGain();
          // internal nodes are kept off the chain array (fixed size of 2: in, out)
          const keep: AudioNode[] = [];
          const bandCount = Math.round(clamp(val(pl, "bands", 16), 8, 24));
          const wave = Math.round(clamp(val(pl, "carrier", 0), 0, 2));
          const pitch = clamp(val(pl, "pitch", 110), 40, 440);
          const detune = clamp(val(pl, "detune", 14), 0, 50);
          const formant = Math.pow(2, clamp(val(pl, "formant", 0), -12, 12) / 12);
          const response = clamp(val(pl, "response", 18), 2, 200) / 1000;
          const sense = clamp(val(pl, "sense", 1.4), 0.2, 4);
          const sib = clamp(val(pl, "sibilance", 0.35), 0, 1);
          const mix = clamp(val(pl, "mix", 1), 0, 1);
          const playKeys = Math.round(val(pl, "play", 0)) === 1;
          const glide = clamp(val(pl, "glide", 30), 0, 1000) / 1000;
          const unison = Math.round(clamp(val(pl, "unison", 3), 1, 5));
          const tone = clamp(val(pl, "tone", 9000), 500, 16000);
          const width = clamp(val(pl, "width", 1), 0.4, 3);
          const octave = Math.round(clamp(val(pl, "octave", 0), -2, 2));

          // release the previous build of this vocoder (after the insert crossfade)
          const prevCleanup = vocoderCleanups.get(pl.id);
          if (prevCleanup) setTimeout(prevCleanup, 400);

          // carrier source -> tone filter
          const carrierSum = ctx.createGain();
          const toneLp = ctx.createBiquadFilter();
          toneLp.type = "lowpass";
          toneLp.frequency.value = tone;
          toneLp.Q.value = 0.5;
          carrierSum.connect(toneLp);
          const carrier = ctx.createGain();
          carrier.gain.value = 1;
          toneLp.connect(carrier);
          keep.push(carrierSum, toneLp);
          const stoppers: (() => void)[] = [];
          let unsubscribe: (() => void) | null = null;
          if (wave === 2) {
            const len = Math.floor(ctx.sampleRate * 2);
            const buf = ctx.createBuffer(1, len, ctx.sampleRate);
            const d = buf.getChannelData(0);
            for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
            const src = ctx.createBufferSource();
            src.buffer = buf;
            src.loop = true;
            src.connect(carrierSum);
            src.start();
            stoppers.push(() => src.stop());
          } else {
            // Polyphonic carrier: 4 voices, each with `unison` detuned oscillators.
            // In "Keys" mode the voices follow the notes played on the keyboard,
            // MIDI controller or typing keys, like a classic vocoder keyboard.
            const VOICES = playKeys ? 4 : 1;
            const voices: { oscs: OscillatorNode[]; amp: GainNode }[] = [];
            const octMul = Math.pow(2, octave);
            for (let v = 0; v < VOICES; v++) {
              const amp = ctx.createGain();
              amp.gain.value = playKeys ? 0 : 1;
              amp.connect(carrierSum);
              const oscs: OscillatorNode[] = [];
              for (let i = 0; i < unison; i++) {
                const osc = ctx.createOscillator();
                osc.type = wave === 1 ? "square" : "sawtooth";
                osc.frequency.value = pitch * octMul;
                osc.detune.value = unison === 1 ? 0 : (i / (unison - 1) - 0.5) * 2 * detune;
                const g = ctx.createGain();
                g.gain.value = 1 / Math.sqrt(unison) / (playKeys ? 2 : 1);
                osc.connect(g);
                g.connect(amp);
                osc.start();
                oscs.push(osc);
                keep.push(osc, g);
                stoppers.push(() => osc.stop());
              }
              keep.push(amp);
              voices.push({ oscs, amp });
            }
            if (playKeys) {
              const apply = () => {
                const notes = keysSnapshot().slice(-VOICES);
                const t = ctx.currentTime;
                voices.forEach((vc, i) => {
                  const n = notes[i];
                  if (n === undefined) {
                    vc.amp.gain.setTargetAtTime(0, t, 0.04);
                    return;
                  }
                  const hz = 440 * Math.pow(2, (n - 69) / 12) * octMul;
                  vc.oscs.forEach((o) => o.frequency.setTargetAtTime(hz, t, Math.max(0.002, glide / 3)));
                  vc.amp.gain.setTargetAtTime(1, t, 0.008);
                });
              };
              apply();
              unsubscribe = subscribeKeys(apply);
            }
          }
          vocoderCleanups.set(pl.id, () => {
            unsubscribe?.();
            stoppers.forEach((s) => {
              try {
                s();
              } catch {
                /* already stopped */
              }
            });
            if (vocoderCleanups.get(pl.id) === cleanupRef) vocoderCleanups.delete(pl.id);
          });
          const cleanupRef = vocoderCleanups.get(pl.id);

          // filter bank
          const lo = 120;
          const hi = 7000;
          const wet = ctx.createGain();
          wet.gain.value = mix;
          for (let b = 0; b < bandCount; b++) {
            const f = lo * Math.pow(hi / lo, b / (bandCount - 1));
            const q = 4 + (b / bandCount) * 6;

            const modBp = ctx.createBiquadFilter();
            modBp.type = "bandpass";
            modBp.frequency.value = f;
            modBp.Q.value = q / width;

            // envelope follower: rectify then smooth
            const rect = ctx.createWaveShaper();
            // Odd length puts an exact 0 at silence; an even curve interpolated to a small DC
            // offset that held every band slightly open and left a constant carrier hum.
            const curve = new Float32Array(1025);
            for (let i = 0; i < 1025; i++) curve[i] = Math.max(0, Math.abs((i / 1024) * 2 - 1) - 0.003);
            rect.curve = curve;
            const smooth = ctx.createBiquadFilter();
            smooth.type = "lowpass";
            smooth.frequency.value = clamp(1 / (2 * Math.PI * response), 1, 80);
            const amount = ctx.createGain();
            amount.gain.value = sense * 3;

            const carBp = ctx.createBiquadFilter();
            carBp.type = "bandpass";
            carBp.frequency.value = clamp(f * formant, 40, 18000);
            carBp.Q.value = q / width;
            const vca = ctx.createGain();
            vca.gain.value = 0;

            inNode.connect(modBp);
            modBp.connect(rect);
            rect.connect(smooth);
            smooth.connect(amount);
            amount.connect(vca.gain);

            carrier.connect(carBp);
            carBp.connect(vca);
            vca.connect(wet);
            keep.push(modBp, rect, smooth, amount, carBp, vca);
          }

          // sibilance path keeps consonants intelligible
          if (sib > 0) {
            const hp = ctx.createBiquadFilter();
            hp.type = "highpass";
            hp.frequency.value = 6500;
            const hpg = ctx.createGain();
            hpg.gain.value = sib * 0.6;
            inNode.connect(hp);
            hp.connect(hpg);
            hpg.connect(wet);
            keep.push(hp, hpg);
          }

          const dry = ctx.createGain();
          dry.gain.value = 1 - mix;
          inNode.connect(dry);
          dry.connect(out);
          const outTrim = ctx.createGain();
          outTrim.gain.value = dbToGain(val(pl, "output", 0)) * 1.4;
          wet.connect(outTrim);
          outTrim.connect(out);
          keep.push(carrier, wet, dry, outTrim);
          (out as unknown as { _vocoder?: AudioNode[] })._vocoder = keep;
          nodes.push(inNode, out);
          break;
        }
        case "gate": {
          // Downward expander approximation: compressor below-threshold attenuation
          // via inverted ratio is unavailable in DynamicsCompressor, so use a
          // waveshaper soft-knee expansion curve around the threshold.
          // Envelope-follower gate: rectify -> attack/release smoothing -> threshold curve -> VCA.
          const thr = Math.pow(10, clamp(val(pl, "threshold", -45), -80, 0) / 20);
          const input = ctx.createGain();
          const vca = ctx.createGain(); vca.gain.value = 0;
          const rect = ctx.createWaveShaper();
          const rc = new Float32Array(1025);
          for (let i = 0; i < rc.length; i++) rc[i] = Math.abs((i / 512) - 1);
          rect.curve = rc;
          const smooth = ctx.createBiquadFilter(); smooth.type = "lowpass"; smooth.Q.value = 0.5;
          const setSmooth = (t?: number) => {
            const ms = (val(pl, "attack", 2) + val(pl, "release", 80)) / 2;
            const f = clamp(1000 / (2 * Math.PI * Math.max(0.1, ms)), 1, 2000);
            if (t === undefined) smooth.frequency.value = f; else glide(smooth.frequency, f, t);
          };
          setSmooth();
          // The threshold scales the envelope into a fixed opening curve, so it can move while playing.
          const sense = ctx.createGain(); sense.gain.value = 1.6 / thr;
          const open = ctx.createWaveShaper();
          const oc = new Float32Array(2049);
          for (let i = 0; i < oc.length; i++) oc[i] = Math.pow(Math.abs((i / 1024) - 1), 4);
          open.curve = oc;
          live(pl, "threshold", (v, t) => glide(sense.gain, 1.6 / Math.pow(10, clamp(v, -80, 0) / 20), t));
          input.connect(vca);
          const floor = (db: number) => (db <= -79.5 ? 0 : dbToGain(clamp(db, -80, 0)));
          const span = ctx.createGain();
          const setRange = (db: number, t?: number) => { const f = floor(db); if (t === undefined) { vca.gain.value = f; span.gain.value = 1 - f; } else { glide(vca.gain, f, t); glide(span.gain, 1 - f, t); } };
          setRange(val(pl, "range", -80));
          input.connect(rect); rect.connect(smooth); smooth.connect(sense); sense.connect(open); open.connect(span); span.connect(vca.gain);
          const gOut = ctx.createGain(); dbLive(pl, "output", gOut); vca.connect(gOut);
          live(pl, "attack", (_v, t) => setSmooth(t));
          live(pl, "release", (_v, t) => setSmooth(t));
          live(pl, "range", (v, t) => setRange(v, t));
          nodes.push(input, vca, gOut);
          break;
        }
        case "stepfilter": {
          const input = ctx.createGain();
          const filter = ctx.createBiquadFilter();
          const mode = Math.round(val(pl, "mode", 0));
          filter.type = mode === 1 ? "highpass" : mode === 2 ? "bandpass" : "lowpass";
          const cutoff = clamp(val(pl, "cutoff", 12000), 80, 18000);
          filter.frequency.value = cutoff;
          filter.Q.value = clamp(val(pl, "resonance", 4), 0.1, 20);
          const wet = ctx.createGain();
          const dry = ctx.createGain();
          const out = ctx.createGain();
          const mix = clamp(val(pl, "mix", 1), 0, 1);
          wet.gain.value = mix;
          dry.gain.value = 1 - mix;
          input.connect(filter);
          filter.connect(wet);
          wet.connect(out);
          input.connect(dry);
          dry.connect(out);
          // Live state: every control (steps included) updates the running sequencer, never rebuilding it.
          const sf = { steps: val(pl, "steps", 16), swing: val(pl, "swing", 0), rate: val(pl, "rate", 8), cutoff, depth: val(pl, "depth", 0.85), smooth: val(pl, "smooth", 0.03) };
          const sv = Array.from({ length: 32 }, (_, i) => val(pl, `s${i + 1}`, 0.5));
          const stepWave = () => {
            const count = Math.max(1, Math.round(sf.steps));
            const harmonics = 32;
            const real = new Float32Array(harmonics + 1);
            const imag = new Float32Array(harmonics + 1);
            for (let h = 1; h <= harmonics; h++) {
              for (let i = 0; i < count; i++) {
                const swing = i % 2 === 1 ? clamp(sf.swing, 0, 0.6) : 0;
                const phase = (2 * Math.PI * h * (i + 0.5 + swing)) / count;
                const v = sv[i] ?? 0.5;
                real[h] = (real[h] ?? 0) + (v * Math.cos(phase) * 2) / count;
                imag[h] = (imag[h] ?? 0) - (v * Math.sin(phase) * 2) / count;
              }
            }
            return ctx.createPeriodicWave(real, imag);
          };
          const seqRate = () => clamp(sf.rate, 0.5, 32) / Math.max(1, Math.round(sf.steps));
          const smoothHz = () => { const sec = clamp(sf.smooth, 0, 0.24); return sec <= 0.001 ? 20000 : clamp(1 / (2 * Math.PI * sec), 0.5, 20000); };
          const sequencer = ctx.createOscillator();
          sequencer.setPeriodicWave(stepWave());
          sequencer.frequency.value = seqRate();
          const depth = ctx.createGain();
          depth.gain.value = cutoff * clamp(sf.depth, 0, 1);
          const smoothing = ctx.createBiquadFilter(); smoothing.type = "lowpass";
          smoothing.frequency.value = smoothHz();
          const setCutoff = (t: number) => { const c = clamp(sf.cutoff, 80, 18000); glide(filter.frequency, c, t); glide(depth.gain, c * clamp(sf.depth, 0, 1), t); };
          live(pl, "cutoff", (v, t) => { sf.cutoff = v; setCutoff(t); });
          live(pl, "depth", (v, t) => { sf.depth = v; setCutoff(t); });
          live(pl, "resonance", (v, t) => glide(filter.Q, clamp(v, 0.1, 20), t));
          live(pl, "mix", (v, t) => { const m = clamp(v, 0, 1); glide(wet.gain, m, t); glide(dry.gain, 1 - m, t); });
          live(pl, "mode", (v) => { const m = Math.round(v); filter.type = m === 1 ? "highpass" : m === 2 ? "bandpass" : "lowpass"; });
          live(pl, "rate", (v, t) => { sf.rate = v; glide(sequencer.frequency, seqRate(), t); });
          live(pl, "smooth", (v, t) => { sf.smooth = v; glide(smoothing.frequency, smoothHz(), t); });
          const reshape = (t: number) => { sequencer.setPeriodicWave(stepWave()); glide(sequencer.frequency, seqRate(), t); };
          live(pl, "steps", (v, t) => { sf.steps = v; reshape(t); });
          live(pl, "swing", (v, t) => { sf.swing = v; reshape(t); });
          for (let i = 0; i < 32; i++) live(pl, `s${i + 1}`, (v, t) => { sv[i] = v; reshape(t); });
          sequencer.connect(smoothing);
          smoothing.connect(depth);
          depth.connect(filter.frequency);
          sequencer.start();
          (out as unknown as { _keep?: AudioNode[] })._keep = [sequencer, smoothing, depth];
          bind(pl, "cutoff", filter.frequency, 80, 18000, true);
          bind(pl, "resonance", filter.Q, 0.1, 20);
          bind(pl, "mix", wet.gain, 0, 1);
          nodes.push(input, filter, wet, dry, out);
          break;
        }
        case "resonator": {
          const input = ctx.createGain();
          const dry = ctx.createGain();
          const wet = ctx.createGain();
          const out = ctx.createGain();
          const mix = clamp(val(pl, "mix", 0.35), 0, 1);
          dry.gain.value = 1 - mix;
          wet.gain.value = mix * 0.65;
          input.connect(dry);
          dry.connect(out);
          const root = 440 * Math.pow(2, (val(pl, "root", 48) - 69) / 12);
          const spread = val(pl, "spread", 0.35);
          const ratios = [1, Math.pow(2, 7 / 12), 2, Math.pow(2, 16 / 12)];
          const rz = { root: val(pl, "root", 48), spread, decay: val(pl, "decay", 1.8), damping: val(pl, "damping", 0.45) };
          const filters: BiquadFilterNode[] = [];
          const gains: GainNode[] = [];
          for (let i = 0; i < ratios.length; i++) {
            const filter = ctx.createBiquadFilter();
            filter.type = "bandpass";
            filter.frequency.value = clamp(root * (ratios[i] ?? 1) * (1 + (i - 1.5) * spread * 0.025), 30, 16000);
            filter.Q.value = 8 + val(pl, "decay", 1.8) * 5;
            const gain = ctx.createGain();
            gain.gain.value = (1 - val(pl, "damping", 0.45) * (i / ratios.length)) / ratios.length;
            input.connect(filter);
            filter.connect(gain);
            gain.connect(wet);
            filters.push(filter);
            gains.push(gain);
          }
          wet.connect(out);
          bind(pl, "mix", wet.gain, 0, 0.65);
          const retune = (t: number) => {
            const r = 440 * Math.pow(2, (rz.root - 69) / 12);
            filters.forEach((f, i) => { glide(f.frequency, clamp(r * (ratios[i] ?? 1) * (1 + (i - 1.5) * rz.spread * 0.025), 30, 16000), t); glide(f.Q, 8 + rz.decay * 5, t); });
            gains.forEach((g, i) => glide(g.gain, (1 - rz.damping * (i / ratios.length)) / ratios.length, t));
          };
          for (const key of ["root", "spread", "decay", "damping"] as const) live(pl, key, (v, t) => { rz[key] = v; retune(t); });
          live(pl, "mix", (v, t) => { const m = clamp(v, 0, 1); glide(dry.gain, 1 - m, t); glide(wet.gain, m * 0.65, t); });
          nodes.push(input, dry, wet, ...filters, ...gains, out);
          break;
        }
        case "scalechord": {
          // Changes notes, not audio: its controls never need the audio path rebuilt.
          for (const prm of pl.params) live(pl, prm.id, () => {});
          nodes.push(ctx.createGain());
          break;
        }
        case "transient": {
          const input = ctx.createGain();
          const dry = ctx.createGain();
          const compressor = ctx.createDynamicsCompressor();
          const wet = ctx.createGain();
          const out = ctx.createGain();
          const attack = val(pl, "attack", 0.35);
          const sustain = val(pl, "sustain", 0);
          const mix = clamp(val(pl, "mix", 1), 0, 1);
          dry.gain.value = 1 - mix;
          compressor.threshold.value = -10 - val(pl, "sensitivity", 0.55) * 36;
          compressor.ratio.value = attack >= 0 ? 1 + attack * 10 : 1 + Math.abs(attack) * 18;
          compressor.attack.value = attack >= 0 ? 0.03 : 0.001;
          compressor.release.value = clamp(0.08 + (sustain + 1) * 0.3, 0.05, 0.7);
          wet.gain.value = dbToGain(val(pl, "output", 0) + Math.max(0, attack) * 5 + sustain * 3) * mix;
          input.connect(dry);
          dry.connect(out);
          input.connect(compressor);
          compressor.connect(wet);
          if (val(pl, "protect", 1) >= 0.5) {
            const clip = ctx.createWaveShaper();
            const cc = new Float32Array(2049);
            for (let i = 0; i < cc.length; i++) cc[i] = Math.tanh(((i / 1024) - 1) * 1.2) / Math.tanh(1.2);
            clip.curve = cc;
            wet.connect(clip); clip.connect(out);
          } else wet.connect(out);
          bind(pl, "attack", compressor.ratio, 1, 20);
          bind(pl, "sustain", compressor.release, 0.05, 0.7);
          bind(pl, "mix", wet.gain, 0, 1.5);
          const tr = { attack, sustain, mix, sensitivity: val(pl, "sensitivity", 0.55), output: val(pl, "output", 0) };
          const reshape = (t: number) => {
            const a = tr.attack, su = tr.sustain, m = clamp(tr.mix, 0, 1);
            glide(dry.gain, 1 - m, t);
            glide(compressor.threshold, -10 - tr.sensitivity * 36, t);
            glide(compressor.ratio, a >= 0 ? 1 + a * 10 : 1 + Math.abs(a) * 18, t);
            glide(compressor.attack, a >= 0 ? 0.03 : 0.001, t);
            glide(compressor.release, clamp(0.08 + (su + 1) * 0.3, 0.05, 0.7), t);
            glide(wet.gain, dbToGain(tr.output + Math.max(0, a) * 5 + su * 3) * m, t);
          };
          for (const key of ["attack", "sustain", "mix", "sensitivity", "output"] as const) live(pl, key, (v, t) => { tr[key] = v; reshape(t); });
          nodes.push(input, dry, compressor, wet, out);
          break;
        }
        default: {
          if (!isCreativeKind(pl.kind)) break;
          const fx = buildCreativeFx(ctx, pl, { val: (id, fb) => val(pl, id, fb), live: (id, fn) => live(pl, id, fn) });
          nodes.push(fx.input, fx.output);
        }
      }
    }
    return nodes;
  }


  /** Rides a channel from an automation curve without touching stored track values. */
  automate(trackId: string, v: Record<string, number>, when?: number) {
    if (!this.ctx) return;
    const ch = this.channel(trackId);
    const t = when ?? this.ctx.currentTime;
    if (v["volume"] !== undefined) {
      const group = this.trackVcas.get(trackId);
      const vca = group ? this.vcaStates[group] : undefined;
      ch.gain.gain.setTargetAtTime(this.trackAudible.get(trackId) !== false && !vca?.muted
        ? clamp(v["volume"] * (vca?.volume ?? 1), 0, 2) : 0, t, 0.02);
      for (const send of [ch.synthReverbScale, ch.synthChorusScale]) {
        send.gain.setTargetAtTime(this.trackAudible.get(trackId) !== false && !vca?.muted
          ? clamp(v["volume"] * (vca?.volume ?? 1), 0, 2) : 0, t, 0.02);
      }
    }
    if (v["pan"] !== undefined) ch.pan.pan.setTargetAtTime(clamp(v["pan"], -1, 1), t, 0.02);
    const bus = this.busStates[ch.bus];
    const sendScale = ch.bus === "master" || !bus ? 1 : bus.muted ? 0 : clamp(bus.volume, 0, 2);
    if (v["sendReverb"] !== undefined) ch.sendReverb.gain.setTargetAtTime(clamp(v["sendReverb"] * sendScale, 0, 1.5), t, 0.02);
    if (v["sendDelay"] !== undefined) ch.sendDelay.gain.setTargetAtTime(clamp(v["sendDelay"] * sendScale, 0, 1.5), t, 0.02);
    for (const [key, normalized] of Object.entries(v)) {
      if (!key.startsWith("plugin:")) continue;
      const [, instanceId = "", paramId = ""] = key.split(":");
      const target = this.automatedPluginParams.get(`${trackId}:${instanceId}:${paramId}`);
      if (!target) continue;
      const n = clamp(normalized, 0, 1);
      const value = target.logarithmic
        ? target.min * Math.pow(target.max / target.min, n)
        : target.min + (target.max - target.min) * n;
      target.param.setTargetAtTime(value, t, 0.02);
    }
  }

  /** Live-note fast path: skip the full mix sync when nothing changed. */
  syncMixIfChanged(tracks: Track[]) {
    if (this.ctx && this.mixTracks === tracks) return;
    this.syncMix(tracks);
  }

  syncMix(tracks: Track[]) {
    this.mixTracks = tracks;
    if (!this.ctx) return;
    this.syncSoundControls(tracks);
    const anySolo = tracks.some((t) => t.solo);
    for (const t of tracks) {
      const ch = this.channel(t.id);
      const audible = !t.muted && !t.deviceBypassed && (!anySolo || t.solo);
      const vca = t.vca ? this.vcaStates[t.vca] : undefined;
      const busState = this.busStates[t.bus ?? "master"];
      const inputs = JSON.stringify([t.gain ?? 1, t.volume, t.pan, audible, t.vca, vca?.volume, vca?.muted, t.bus ?? "master", busState?.volume, busState?.muted, t.sends?.reverb ?? 0, t.sends?.delay ?? 0, t.sends?.chorus ?? 0]);
      if (this.mixerInputs.get(ch) === inputs) continue;
      this.mixerInputs.set(ch, inputs);
      this.trackAudible.set(t.id, audible);
      const previousVca = this.trackVcas.get(t.id);
      if (previousVca !== t.vca) {
        if (previousVca) {
          const previousMeter = this.vcaMeters.get(previousVca);
          if (previousMeter) try { ch.pan.disconnect(previousMeter); } catch { /* already detached */ }
        }
        const nextMeter = t.vca ? this.vcaMeters.get(t.vca) : undefined;
        if (nextMeter) ch.pan.connect(nextMeter);
      }
      if (t.vca) this.trackVcas.set(t.id, t.vca);
      else this.trackVcas.delete(t.id);
      ch.trim.gain.setTargetAtTime(clamp(t.gain ?? 1, 0, 2), this.ctx.currentTime, 0.02);
      ch.gain.gain.setTargetAtTime(audible && !vca?.muted ? t.volume * (vca?.volume ?? 1) : 0, this.ctx.currentTime, 0.02);
      for (const send of [ch.synthReverbScale, ch.synthChorusScale]) {
        send.gain.setTargetAtTime(audible && !vca?.muted ? clamp(t.volume * (vca?.volume ?? 1), 0, 2) : 0, this.ctx.currentTime, 0.02);
      }
      ch.pan.pan.setTargetAtTime(clamp(t.pan, -1, 1), this.ctx.currentTime, 0.02);
      const bus = t.bus ?? "master";
      if (ch.bus !== bus) {
        try {
          ch.pan.disconnect(this.busNode(ch.bus));
        } catch {
          /* not connected */
        }
        ch.pan.connect(this.busNode(bus));
        ch.bus = bus;
      }
      this.syncTrackSends(ch, t, this.ctx.currentTime);
    }
  }



  removeChannel(id: string) {
    const ch = this.channels.get(id);
    if (ch) {
      this.channels.delete(id);
      this.trackVcas.delete(id);
      this.trackAudible.delete(id);
      this.pluginScopes.delete(`ch:${id}`);
      const now = this.ctx?.currentTime ?? 0;
      try {
        ch.gain.gain.cancelScheduledValues(now);
        ch.gain.gain.setTargetAtTime(0, now, 0.006);
        window.setTimeout(() => {
          try { ch.pan.disconnect(); } catch { /* already disconnected */ }
          for (const send of [ch.synthReverbScale, ch.synthChorusScale]) {
            try { send.disconnect(); } catch { /* already disconnected */ }
          }
          for (const node of ch.insertNodes) {
            try { node.disconnect(); } catch { /* already disconnected */ }
          }
        }, 35);
      } catch {
        try { ch.pan.disconnect(); } catch { /* already disconnected */ }
        for (const send of [ch.synthReverbScale, ch.synthChorusScale]) {
          try { send.disconnect(); } catch { /* already disconnected */ }
        }
      }
    }
  }

  /** Bumped on transport stop so pending async sample decodes don't trigger afterwards. */
  private transportGen = 0;

  /** Fade queued transport/preview channels instead of leaving scheduled notes behind. */
  silenceChannels(ids: string[]) {
    this.transportGen++;
    stopExternalNotes(ids);
    for (const id of ids) {
      const now = this.ctx?.currentTime ?? 0;
      for (const v of this.granularVoices.get(id) ?? []) v.stop(now);
      this.granularVoices.delete(id);
    }
    for (const id of ids) {
      this.stopSamples(id);
      const now = this.ctx?.currentTime ?? 0;
      this.monoVoice.get(id)?.stop(now);
      this.monoVoice.delete(id);
      this.lastMidi.delete(id);
      for (const gate of this.modularGates.get(id) ?? []) {
        try { gate.gain.cancelScheduledValues(now); gate.gain.setTargetAtTime(0, now, 0.01); setTimeout(() => { try { gate.disconnect(); } catch { /* gone */ } }, 120); } catch { /* gone */ }
      }
      this.modularGates.delete(id);
      this.removeChannel(id);
    }
  }

  /* ---------------- granular synth ---------------- */
  private granularVoices = new Map<string, Set<GranularVoice>>();
  /** Newest knob values per track, read by held grain clouds every few milliseconds. */
  private granularLive = new Map<string, GranularPatch>();
  /** Grains really scheduled on the live context, for the synth's display. */
  private granularActivity = new Map<string, { position: number; at: number; length: number; reverse: boolean }[]>();

  /** Grains sounding right now on a track (read position 0..1 and how far through each grain is). */
  granularGrains(trackId: string): { position: number; progress: number; reverse: boolean }[] {
    const now = this.ctx?.currentTime ?? 0;
    const log = this.granularActivity.get(trackId);
    if (!log) return [];
    return log.filter((g) => g.at <= now && g.at + g.length >= now).map((g) => ({ position: g.position, progress: (now - g.at) / g.length, reverse: g.reverse }));
  }

  private playGranular(trackId: string, dest: AudioNode, g: GranularPatch, midi: number, duration: number, velocity: number, t0: number) {
    const ctx = this.ctx as BaseAudioContext | null;
    if (!ctx) return;
    this.granularLive.set(trackId, g);
    let buffer: AudioBuffer | undefined;
    let root = GRANULAR_ROOT;
    if (g.source === "sample") {
      if (!g.sampleUrl) return;
      buffer = this.sampleBuffers.get(g.sampleUrl);
      root = g.sampleRoot ?? 60;
      if (!buffer) { void this.ensureBuffer(g.sampleUrl); return; } // first press loads it
    } else buffer = builtInSource(ctx, g.source);
    const live = !(typeof OfflineAudioContext !== "undefined" && ctx instanceof OfflineAudioContext);
    const log = live ? (this.granularActivity.get(trackId) ?? []) : null;
    if (log) this.granularActivity.set(trackId, log);
    const voice = playGranularVoice(ctx, dest, buffer, root, g, () => this.granularLive.get(trackId) ?? g, midi, duration, velocity, t0,
      log ? (position, at, length, reverse) => { log.push({ position, at, length, reverse }); if (log.length > 160) log.splice(0, log.length - 160); } : undefined);
    const set = this.granularVoices.get(trackId) ?? new Set<GranularVoice>();
    set.add(voice);
    this.granularVoices.set(trackId, set);
    setTimeout(() => { set.delete(voice); }, Math.max(0, voice.end - ctx.currentTime) * 1000 + 300);
  }

  /* ---------------- pulse wave cache ---------------- */
  private pulseCache = new Map<string, PeriodicWave>();
  pulseWave(ctx: AudioContext, width: number) {
    const key = width.toFixed(2);
    const cached = this.pulseCache.get(key);
    if (cached) return cached;
    const n = 64;
    const real = new Float32Array(n);
    const imag = new Float32Array(n);
    for (let i = 1; i < n; i++) imag[i] = (2 / (i * Math.PI)) * Math.sin(i * Math.PI * width);
    const wave = ctx.createPeriodicWave(real, imag, { disableNormalization: false });
    this.pulseCache.set(key, wave);
    return wave;
  }

  /* ---------------- input recording ---------------- */
  private recorder: MediaRecorder | null = null;
  private recStream: MediaStream | null = null;
  /** AudioContext time the current mic recorder began capturing. */
  recStartedAt = 0;
  private recChunks: Blob[] = [];
  private monitorNode: MediaStreamAudioSourceNode | null = null;
  private monitorGain: GainNode | null = null;
  private recAnalyser: AnalyserNode | null = null;
  private inputGainNode: GainNode | null = null;
  private recDest: MediaStreamAudioDestinationNode | null = null;
  private trackRecorder: { recorder: MediaRecorder; destination: MediaStreamAudioDestinationNode; source: AudioNode; trackId: string; chunks: Blob[] } | null = null;

  private monitorTrackId: string | null = null;

  get isRecording() {
    return this.recorder?.state === "recording";
  }

  get isTrackRecording() {
    return this.trackRecorder?.recorder.state === "recording";
  }

  /** Audio-clock time the current channel print started, so the take can be lined up with the song. */
  trackRecStartedAt = 0;

  /** Print an instrument or drum channel directly, without capturing the rest of the song. */
  startTrackRecording(trackId: string) {
    if (this.trackRecorder) return;
    const ctx = this.init();
    const destination = ctx.createMediaStreamDestination();
    const source = this.channel(trackId).meter;
    source.connect(destination);
    const mime = preferredRecordingMime();
    try {
      const recorder = new MediaRecorder(destination.stream, mime ? { mimeType: mime } : undefined);
      const chunks: Blob[] = [];
      recorder.ondataavailable = (event) => { if (event.data.size) chunks.push(event.data); };
      recorder.start(40);
      this.trackRecStartedAt = ctx.currentTime;
      this.trackRecorder = { recorder, destination, source, trackId, chunks };
    } catch (error) {
      source.disconnect(destination);
      destination.stream.getTracks().forEach((track) => track.stop());
      throw error;
    }
  }

  async stopTrackRecording(): Promise<{ peaks: number[]; duration: number; url: string; trackId: string } | null> {
    const session = this.trackRecorder;
    if (!session) return null;
    this.trackRecorder = null;
    const { recorder, destination, source, trackId, chunks } = session;
    try {
      const blob = await new Promise<Blob>((resolve) => {
        recorder.onstop = () => resolve(new Blob(chunks, { type: recorder.mimeType || "audio/webm" }));
        if (recorder.state !== "inactive") recorder.stop();
        else resolve(new Blob(chunks, { type: recorder.mimeType || "audio/webm" }));
      });
      if (!blob.size) return null;
      const ctx = this.init();
      let buffer: AudioBuffer;
      try { buffer = await ctx.decodeAudioData(await blob.arrayBuffer()); }
      catch { throw new Error("This browser cannot play back its recorded audio. Try Chrome or Safari."); }
      const data = buffer.getChannelData(0);
      const buckets = Math.min(1600, Math.max(160, Math.ceil(buffer.duration * 80)));
      const peaks = Array.from({ length: buckets }, (_, bucket) => {
        const from = Math.floor(bucket * data.length / buckets);
        const to = Math.floor((bucket + 1) * data.length / buckets);
        let peak = 0;
        for (let i = from; i < to; i++) peak = Math.max(peak, Math.abs(data[i] ?? 0));
        return peak;
      });
      const url = URL.createObjectURL(blob);
      this.sampleBuffers.set(url, this.centered(buffer));
      return { peaks, duration: buffer.duration, url, trackId };
    } finally {
      source.disconnect(destination);
      destination.stream.getTracks().forEach((track) => track.stop());
    }
  }

  get monitoredTrack() {
    return this.monitorTrackId;
  }

  /** Open the microphone for metering/monitoring when a channel is armed. */
  private monitorPending: { trackId: string; p: Promise<void> } | null = null;

  async startInputMonitoring(trackId: string, monitor: boolean) {
    // arming and REC can both open the input at once; share the in-flight request
    if (this.monitorPending?.trackId === trackId) {
      await this.monitorPending.p;
      this.setMonitoring(monitor);
      return;
    }
    const p = this.openInputMonitoring(trackId, monitor);
    this.monitorPending = { trackId, p };
    try { await p; } finally { if (this.monitorPending?.p === p) this.monitorPending = null; }
  }

  private async openInputMonitoring(trackId: string, monitor: boolean) {
    if (this.monitorTrackId === trackId && this.recStream?.active) {
      this.setMonitoring(monitor);
      return;
    }
    if (this.isRecording) return;
    this.stopInputMonitoring();
    const generation = ++this.monitorGeneration;
    const ctx = this.init();
    const stream = await openMicOrThrow({
      echoCancellation: false,
      noiseSuppression: false,
      autoGainControl: false,
      channelCount: { ideal: 2 },
    }, "timeline");
    // The target may have changed while the browser permission prompt was open.
    if (generation !== this.monitorGeneration) {
      releaseMic(stream);
      return;
    }
    this.recStream = stream;
    const src = ctx.createMediaStreamSource(stream);
    // input channel pick + input gain; everything downstream (meter, monitor, recorder) hears this
    const inGain = ctx.createGain();
    inGain.gain.value = 10 ** (getInputGainDb() / 20);
    const chan = getInputChannel();
    if (chan === "stereo") src.connect(inGain);
    else {
      const sp = ctx.createChannelSplitter(2);
      const mg2 = ctx.createChannelMerger(2);
      const c = chan === "in1" ? 0 : 1;
      src.connect(sp);
      sp.connect(mg2, c, 0);
      sp.connect(mg2, c, 1);
      mg2.connect(inGain);
    }
    const dest = ctx.createMediaStreamDestination();
    inGain.connect(dest);
    this.inputGainNode = inGain;
    this.recDest = dest;
    const analyser = ctx.createAnalyser();
    analyser.fftSize = 1024;
    inGain.connect(analyser);
    this.recAnalyser = analyser;
    const mg = ctx.createGain();
    mg.gain.value = monitor ? 1 : 0;
    inGain.connect(mg);
    mg.connect(this.channel(trackId).input);
    this.monitorNode = src;
    this.monitorGain = mg;
    this.monitorTrackId = trackId;
  }

  /** Close the microphone when the channel is disarmed (never while recording). */
  stopInputMonitoring() {
    if (this.isRecording) return;
    this.monitorGeneration += 1;
    releaseMic(this.recStream);
    this.recStream = null;
    this.monitorNode?.disconnect();
    this.monitorGain?.disconnect();
    this.inputGainNode?.disconnect();
    this.inputGainNode = null;
    this.recDest = null;
    this.monitorNode = null;
    this.monitorGain = null;
    this.recAnalyser = null;
    this.monitorTrackId = null;
  }

  async startInputRecording(trackId: string, monitor: boolean) {
    if (this.isRecording) return;
    if (this.recordingStart) return this.recordingStart;
    this.recordingStart = (async () => {
      await this.startInputMonitoring(trackId, monitor);
      const stream = this.recDest?.stream ?? this.recStream;
      if (!stream) throw new Error("The microphone input is not open.");
      this.recChunks = [];
      const mime = preferredRecordingMime();
      const rec = new MediaRecorder(stream, mime ? { mimeType: mime } : undefined);
      rec.ondataavailable = (e) => e.data.size > 0 && this.recChunks.push(e.data);
      rec.start(200);
      this.recorder = rec;
      this.recStartedAt = this.ctx?.currentTime ?? 0;
    })();
    try {
      await this.recordingStart;
    } finally {
      this.recordingStart = null;
    }
  }

  /** Throw away a microphone take that never reached the song (record cancelled during the count-in). */
  cancelInputRecording() {
    const rec = this.recorder;
    if (!rec) return;
    this.recorder = null;
    rec.ondataavailable = null;
    try { if (rec.state !== "inactive") rec.stop(); } catch { /* already stopped */ }
    this.recChunks = [];
    if (!this.monitorTrackId) this.stopInputMonitoring();
  }

  /** Live input gain in dB (-24..+24), applied before metering, monitoring and recording. */
  setInputGain(db: number) {
    if (this.inputGainNode && this.ctx)
      this.inputGainNode.gain.setTargetAtTime(10 ** (db / 20), this.ctx.currentTime, 0.02);
  }

  /**
   * True when the browser exposes the output-routing API. iPadOS reports this
   * as available yet rejects every call, so callers must also treat
   * isAppleMobile() as "no picker here" — see Settings and setOutputDevice.
   */
  get canPickOutput() {
    return typeof (AudioContext.prototype as unknown as { setSinkId?: unknown }).setSinkId === "function";
  }

  /** Route all app playback to an output device (null = system default). */
  async setOutputDevice(id: string | null) {
    const ctx = this.init() as AudioContext & { setSinkId?: (id: string) => Promise<void> };
    if (!ctx.setSinkId || isAppleMobile())
      throw new Error(`This browser can't choose an output. ${outputRoutingHint()}`);
    await ctx.setSinkId(id ?? "");
  }

  setMonitoring(on: boolean) {
    if (this.monitorGain && this.ctx)
      this.monitorGain.gain.setTargetAtTime(on ? 1 : 0, this.ctx.currentTime, 0.01);
  }

  inputLevel() {
    if (!this.recAnalyser) return 0;
    const data = new Uint8Array(this.recAnalyser.fftSize);
    this.recAnalyser.getByteTimeDomainData(data);
    let peak = 0;
    for (let i = 0; i < data.length; i++) peak = Math.max(peak, Math.abs((data[i] ?? 128) - 128) / 128);
    return peak;
  }

  async stopInputRecording(): Promise<{ peaks: number[]; duration: number; url: string } | null> {
    const rec = this.recorder;
    if (!rec) return null;
    const blob: Blob = await new Promise((resolve) => {
      const done = () => resolve(new Blob(this.recChunks, { type: rec.mimeType || "audio/webm" }));
      // A recorder whose input was unplugged has already stopped by itself.
      if (rec.state === "inactive") return done();
      rec.onstop = done;
      rec.stop();
    });
    this.recorder = null;
    // The channel stays armed, so the microphone stays open for metering and
    // monitoring; it is only released when the channel is disarmed.
    if (!this.monitorTrackId) this.stopInputMonitoring();
    if (!blob.size) return null;

    const ctx = this.init();
    const arr = await blob.arrayBuffer();
    let peaks: number[] = [];
    let duration = 0;
    let buf: AudioBuffer;
    try {
      buf = await ctx.decodeAudioData(arr.slice(0));
    } catch {
      throw new Error("This browser recorded the take in a format it can't play back. Try Chrome or Safari.");
    }
    duration = buf.duration;
    // Microphone takes often arrive very quiet (browser input, no preamp gain).
    // Auto-level each take so its loudest peak sits at -1 dBFS (max +30 dB boost).
    let loud = 0;
    for (let c = 0; c < buf.numberOfChannels; c++) { const ch = buf.getChannelData(c); for (let i = 0; i < ch.length; i++) loud = Math.max(loud, Math.abs(ch[i] ?? 0)); }
    let outBlob = blob;
    if (loud > 0.0005 && loud < 0.89) {
      const g = Math.min(31.6, 0.89 / loud);
      for (let c = 0; c < buf.numberOfChannels; c++) { const ch = buf.getChannelData(c); for (let i = 0; i < ch.length; i++) ch[i] = (ch[i] ?? 0) * g; }
      outBlob = encodeWav({ left: buf.getChannelData(0), right: buf.getChannelData(Math.min(1, buf.numberOfChannels - 1)), sampleRate: buf.sampleRate });
    }
    const data = buf.getChannelData(0);
    const buckets = Math.min(1600, Math.max(160, Math.ceil(duration * 80)));
    const size = Math.max(1, Math.ceil(data.length / buckets));
    for (let b = 0; b < buckets; b++) {
      let peak = 0;
      for (let i = b * size; i < Math.min(data.length, (b + 1) * size); i++) peak = Math.max(peak, Math.abs(data[i] ?? 0));
      peaks.push(peak);
    }
    const url = URL.createObjectURL(outBlob);
    this.sampleBuffers.set(url, this.centered(buf));
    return { peaks, duration, url };
  }

  async peaksFromFile(file: File | Blob) {
    const ctx = this.init();
    const buf = await ctx.decodeAudioData(await file.arrayBuffer());
    const data = buf.getChannelData(0);
    const buckets = 160;
    const size = Math.max(1, Math.floor(data.length / buckets));
    const peaks: number[] = [];
    for (let b = 0; b < buckets; b++) {
      let peak = 0;
      for (let i = b * size; i < Math.min(data.length, (b + 1) * size); i++)
        peak = Math.max(peak, Math.abs(data[i] ?? 0));
      peaks.push(peak);
    }
    return { peaks, duration: buf.duration };
  }

  /* ---------------- sampler ---------------- */
  protected sampleBuffers = new Map<string, AudioBuffer>();
  /** Decoded audio this engine holds; AudioBuffers are context-independent, so offline renders reuse them. */
  decodedAudio(): ReadonlyMap<string, AudioBuffer> {
    return this.sampleBuffers;
  }
  /** Interface takes recorded on one side only play from both speakers. */
  private centered(buf: AudioBuffer) { centerOneSided(buf); return buf; }
  protected reversedBuffers = new Map<string, AudioBuffer>();
  private liveSamples = new Map<string, AudioBufferSourceNode[]>();
  /** voices grouped by an arbitrary key so pads can choke each other */
  private keyedSamples = new Map<string, AudioBufferSourceNode[]>();
  private sampleTriggerVersions = new Map<string, number>();

  /** Loudest absolute sample (0..1) in the start..end part of a loaded sample, across all channels; 0 when not loaded. */
  samplePeak(url: string, start = 0, end = 1): number {
    const buf = this.sampleBuffers.get(url);
    if (!buf) return 0;
    return peakInWindow(Array.from({ length: buf.numberOfChannels }, (_, c) => buf.getChannelData(c)), start, end);
  }

  /** Decodes a dropped audio file, keeps the buffer and returns its display data. */
  async loadSampleFile(file: File | Blob, name: string) {
    const ctx = this.init();
    const raw = await (file as File).arrayBuffer();
    const buf = await ctx.decodeAudioData(raw.slice(0));
    // Only files that really decode are kept in the account library.
    if (file instanceof File && /\.(mp3|mp4)$/i.test(file.name)) {
      void import("./media-library").then(({ retainMediaInBackground }) => retainMediaInBackground(file, file.name));
    }
    const url = URL.createObjectURL(file);
    this.sampleBuffers.set(url, this.centered(buf));
    const data = buf.getChannelData(0);
    const buckets = 480;
    const size = Math.max(1, Math.floor(data.length / buckets));
    const peaks: number[] = [];
    for (let b = 0; b < buckets; b++) {
      let peak = 0;
      for (let i = b * size; i < Math.min(data.length, (b + 1) * size); i++)
        peak = Math.max(peak, Math.abs(data[i] ?? 0));
      peaks.push(peak);
    }
    return { url, name, peaks, duration: buf.duration };
  }

  hasSample(url: string) {
    return this.sampleBuffers.has(url);
  }

  private reversed(url: string) {
    const cached = this.reversedBuffers.get(url);
    if (cached) return cached;
    const src = this.sampleBuffers.get(url);
    const ctx = this.ctx;
    if (!src || !ctx) return null;
    const out = ctx.createBuffer(src.numberOfChannels, src.length, src.sampleRate);
    for (let c = 0; c < src.numberOfChannels; c++) {
      const from = src.getChannelData(c);
      const to = out.getChannelData(c);
      for (let i = 0, n = from.length; i < n; i++) to[i] = from[n - 1 - i] as number;
    }
    this.reversedBuffers.set(url, out);
    return out;
  }

  /** Renders the sampler's processed sound (trim, reverse, tune, sync, filter, fades) offline. Original stays untouched. */
  async renderSample(s: Parameters<SyncLabEngine["playSample"]>[1]): Promise<{ left: Float32Array; right: Float32Array; sampleRate: number } | null> {
    this.init();
    // Saved samples may not have been played (and decoded) in this session yet.
    if (!this.sampleBuffers.has(s.url)) await this.ensureBuffer(s.url);
    const base = s.reverse ? this.reversed(s.url) : this.sampleBuffers.get(s.url);
    if (!base) return null;
    const sync = s.syncToBpm && s.sampleBpm && s.sampleBpm > 0 ? this.tempo / s.sampleBpm : 1;
    const rate = clamp(Math.pow(2, s.pitch / 12) * sync, 0.0625, 16);
    const [a, b] = sampleWindow(s.start, s.end, !!s.reverse);
    const win = base.duration * (b - a);
    const len = win / rate;
    const sr = base.sampleRate;
    const off = new OfflineAudioContext(2, Math.max(1, Math.ceil(len * sr)), sr);
    const src = off.createBufferSource();
    src.buffer = base;
    src.playbackRate.value = rate;
    const g = off.createGain();
    const peak = clamp(s.gain, 0, 2);
    const fi = Math.max(0.001, s.fadeIn ?? 0);
    const fo = Math.max(0, s.fadeOut ?? 0);
    g.gain.setValueAtTime(0, 0);
    g.gain.linearRampToValueAtTime(peak, Math.min(len, fi));
    if (fo > 0 && len - fo > fi) {
      g.gain.setValueAtTime(peak, len - fo);
      g.gain.linearRampToValueAtTime(0.0001, len);
    }
    let head: AudioNode = src;
    if (s.filterType && s.filterType !== "off") {
      const f = off.createBiquadFilter();
      f.type = s.filterType;
      f.frequency.value = clamp(s.cutoff ?? 18000, 20, 20000);
      f.Q.value = clamp(s.resonance ?? 0.7, 0.1, 24);
      src.connect(f);
      head = f;
    }
    head.connect(g);
    g.connect(off.destination);
    src.start(0, base.duration * a, win);
    const out = await off.startRendering();
    return { left: out.getChannelData(0).slice(), right: out.getChannelData(Math.min(1, out.numberOfChannels - 1)).slice(), sampleRate: sr };
  }

  /** project tempo, used by sampler beat sync */
  tempo = 120;

  /** Plays the trimmed sample pitched to a midi note through the track channel. */
  playSample(
    trackId: string,
    s: {
      url: string;
      start: number;
      end: number;
      gain: number;
      pitch: number;
      rootNote: number;
      loop: boolean;
      reverse: boolean;
      oneShot: boolean;
      attack: number;
      release: number;
      decay?: number | undefined;
      sustain?: number | undefined;
      filterType?: "off" | "lowpass" | "highpass" | "bandpass" | "notch" | undefined;
      cutoff?: number | undefined;
      resonance?: number | undefined;
      sampleBpm?: number | undefined;
      syncToBpm?: boolean | undefined;
      fadeIn?: number | undefined;
      fadeOut?: number | undefined;
    },
    midi: number,
    duration?: number,
    velocity = 1,
    when?: number,
    voiceKey?: string,
  ) {
    if (voiceKey) this.stopVoiceKey(trackId, voiceKey);
    const triggerKey = voiceKey ? `${trackId}|${voiceKey}` : trackId;
    const version = this.sampleTriggerVersions.get(triggerKey) ?? 0;
    const trackVersion = this.sampleTriggerVersions.get(trackId) ?? 0;
    const ctx = this.init();
    const base = s.reverse ? this.reversed(s.url) : this.sampleBuffers.get(s.url);
    if (!base) {
      // Sound not decoded yet (e.g. pad restored from a saved project): load it, then play once.
      if (s.url && !this.sampleBuffers.has(s.url)) {
        const gen = this.transportGen;
        void this.ensureBuffer(s.url).then((b) => {
          // A transport stop while the decode was pending cancels the queued trigger.
          if (b && gen === this.transportGen && version === (this.sampleTriggerVersions.get(triggerKey) ?? 0) && trackVersion === (this.sampleTriggerVersions.get(trackId) ?? 0)) this.playSample(trackId, s, midi, duration, velocity, undefined, voiceKey);
        });
      }
      return;
    }
    const t0 = Math.max(when ?? ctx.currentTime, ctx.currentTime + 0.002);
    const ch = this.playbackChannel(trackId);

    const src = ctx.createBufferSource();
    src.buffer = base;
    const sync = s.syncToBpm && s.sampleBpm && s.sampleBpm > 0 ? this.tempo / s.sampleBpm : 1;
    const rate = Math.pow(2, (midi - s.rootNote + s.pitch) / 12) * sync;
    src.playbackRate.value = clamp(rate, 0.0625, 16);

    // Reverse plays the trimmed part backwards: in the flipped buffer that part sits at [1 − end, 1 − start].
    const [a, b] = sampleWindow(s.start, s.end, !!s.reverse);
    const offset = base.duration * a;
    const window = base.duration * (b - a);
    const playable = window / src.playbackRate.value;
    const len = s.loop ? (duration ?? playable) : s.oneShot ? playable : Math.min(playable, duration ?? playable);

    if (s.loop) {
      src.loop = true;
      src.loopStart = offset;
      src.loopEnd = offset + window;
    }

    const amp = ctx.createGain();
    const peak = clamp(s.gain, 0, 2) * clamp(velocity, 0, 1);
    const atk = Math.max(0.001, s.attack);
    const rel = Math.max(0.005, s.release);
    const dec = Math.max(0, s.decay ?? 0);
    const sus = peak * clamp(s.sustain ?? 1, 0, 1);
    const fi = Math.max(atk, s.fadeIn ?? 0);
    amp.gain.setValueAtTime(0, t0);
    amp.gain.linearRampToValueAtTime(peak, t0 + fi);
    if (dec > 0) amp.gain.linearRampToValueAtTime(Math.max(0.0001, sus), t0 + fi + dec);
    const hold = dec > 0 ? sus : peak;
    const endT = Math.max(t0 + fi + dec, t0 + len);
    const fo = Math.max(0, s.fadeOut ?? 0);
    if (fo > 0 && !s.loop && endT - fo > t0 + fi + dec) {
      amp.gain.setValueAtTime(hold, endT - fo);
      amp.gain.linearRampToValueAtTime(0.0001, endT);
    } else {
      amp.gain.setValueAtTime(Math.max(0.0001, hold), endT);
    }
    amp.gain.linearRampToValueAtTime(0.0001, t0 + len + rel);

    let head: AudioNode = src;
    if (s.filterType && s.filterType !== "off") {
      const f = ctx.createBiquadFilter();
      f.type = s.filterType;
      f.frequency.value = clamp(s.cutoff ?? 18000, 20, 20000);
      f.Q.value = clamp(s.resonance ?? 0.7, 0.1, 24);
      src.connect(f);
      head = f;
    }
    head.connect(amp);
    amp.connect(ch.input);
    src.start(t0, offset, s.loop ? undefined : window);
    src.stop(t0 + len + rel + 0.02);

    const live = this.liveSamples.get(trackId) ?? [];
    live.push(src);
    this.liveSamples.set(trackId, live);
    const kk = voiceKey ? `${trackId}|${voiceKey}` : null;
    if (kk) this.keyedSamples.set(kk, [...(this.keyedSamples.get(kk) ?? []), src]);
    src.onended = () => {
      try {
        src.disconnect();
        amp.disconnect();
      } catch {
        /* already gone */
      }
      this.liveSamples.set(trackId, (this.liveSamples.get(trackId) ?? []).filter((x) => x !== src));
      if (kk) this.keyedSamples.set(kk, (this.keyedSamples.get(kk) ?? []).filter((x) => x !== src));
    };
  }

  /** Decodes and caches an audio url so a timeline clip can play from it. */
  async ensureBuffer(url: string): Promise<AudioBuffer | null> {
    if (!url) return null;
    const cached = this.sampleBuffers.get(url);
    if (cached) return cached;
    try {
      const res = await fetch(url);
      const buf = await this.init().decodeAudioData(await res.arrayBuffer());
      this.sampleBuffers.set(url, this.centered(buf));
      return buf;
    } catch {
      return null;
    }
  }


  /** Returns (and caches) a reversed copy of a decoded buffer. Original is untouched. */
  private reversedBuffer(url: string, buf: AudioBuffer): AudioBuffer {
    const cached = this.reversedBuffers.get(url);
    if (cached) return cached;
    const ctx = this.init();
    const out = ctx.createBuffer(buf.numberOfChannels, buf.length, buf.sampleRate);
    for (let c = 0; c < buf.numberOfChannels; c++) {
      const src = buf.getChannelData(c);
      const dst = out.getChannelData(c);
      for (let i = 0, n = src.length; i < n; i++) dst[i] = src[n - 1 - i] as number;
    }
    this.reversedBuffers.set(url, out);
    return out;
  }

  /** Plays an arrangement clip through its track channel, with trim, fades, pitch, speed and reverse. */
  playClip(
    trackId: string,
    c: {
      url: string;
      offset?: number;
      length?: number;
      gain?: number;
      fadeIn?: number;
      fadeOut?: number;
      rate?: number;
      reverse?: boolean;
      loopClip?: boolean;
       /** Equal-power overlap at an audition loop seam, in source seconds. */
       loopCrossfade?: number;
    },
    when?: number,
  ) {
    const ctx = this.init();
    const decoded = this.sampleBuffers.get(c.url);
    if (!decoded) return false;
    const t0 = when ?? ctx.currentTime;
    const ch = this.playbackChannel(trackId);
    const offset = clamp(c.offset ?? 0, 0, Math.max(0, decoded.duration - 0.01));
    const len = clamp(c.length ?? decoded.duration - offset, 0.01, decoded.duration - offset);
    const peak = clamp(c.gain ?? 1, 0, 2);
    const rate = clamp(c.rate ?? 1, 0.25, 4);
    const heard = len / rate;
    const fin = clamp(c.fadeIn ?? 0.004, 0.001, Math.max(0.001, heard / 2));
    const fout = clamp(c.fadeOut ?? 0.01, 0.001, Math.max(0.001, heard / 2));

    const buf = c.reverse ? this.reversedBuffer(c.url, decoded) : decoded;
    // when reversed, the same trim window lives mirrored in the reversed buffer
    const startAt = c.reverse ? Math.max(0, decoded.duration - offset - len) : offset;

    const src = ctx.createBufferSource();
    const crossfadeFrames = c.loopClip
      ? Math.min(Math.floor(clamp(c.loopCrossfade ?? 0, 0, len / 2) * buf.sampleRate), Math.floor((len * buf.sampleRate) / 2))
      : 0;
    let playbackBuffer = buf;
    let playbackStart = startAt;
    let playbackLength = len;
    if (crossfadeFrames > 0) {
      const startFrame = Math.floor(startAt * buf.sampleRate);
      const lengthFrames = Math.min(Math.floor(len * buf.sampleRate), buf.length - startFrame);
      const outputFrames = Math.max(1, lengthFrames - crossfadeFrames);
      playbackBuffer = ctx.createBuffer(buf.numberOfChannels, outputFrames, buf.sampleRate);
      for (let channel = 0; channel < buf.numberOfChannels; channel++) {
        const input = buf.getChannelData(channel);
        const output = playbackBuffer.getChannelData(channel);
        for (let i = 0; i < outputFrames; i++) {
          if (i < crossfadeFrames) {
            const phase = i / Math.max(1, crossfadeFrames - 1);
            const tail = input[startFrame + outputFrames + i] ?? 0;
            const head = input[startFrame + i] ?? 0;
            output[i] = tail * Math.cos(phase * Math.PI * 0.5) + head * Math.sin(phase * Math.PI * 0.5);
          } else {
            output[i] = input[startFrame + i] ?? 0;
          }
        }
      }
      playbackStart = 0;
      playbackLength = playbackBuffer.duration;
    }
    src.buffer = playbackBuffer;
    src.playbackRate.value = rate;
    src.loop = c.loopClip ?? false;
    if (src.loop) {
      src.loopStart = playbackStart;
      src.loopEnd = playbackStart + playbackLength;
    }
    const amp = ctx.createGain();
    if (src.loop) {
      amp.gain.setValueAtTime(peak, t0);
    } else {
      amp.gain.setValueAtTime(0, t0);
      amp.gain.linearRampToValueAtTime(peak, t0 + fin);
      amp.gain.setValueAtTime(peak, t0 + Math.max(fin, heard - fout));
      amp.gain.linearRampToValueAtTime(0.0001, t0 + heard);
    }
    src.connect(amp);
    amp.connect(ch.input);
    if (src.loop) src.start(t0, playbackStart);
    else {
      src.start(t0, startAt, len);
      src.stop(t0 + heard + 0.02);
    }

    const live = this.liveSamples.get(trackId) ?? [];
    live.push(src);
    this.liveSamples.set(trackId, live);
    src.onended = () => {
      try {
        src.disconnect();
        amp.disconnect();
      } catch {
        /* already gone */
      }
      this.liveSamples.set(trackId, (this.liveSamples.get(trackId) ?? []).filter((x) => x !== src));
    };
    return true;
  }

  /** Stops only the voices started with this voice key (pad choke groups). */
  stopVoiceKey(trackId: string, voiceKey: string) {
    const kk = `${trackId}|${voiceKey}`;
    this.sampleTriggerVersions.set(kk, (this.sampleTriggerVersions.get(kk) ?? 0) + 1);
    for (const src of this.keyedSamples.get(kk) ?? []) {
      try {
        src.stop();
      } catch {
        /* already stopped */
      }
    }
    this.keyedSamples.set(kk, []);
  }

  stopSamples(trackId?: string) {
    const ids = trackId ? [trackId] : [...new Set([...this.liveSamples.keys(), ...[...this.sampleTriggerVersions.keys()].map(key => key.split("|")[0] ?? key)])];
    for (const id of ids) {
      this.sampleTriggerVersions.set(id, (this.sampleTriggerVersions.get(id) ?? 0) + 1);
      for (const src of this.liveSamples.get(id) ?? []) {
        try {
          src.stop();
        } catch {
          /* already stopped */
        }
      }
      this.liveSamples.set(id, []);
      for (const key of [...this.keyedSamples.keys()]) if (key.startsWith(`${id}|`)) this.keyedSamples.set(key, []);
    }
  }


  /* ---------------- wavetable cache ---------------- */
  private tableCache = new Map<string, PeriodicWave>();
  /** Morphing wavetable: position 0 = soft sine stack, 0.5 = saw-like, 1 = hollow/formant spectrum. */
  wavetableWave(ctx: AudioContext, morph: number) {
    const pos = clamp(morph, 0, 1);
    const key = pos.toFixed(2);
    const cached = this.tableCache.get(key);
    if (cached) return cached;
    const n = 48;
    const real = new Float32Array(n);
    const imag = new Float32Array(n);
    for (let i = 1; i < n; i++) {
      const soft = Math.exp(-i * 0.9);
      const saw = 1 / i;
      const hollow = (i % 2 === 1 ? 1 / i : 0) * (1 + Math.cos(i * 0.6));
      const a = pos < 0.5 ? soft + (saw - soft) * (pos * 2) : saw + (hollow - saw) * ((pos - 0.5) * 2);
      imag[i] = a;
    }
    const wave = ctx.createPeriodicWave(real, imag, { disableNormalization: false });
    this.tableCache.set(key, wave);
    return wave;
  }

  private liveVoices = new Map<string, Set<{ end: number; patch: SynthPatch; update: (patch: SynthPatch, time: number) => void }>>();
  private liveDrums = new Map<string, Set<{ end: number; pad: DrumPad; update: (pad: DrumPad, time: number) => void }>>();

  /** Update nodes already sounding, without triggering or capturing another note. */
  syncSoundControls(tracks: Track[]) {
    const ctx = this.ctx;
    if (!ctx) return;
    for (const t of tracks) if (t.patch?.granular) { this.granularLive.set(t.id, t.patch.granular); warmBuiltInSource(ctx, t.patch.granular.source); }
    const now = ctx.currentTime;
    const byId = new Map(tracks.map(track => [track.id, track]));
    for (const [id, voices] of this.liveVoices) {
      const patch = byId.get(id)?.patch;
      for (const voice of voices) {
        if (voice.end <= now) { voices.delete(voice); continue; }
        if (!patch || patch === voice.patch || patch.modular) continue;
        voice.update(patch, now);
        voice.patch = patch;
      }
      if (!voices.size) this.liveVoices.delete(id);
    }
    for (const [key, voices] of this.liveDrums) {
      const [trackId, padId] = JSON.parse(key) as [string, string];
      const pad = byId.get(trackId)?.pads?.find(item => item.id === padId);
      for (const voice of voices) {
        if (voice.end <= now) { voices.delete(voice); continue; }
        if (!pad || pad === voice.pad) continue;
        // Sequencer edits must not rewrite sound controls or cancel filter envelopes.
        const previous = voice.pad;
        if (pad.volume !== previous.volume || pad.pan !== previous.pan || pad.pitch !== previous.pitch || pad.tone !== previous.tone || pad.filterType !== previous.filterType || pad.cutoff !== previous.cutoff || pad.resonance !== previous.resonance) voice.update(pad, now);
        voice.pad = pad;
      }
      if (!voices.size) this.liveDrums.delete(key);
    }
  }

  private lastMidi = new Map<string, number>();
  private modularGates = new Map<string, Set<GainNode>>();
  private monoVoice = new Map<string, { out: GainNode; stop: (t: number) => void }>();

  /* ---------------- synth voice ---------------- */
  /** Per-track pitch modulation bus (cents) feeding every synth oscillator's detune: pitch bend + mod-wheel vibrato. */
  private pitchMods = new Map<string, { bend: ConstantSourceNode; depth: GainNode; sum: GainNode }>();
  private pitchMod(trackId: string) {
    let pm = this.pitchMods.get(trackId);
    if (pm) return pm;
    const ctx = this.init();
    const sum = ctx.createGain();
    const bend = ctx.createConstantSource();
    bend.offset.value = 0;
    bend.connect(sum);
    const lfo = ctx.createOscillator();
    lfo.frequency.value = 5.5;
    const depth = ctx.createGain();
    depth.gain.value = 0;
    lfo.connect(depth);
    depth.connect(sum);
    bend.start();
    lfo.start();
    pm = { bend, depth, sum };
    this.pitchMods.set(trackId, pm);
    return pm;
  }
  /** Pitch bend in cents (e.g. ±200 = ±2 semitones) for every voice on this track. */
  setPitchBend(trackId: string, cents: number, when?: number) {
    const ctx = this.init();
    this.pitchMod(trackId).bend.offset.setTargetAtTime(clamp(cents, -2400, 2400), when ?? ctx.currentTime, 0.008);
  }
  /** Mod wheel 0..1 → vibrato depth up to ±60 cents. */
  setModWheel(trackId: string, amount: number, when?: number) {
    const ctx = this.init();
    this.pitchMod(trackId).depth.gain.setTargetAtTime(clamp(amount, 0, 1) * 60, when ?? ctx.currentTime, 0.02);
  }

  /** One looping white-noise buffer per context, shared by every voice (no per-note buffer filling on the main thread). */
  private noiseBuffers = new WeakMap<BaseAudioContext, AudioBuffer>();
  private noiseSource(ctx: BaseAudioContext, t0: number, life: number): AudioBufferSourceNode {
    let buf = this.noiseBuffers.get(ctx);
    if (!buf) {
      buf = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
      const d = buf.getChannelData(0);
      for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
      this.noiseBuffers.set(ctx, buf);
    }
    const src = ctx.createBufferSource();
    src.buffer = buf;
    src.loop = true;
    src.start(t0, Math.random() * 1.9);
    src.stop(t0 + life);
    return src;
  }

  playNote(trackId: string, patch: SynthPatch, midi: number, duration: number, velocity = 1, when?: number) {
    const ctx = this.init();
    const t0 = when ?? ctx.currentTime;
    // External MIDI instruments only play live: exports (offline renders) can't reach hardware,
    // and a muted/soloed-out channel sends nothing.
    if (isExternal(trackId) && !(typeof OfflineAudioContext !== "undefined" && ctx instanceof OfflineAudioContext)) {
      if (this.trackAudible.get(trackId) !== false) sendExternalNote(trackId, midi, duration, velocity, t0 - ctx.currentTime);
      return;
    }
    const ch = this.playbackChannel(trackId);
    if (patch.granular) {
      this.playGranular(trackId, ch.input, patch.granular, midi, duration, velocity, t0);
      return;
    }
    if (patch.modular) {
      // Each modular voice runs through its own gate so Stop/silence can always cut it.
      const gate = ctx.createGain();
      gate.connect(ch.input);
      const gates = this.modularGates.get(trackId) ?? new Set<GainNode>();
      gates.add(gate); this.modularGates.set(trackId, gates);
      const life = playModularVoice(ctx, gate, patch.modular, midi, duration, velocity, t0, this.pitchMod(trackId).sum, (mod, output) =>
        !(typeof OfflineAudioContext !== 'undefined' && ctx instanceof OfflineAudioContext) && MODULAR_SCOPE_TYPES.includes(mod.type) ? attachModularScope(ctx, modularScopeId(trackId, mod.id), output) : undefined);
      setTimeout(() => { gates.delete(gate); try { gate.disconnect(); } catch { /* gone */ } }, (t0 - ctx.currentTime + life + 0.2) * 1000);
      return;
    }
    const life = duration + patch.amp.release + 0.25;

    /* ---- modulation matrix ---- */
    const routes = (patch.modMatrix ?? []).filter((r) => r.on);
    const macros = patch.macros ?? [0, 0, 0, 0];
    const randomVal = Math.random() * 2 - 1;
    const staticSources: Record<string, number> = {
      velocity: clamp(velocity, 0, 1),
      keytrack: clamp((midi - 60) / 36, -1, 1),
      random: randomVal,
      macro1: macros[0] ?? 0,
      macro2: macros[1] ?? 0,
      macro3: macros[2] ?? 0,
      macro4: macros[3] ?? 0,
    };
    /** Sum of the fixed (non-moving) modulation reaching a destination, in -1..1 units. */
    const fixedMod = (dest: string) =>
      routes.reduce(
        (sum, r) => (r.dest === dest && r.source in staticSources ? sum + r.amount * (staticSources[r.source] ?? 0) : sum),
        0,
      );
    const audioRoutes = (dest: string) => routes.filter((r) => r.dest === dest && !(r.source in staticSources));

    const analog = patch.analog ?? 0;
    const drift = (Math.random() * 2 - 1) * analog;

    /* ---- voice output + per-voice pan ---- */
    const voiceOut = ctx.createGain();
    voiceOut.gain.value = 0;
    const voicePan = ctx.createStereoPanner();
    voicePan.pan.value = clamp(fixedMod("pan"), -1, 1);
    voiceOut.connect(voicePan);
    voicePan.connect(ch.input);

    // mono / legato: retire the previous voice on this track
    const mode = patch.voiceMode ?? "poly";
    if (mode !== "poly") {
      const prev = this.monoVoice.get(trackId);
      if (prev) prev.stop(t0);
    }

    /* ---- filters ---- */
    const kt = patch.keyTracking ?? 0;
    const cutoffMod = Math.pow(2, fixedMod("cutoff") * 4 + drift * 0.15);
    const cutoffBase = clamp(patch.cutoff * Math.pow(2, (kt * (midi - 60)) / 12) * cutoffMod, 40, 18000);

    const filterIn = ctx.createGain();
    const filter = ctx.createBiquadFilter();
    filter.type = patch.filterType;
    filter.Q.value = clamp(patch.resonance * (1 + fixedMod("resonance")), 0, 30);
    filter.frequency.value = cutoffBase;
    filterIn.connect(filter);

    // Scaled into the curve's ±4 range so loud/resonant voices are never hard-clipped (see voice-saturation.ts).
    const shaperIn = ctx.createGain();
    shaperIn.gain.value = VOICE_SHAPER_IN;
    const shaper = ctx.createWaveShaper();
    shaper.curve = this.voiceCurve(patch);
    shaperIn.connect(shaper);

    const f2 = patch.filter2;
    let filter2: BiquadFilterNode | null = null;
    if (f2?.on) {
      filter2 = ctx.createBiquadFilter();
      filter2.type = f2.type;
      filter2.Q.value = clamp(f2.resonance, 0, 30);
      filter2.frequency.value = clamp(f2.cutoff * Math.pow(2, fixedMod("cutoff2") * 4), 40, 18000);
      if (f2.routing === "series") {
        filter.connect(filter2);
        filter2.connect(shaperIn);
      } else {
        filterIn.connect(filter2);
        filter2.connect(shaperIn);
        filter.connect(shaperIn);
      }
    } else {
      filter.connect(shaperIn);
    }

    // flanger / phaser colouring before the voice output
    let tail: AudioNode = shaper;
    const voiceFx = new Map<string, (value: number, time: number) => void>();
    const crushAmt = clamp(patch.fx.bitcrush ?? 0, 0, 1);
    {
      // bit-depth reduction: 12 bits down to 2 bits
      const bits = Math.round(12 - crushAmt * 10);
      const levels = 2 ** bits;
      const n = 4096;
      const curve = new Float32Array(n);
      for (let i = 0; i < n; i++) {
        const x = (i / (n - 1)) * 2 - 1;
        curve[i] = Math.round(x * levels) / levels;
      }
      const crusher = ctx.createWaveShaper();
      crusher.curve = crushAmt > 0.01 ? curve : null;
      voiceFx.set("bitcrush", v => { crusher.curve = v > 0.01 ? makeBitcrushCurve(Math.round(12 - clamp(v, 0, 1) * 10)) : null; });
      shaper.connect(crusher);
      tail = crusher;
    }
    // Flanger, phaser and echo are parallel wet paths: a voice only builds the ones its patch uses
    // (amount > 0), so dense chords don't run hundreds of silent delay/allpass nodes. Raising one
    // from zero applies from the next note; held notes keep live control of paths they have.
    const flanger = patch.fx.flanger ?? 0;
    if (flanger > 0) {
      const d = ctx.createDelay(0.02);
      d.delayTime.value = 0.004;
      const lfo = ctx.createOscillator();
      const lg = ctx.createGain();
      lfo.frequency.value = 0.25;
      lg.gain.value = 0.003 * flanger;
      lfo.connect(lg);
      lg.connect(d.delayTime);
      lfo.start(t0);
      lfo.stop(t0 + life);
      const wet = ctx.createGain();
      wet.gain.value = flanger * 0.7;
      voiceFx.set("flanger", (v, time) => { wet.gain.setTargetAtTime(v * 0.7, time, 0.015); lg.gain.setTargetAtTime(v * 0.003, time, 0.015); });
      tail.connect(d);
      d.connect(wet);
      wet.connect(voiceOut);
    }
    const phaser = patch.fx.phaser ?? 0;
    if (phaser > 0) {
      let node: AudioNode = tail;
      for (let i = 0; i < 4; i++) {
        const ap = ctx.createBiquadFilter();
        ap.type = "allpass";
        ap.frequency.value = 400 + i * 600;
        node.connect(ap);
        node = ap;
      }
      const wet = ctx.createGain();
      wet.gain.value = phaser * 0.8;
      voiceFx.set("phaser", (v, time) => wet.gain.setTargetAtTime(v * 0.8, time, 0.015));
      node.connect(wet);
      wet.connect(voiceOut);
    }
    tail.connect(voiceOut);

    /** Per-voice echo nodes, released once the echo has died away. */
    const echoNodes: AudioNode[] = [];
    if (patch.fx.delay > 0) {
      const delay = ctx.createDelay(1.5);
      echoNodes.push(delay);
      delay.delayTime.value = 0.28;
      const fb = ctx.createGain();
      fb.gain.value = clamp(patch.fx.delayFeedback, 0, 0.8);
      const wet = ctx.createGain();
      wet.gain.value = patch.fx.delay * 0.6;
      voiceFx.set("delay", (v, time) => wet.gain.setTargetAtTime(v * 0.6, time, 0.015));
      voiceFx.set("delayFeedback", (v, time) => fb.gain.setTargetAtTime(clamp(v, 0, 0.8), time, 0.015));
      voicePan.connect(wet);
      wet.connect(delay);
      delay.connect(fb);
      fb.connect(delay);
      delay.connect(ch.input);
    }
    if (this.chorusSend) {
      const wet = ctx.createGain();
      wet.gain.value = patch.fx.chorus * 0.7;
      voiceFx.set("chorus", (v, time) => wet.gain.setTargetAtTime(v * 0.7, time, 0.015));
      voicePan.connect(wet);
      // Route through the channel's send scale so track mute/volume/VCA apply.
      wet.connect(ch.synthChorusScale);
    }
    if (this.reverbSend) {
      const wet = ctx.createGain();
      wet.gain.value = patch.fx.reverb * 0.5;
      voiceFx.set("reverb", (v, time) => wet.gain.setTargetAtTime(v * 0.5, time, 0.015));
      voicePan.connect(wet);
      wet.connect(ch.synthReverbScale);
    }

    /* ---- oscillators ---- */
    const voices = clamp(Math.round(patch.unison.voices), 1, 7);
    const unisonDetune = clamp(patch.unison.detune * (1 + fixedMod("unisonDetune")), 0, 100);
    const levelMod = clamp(1 + fixedMod("level"), 0, 2);
    const nodes: (OscillatorNode | AudioBufferSourceNode)[] = [];
    const oscControls: { index: number; spread: number; source: OscillatorNode | AudioBufferSourceNode; gain: GainNode; pan: StereoPannerNode }[] = [];
    const oscNodes: (OscillatorNode | null)[][] = patch.oscillators.map(() => []);
    const rootFreq = midiToFreq(midi);
    const prevMidi = this.lastMidi.get(trackId);
    const glide = patch.glide ?? 0;
    const doGlide = glide > 0 && prevMidi !== undefined && (patch.glideMode !== "legato" || mode !== "poly");

    const light = patch.lightVoices === true;
    const fmAny = fixedMod("fmAmount") > 0;
    const ringCarrier = patch.oscillators.some((x, j) => j > 0 && x.on && x.ring);
    patch.oscillators.forEach((osc, oi) => {
      // Keep muted oscillators available for live level/on edits — unless the patch asks for light
      // voices, where a switched-off oscillator that isn't a ring carrier or FM source is skipped.
      if (light && !osc.on && !(oi === 0 && ringCarrier) && !((osc.fm ?? 0) > 0 || fmAny)) return;

      for (let u = 0; u < voices; u++) {
        const spread = voices === 1 ? 0 : (u / (voices - 1) - 0.5) * 2;
        const g = ctx.createGain();
        g.gain.value = (osc.on ? (osc.level * levelMod) / voices : 0) * velocity;
        const p = ctx.createStereoPanner();
        p.pan.value = clamp(osc.pan + spread * patch.unison.width, -1, 1);
        g.connect(p);
        p.connect(filterIn);

        if (osc.wave === "noise") {
          const src = this.noiseSource(ctx, t0, life);
          src.connect(g);
          nodes.push(src);
          oscControls.push({ index: oi, spread, source: src, gain: g, pan: p });
          oscNodes[oi]!.push(null);
          continue;
        }

        const o = ctx.createOscillator();
        if (osc.wave === "pulse") {
          const pw = clamp((osc.pulseWidth ?? 0.3) + fixedMod("pulseWidth") * 0.4, 0.02, 0.98);
          o.setPeriodicWave(this.pulseWave(ctx, pw));
        } else if (osc.wave === "wavetable") {
          const morph = clamp((osc.morph ?? 0.5) + fixedMod("morph"), 0, 1);
          o.setPeriodicWave(this.wavetableWave(ctx, morph));
        } else {
          o.type = osc.wave;
        }
        if ((osc.phase ?? 0) !== 0) {
          const harmonics = phasedHarmonics(osc.wave, osc.phase ?? 0, osc.pulseWidth, osc.morph);
          o.setPeriodicWave(ctx.createPeriodicWave(harmonics.real, harmonics.imag));
        }
        const freq = midiToFreq(midi + osc.octave * 12 + osc.semitone);
        if (doGlide) {
          const from = midiToFreq(prevMidi! + osc.octave * 12 + osc.semitone);
          o.frequency.setValueAtTime(from, t0);
          o.frequency.exponentialRampToValueAtTime(Math.max(20, freq), t0 + glide);
        } else {
          o.frequency.setValueAtTime(freq, t0);
        }
        o.detune.setValueAtTime(
          osc.detune + (osc.fine ?? 0) + spread * unisonDetune + fixedMod("pitch") * 1200 + drift * 12,
          t0,
        );
        {
          const pmSum = this.pitchMod(trackId).sum;
          pmSum.connect(o.detune);
          o.addEventListener("ended", () => { try { pmSum.disconnect(o.detune); } catch { /* already gone */ } });
        }
        // hard-sync flavour: snap the partial back toward the root pitch
        if (osc.sync) o.frequency.setValueAtTime(rootFreq * Math.round(freq / rootFreq || 1), t0);

        // ring modulation against oscillator 1
        const carrier = oi > 0 && osc.ring ? oscNodes[0]?.[u] ?? null : null;
        if (carrier) {
          const ring = ctx.createGain();
          ring.gain.value = 0;
          carrier.connect(ring.gain);
          o.connect(ring);
          ring.connect(g);
        } else {
          o.connect(g);
        }

        o.start(t0);
        o.stop(t0 + life);
        nodes.push(o);
        oscControls.push({ index: oi, spread, source: o, gain: g, pan: p });
        oscNodes[oi]!.push(o);
      }
    });

    // FM: each oscillator can frequency-modulate the next one
    const fmMod = fixedMod("fmAmount");
    patch.oscillators.forEach((osc, oi) => {
      const amount = clamp((osc.fm ?? 0) + fmMod, 0, 1);
      if (amount <= 0) return;
      const targets = oscNodes[oi + 1];
      if (!targets) return;
      (oscNodes[oi] ?? []).forEach((mod, u) => {
        const target = targets[u];
        if (!mod || !target) return;
        const depth = ctx.createGain();
        depth.gain.value = amount * rootFreq * 6;
        mod.connect(depth);
        depth.connect(target.frequency);
      });
    });

    let noiseGain: GainNode | undefined;
    if (!light || patch.noise > 0 || !nodes.length) {
      const src = this.noiseSource(ctx, t0, life);
      const g = ctx.createGain();
      g.gain.value = patch.noise * 0.4 * velocity;
      noiseGain = g;
      src.connect(g);
      g.connect(filterIn);
      nodes.push(src);
    }

    /* ---- legacy LFO destinations ---- */
    const lfoControls: { index: number; source: OscillatorNode; depth: GainNode; destination: string }[] = [];
    const runningMods: { stop: (t: number) => void }[] = [];
    patch.lfos.forEach((lfo, index) => {
      if (light && !lfo.on) return;
      const o = ctx.createOscillator();
      o.type = lfo.wave;
      o.frequency.value = lfoHz(lfo, this.tempo);
      const g = ctx.createGain();
      if (lfo.destination === "filter") {
        g.gain.value = lfo.amount * 2000;
        g.connect(filter.frequency);
      } else if (lfo.destination === "volume") {
        g.gain.value = lfo.amount * 0.4;
        g.connect(voiceOut.gain);
      } else if (lfo.destination === "pan") {
        g.gain.value = lfo.amount;
        g.connect(voicePan.pan);
      } else {
        g.gain.value = lfo.amount * 50;
        nodes.forEach((n) => {
          if ("detune" in n && n.detune) g.connect((n as OscillatorNode).detune);
        });
      }
      if (!lfo.on) g.gain.value = 0;
      o.connect(g);
      lfoControls.push({ index, source: o, depth: g, destination: lfo.destination });
      o.start(t0);
      o.stop(t0 + life);
      runningMods.push({ stop: (t) => { try { o.stop(t); } catch { /* done */ } } });
    });

    /* ---- mod matrix: moving sources ---- */
    const modOutputs = new Map<string, AudioNode>();
    const modSource = (src: string): AudioNode | null => {
      const cached = modOutputs.get(src);
      if (cached) return cached;
      if (src === "modEnv") {
        const env = patch.modEnv ?? { attack: 0.01, decay: 0.3, sustain: 0.5, release: 0.3 };
        const cs = ctx.createConstantSource();
        cs.offset.setValueAtTime(0, t0);
        cs.offset.linearRampToValueAtTime(1, t0 + Math.max(0.001, env.attack));
        cs.offset.linearRampToValueAtTime(env.sustain, t0 + env.attack + env.decay);
        const rel = t0 + Math.max(duration, env.attack + env.decay);
        cs.offset.setValueAtTime(env.sustain, rel);
        cs.offset.linearRampToValueAtTime(0, rel + Math.max(0.01, env.release));
        cs.start(t0);
        cs.stop(t0 + life);
        modOutputs.set(src, cs);
        runningMods.push({ stop: (t) => { try { cs.stop(t); } catch { /* done */ } } });
        return cs;
      }
      const idx = src === "lfo1" ? 0 : src === "lfo2" ? 1 : src === "lfo3" ? 2 : -1;
      if (idx < 0) return null;
      const cfg = patch.lfos[idx] ?? { rate: 1, wave: "sine" as const, amount: 1, on: true, destination: "filter" as const };
      const o = ctx.createOscillator();
      o.type = cfg.wave;
      o.frequency.value = clamp(lfoHz(cfg, this.tempo), 0.01, 40);
      o.start(t0);
      o.stop(t0 + life);
      modOutputs.set(src, o);
      runningMods.push({ stop: (t) => { try { o.stop(t); } catch { /* done */ } } });
      return o;
    };

    const AUDIO_TARGETS: Record<string, { param: AudioParam | null; scale: number }> = {
      pitch: { param: null, scale: 1200 },
      cutoff: { param: filter.frequency, scale: 4000 },
      cutoff2: { param: filter2 ? filter2.frequency : null, scale: 4000 },
      resonance: { param: filter.Q, scale: 15 },
      level: { param: voiceOut.gain, scale: 0.3 },
      pan: { param: voicePan.pan, scale: 1 },
    };
    for (const dest of Object.keys(AUDIO_TARGETS)) {
      for (const r of audioRoutes(dest)) {
        const src = modSource(r.source);
        if (!src) continue;
        const depth = ctx.createGain();
        const target = AUDIO_TARGETS[dest]!;
        depth.gain.value = r.amount * target.scale;
        src.connect(depth);
        if (dest === "pitch") {
          nodes.forEach((n) => {
            if ("detune" in n && n.detune) depth.connect((n as OscillatorNode).detune);
          });
        } else if (target.param) {
          depth.connect(target.param);
        }
      }
    }

    /* ---- amp envelope ---- */
    const a = patch.amp;
    const sens = patch.velocitySens ?? 1;
    const peak = 0.35 * (1 - sens + sens * clamp(velocity, 0, 1));
    voiceOut.gain.cancelScheduledValues(t0);
    voiceOut.gain.setValueAtTime(0.0001, t0);
    voiceOut.gain.linearRampToValueAtTime(peak, t0 + Math.max(0.001, a.attack));
    voiceOut.gain.linearRampToValueAtTime(peak * a.sustain + 0.0001, t0 + a.attack + a.decay);
    const relStart = t0 + Math.max(duration, a.attack + a.decay);
    voiceOut.gain.setValueAtTime(Math.max(0.0001, peak * a.sustain), relStart);
    voiceOut.gain.exponentialRampToValueAtTime(0.0001, relStart + Math.max(0.02, a.release));

    /* ---- filter envelope ---- */
    const fe = patch.filterEnv;
    const base = cutoffBase;
    filter.frequency.cancelScheduledValues(t0);
    filter.frequency.setValueAtTime(base, t0);
    filter.frequency.linearRampToValueAtTime(clamp(base + fe.amount, 40, 18000), t0 + Math.max(0.001, fe.attack));
    filter.frequency.linearRampToValueAtTime(
      clamp(base + fe.amount * fe.sustain, 40, 18000),
      t0 + fe.attack + fe.decay,
    );
    filter.frequency.setTargetAtTime(base, relStart, Math.max(0.02, fe.release));

    const active = this.liveVoices.get(trackId) ?? new Set();
    const voice = { end: t0 + life, patch, update: (next: SynthPatch, time: number) => {
      const old = voice.patch;
      const glideParam = (param: AudioParam, value: number) => param.setTargetAtTime(value, Math.max(t0, time), 0.015);
      if (next.cutoff !== old.cutoff || next.keyTracking !== old.keyTracking || next.filterEnv !== old.filterEnv) {
        holdAt(filter.frequency, time);
        const base = clamp(next.cutoff * Math.pow(2, ((next.keyTracking ?? 0) * (midi - 60)) / 12) * cutoffMod, 40, 18000);
        for (const [age, level] of envelopePoints(next.filterEnv, duration, Math.max(0, time - t0))) {
          filter.frequency.linearRampToValueAtTime(clamp(base + next.filterEnv.amount * level, 40, 18000), Math.max(time, t0 + age) + 0.015);
        }
      }
      if (noiseGain) glideParam(noiseGain.gain, next.noise * 0.4 * velocity);
      for (const [key, setter] of voiceFx) {
        const value = next.fx[key as keyof SynthPatch["fx"]] ?? 0;
        if (value !== old.fx[key as keyof SynthPatch["fx"]]) setter(value, time);
      }
      filter.type = next.filterType;
      glideParam(filter.Q, clamp(next.resonance * (1 + fixedMod("resonance")), 0, 30));
      if (next.drive !== old.drive || next.fx.distortion !== old.fx.distortion || next.fx.saturation !== old.fx.saturation || next.clean !== old.clean)
        shaper.curve = this.voiceCurve(next);
      if (filter2 && next.filter2) {
        filter2.type = next.filter2.type;
        glideParam(filter2.frequency, clamp(next.filter2.cutoff, 40, 18000));
        glideParam(filter2.Q, clamp(next.filter2.resonance, 0, 30));
      }
      for (const control of oscControls) {
        const osc = next.oscillators[control.index];
        if (!osc) continue;
        glideParam(control.gain.gain, osc.on ? osc.level * levelMod / voices * velocity : 0);
        glideParam(control.pan.pan, clamp(osc.pan + control.spread * next.unison.width, -1, 1));
        if (control.source instanceof OscillatorNode) {
          const source = control.source;
          const prev = old.oscillators[control.index];
          // Only replace the waveform when its shape actually changed; rewriting it on every knob move clicks.
          const shapeChanged = !prev || prev.wave !== osc.wave || prev.pulseWidth !== osc.pulseWidth || prev.morph !== osc.morph || (prev.phase ?? 0) !== (osc.phase ?? 0);
          if (!shapeChanged) { /* keep current waveform */ }
          else if (osc.wave === "pulse") source.setPeriodicWave(this.pulseWave(ctx, clamp(osc.pulseWidth ?? 0.3, 0.02, 0.98)));
          else if (osc.wave === "wavetable") source.setPeriodicWave(this.wavetableWave(ctx, clamp(osc.morph ?? 0.5, 0, 1)));
          else if (osc.wave !== "noise") source.type = osc.wave;
          if (shapeChanged && (osc.phase ?? 0) !== 0) {
            const harmonics = phasedHarmonics(osc.wave, osc.phase ?? 0, osc.pulseWidth, osc.morph);
            source.setPeriodicWave(ctx.createPeriodicWave(harmonics.real, harmonics.imag));
          }
          glideParam(source.frequency, midiToFreq(midi + osc.octave * 12 + osc.semitone));
          glideParam(source.detune, osc.detune + (osc.fine ?? 0) + control.spread * next.unison.detune + fixedMod("pitch") * 1200 + drift * 12);
        }
      }
      for (const control of lfoControls) {
        const lfo = next.lfos[control.index];
        if (!lfo) continue;
        control.source.type = lfo.wave; glideParam(control.source.frequency, lfoHz(lfo, this.tempo));
        const scale = control.destination === "filter" ? 2000 : control.destination === "volume" ? 0.4 : control.destination === "pan" ? 1 : 50;
        glideParam(control.depth.gain, lfo.on ? lfo.amount * scale : 0);
      }
      if (next.amp !== old.amp || next.velocitySens !== old.velocitySens) {
        holdAt(voiceOut.gain, time);
        const sens = next.velocitySens ?? 1;
        const peak = 0.35 * (1 - sens + sens * clamp(velocity, 0, 1));
        for (const [age, level] of envelopePoints(next.amp, duration, Math.max(0, time - t0)))
          voiceOut.gain.linearRampToValueAtTime(Math.max(0.0001, peak * level), Math.max(time, t0 + age) + 0.015);
      }
    } };
    active.add(voice); this.liveVoices.set(trackId, active);
    const cleanupSource = nodes[0];
    cleanupSource?.addEventListener("ended", () => {
      active.delete(voice);
      if (!active.size) this.liveVoices.delete(trackId);
      // Release the finished voice's graph so long sessions don't pile up silent nodes.
      // The echo keeps ringing for a few seconds first; offline renders keep everything until done.
      if (typeof OfflineAudioContext !== "undefined" && ctx instanceof OfflineAudioContext) return;
      try { voiceOut.disconnect(); } catch { /* already detached */ }
      setTimeout(() => {
        try { voicePan.disconnect(); } catch { /* already detached */ }
        for (const n of echoNodes) { try { n.disconnect(); } catch { /* already detached */ } }
      }, 8000);
    });
    this.lastMidi.set(trackId, midi);
    if (mode !== "poly") {
      this.monoVoice.set(trackId, {
        out: voiceOut,
        stop: (t) => {
          try {
            voiceOut.gain.cancelScheduledValues(t);
            voiceOut.gain.setTargetAtTime(0.0001, t, 0.008);
          } catch {
            /* already gone */
          }
          for (const n of nodes) {
            try {
              n.stop(t + 0.05);
            } catch {
              /* already stopped */
            }
          }
          for (const m of runningMods) m.stop(t + 0.05);
        },
      });
    }
  }

  /* ---------------- drum voices ---------------- */
  /** Loud metronome click straight to the master output (count-in / pre-count). */
  playClick(accent = false, when?: number) {
    const ctx = this.init();
    if (!this.master) return;
    const prefs = playbackPreferences();
    if (prefs.clickLevel <= 0) return;
    const t = Math.max(when ?? ctx.currentTime, ctx.currentTime + 0.002);
    const osc = ctx.createOscillator();
    const sounds: Record<string, [OscillatorType, number, number]> = {
      "Detroit Rim": ["triangle", 1200, 0.035], Click: ["square", 1600, 0.018],
      Cowbell: ["square", 540, 0.08], Sidestick: ["triangle", 850, 0.024], Beep: ["sine", 1000, 0.08],
    };
    const [wave, frequency, duration] = sounds[prefs.clickSound] ?? ["square", 1174.7, 0.08];
    osc.type = wave;
    osc.frequency.value = frequency * (accent ? 1.5 : 1);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(Math.max(0.0001, prefs.clickLevel * 0.5), t + 0.003);
    g.gain.exponentialRampToValueAtTime(0.0001, t + duration);
    osc.connect(g);
    g.connect(this.master);
    osc.start(t);
    osc.stop(t + duration + 0.02);
  }

  private vintageDrumBuffers = new Map<string, AudioBuffer>();

  playDrum(trackId: string, pad: DrumPad, velocity = 1, when?: number) {
    const ctx = this.init();
    const t = Math.max(when ?? ctx.currentTime, ctx.currentTime + 0.002);
    const ch = this.playbackChannel(trackId);
    const out = ctx.createGain();
    out.gain.value = pad.volume;
    const p = ctx.createStereoPanner();
    p.pan.value = clamp(pad.pan, -1, 1);
    const vol = velocity;
    const tune = Math.pow(2, pad.pitch / 12);
    const dec = 0.1 + pad.decay;

    let drumTone: BiquadFilterNode | undefined;
    let drumFilter: BiquadFilterNode | undefined;
    // ---- shaping chain: out -> distortion -> compressor -> tone -> envelope -> pan -> channel
    const drive = clamp(pad.drive ?? 0, 0, 1);
    let node: AudioNode = out;
    if (drive > 0.001) {
      const shaper = ctx.createWaveShaper();
      const k = 1 + drive * 60;
      shaper.curve = this.distortionCurve(drive);
      shaper.oversample = "2x";
      const trim = ctx.createGain();
      trim.gain.value = 1 / (1 + drive * 1.6);
      node.connect(shaper);
      shaper.connect(trim);
      node = trim;
    }

    const compression = clamp(pad.compressor ?? 0, 0, 1);
    if (compression > 0.001) {
      const compressor = ctx.createDynamicsCompressor();
      compressor.threshold.value = -8 - compression * 34;
      compressor.knee.value = 18 - compression * 14;
      compressor.ratio.value = 1 + compression * 11;
      compressor.attack.value = 0.002 + (1 - compression) * 0.018;
      compressor.release.value = 0.08 + compression * 0.22;
      node.connect(compressor);
      node = compressor;
    }

    const toneAmt = clamp(pad.tone ?? 0.5, 0, 1);
    {
      const f = ctx.createBiquadFilter();
      if (toneAmt < 0.5) {
        f.type = "lowpass";
        f.frequency.value = 300 * Math.pow(60, toneAmt * 2); // 300Hz .. 18kHz
      } else {
        f.type = "highpass";
        f.frequency.value = 30 * Math.pow(120, (toneAmt - 0.5) * 2); // 30Hz .. 3.6kHz
      }
      f.Q.value = 0.8;
      drumTone = f;
      node.connect(f);
      node = f;
    }

    // resonant sweepable filter (off unless filterType set)
    if (pad.filterType && pad.filterType !== "off") {
      const f = ctx.createBiquadFilter();
      drumFilter = f;
      f.type = pad.filterType;
      const base = 40 * Math.pow(450, clamp(pad.cutoff ?? 1, 0, 1)); // 40Hz..18kHz
      const q = 0.5 + clamp(pad.resonance ?? 0, 0, 1) * 18;
      f.Q.value = q;
      const envAmt = clamp(pad.filterEnv ?? 0, -1, 1);
      if (Math.abs(envAmt) > 0.01) {
        const peak = clamp(base * Math.pow(8, envAmt), 30, 20000);
        f.frequency.setValueAtTime(peak, t);
        f.frequency.exponentialRampToValueAtTime(Math.max(30, base), t + 0.02 + dec * 0.6);
      } else f.frequency.value = base;
      node.connect(f);
      node = f;
    }

    // bit / sample-rate crush
    const crush = clamp(pad.crush ?? 0, 0, 1);
    if (crush > 0.01) {
      const shaper = ctx.createWaveShaper();
      const levels = Math.max(2, Math.round(Math.pow(2, 12 - crush * 10)));
      const curve = new Float32Array(2048);
      for (let i = 0; i < 2048; i++) {
        const x = (i / 2047) * 2 - 1;
        curve[i] = Math.round(x * levels) / levels;
      }
      shaper.curve = curve;
      node.connect(shaper);
      node = shaper;
    }

    const env = ctx.createGain();
    const atk = Math.max(0.0005, (pad.attack ?? 0) * 0.25);
    const rel = 0.02 + (pad.release ?? 0.2) * 1.5;
    // HOLD keeps the pad at full level for up to one extra second before its release.
    const hold = Math.max(0.02, dec * 1.2) + Math.max(0, Math.min(1, pad.sustain ?? 0));
    env.gain.setValueAtTime(0.0001, t);
    env.gain.linearRampToValueAtTime(1, t + atk);
    env.gain.setValueAtTime(1, t + atk + hold);
    env.gain.exponentialRampToValueAtTime(0.0001, t + atk + hold + rel);
    node.connect(env);
    env.connect(p);
    p.connect(ch.input);

    // user sample on this pad: play the real audio through the same shaping chain
    const retainDrum = (source: AudioBufferSourceNode, length: number) => {
      const key = JSON.stringify([trackId, pad.id]);
      const voices = this.liveDrums.get(key) ?? new Set();
      const voice = { end: t + length, pad, update: (next: DrumPad, time: number) => {
        const prev = voice.pad;
        if (next.volume !== prev.volume) out.gain.setTargetAtTime(next.volume, time, 0.015);
        if (next.pan !== prev.pan) p.pan.setTargetAtTime(clamp(next.pan, -1, 1), time, 0.015);
        if (next.pitch !== prev.pitch) source.playbackRate.setTargetAtTime(Math.pow(2, next.pitch / 12), time, 0.015);
        if (drumTone && next.tone !== prev.tone) {
          const tone = clamp(next.tone ?? 0.5, 0, 1);
          drumTone.type = tone < 0.5 ? "lowpass" : "highpass";
          drumTone.frequency.setTargetAtTime(tone < 0.5 ? 300 * Math.pow(60, tone * 2) : 30 * Math.pow(120, (tone - 0.5) * 2), time, 0.015);
        }
        // Only touch the filter when a filter control moved, so volume/pan edits keep its envelope.
        if (drumFilter && next.filterType && next.filterType !== "off" && (next.filterType !== prev.filterType || next.cutoff !== prev.cutoff || next.resonance !== prev.resonance)) {
          drumFilter.type = next.filterType;
          drumFilter.frequency.cancelScheduledValues(time);
          drumFilter.frequency.setTargetAtTime(40 * Math.pow(450, clamp(next.cutoff ?? 1, 0, 1)), time, 0.015);
          drumFilter.Q.setTargetAtTime(0.5 + clamp(next.resonance ?? 0, 0, 1) * 18, time, 0.015);
        }
      } };
      voices.add(voice); this.liveDrums.set(key, voices);
      source.addEventListener("ended", () => { voices.delete(voice); if (!voices.size) this.liveDrums.delete(key); });
    };
    const sampleBuf = pad.sampleUrl ? (pad.reverse ? this.reversed(pad.sampleUrl) : this.sampleBuffers.get(pad.sampleUrl)) : undefined;
    if (sampleBuf) {
      const src = ctx.createBufferSource();
      src.buffer = sampleBuf;
      src.playbackRate.value = tune;
      const g = ctx.createGain();
      g.gain.value = vol;
      src.connect(g);
      g.connect(out);
      const s0 = clamp(pad.start ?? 0, 0, 1) * sampleBuf.duration;
      const s1 = clamp(pad.end ?? 1, 0, 1) * sampleBuf.duration;
      const len = Math.max(0.005, (s1 - s0) / tune);
      env.gain.cancelScheduledValues(t);
      env.gain.setValueAtTime(0.0001, t);
      env.gain.linearRampToValueAtTime(1, t + atk);
      env.gain.setValueAtTime(1, t + Math.max(atk, len - 0.01));
      env.gain.linearRampToValueAtTime(0.0001, t + len);
      retainDrum(src, len);
      src.start(t, s0, s1 - s0);
      return;
    }

    const noiseBurst = (dur: number, freq: number, type: BiquadFilterType, q = 1, level = 1, spread = 0, offset = 0) => {
      const len = Math.ceil(ctx.sampleRate * dur);
      const buf = ctx.createBuffer(1, len, ctx.sampleRate);
      const d = buf.getChannelData(0);
      for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 2);
      const src = ctx.createBufferSource();
      src.buffer = buf;
      const f = ctx.createBiquadFilter();
      f.type = type;
      f.frequency.value = freq * tune;
      f.Q.value = q;
      const g = ctx.createGain();
      g.gain.value = vol * level;
      src.connect(f);
      f.connect(g);
      if (spread > 0.001) {
        const sp = ctx.createStereoPanner();
        sp.pan.value = clamp((Math.random() * 2 - 1) * spread, -1, 1);
        g.connect(sp);
        sp.connect(out);
      } else {
        g.connect(out);
      }
      src.start(t + offset);
    };

    const tone = (start: number, end: number, dur: number, type: OscillatorType = "sine", level = 1) => {
      const o = ctx.createOscillator();
      o.type = type;
      o.frequency.setValueAtTime(start * tune, t);
      o.frequency.exponentialRampToValueAtTime(Math.max(20, end * tune), t + dur);
      const g = ctx.createGain();
      g.gain.setValueAtTime(vol * level, t);
      g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      o.connect(g);
      g.connect(out);
      o.start(t);
      o.stop(t + dur + 0.02);
    };

    const kit = pad.kit ?? "909";
    const cacheKey = `${ctx.sampleRate}:${kit}:${pad.kind}:${pad.voice ?? ""}:${pad.decay.toFixed(4)}`;
    let vintage = this.vintageDrumBuffers.get(cacheKey);
    if (!vintage) {
      const pcm = renderVintageDrum(kit, pad.kind, pad.decay, ctx.sampleRate, pad.voice);
      if (pcm) {
        vintage = ctx.createBuffer(1, pcm.length, ctx.sampleRate);
        vintage.getChannelData(0).set(pcm);
        if (this.vintageDrumBuffers.size >= 128) this.vintageDrumBuffers.clear();
        this.vintageDrumBuffers.set(cacheKey, vintage);
      }
    }
    if (vintage) {
      const source = ctx.createBufferSource();
      source.buffer = vintage;
      source.playbackRate.value = tune;
      const gain = ctx.createGain();
      gain.gain.value = vol;
      source.connect(gain);
      gain.connect(out);
      // Keep the original voice tail; attack/release still shape its actual audio.
      const end = vintage.duration / tune;
      env.gain.cancelScheduledValues(t);
      env.gain.setValueAtTime(0.0001, t);
      env.gain.linearRampToValueAtTime(1, t + Math.min(atk, end / 2));
      env.gain.setValueAtTime(1, t + Math.max(atk, end - Math.min(rel, end / 3)));
      env.gain.exponentialRampToValueAtTime(0.0001, t + end);
      retainDrum(source, end);
      source.start(t);
    } else {
    const K = DRUM_KIT_VOICES[pad.kit ?? "909"] ?? DRUM_KIT_VOICES["909"];

    switch (pad.kind) {
      case "kick":
        tone(K.kick[0], K.kick[1], K.kick[2] * dec * 2, K.kick[3]);
        noiseBurst(0.02 * K.click, 1800, "highpass");
        break;
      case "snare":
        tone(K.snare[0], K.snare[0] * 0.6, 0.12 * dec * 2, "triangle", 0.6 * K.body);
        noiseBurst(0.22 * dec * 2 * K.snare[2], K.snare[1], "highpass");
        break;
      case "clap":
        [0, 0.012, 0.024].forEach((o) => noiseBurst(0.16 * K.snare[2], K.clap, "bandpass", 1.6, 1, 0, o));
        break;
      case "hat":
        noiseBurst(0.06 * dec * 2 * K.hatD, K.hatF, "highpass");
        break;
      case "openhat":
        noiseBurst(0.35 * dec * 2 * K.hatD, K.hatF * 0.9, "highpass");
        break;
      case "tom":
        tone(K.tom[0], K.tom[1], 0.4 * dec * 2, "sine");
        break;
      case "perc":
        tone(K.perc, K.perc / 2, 0.12 * dec * 2, "square", 0.5);
        break;
      case "rim":
        tone(K.perc * 2.6, K.perc * 1.4, 0.05, "square", 0.5);
        break;
      case "crash":
        noiseBurst(1.2 * dec, K.crash, "highpass");
        break;
      case "ride":
        noiseBurst(0.6 * dec, K.ride, "bandpass", 0.8);
        break;
      default:
        noiseBurst(0.4 * dec, 900, "bandpass", 3);
    }

    }

    // extra transient click
    const snap = clamp(pad.snap ?? 0, 0, 1);
    if (snap > 0.001) noiseBurst(0.004 + snap * 0.016, 2600 + snap * 5000, "highpass", 0.9, snap);

    // extra noise layer, spread in stereo by WIDTH
    const noise = clamp(pad.noise ?? 0, 0, 1);
    if (noise > 0.001)
      noiseBurst(0.03 + noise * dec * 1.6, 400 + noise * 4000, "bandpass", 0.7, noise * 0.8, clamp(pad.width ?? 0, 0, 1));
  }
}

function setTimeoutBurst(fn: () => void, delay: number) {
  if (delay === 0) fn();
  else setTimeout(fn, delay * 1000);
}

const engineGlobal = globalThis as typeof globalThis & { __synclabEngine?: SyncLabEngine };
export const getEngine = () => {
  const current = engineGlobal.__synclabEngine;
  // a stale instance from a previous hot reload may lack newer methods
  const required: (keyof SyncLabEngine)[] = [
    "setBus",
    "setFxInserts",
    "startInputMonitoring",
    "stopInputMonitoring",
    "setVcaStates",
    "setAuxReturn",
    "getMasterChannel",
    "syncSoundControls",
    "granularGrains",
  ];
  if (!current || required.some((m) => typeof current[m] !== "function")) {
    engineGlobal.__synclabEngine = new SyncLabEngine();
  }
  return engineGlobal.__synclabEngine!;
};

