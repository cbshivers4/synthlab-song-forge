import { keysSnapshot, subscribeKeys } from "./active-keys";
import type { DrumKitId, DrumPad, PluginInstance, SynthPatch, Track } from "./types";
import { getInputChannel, getInputGainDb, getOutputDevice, openMicOrThrow, preferredRecordingMime, releaseMic } from "./mic";

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

function makeGateCurve(threshold: number) {
  const n = 4096;
  const curve = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const x = (i / (n - 1)) * 2 - 1;
    const a = Math.abs(x);
    const sign = x < 0 ? -1 : 1;
    if (a >= threshold) {
      curve[i] = x;
    } else {
      // soft attenuation below threshold (12 dB/oct-ish expansion feel)
      const r = a / threshold;
      curve[i] = sign * a * r * r;
    }
  }
  return curve;
}

function makeDistortionCurve(amount: number) {
  const k = amount * 100;
  const n = 1024;
  const curve = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const x = (i * 2) / n - 1;
    curve[i] = ((1 + k) * x) / (1 + k * Math.abs(x));
  }
  return curve;
}

interface ChannelStrip {
  input: GainNode;
  gain: GainNode;
  pan: StereoPannerNode;
  meter: AnalyserNode;
  sendReverb: GainNode;
  sendDelay: GainNode;
  sendChorus: GainNode;
  bus: string;
  insertNodes: AudioNode[];
  insertKey: string;
  insertOut: GainNode;
}

type AutomatableAudioParam = { param: AudioParam; min: number; max: number; logarithmic?: boolean };

const vocoderCleanups = new Map<string, () => void>();

export class SyncLabEngine {
  ctx: AudioContext | null = null;
  master: GainNode | null = null;
  reverb: ConvolverNode | null = null;
  reverbSend: GainNode | null = null;
  delaySend: GainNode | null = null;
  chorusSend: GainNode | null = null;
  private buses = new Map<string, GainNode>();
  private busStates: Record<string, { volume: number; muted: boolean }> = {};
  private mixTracks: Track[] = [];
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
  private resumeListenersInstalled = false;
  private monitorGeneration = 0;
  private recordingStart: Promise<void> | null = null;
  private distortionCurves = new Map<string, Float32Array<ArrayBuffer>>();



  init() {
    if (this.ctx) {
      if (this.ctx.state === "suspended") void this.ctx.resume();
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
      const resume = () => {
        if (this.ctx?.state === "suspended") void this.ctx.resume().catch(() => undefined);
      };
      document.addEventListener("visibilitychange", () => {
        if (document.visibilityState === "visible") resume();
      });
      window.addEventListener("pageshow", resume);
      window.addEventListener("pointerdown", resume, { passive: true });
      window.addEventListener("keydown", resume);
    }
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
    return ctx;
  }

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

  /* ---------------- master capture (bounce / export) ---------------- */
  private capture: {
    proc: ScriptProcessorNode;
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
    const cap = { proc, sink: ctx.createGain(), left, right, frames: 0 };
    proc.onaudioprocess = (e) => {
      const l = e.inputBuffer.getChannelData(0);
      const r = e.inputBuffer.numberOfChannels > 1 ? e.inputBuffer.getChannelData(1) : l;
      left.push(new Float32Array(l));
      right.push(new Float32Array(r));
      cap.frames += l.length;
    };
    cap.sink.gain.value = 0;
    this.master.connect(proc);
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
      this.master.disconnect(cap.proc);
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

  setBus(id: string, volume: number, muted: boolean) {
    this.busStates[id] = { volume, muted };
    if (!this.ctx) return;
    // The master fader controls the complete mix, including every bus and FX return.
    // The "master" routing bus stays at unity so direct tracks are not attenuated twice.
    if (id === "master") {
      this.master?.gain.setTargetAtTime(muted ? 0 : 0.85 * clamp(volume, 0, 1.5), this.ctx.currentTime, 0.02);
      return;
    }
    this.busNode(id).gain.setTargetAtTime(muted ? 0 : clamp(volume, 0, 1.5), this.ctx.currentTime, 0.02);
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
    const scale = track.bus === "master" || !bus ? 1 : bus.muted ? 0 : clamp(bus.volume, 0, 1.5);
    const sends = track.sends ?? { reverb: 0, delay: 0, chorus: 0 };
    ch.sendReverb.gain.setTargetAtTime(clamp(sends.reverb * scale, 0, 1.5), time, 0.02);
    ch.sendDelay.gain.setTargetAtTime(clamp(sends.delay * scale, 0, 1.5), time, 0.02);
    ch.sendChorus.gain.setTargetAtTime(clamp(sends.chorus * scale, 0, 1.5), time, 0.02);
  }

  setAuxReturn(id: string, volume: number, muted: boolean) {
    this.auxStates[id] = { volume, muted };
    const node = this.auxReturns.get(id);
    if (!node || !this.ctx) return;
    node.gain.setTargetAtTime(muted ? 0 : clamp(volume, 0, 1.5), this.ctx.currentTime, 0.02);
  }

  setVcaStates(states: Record<string, { volume: number; muted: boolean }>, tracks: Track[]) {
    this.vcaStates = states;
    this.syncMix(tracks);
  }

  getLevel() {
    return this.peakOf(this.analyser);
  }

  private peakOf(node: AnalyserNode | null | undefined) {
    if (!node) return 0;
    const data = new Uint8Array(node.fftSize);
    node.getByteTimeDomainData(data);
    let peak = 0;
    for (let i = 0; i < data.length; i++) peak = Math.max(peak, Math.abs((data[i] ?? 128) - 128) / 128);
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

  channel(id: string): ChannelStrip {
    const ctx = this.init();
    let ch = this.channels.get(id);
    if (!ch) {
      const input = ctx.createGain();
      const gain = ctx.createGain();
      const pan = ctx.createStereoPanner();
      const meter = ctx.createAnalyser();
      meter.fftSize = 1024;
      meter.smoothingTimeConstant = 0.55;
      // channel meter doubles as the strip scope source
      this.pluginScopes.set(`ch:${id}`, meter);
      input.connect(gain);
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
      sendReverb.connect(this.reverbSend!);
      sendDelay.connect(this.delaySend!);
      sendChorus.connect(this.chorusSend!);
      ch = { input, gain, pan, meter, sendReverb, sendDelay, sendChorus, bus: "master", insertNodes: [], insertKey: "", insertOut };
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
        filter: 1,
        drive: 3,
        compressor: 2,
        delay: 5,
        width: 1,
        gain: 1,
        reverb: 5,
        chorus: 4,
        flanger: 5,
        phaser: 7,
        tremolo: 1,
        autopan: 1,
        limiter: 1,
        bitcrusher: 5,
        vocoder: 2,
        gate: 1,
        stepfilter: 5,
        resonator: 12,
        scalechord: 1,
        transient: 5,
      }[pl.kind];
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
    for (const k of [...this.liveParams.keys()]) if (k.startsWith(`${targetId}:`)) this.liveParams.delete(k);


    for (const pl of active) {
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
          }
          const out = ctx.createGain();
          out.gain.value = dbToGain(val(pl, "output", 0));
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
          nodes.push(f);
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
          ws.connect(tone);
          tone.connect(out);
          live(pl, "drive", (v) => { ws.curve = makeDistortionCurve(clamp(v, 0, 1)); });
          live(pl, "tone", (v, t) => glide(tone.frequency, v, t));
          live(pl, "output", (v, t) => glide(out.gain, dbToGain(v), t));
          nodes.push(ws, tone, out);
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
          nodes.push(c, out);
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
          d.connect(fb);
          fb.connect(d);
          d.connect(wet);
          wet.connect(out);
          live(pl, "time", (v, t) => d.delayTime.setTargetAtTime(clamp(v / 1000, 0.01, 2), t, 0.05));
          live(pl, "feedback", (v, t) => glide(fb.gain, clamp(v, 0, 0.92), t));
          live(pl, "mix", (v, t) => glide(wet.gain, clamp(v, 0, 1), t));
          nodes.push(inNode, d, fb, wet, out);
          break;
        }
        case "width": {
          const w = ctx.createGain();
          w.gain.value = dbToGain(val(pl, "output", 0));
          live(pl, "output", (v, t) => glide(w.gain, dbToGain(v), t));
          nodes.push(w);
          break;
        }
        case "gain": {
          const g2 = ctx.createGain();
          g2.gain.value = dbToGain(val(pl, "gain", 0));
          live(pl, "gain", (v, t) => glide(g2.gain, dbToGain(v), t));
          nodes.push(g2);
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
          conv.connect(wet);
          wet.connect(out);
          live(pl, "predelay", (v, t) => glide(pre.delayTime, clamp(v / 1000, 0, 0.5), t));
          live(pl, "mix", (v, t) => glide(wet.gain, clamp(v, 0, 1), t));
          nodes.push(inNode, pre, conv, wet, out);
          break;
        }
        case "chorus": {
          const inNode = ctx.createGain();
          const d = ctx.createDelay(0.1);
          d.delayTime.value = 0.02;
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
          nodes.push(inNode, d, wet, out);
          break;
        }
        case "flanger": {
          const inNode = ctx.createGain();
          const d = ctx.createDelay(0.05);
          d.delayTime.value = 0.004;
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
          let cur: AudioNode = inNode;
          for (let i = 0; i < 4; i++) {
            const ap = ctx.createBiquadFilter();
            ap.type = "allpass";
            ap.frequency.value = center * (1 + i * 0.5);
            ap.Q.value = 0.8;
            lfoGain.connect(ap.frequency);
            cur.connect(ap);
            cur = ap;
            nodes.push(ap);
          }
          lfo.start();
          cur.connect(wet);
          inNode.connect(out);
          wet.connect(out);
          nodes.push(inNode, wet, out);
          break;
        }
        case "tremolo": {
          const g = ctx.createGain();
          const depth = clamp(val(pl, "depth", 0.6), 0, 1);
          g.gain.value = 1 - depth / 2;
          const lfo = ctx.createOscillator();
          lfo.frequency.value = clamp(val(pl, "rate", 5), 0.1, 20);
          const lfoGain = ctx.createGain();
          lfoGain.gain.value = depth / 2;
          lfo.connect(lfoGain);
          lfoGain.connect(g.gain);
          lfo.start();
          nodes.push(g);
          break;
        }
        case "autopan": {
          const pan = ctx.createStereoPanner();
          const lfo = ctx.createOscillator();
          lfo.frequency.value = clamp(val(pl, "rate", 1), 0.05, 10);
          const lfoGain = ctx.createGain();
          lfoGain.gain.value = clamp(val(pl, "depth", 0.8), 0, 1);
          lfo.connect(lfoGain);
          lfoGain.connect(pan.pan);
          lfo.start();
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
          nodes.push(c);
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
          ws.connect(wet);
          wet.connect(out);
          nodes.push(inNode, ws, wet, dry, out);
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
            const curve = new Float32Array(1024);
            for (let i = 0; i < 1024; i++) curve[i] = Math.abs((i / 1023) * 2 - 1);
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
          const thr = Math.pow(10, clamp(val(pl, "threshold", -45), -80, 0) / 20);
          const ws = ctx.createWaveShaper();
          ws.curve = makeGateCurve(thr);
          nodes.push(ws);
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
          const count = Math.round(val(pl, "steps", 16));
          const stepValues = Array.from({ length: count }, (_, i) => val(pl, `s${i + 1}`, 0.5));
          const harmonics = 32;
          const real = new Float32Array(harmonics + 1);
          const imag = new Float32Array(harmonics + 1);
          for (let h = 1; h <= harmonics; h++) {
            for (let i = 0; i < count; i++) {
              const phase = (2 * Math.PI * h * (i + 0.5)) / count;
              real[h] = (real[h] ?? 0) + ((stepValues[i] ?? 0.5) * Math.cos(phase) * 2) / count;
              imag[h] = (imag[h] ?? 0) - ((stepValues[i] ?? 0.5) * Math.sin(phase) * 2) / count;
            }
          }
          const sequencer = ctx.createOscillator();
          sequencer.setPeriodicWave(ctx.createPeriodicWave(real, imag));
          sequencer.frequency.value = clamp(val(pl, "rate", 8), 0.5, 32) / count;
          const depth = ctx.createGain();
          depth.gain.value = cutoff * clamp(val(pl, "depth", 0.85), 0, 1);
          sequencer.connect(depth);
          depth.connect(filter.frequency);
          sequencer.start();
          (out as unknown as { _keep?: AudioNode[] })._keep = [sequencer, depth];
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
          nodes.push(input, dry, wet, ...filters, ...gains, out);
          break;
        }
        case "scalechord": {
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
          wet.connect(out);
          bind(pl, "attack", compressor.ratio, 1, 20);
          bind(pl, "sustain", compressor.release, 0.05, 0.7);
          bind(pl, "mix", wet.gain, 0, 1.5);
          nodes.push(input, dry, compressor, wet, out);
          break;
        }
      }
    }
    return nodes;
  }


  /** Rides a channel from an automation curve without touching stored track values. */
  automate(trackId: string, v: Record<string, number>) {
    if (!this.ctx) return;
    const ch = this.channel(trackId);
    const t = this.ctx.currentTime;
    if (v["volume"] !== undefined) {
      const group = this.trackVcas.get(trackId);
      const vca = group ? this.vcaStates[group] : undefined;
      ch.gain.gain.setTargetAtTime(this.trackAudible.get(trackId) !== false && !vca?.muted
        ? clamp(v["volume"] * (vca?.volume ?? 1), 0, 1.5) : 0, t, 0.02);
    }
    if (v["pan"] !== undefined) ch.pan.pan.setTargetAtTime(clamp(v["pan"], -1, 1), t, 0.02);
    const bus = this.busStates[ch.bus];
    const sendScale = ch.bus === "master" || !bus ? 1 : bus.muted ? 0 : clamp(bus.volume, 0, 1.5);
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

  syncMix(tracks: Track[]) {
    this.mixTracks = tracks;
    if (!this.ctx) return;
    const anySolo = tracks.some((t) => t.solo);
    for (const t of tracks) {
      const ch = this.channel(t.id);
      const audible = !t.muted && (!anySolo || t.solo);
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
      const vca = t.vca ? this.vcaStates[t.vca] : undefined;
      ch.gain.gain.setTargetAtTime(audible && !vca?.muted ? t.volume * (vca?.volume ?? 1) : 0, this.ctx.currentTime, 0.02);
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
          for (const node of ch.insertNodes) {
            try { node.disconnect(); } catch { /* already disconnected */ }
          }
        }, 35);
      } catch {
        try { ch.pan.disconnect(); } catch { /* already disconnected */ }
      }
    }
  }

  /** Fade queued transport/preview channels instead of leaving scheduled notes behind. */
  silenceChannels(ids: string[]) {
    for (const id of ids) {
      this.stopSamples(id);
      const now = this.ctx?.currentTime ?? 0;
      this.monoVoice.get(id)?.stop(now);
      this.monoVoice.delete(id);
      this.lastMidi.delete(id);
      this.removeChannel(id);
    }
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
      this.sampleBuffers.set(url, buffer);
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
    if (this.monitorTrackId === trackId && this.recStream) {
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
    })();
    try {
      await this.recordingStart;
    } finally {
      this.recordingStart = null;
    }
  }

  /** Live input gain in dB (-24..+24), applied before metering, monitoring and recording. */
  setInputGain(db: number) {
    if (this.inputGainNode && this.ctx)
      this.inputGainNode.gain.setTargetAtTime(10 ** (db / 20), this.ctx.currentTime, 0.02);
  }

  /** True when the browser can route playback to a chosen output device. */
  get canPickOutput() {
    return typeof (AudioContext.prototype as unknown as { setSinkId?: unknown }).setSinkId === "function";
  }

  /** Route all app playback to an output device (null = system default). */
  async setOutputDevice(id: string | null) {
    const ctx = this.init() as AudioContext & { setSinkId?: (id: string) => Promise<void> };
    if (!ctx.setSinkId) throw new Error("This browser can't choose an output. Change it in your computer's sound settings.");
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
      rec.onstop = () => resolve(new Blob(this.recChunks, { type: rec.mimeType || "audio/webm" }));
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
    const data = buf.getChannelData(0);
    const buckets = Math.min(1600, Math.max(160, Math.ceil(duration * 80)));
    const size = Math.max(1, Math.ceil(data.length / buckets));
    for (let b = 0; b < buckets; b++) {
      let peak = 0;
      for (let i = b * size; i < Math.min(data.length, (b + 1) * size); i++) peak = Math.max(peak, Math.abs(data[i] ?? 0));
      peaks.push(peak);
    }
    const url = URL.createObjectURL(blob);
    this.sampleBuffers.set(url, buf);
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
  private sampleBuffers = new Map<string, AudioBuffer>();
  private reversedBuffers = new Map<string, AudioBuffer>();
  private liveSamples = new Map<string, AudioBufferSourceNode[]>();
  /** voices grouped by an arbitrary key so pads can choke each other */
  private keyedSamples = new Map<string, AudioBufferSourceNode[]>();

  /** Decodes a dropped audio file, keeps the buffer and returns its display data. */
  async loadSampleFile(file: File | Blob, name: string) {
    const ctx = this.init();
    const raw = await (file as File).arrayBuffer();
    const buf = await ctx.decodeAudioData(raw.slice(0));
    const url = URL.createObjectURL(file);
    this.sampleBuffers.set(url, buf);
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
    const base = s.reverse ? this.reversed(s.url) : this.sampleBuffers.get(s.url);
    if (!base) return null;
    const sync = s.syncToBpm && s.sampleBpm && s.sampleBpm > 0 ? this.tempo / s.sampleBpm : 1;
    const rate = clamp(Math.pow(2, s.pitch / 12) * sync, 0.0625, 16);
    const a = clamp(s.start, 0, 0.999);
    const b = clamp(s.end, a + 0.001, 1);
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
    const ctx = this.init();
    const base = s.reverse ? this.reversed(s.url) : this.sampleBuffers.get(s.url);
    if (!base) return;
    const t0 = Math.max(when ?? ctx.currentTime, ctx.currentTime + 0.002);
    const ch = this.channel(trackId);

    const src = ctx.createBufferSource();
    src.buffer = base;
    const sync = s.syncToBpm && s.sampleBpm && s.sampleBpm > 0 ? this.tempo / s.sampleBpm : 1;
    const rate = Math.pow(2, (midi - s.rootNote + s.pitch) / 12) * sync;
    src.playbackRate.value = clamp(rate, 0.0625, 16);

    const a = clamp(s.start, 0, 0.999);
    const b = clamp(s.end, a + 0.001, 1);
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
      this.sampleBuffers.set(url, buf);
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
    const ch = this.channel(trackId);
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
    const ids = trackId ? [trackId] : [...this.liveSamples.keys()];
    for (const id of ids) {
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

  private lastMidi = new Map<string, number>();
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

  playNote(trackId: string, patch: SynthPatch, midi: number, duration: number, velocity = 1, when?: number) {
    const ctx = this.init();
    const t0 = when ?? ctx.currentTime;
    const ch = this.channel(trackId);
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

    const shaper = ctx.createWaveShaper();
    shaper.curve = this.distortionCurve(Math.min(1.5, 0.05 + patch.fx.distortion + (patch.fx.saturation ?? 0) * 0.6 + (patch.drive ?? 0) * 0.8));

    const f2 = patch.filter2;
    let filter2: BiquadFilterNode | null = null;
    if (f2?.on) {
      filter2 = ctx.createBiquadFilter();
      filter2.type = f2.type;
      filter2.Q.value = clamp(f2.resonance, 0, 30);
      filter2.frequency.value = clamp(f2.cutoff * Math.pow(2, fixedMod("cutoff2") * 4), 40, 18000);
      if (f2.routing === "series") {
        filter.connect(filter2);
        filter2.connect(shaper);
      } else {
        filterIn.connect(filter2);
        filter2.connect(shaper);
        filter.connect(shaper);
      }
    } else {
      filter.connect(shaper);
    }

    // flanger / phaser colouring before the voice output
    let tail: AudioNode = shaper;
    const crushAmt = clamp(patch.fx.bitcrush ?? 0, 0, 1);
    if (crushAmt > 0.01) {
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
      crusher.curve = curve;
      shaper.connect(crusher);
      tail = crusher;
    }
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
      node.connect(wet);
      wet.connect(voiceOut);
    }
    tail.connect(voiceOut);

    if (patch.fx.delay > 0) {
      const delay = ctx.createDelay(1.5);
      delay.delayTime.value = 0.28;
      const fb = ctx.createGain();
      fb.gain.value = clamp(patch.fx.delayFeedback, 0, 0.8);
      const wet = ctx.createGain();
      wet.gain.value = patch.fx.delay * 0.6;
      voicePan.connect(wet);
      wet.connect(delay);
      delay.connect(fb);
      fb.connect(delay);
      delay.connect(ch.input);
    }
    if ((patch.fx.chorus ?? 0) > 0 && this.chorusSend) {
      const wet = ctx.createGain();
      wet.gain.value = patch.fx.chorus * 0.7;
      voicePan.connect(wet);
      wet.connect(this.chorusSend);
    }
    if (patch.fx.reverb > 0 && this.reverbSend) {
      const wet = ctx.createGain();
      wet.gain.value = patch.fx.reverb * 0.5;
      voicePan.connect(wet);
      wet.connect(this.reverbSend);
    }

    /* ---- oscillators ---- */
    const voices = clamp(Math.round(patch.unison.voices), 1, 7);
    const unisonDetune = clamp(patch.unison.detune * (1 + fixedMod("unisonDetune")), 0, 100);
    const levelMod = clamp(1 + fixedMod("level"), 0, 2);
    const nodes: (OscillatorNode | AudioBufferSourceNode)[] = [];
    const oscNodes: (OscillatorNode | null)[][] = patch.oscillators.map(() => []);
    const rootFreq = midiToFreq(midi);
    const prevMidi = this.lastMidi.get(trackId);
    const glide = patch.glide ?? 0;
    const doGlide = glide > 0 && prevMidi !== undefined && (patch.glideMode !== "legato" || mode !== "poly");

    patch.oscillators.forEach((osc, oi) => {
      if (!osc.on || osc.level <= 0) return;
      for (let u = 0; u < voices; u++) {
        const spread = voices === 1 ? 0 : (u / (voices - 1) - 0.5) * 2;
        const g = ctx.createGain();
        g.gain.value = ((osc.level * levelMod) / voices) * velocity;
        const p = ctx.createStereoPanner();
        p.pan.value = clamp(osc.pan + spread * patch.unison.width, -1, 1);
        g.connect(p);
        p.connect(filterIn);

        if (osc.wave === "noise") {
          const len = Math.ceil(ctx.sampleRate * life);
          const buf = ctx.createBuffer(1, len, ctx.sampleRate);
          const d = buf.getChannelData(0);
          for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
          const src = ctx.createBufferSource();
          src.buffer = buf;
          src.connect(g);
          src.start(t0);
          nodes.push(src);
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

    if (patch.noise > 0) {
      const len = Math.ceil(ctx.sampleRate * life);
      const buf = ctx.createBuffer(1, len, ctx.sampleRate);
      const d = buf.getChannelData(0);
      for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
      const src = ctx.createBufferSource();
      src.buffer = buf;
      const g = ctx.createGain();
      g.gain.value = patch.noise * 0.4 * velocity;
      src.connect(g);
      g.connect(filterIn);
      src.start(t0);
      nodes.push(src);
    }

    /* ---- legacy LFO destinations ---- */
    const runningMods: { stop: (t: number) => void }[] = [];
    patch.lfos.forEach((lfo) => {
      if (!lfo.on) return;
      const o = ctx.createOscillator();
      o.type = lfo.wave;
      o.frequency.value = lfo.rate;
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
      o.connect(g);
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
      o.frequency.value = clamp(cfg.rate, 0.01, 40);
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
  playClick(accent = false) {
    const ctx = this.init();
    if (!this.master) return;
    const t = ctx.currentTime + 0.002;
    const osc = ctx.createOscillator();
    osc.type = "square";
    osc.frequency.value = accent ? 1760 : 1174.7;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.35, t + 0.003);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.08);
    osc.connect(g);
    g.connect(this.master);
    osc.start(t);
    osc.stop(t + 0.1);
  }

  playDrum(trackId: string, pad: DrumPad, velocity = 1, when?: number) {
    const ctx = this.init();
    const t = Math.max(when ?? ctx.currentTime, ctx.currentTime + 0.002);
    const ch = this.channel(trackId);
    const out = ctx.createGain();
    const p = ctx.createStereoPanner();
    p.pan.value = clamp(pad.pan, -1, 1);
    const vol = pad.volume * velocity;
    const tune = Math.pow(2, pad.pitch / 12);
    const dec = 0.1 + pad.decay;

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
    if (Math.abs(toneAmt - 0.5) > 0.01) {
      const f = ctx.createBiquadFilter();
      if (toneAmt < 0.5) {
        f.type = "lowpass";
        f.frequency.value = 300 * Math.pow(60, toneAmt * 2); // 300Hz .. 18kHz
      } else {
        f.type = "highpass";
        f.frequency.value = 30 * Math.pow(120, (toneAmt - 0.5) * 2); // 30Hz .. 3.6kHz
      }
      f.Q.value = 0.8;
      node.connect(f);
      node = f;
    }

    // resonant sweepable filter (off unless filterType set)
    if (pad.filterType && pad.filterType !== "off") {
      const f = ctx.createBiquadFilter();
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
    const hold = Math.max(0.02, dec * 1.2);
    env.gain.setValueAtTime(0.0001, t);
    env.gain.linearRampToValueAtTime(1, t + atk);
    env.gain.setValueAtTime(1, t + atk + hold);
    env.gain.exponentialRampToValueAtTime(0.0001, t + atk + hold + rel);
    node.connect(env);
    env.connect(p);
    p.connect(ch.input);

    const noiseBurst = (dur: number, freq: number, type: BiquadFilterType, q = 1, level = 1, spread = 0) => {
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
      src.start(t);
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

    const K = DRUM_KIT_VOICES[pad.kit ?? "909"] ?? DRUM_KIT_VOICES["909"]!;

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
        [0, 0.012, 0.024].forEach((o) =>
          setTimeoutBurst(() => noiseBurst(0.16 * K.snare[2], K.clap, "bandpass", 1.6), o),
        );
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
  ];
  if (!current || required.some((m) => typeof current[m] !== "function")) {
    engineGlobal.__synclabEngine = new SyncLabEngine();
  }
  return engineGlobal.__synclabEngine!;
};

