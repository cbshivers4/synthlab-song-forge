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
  sample?: string | undefined;
  muted: boolean;
  solo: boolean;
  steps: number[]; // velocity 0..1 per step, 0 = off
  probability?: number[] | undefined;
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
  url?: string | undefined;
  cloudPath?: string | undefined;
  takeOf?: string | undefined;
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
  | "gate";

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
}

export interface Track {
  id: string;
  name: string;
  kind: TrackKind;
  color: string;
  volume: number;
  pan: number;
  muted: boolean;
  solo: boolean;
  armed: boolean;
  frozen: boolean;
  hidden: boolean;
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
}

export interface Transport {
  playing: boolean;
  recording: boolean;
  paused?: boolean;
  overdub?: boolean;
  punchIn?: number | null;
  punchOut?: number | null;
  monitor?: boolean;
  bpm: number;
  swing: number;
  step: number;
  metronome: boolean;
  countIn: boolean;
  loop: boolean;
  loopStart?: number;
  loopEnd?: number;
  bars: number;
}

export interface BusState {
  volume: number;
  muted: boolean;
}
