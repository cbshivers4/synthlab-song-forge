import { getEngine } from "./audio-engine";
import { openMic, releaseMic, getInputChannel } from "./mic";
import type { Capture } from "./bounce";
import { clampTapePosition, joinTapeChunks, tapeCurve } from "./reel-audio";

export type TapeMode = "stopped" | "recording" | "playing" | "paused" | "rewinding";
export interface TapeState {
  mode: TapeMode; busy: boolean; ready: boolean; source: "input" | "song";
  position: number; duration: number; levelL: number; levelR: number; clipped: boolean;
  inputGain: number; tone: number; drive: number; outputGain: number; speed: number;
  monitor: boolean; loop: boolean; name: string; error: string | null; hasTape: boolean;
}
const processorCode = `class TapeCapture extends AudioWorkletProcessor {
  constructor() { super(); this.active = false; this.left = []; this.right = []; this.frames = 0;
    this.port.onmessage = ({data}) => {
      if (data === 'start') { this.left = []; this.right = []; this.frames = 0; this.active = true; }
      if (data === 'stop') { this.active = false; this.flush(); this.port.postMessage({stopped: true}); }
    };
  }
  flush() { if (!this.frames) return;
    const left = new Float32Array(this.frames), right = new Float32Array(this.frames); let offset = 0;
    for (let i = 0; i < this.left.length; i++) { left.set(this.left[i], offset); right.set(this.right[i], offset); offset += this.left[i].length; }
    this.port.postMessage({left, right}, [left.buffer, right.buffer]); this.left = []; this.right = []; this.frames = 0;
  }
  process(inputs) { const input = inputs[0];
    if (this.active && input && input[0]) { this.left.push(input[0].slice()); this.right.push((input[1] || input[0]).slice()); this.frames += input[0].length; if (this.frames >= 2048) this.flush(); }
    return true;
  }
}
registerProcessor('synclab-tape-capture', TapeCapture);`;

/** One session recorder, shared by both layouts. Playback bypasses the song master to avoid recapture. */
class ReelRecorder {
  private state: TapeState = { mode: "stopped", busy: false, ready: false, source: "input", position: 0, duration: 0, levelL: 0, levelR: 0, clipped: false, inputGain: 0, tone: 0, drive: 0, outputGain: 0, speed: 1, monitor: false, loop: false, name: "Untitled tape", error: null, hasTape: false };
  private listeners = new Set<() => void>();
  private ctx: AudioContext | null = null;
  private stream: MediaStream | null = null;
  private sourceNode: AudioNode | null = null;
  private inputRouting: AudioNode[] = [];
  private input: GainNode | null = null;
  private tone: BiquadFilterNode | null = null;
  private drive: WaveShaperNode | null = null;
  private monitor: GainNode | null = null;
  private output: GainNode | null = null;
  private split: ChannelSplitterNode | null = null;
  private meters: AnalyserNode[] = [];
  private meterData = new Float32Array(1024);
  private worklet: AudioWorkletNode | null = null;
  private silent: GainNode | null = null;
  private moduleLoaded = false;
  private chunks: { left: Float32Array[]; right: Float32Array[]; frames: number } = { left: [], right: [], frames: 0 };
  private capture: Capture | null = null;
  private player: AudioBufferSourceNode | null = null;
  private reversed: AudioBuffer | null = null;
  private rewindRate = 6;
  private playbackStarted = 0;
  private playbackOffset = 0;
  private finish: (() => void) | null = null;
  private opening: Promise<void> | null = null;
  private timer: ReturnType<typeof setInterval> | null = null;
  private masterMetering = false;
  /** Timeline mode reads the existing post-master taps, without opening a recording input. */
  setMasterMetering = (enabled: boolean) => { this.masterMetering = enabled; this.tick(); };
  subscribe = (fn: () => void) => {
    this.listeners.add(fn);
    if (!this.timer) this.timer = setInterval(() => this.tick(), 50);
    return () => { this.listeners.delete(fn); if (!this.listeners.size && this.timer) { clearInterval(this.timer); this.timer = null; } };
  };
  getSnapshot = () => this.state;
  private update(patch: Partial<TapeState>) { this.state = { ...this.state, ...patch }; for (const listener of this.listeners) listener(); }
  private context() {
    this.ctx = getEngine().init();
    if (!this.output) {
      this.output = this.ctx.createGain(); this.output.gain.value = 10 ** (this.state.outputGain / 20);
      this.output.connect(this.ctx.destination);
      this.split = this.ctx.createChannelSplitter(2);
      this.output.connect(this.split);
      this.meters = [0, 1].map((channel) => { const meter = this.ctx?.createAnalyser(); if (!meter) throw new Error("Audio unavailable"); meter.fftSize = 1024; this.split?.connect(meter, channel); return meter; });
    }
    return this.ctx;
  }
  private tick() {
    let position = this.state.position;
    if (this.state.mode === "recording" && this.ctx) position = this.chunks.frames / this.ctx.sampleRate;
    if (this.state.mode === "playing" && this.ctx) {
      position = this.playbackOffset + (this.ctx.currentTime - this.playbackStarted) * this.state.speed;
      if (this.state.loop && this.state.duration) position %= this.state.duration;
      position = clampTapePosition(position, this.state.duration);
    }
    const readMaster = this.masterMetering && this.state.mode !== "recording" && this.state.mode !== "playing";
    const levels = [0, 1].map((channel) => {
      let data: Float32Array | null = null;
      if (readMaster) data = getEngine().getMasterChannel(channel === 0 ? 0 : 1, "wave");
      else if (this.meters[channel]) { this.meters[channel].getFloatTimeDomainData(this.meterData); data = this.meterData; }
      let peak = 0;
      if (data) for (const sample of data) peak = Math.max(peak, Math.abs(sample));
      return peak;
    });
    this.update({ position, ...(this.state.mode === "recording" ? { duration: position } : {}), levelL: levels[0] ?? 0, levelR: levels[1] ?? 0, clipped: this.state.clipped || levels.some((peak) => peak >= 0.985) });
  }
  private disconnectInput() {
    if (this.sourceNode && this.input) { try { this.sourceNode.disconnect(this.input); } catch { /* already detached */ } }
    for (const node of [this.input, this.tone, this.drive, this.monitor, this.worklet, this.silent]) node?.disconnect();
    for (const node of this.inputRouting) node.disconnect();
    this.inputRouting = [];
    if (this.worklet) this.worklet.port.onmessage = null;
    releaseMic(this.stream); this.stream = null; this.sourceNode = null;
    this.input = null; this.tone = null; this.drive = null; this.monitor = null; this.worklet = null; this.silent = null;
  }
  enable = async () => {
    if (this.state.ready) return;
    if (this.opening) return this.opening;
    this.opening = this.openInput();
    try { await this.opening; } finally { this.opening = null; }
  };
  private async openInput() {
    this.update({ busy: true, error: null });
    try {
      const ctx = this.context(); await ctx.resume();
      if (!ctx.audioWorklet) throw new Error("This browser does not support the recorder. Try current Chrome, Edge or Safari.");
      if (!this.moduleLoaded) {
        const url = URL.createObjectURL(new Blob([processorCode], { type: "text/javascript" }));
        try { await ctx.audioWorklet.addModule(url); this.moduleLoaded = true; } finally { URL.revokeObjectURL(url); }
      }
      if (this.state.source === "input") {
        const result = await openMic({ echoCancellation: false, noiseSuppression: false, autoGainControl: false }, "reel-recorder");
        if ("error" in result) throw new Error(result.error);
        this.stream = result.stream;
        const source = ctx.createMediaStreamSource(result.stream);
        const channel = getInputChannel();
        if (channel !== "stereo") {
          const splitter = ctx.createChannelSplitter(2); source.connect(splitter);
          const selected = ctx.createGain(); selected.channelCount = 2; selected.channelCountMode = "explicit";
          splitter.connect(selected, channel === "in2" ? 1 : 0); this.sourceNode = selected;
          this.inputRouting = [source, splitter, selected];
        } else this.sourceNode = source;
        result.stream.getAudioTracks()[0]?.addEventListener("ended", () => { void this.release().then(() => this.update({ error: "Audio input disconnected. Enable the input again." })); }, { once: true });
      } else this.sourceNode = getEngine().outputNode;
      if (!this.sourceNode) throw new Error("Song output is not available.");
      this.input = ctx.createGain(); this.input.gain.value = 10 ** (this.state.inputGain / 20);
      this.input.channelCount = 2; this.input.channelCountMode = "explicit";
      this.tone = ctx.createBiquadFilter(); this.tone.type = "highshelf"; this.tone.frequency.value = 2500; this.tone.gain.value = this.state.tone;
      this.drive = ctx.createWaveShaper(); this.drive.curve = tapeCurve(this.state.drive);
      this.monitor = ctx.createGain(); this.monitor.gain.value = this.state.monitor && this.state.source === "input" ? 1 : 0;
      this.sourceNode.connect(this.input).connect(this.tone).connect(this.drive).connect(this.monitor).connect(ctx.destination);
      this.worklet = new AudioWorkletNode(ctx, "synclab-tape-capture", { numberOfInputs: 1, numberOfOutputs: 1, outputChannelCount: [2] });
      this.drive.connect(this.worklet); this.silent = ctx.createGain(); this.silent.gain.value = 0;
      this.worklet.connect(this.silent).connect(ctx.destination);
      this.worklet.port.onmessage = ({ data }: MessageEvent<{ left?: Float32Array; right?: Float32Array; stopped?: boolean }>) => {
        if (data.left && data.right) { this.chunks.left.push(data.left); this.chunks.right.push(data.right); this.chunks.frames += data.left.length; }
        if (data.stopped) { this.finish?.(); this.finish = null; }
      };
      // Meter the processed input while idle/recording, actual output while playing.
      this.drive.connect(this.split ?? this.output ?? ctx.destination);
      this.update({ ready: true });
    } catch (error) { this.disconnectInput(); this.update({ error: error instanceof Error ? error.message : "Unable to enable recording.", ready: false }); }
    finally { this.update({ busy: false }); }
  }
  setSource = async (source: TapeState["source"]) => { if (this.state.busy || this.state.mode === "recording") return; await this.release(); this.update({ source, error: null }); };
  configure = (patch: Partial<Pick<TapeState, "inputGain" | "tone" | "drive" | "outputGain" | "speed" | "monitor" | "loop" | "name">>) => {
    const position = this.state.mode === "playing" && this.ctx ? this.playbackOffset + (this.ctx.currentTime - this.playbackStarted) * this.state.speed : this.state.position;
    this.update(patch);
    const ctx = this.ctx;
    if (!ctx) return;
    this.input?.gain.setTargetAtTime(10 ** (this.state.inputGain / 20), ctx.currentTime, 0.015);
    this.tone?.gain.setTargetAtTime(this.state.tone, ctx.currentTime, 0.015);
    if (patch.drive !== undefined && this.drive) this.drive.curve = tapeCurve(this.state.drive);
    this.output?.gain.setTargetAtTime(10 ** (this.state.outputGain / 20), ctx.currentTime, 0.015);
    this.monitor?.gain.setTargetAtTime(this.state.monitor && this.state.source === "input" ? 1 : 0, ctx.currentTime, 0.015);
    if (this.player) { this.player.loop = this.state.loop; if (patch.speed !== undefined) { this.playbackOffset = this.state.loop && this.state.duration ? position % this.state.duration : position; this.playbackStarted = ctx.currentTime; this.player.playbackRate.setValueAtTime(this.state.speed, ctx.currentTime); } }
  };
  record = async () => {
    if (this.state.busy || this.state.mode === "recording") return;
    this.stopPlayer(); await this.enable();
    if (!this.worklet || !this.state.ready) return;
    this.chunks = { left: [], right: [], frames: 0 };
    this.worklet.port.postMessage("start"); this.update({ mode: "recording", position: 0, duration: 0, clipped: false, error: null });
  };
  stop = async () => {
    if (this.state.busy) return;
    if (this.state.mode === "recording" && this.worklet && this.ctx) {
      this.update({ busy: true });
      await new Promise<void>((resolve) => {
        const timeout = setTimeout(() => { this.finish = null; resolve(); }, 2000);
        this.finish = () => { clearTimeout(timeout); resolve(); };
        this.worklet?.port.postMessage("stop");
      });
      const left = joinTapeChunks(this.chunks.left), right = joinTapeChunks(this.chunks.right);
      if (left.length) this.capture = { left, right, sampleRate: this.ctx.sampleRate };
      this.chunks = { left: [], right: [], frames: 0 };
      this.update({ busy: false, mode: "stopped", position: 0, duration: (this.capture?.left.length ?? 0) / this.ctx.sampleRate, hasTape: !!this.capture });
    } else { this.stopPlayer(); this.update({ mode: "stopped", position: 0 }); }
  };
  private stopPlayer() { const player = this.player; this.player = null; if (player) { player.onended = null; try { player.stop(); } catch { /* ended */ } player.disconnect(); } if (this.split) this.drive?.connect(this.split); }
  play = async () => {
    if (!this.capture || this.state.busy || this.state.mode === "recording") return;
    if (this.state.mode === "playing") { this.tick(); this.stopPlayer(); this.update({ mode: "paused" }); return; }
    try {
      const ctx = this.context(); await ctx.resume();
      this.stopPlayer();
      const buffer = ctx.createBuffer(2, this.capture.left.length, this.capture.sampleRate);
      buffer.copyToChannel(this.capture.left as Float32Array<ArrayBuffer>, 0); buffer.copyToChannel(this.capture.right as Float32Array<ArrayBuffer>, 1);
      const player = ctx.createBufferSource(); player.buffer = buffer; player.loop = this.state.loop; player.playbackRate.value = this.state.speed;
      if (this.split && this.drive) { try { this.drive.disconnect(this.split); } catch { /* not connected */ } }
      player.connect(this.output ?? ctx.destination);
      this.playbackOffset = this.state.position >= buffer.duration ? 0 : this.state.position; this.playbackStarted = ctx.currentTime;
      this.player = player;
      player.onended = () => { if (this.player === player) { this.player = null; player.disconnect(); this.update({ mode: "stopped", position: this.state.duration }); if (this.split) this.drive?.connect(this.split); } };
      player.start(0, this.playbackOffset); this.update({ mode: "playing", error: null });
    } catch (error) { this.update({ error: error instanceof Error ? error.message : "Playback failed." }); }
  };
  seek = async (position: number) => {
    if (this.state.mode === "recording" || this.state.busy) return;
    const playing = this.state.mode === "playing"; this.stopPlayer();
    this.update({ position: clampTapePosition(position, this.state.duration), mode: playing ? "paused" : this.state.mode });
    if (playing) await this.play();
  };
  load = async (file: File) => {
    if (this.state.busy || this.state.mode === "recording") return;
    void import("./media-library").then(({ retainMediaInBackground }) => retainMediaInBackground(file, file.name));
    this.update({ busy: true, error: null }); this.stopPlayer();
    try { const buffer = await this.context().decodeAudioData(await file.arrayBuffer()); this.capture = { left: buffer.getChannelData(0).slice(), right: buffer.getChannelData(buffer.numberOfChannels > 1 ? 1 : 0).slice(), sampleRate: buffer.sampleRate }; this.update({ name: file.name.replace(/\.[^.]+$/, ""), mode: "stopped", position: 0, duration: buffer.duration, hasTape: true, clipped: false }); }
    catch { this.update({ mode: "stopped", error: "This audio file cannot be decoded in your browser. Try WAV or MP3." }); }
    finally { this.update({ busy: false }); }
  };
  getCapture = () => this.capture;
  /** Apply playback speed and output gain to exports and timeline transfers, without reapplying input processing. */
  render = async (): Promise<Capture> => {
    if (!this.capture) throw new Error("Record or load a tape first.");
    const capture = this.capture;
    const ctx = new OfflineAudioContext(2, Math.max(1, Math.ceil(capture.left.length / this.state.speed)), capture.sampleRate);
    const buffer = ctx.createBuffer(2, capture.left.length, capture.sampleRate);
    buffer.copyToChannel(capture.left as Float32Array<ArrayBuffer>, 0); buffer.copyToChannel(capture.right as Float32Array<ArrayBuffer>, 1);
    const source = ctx.createBufferSource(); source.buffer = buffer; source.playbackRate.value = this.state.speed;
    const gain = ctx.createGain(); gain.gain.value = 10 ** (this.state.outputGain / 20); source.connect(gain).connect(ctx.destination); source.start();
    const result = await ctx.startRendering(); return { left: result.getChannelData(0), right: result.getChannelData(1), sampleRate: result.sampleRate };
  };
  resetClip = () => this.update({ clipped: false });
  release = async () => {
    if (this.opening) await this.opening;
    if (this.state.mode === "recording") await this.stop();
    this.stopPlayer(); this.disconnectInput(); this.update({ ready: false, monitor: false, mode: "stopped", levelL: 0, levelR: 0 });
  };
}
const globalRecorder = globalThis as typeof globalThis & { __synclabReel?: ReelRecorder };
export const getReelRecorder = () => (globalRecorder.__synclabReel ??= new ReelRecorder());