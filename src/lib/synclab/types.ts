export type TrackKind =
  | "audio"
  | "instrument"
  | "midi"
  | "drum"
  | "sampler"
  | "ai-vocal";

export type BusId = "drums" | "vocals" | "instruments" | "synths" | "fx" | "master";

export type OscWave = "sine" | "triangle" | "sawtooth" | "square" | "pulse" | "noise" | "wavetable";

export type LfoWave = "sine" | "triangle" | "sawtooth" | "square";

export interface OscillatorParams {
  on: boolean;
  wave: OscWave;
  octave: number;
  semitone: number;
  fine?: number;
  detune: number;
  level: number;
  pan: number;
  phase?: number;
  sync?: boolean;
  pulseWidth?: number;
  /** wavetable position 0..1 when wave === "wavetable" */
  morph?: number;
  /** this oscillator frequency-modulates the next one by this amount (0..1) */
  fm?: number;
  /** ring-modulate this oscillator with oscillator 1 */
  ring?: boolean;
}

export interface EnvelopeParams {
  attack: number;
  decay: number;
  sustain: number;
  release: number;
}

export interface LfoParams {
  on: boolean;
  rate: number;
  wave: LfoWave;
  amount: number;
  sync?: boolean;
  destination: "pitch" | "filter" | "volume" | "pan" | "wavetable";
}

export type ModSource =
  | "lfo1"
  | "lfo2"
  | "lfo3"
  | "modEnv"
  | "velocity"
  | "keytrack"
  | "random"
  | "macro1"
  | "macro2"
  | "macro3"
  | "macro4";

export type ModDest =
  | "pitch"
  | "cutoff"
  | "cutoff2"
  | "resonance"
  | "level"
  | "pan"
  | "pulseWidth"
  | "morph"
  | "fmAmount"
  | "unisonDetune";

export interface ModRoute {
  id: string;
  on: boolean;
  source: ModSource;
  dest: ModDest;
  /** -1..1, scaled per destination */
  amount: number;
}

export interface FilterStage {
  on: boolean;
  type: BiquadFilterType;
  cutoff: number;
  resonance: number;
  /** series runs after filter 1, parallel sums alongside it */
  routing: "series" | "parallel";
}

export interface SynthPatch {
  name: string;
  oscillators: OscillatorParams[];
  noise: number;
  filterType: BiquadFilterType;
  cutoff: number;
  resonance: number;
  drive: number;
  keyTracking?: number;
  amp: EnvelopeParams;
  filterEnv: EnvelopeParams & { amount: number };
  lfos: LfoParams[];
  unison: { voices: number; detune: number; width: number };
  glide: number;
  glideMode?: "always" | "legato";
  /** second filter stage */
  filter2?: FilterStage | undefined;
  /** free modulation envelope, only heard through the mod matrix */
  modEnv?: EnvelopeParams | undefined;
  /** four performance macros, 0..1, usable as mod sources */
  macros?: number[] | undefined;
  modMatrix?: ModRoute[] | undefined;
  voiceMode?: "poly" | "mono" | "legato";
  /** how much note velocity opens the amp, 0..1 */
  velocitySens?: number;
  /** analogue drift: random per-voice tuning and cutoff wobble, 0..1 */
  analog?: number;
  fx: {
    distortion: number;
    saturation?: number;
    chorus: number;
    flanger?: number;
    phaser?: number;
    delay: number;
    delayFeedback: number;
    reverb: number;
    bitcrush: number;
  };
  arp: {
    on: boolean;
    rate: number; // steps per note
    direction: "up" | "down" | "updown" | "random" | "alternate";
    octaves: number;
    gate: number;
    swing?: number;
    sync?: boolean;
  };
}

export type DrumKitId =
  | "909"
  | "808"
  | "707"
  | "606"
  | "linn"
  | "acoustic"
  | "detroit"
  | "lofi"
  | "trap"
  | "cr78"
  | "simmons"
  | "dmx"
  | "mpc60"
  | "jazz"
  | "rock"
  | "latin"
  | "afrobeat"
  | "drill"
  | "ghettotech"
  | "jungle"
  | "boombap"
  | "house"
  | "techno"
  | "industrial";

export interface DrumPad {
  id: string;
  name: string;
  kit?: DrumKitId;
  kind: "kick" | "snare" | "clap" | "hat" | "openhat" | "tom" | "perc" | "rim" | "crash" | "ride" | "fx";
  volume: number;
  pan: number;
  pitch: number;
  decay: number;
  attack?: number;
  sustain?: number;
  release?: number;
  start?: number;
  end?: number;
  reverse?: boolean;
  choke?: number;
  /** 0..1 tone filter — below 0.5 darkens (lowpass), above 0.5 thins out (highpass) */
  tone?: number;
  /** 0..1 saturation drive */
  drive?: number;
  /** 0..1 extra transient click on the attack */
  snap?: number;
  /** 0..1 extra noise layer blended with the voice */
  noise?: number;
  /** 0..1 stereo width of the noise layer */
  width?: number;
  sample?: string | undefined;
  muted: boolean;
  solo: boolean;
  steps: number[]; // velocity 0..1 per step, 0 = off
  /** chance 0..1 that a written step actually fires; 1 (or unset) always fires */
  probability?: number[] | undefined;
  /** MIDI note this pad sends and listens on; unset means the General MIDI note for its kind */
  note?: number | undefined;
}

export interface MidiNote {
  id: string;
  step: number;
  length: number;
  pitch: number; // midi note number
  velocity: number;
}

export interface AudioClip {
  id: string;
  name: string;
  peaks: number[];
  duration: number;
  /** timeline position in steps (1 step = 1/16 note) */
  start?: number;
  /** seconds into the file where playback begins */
  offset?: number;
  /** played length in seconds; defaults to the whole file */
  length?: number;
  /** clip gain 0..2 */
  gain?: number;
  /** fade times in seconds */
  fadeIn?: number;
  fadeOut?: number;
  loopClip?: boolean;
  /** transpose in semitones (browser playback also changes length) */
  pitch?: number;
  /** playback speed multiplier, 1 = original */
  speed?: number;
  /** play the clip backwards */
  reverse?: boolean;
  url?: string | undefined;
  cloudPath?: string | undefined;
  takeOf?: string | undefined;
}

/** Combined playback rate for a clip — pitch and speed share one rate in the browser. */
export function clipRate(c: Pick<AudioClip, "pitch" | "speed">): number {
  const speed = c.speed ?? 1;
  const semis = c.pitch ?? 0;
  return Math.max(0.25, Math.min(4, speed * Math.pow(2, semis / 12)));
}

/** How long the clip occupies the timeline, in seconds. */
export function clipSeconds(c: AudioClip): number {
  return (c.length ?? c.duration) / clipRate(c);
}

export type PluginKind =
  | "eq"
  | "paraeq"
  | "filter"
  | "drive"
  | "compressor"
  | "delay"
  | "gain"
  | "width"
  | "reverb"
  | "chorus"
  | "flanger"
  | "phaser"
  | "tremolo"
  | "autopan"
  | "limiter"
  | "bitcrusher"
  | "vocoder"
  | "gate"
  | "stepfilter"
  | "resonator"
  | "scalechord"
  | "transient";

export interface PluginParam {
  id: string;
  name: string;
  value: number;
  min: number;
  max: number;
  unit?: string | undefined;
}

export interface PluginDef {
  id: string;
  name: string;
  vendor: string;
  format: "Built-in" | "VST3" | "AU" | "CLAP" | "AAX";
  kind: PluginKind;
  params: PluginParam[];
}

export interface PluginInstance {
  id: string;
  defId: string;
  name: string;
  vendor: string;
  format: PluginDef["format"];
  kind: PluginKind;
  bypass: boolean;
  params: PluginParam[];
}

/** A loaded audio file played back by the sampler instrument. */
export interface SamplerState {
  name: string;
  url: string;
  cloudPath?: string | undefined;
  duration: number;
  peaks: number[];
  /** trim points as 0..1 fractions of the file */
  start: number;
  end: number;
  gain: number;
  /** extra tuning in semitones */
  pitch: number;
  /** midi note that plays the sample at its recorded speed */
  rootNote: number;
  loop: boolean;
  reverse: boolean;
  /** when off the sample always plays to the trim end */
  oneShot: boolean;
  /** chop points as sorted 0..1 fractions; slice n spans slices[n]..slices[n+1] */
  slices?: number[] | undefined;
  attack: number;
  release: number;
  /** envelope decay time in seconds (default 0) */
  decay?: number | undefined;
  /** envelope sustain level 0..1 (default 1) */
  sustain?: number | undefined;
  filterType?: "off" | "lowpass" | "highpass" | "bandpass" | "notch" | undefined;
  /** filter cutoff in Hz */
  cutoff?: number | undefined;
  resonance?: number | undefined;
  /** tempo the sample was recorded at, for beat sync */
  sampleBpm?: number | undefined;
  /** follow project tempo (repitch: speed and pitch change together) */
  syncToBpm?: boolean | undefined;
  fadeIn?: number | undefined;
  fadeOut?: number | undefined;
}

export type AutomationParam =
  | "volume"
  | "pan"
  | "sendReverb"
  | "sendDelay"
  | `plugin:${string}:${string}`;

export interface AutomationPoint {
  step: number;
  /** 0..1 for volume and sends, -1..1 for pan */
  value: number;
  /** Outgoing segment curvature: -1 ease-out, 0 linear, 1 ease-in. */
  curve?: number;
}

export interface AutomationLane {
  param: AutomationParam;
  /** read plays the curve; write/touch/latch capture live control movements */
  mode: "read" | "write" | "touch" | "latch" | "off";
  points: AutomationPoint[];
  /** locked lanes ignore every edit until unlocked again */
  locked?: boolean | undefined;
}

export interface Track {
  id: string;
  name: string;
  kind: TrackKind;
  color: string;
  /** id from TRACK_ICONS; when unset the icon is picked automatically from the kind */
  icon?: string | undefined;
  volume: number;
  pan: number;
  muted: boolean;
  solo: boolean;
  armed: boolean;
  frozen: boolean;
  hidden: boolean;
  /** lane height in px on the arrangement */
  height?: number;
  monitor?: boolean;
  input: string;
  bus: BusId;
  sends?: { reverb: number; delay: number; chorus: number } | undefined;
  steps: number;
  instrument?: string | undefined;
  patch?: SynthPatch | undefined;
  notes?: MidiNote[] | undefined;
  pads?: DrumPad[] | undefined;
  plugins?: PluginInstance[] | undefined;
  clips?: AudioClip[] | undefined;
  sampler?: SamplerState | undefined;
  activeClipId?: string | undefined;
  recording?: boolean;
  automation?: AutomationLane[] | undefined;
  /** free-text note the producer keeps on this channel; saved with the project */
  memo?: string | undefined;
}

export interface Transport {
  playing: boolean;
  recording: boolean;
  paused?: boolean;
  overdub?: boolean;
  /** audio takes remove the older takes they overlap */
  replace?: boolean;
  punchIn?: number | null;
  punchOut?: number | null;
  monitor?: boolean;
  bpm: number;
  swing: number;
  step: number;
  metronome: boolean;
  countIn: boolean;
  /** bars of count-in before recording starts (1, 2 or 4) */
  countInBars?: number;
  /** clicks remaining while the count-in runs; null when not counting */
  countInLeft?: number | null;
  loop: boolean;
  loopStart?: number;
  loopEnd?: number;
  /** export range in steps; both null/undefined when the flags are off */
  exportStart?: number | null;
  exportEnd?: number | null;
  /** timeline length in bars (1 bar = 4 steps) */
  bars: number;
  /** snap grid for clip edits, in steps (1 step = a 1/4 note). 0 = free move */
  snap?: number;
  /** keep the timeline scrolled to the playhead while it plays */
  follow?: boolean;
}

export interface BusState {
  volume: number;
  muted: boolean;
}

/** A named part of the arrangement — intro, verse, drop and so on. */
export interface SongSection {
  id: string;
  name: string;
  /** start position in steps (1 step = a 1/4 note, 4 steps = 1 bar) */
  start: number;
  /** length in steps */
  length: number;
  color: string;
}

export const SECTION_NAMES = [
  "INTRO",
  "VERSE",
  "PRE",
  "CHORUS",
  "HOOK",
  "DROP",
  "BREAK",
  "BRIDGE",
  "BUILD",
  "SOLO",
  "OUTRO",
] as const;

export const SECTION_COLORS = [
  "oklch(0.78 0.16 195)",
  "oklch(0.74 0.19 320)",
  "oklch(0.8 0.17 95)",
  "oklch(0.72 0.18 30)",
  "oklch(0.76 0.16 145)",
  "oklch(0.7 0.18 265)",
  "oklch(0.8 0.13 55)",
  "oklch(0.74 0.15 355)",
];
