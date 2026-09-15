export type TrackKind =
  | "audio"
  | "instrument"
  | "midi"
  | "drum"
  | "sampler"
  | "ai-vocal";

export type BusId = "drums" | "vocals" | "instruments" | "synths" | "fx" | "master";

export type OscWave = "sine" | "triangle" | "sawtooth" | "square" | "pulse" | "noise";

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

export interface DrumPad {
  id: string;
  name: string;
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
  takeOf?: string | undefined;
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
  clips?: AudioClip[] | undefined;
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
