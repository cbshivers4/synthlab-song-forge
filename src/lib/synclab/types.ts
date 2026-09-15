export type TrackKind =
  | "audio"
  | "instrument"
  | "midi"
  | "drum"
  | "sampler"
  | "ai-vocal";

export type BusId = "drums" | "vocals" | "instruments" | "synths" | "fx" | "master";

export type OscWave = "sine" | "triangle" | "sawtooth" | "square";

export interface OscillatorParams {
  on: boolean;
  wave: OscWave;
  octave: number;
  semitone: number;
  detune: number;
  level: number;
  pan: number;
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
  wave: OscWave;
  amount: number;
  destination: "pitch" | "filter" | "volume" | "pan";
}

export interface SynthPatch {
  name: string;
  oscillators: OscillatorParams[];
  noise: number;
  filterType: BiquadFilterType;
  cutoff: number;
  resonance: number;
  drive: number;
  amp: EnvelopeParams;
  filterEnv: EnvelopeParams & { amount: number };
  lfos: LfoParams[];
  unison: { voices: number; detune: number; width: number };
  glide: number;
  fx: {
    distortion: number;
    chorus: number;
    delay: number;
    delayFeedback: number;
    reverb: number;
    bitcrush: number;
  };
  arp: {
    on: boolean;
    rate: number; // steps per note
    direction: "up" | "down" | "updown" | "random";
    octaves: number;
    gate: number;
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
  muted: boolean;
  solo: boolean;
  steps: number[]; // velocity 0..1 per step, 0 = off
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
  url?: string;
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
  input: string;
  bus: BusId;
  steps: number;
  patch?: SynthPatch;
  notes?: MidiNote[];
  pads?: DrumPad[];
  clips?: AudioClip[];
}

export interface Transport {
  playing: boolean;
  recording: boolean;
  bpm: number;
  swing: number;
  step: number;
  metronome: boolean;
  countIn: boolean;
  loop: boolean;
  bars: number;
}
