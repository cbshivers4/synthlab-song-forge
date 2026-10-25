import { kitExtraPads } from "./vintage-drums";
import { MODULAR_PRESETS } from "./modular";
import type { DrumKitId, DrumPad, OscillatorParams, SynthPatch, TrackKind } from "./types";

export const uid = () => Math.random().toString(36).slice(2, 10);

export const defaultPatch = (name = "Init Saw"): SynthPatch => ({
  name,
  oscillators: [
    { on: true, wave: "sawtooth", octave: 0, semitone: 0, detune: 0, level: 0.8, pan: 0 },
    { on: true, wave: "square", octave: -1, semitone: 0, detune: 8, level: 0.45, pan: -0.2 },
    { on: false, wave: "triangle", octave: 1, semitone: 7, detune: -6, level: 0.3, pan: 0.2 },
    { on: false, wave: "wavetable", octave: 0, semitone: 0, detune: 0, level: 0.3, pan: 0, morph: 0.5 },
  ],
  noise: 0,
  filterType: "lowpass",
  cutoff: 2400,
  resonance: 6,
  drive: 0.2,
  amp: { attack: 0.01, decay: 0.2, sustain: 0.6, release: 0.35 },
  filterEnv: { attack: 0.005, decay: 0.25, sustain: 0.25, release: 0.3, amount: 2600 },
  lfos: [
    { on: false, rate: 4, wave: "sine", amount: 0.3, destination: "filter" },
    { on: false, rate: 0.5, wave: "triangle", amount: 0.2, destination: "pan" },
    { on: false, rate: 2, wave: "triangle", amount: 0.25, destination: "pitch" },
  ],
  unison: { voices: 2, detune: 12, width: 0.5 },
  glide: 0,
  filter2: { on: false, type: "highpass", cutoff: 200, resonance: 1, routing: "series" },
  modEnv: { attack: 0.01, decay: 0.3, sustain: 0.4, release: 0.3 },
  macros: [0, 0, 0, 0],
  modMatrix: [],
  voiceMode: "poly",
  velocitySens: 1,
  analog: 0.15,
  fx: { distortion: 0.1, chorus: 0.2, delay: 0.18, delayFeedback: 0.3, reverb: 0.2, bitcrush: 0 },
  arp: { on: false, rate: 1, direction: "up", octaves: 1, gate: 0.6 },
});

const O = (p: SynthPatch, i: number) => p.oscillators[i] as import("./types").OscillatorParams;

type PresetDef = { name: string; category: string; mutate: (p: SynthPatch) => void };

export const SYNTH_PRESETS: PresetDef[] = [
  {
    name: "Belleville Strings",
    category: "Detroit Techno",
    mutate: (p) => {
      O(p,0).wave = "sawtooth";
      p.oscillators[1] = { ...O(p,1), on: true, wave: "sawtooth", detune: 14, octave: 0, level: 0.6 };
      p.cutoff = 1500;
      p.amp = { attack: 0.35, decay: 0.6, sustain: 0.8, release: 1.4 };
      p.fx.reverb = 0.5;
      p.fx.chorus = 0.45;
    },
  },
  {
    name: "Cybotron Lead",
    category: "Detroit Electro",
    mutate: (p) => {
      O(p,0).wave = "square";
      p.oscillators[1] = { ...O(p,1), on: true, wave: "sawtooth", octave: 0, detune: -10, level: 0.5 };
      p.cutoff = 3400;
      p.resonance = 10;
      p.amp = { attack: 0.005, decay: 0.15, sustain: 0.4, release: 0.2 };
      p.fx.delay = 0.35;
      p.fx.distortion = 0.3;
    },
  },
  {
    name: "Ghetto Tech Bass",
    category: "Ghetto Tech",
    mutate: (p) => {
      O(p,0).wave = "square";
      O(p,0).octave = -1;
      p.oscillators[1] = { ...O(p,1), on: true, wave: "sawtooth", octave: -2, level: 0.7, detune: 4 };
      p.cutoff = 900;
      p.resonance = 12;
      p.amp = { attack: 0.002, decay: 0.18, sustain: 0.2, release: 0.15 };
      p.filterEnv.amount = 1800;
      p.fx.distortion = 0.45;
    },
  },
  {
    name: "303 Acid",
    category: "Acid",
    mutate: (p) => {
      O(p,0).wave = "sawtooth";
      O(p,1).on = false;
      p.cutoff = 700;
      p.resonance = 22;
      p.filterEnv.amount = 4200;
      p.filterEnv.decay = 0.22;
      p.amp = { attack: 0.001, decay: 0.2, sustain: 0.1, release: 0.12 };
      p.glide = 0.06;
      p.fx.distortion = 0.5;
    },
  },
  {
    name: "Warehouse Pad",
    category: "Pad",
    mutate: (p) => {
      O(p,0).wave = "triangle";
      p.oscillators[1] = { ...O(p,1), on: true, wave: "sawtooth", detune: 16, level: 0.35 };
      p.oscillators[2] = { ...O(p,2), on: true, level: 0.25 };
      p.cutoff = 1200;
      p.amp = { attack: 0.9, decay: 1.2, sustain: 0.85, release: 2.2 };
      p.fx.reverb = 0.7;
      p.fx.chorus = 0.5;
    },
  },
  {
    name: "Deep Keys",
    category: "Deep House",
    mutate: (p) => {
      O(p,0).wave = "triangle";
      p.oscillators[1] = { ...O(p,1), on: true, wave: "sine", octave: 1, level: 0.3 };
      p.cutoff = 1800;
      p.amp = { attack: 0.01, decay: 0.5, sustain: 0.3, release: 0.6 };
      p.fx.reverb = 0.35;
    },
  },
  {
    name: "Sub Bass",
    category: "Bass",
    mutate: (p) => {
      O(p,0).wave = "sine";
      O(p,0).octave = -2;
      O(p,1).on = false;
      p.cutoff = 400;
      p.amp = { attack: 0.005, decay: 0.3, sustain: 0.7, release: 0.2 };
      p.fx.reverb = 0;
      p.fx.delay = 0;
    },
  },
  {
    name: "Metro Pluck",
    category: "Pluck",
    mutate: (p) => {
      O(p,0).wave = "square";
      p.cutoff = 2600;
      p.resonance = 8;
      p.amp = { attack: 0.002, decay: 0.16, sustain: 0, release: 0.2 };
      p.filterEnv.amount = 3200;
      p.fx.delay = 0.3;
    },
  },
  {
    name: "Assembly Line",
    category: "Industrial",
    mutate: (p) => {
      O(p,0).wave = "square";
      p.noise = 0.25;
      p.cutoff = 1500;
      p.fx.distortion = 0.7;
      p.fx.bitcrush = 0.4;
      p.amp = { attack: 0.001, decay: 0.12, sustain: 0.3, release: 0.1 };
    },
  },
  {
    name: "Vocoder Bot",
    category: "Robotic",
    mutate: (p) => {
      O(p,0).wave = "sawtooth";
      p.oscillators[1] = { ...O(p,1), on: true, wave: "square", detune: 20, level: 0.4 };
      p.cutoff = 2000;
      p.fx.bitcrush = 0.6;
      p.fx.chorus = 0.6;
      p.amp = { attack: 0.02, decay: 0.3, sustain: 0.5, release: 0.3 };
    },
  },
  {
    name: "Night Arp",
    category: "Arp",
    mutate: (p) => {
      p.arp = { on: true, rate: 1, direction: "updown", octaves: 2, gate: 0.5 };
      p.amp = { attack: 0.003, decay: 0.18, sustain: 0.1, release: 0.2 };
      p.cutoff = 3000;
      p.fx.delay = 0.4;
    },
  },
  {
    name: "Void Ambient",
    category: "Ambient",
    mutate: (p) => {
      O(p,0).wave = "sine";
      p.oscillators[2] = { ...O(p,2), on: true, wave: "triangle", level: 0.3 };
      p.amp = { attack: 1.6, decay: 2, sustain: 0.9, release: 3 };
      p.cutoff = 900;
      p.fx.reverb = 0.85;
    },
  },
  {
    name: "Supersaw Anthem",
    category: "Lead",
    mutate: (p) => {
      O(p,0).wave = "sawtooth";
      p.oscillators[1] = { ...O(p,1), on: true, wave: "sawtooth", octave: 0, detune: 22, level: 0.7 };
      p.oscillators[2] = { ...O(p,2), on: true, wave: "sawtooth", octave: 0, semitone: 0, detune: -22, level: 0.6 };
      p.unison = { voices: 4, detune: 26, width: 0.9 };
      p.cutoff = 5200;
      p.amp = { attack: 0.02, decay: 0.4, sustain: 0.8, release: 0.6 };
      p.fx.reverb = 0.35;
      p.fx.chorus = 0.3;
    },
  },
  {
    name: "Reese Bass",
    category: "Bass",
    mutate: (p) => {
      O(p,0).wave = "sawtooth";
      O(p,0).octave = -1;
      p.oscillators[1] = { ...O(p,1), on: true, wave: "sawtooth", octave: -1, detune: 18, level: 0.8 };
      p.cutoff = 600;
      p.resonance = 8;
      p.amp = { attack: 0.01, decay: 0.4, sustain: 0.9, release: 0.25 };
      p.fx.distortion = 0.3;
      p.fx.chorus = 0.25;
    },
  },
  {
    name: "FM Bell",
    category: "Keys",
    mutate: (p) => {
      O(p,0).wave = "sine";
      p.oscillators[1] = { ...O(p,1), on: true, wave: "sine", octave: 2, semitone: 7, level: 0.35 };
      p.cutoff = 6000;
      p.amp = { attack: 0.002, decay: 0.9, sustain: 0.05, release: 1.2 };
      p.fx.reverb = 0.45;
      p.fx.delay = 0.2;
    },
  },
  {
    name: "Rhodes Soul",
    category: "Keys",
    mutate: (p) => {
      O(p,0).wave = "sine";
      p.oscillators[1] = { ...O(p,1), on: true, wave: "triangle", octave: 1, level: 0.25 };
      p.cutoff = 2200;
      p.amp = { attack: 0.008, decay: 0.8, sustain: 0.35, release: 0.7 };
      p.fx.chorus = 0.4;
      p.fx.reverb = 0.3;
    },
  },
  {
    name: "Moog Mono",
    category: "Bass",
    mutate: (p) => {
      O(p,0).wave = "sawtooth";
      O(p,0).octave = -1;
      p.oscillators[1] = { ...O(p,1), on: true, wave: "square", octave: -1, detune: 6, level: 0.5 };
      p.cutoff = 850;
      p.resonance = 14;
      p.filterEnv.amount = 2400;
      p.glide = 0.04;
      p.amp = { attack: 0.004, decay: 0.3, sustain: 0.6, release: 0.2 };
    },
  },
  {
    name: "Brass Stab",
    category: "Brass",
    mutate: (p) => {
      O(p,0).wave = "sawtooth";
      p.oscillators[1] = { ...O(p,1), on: true, wave: "sawtooth", detune: 10, level: 0.55 };
      p.cutoff = 1600;
      p.filterEnv = { attack: 0.06, decay: 0.3, sustain: 0.4, release: 0.3, amount: 3200 };
      p.amp = { attack: 0.03, decay: 0.25, sustain: 0.5, release: 0.3 };
      p.fx.reverb = 0.25;
    },
  },
  {
    name: "Glass Pad",
    category: "Pad",
    mutate: (p) => {
      O(p,0).wave = "triangle";
      p.oscillators[1] = { ...O(p,1), on: true, wave: "sine", octave: 1, detune: 9, level: 0.4 };
      p.cutoff = 3600;
      p.amp = { attack: 1.2, decay: 1.5, sustain: 0.8, release: 2.6 };
      p.lfos[0] = { on: true, rate: 0.3, wave: "sine", amount: 0.25, destination: "filter" };
      p.fx.reverb = 0.8;
    },
  },
  {
    name: "Choir Air",
    category: "Pad",
    mutate: (p) => {
      O(p,0).wave = "triangle";
      p.noise = 0.12;
      p.oscillators[1] = { ...O(p,1), on: true, wave: "triangle", detune: 12, level: 0.4 };
      p.cutoff = 2000;
      p.amp = { attack: 0.7, decay: 1, sustain: 0.9, release: 2 };
      p.fx.reverb = 0.75;
      p.fx.chorus = 0.5;
    },
  },
  {
    name: "Hoover Rave",
    category: "Rave",
    mutate: (p) => {
      O(p,0).wave = "sawtooth";
      p.oscillators[1] = { ...O(p,1), on: true, wave: "sawtooth", semitone: 7, detune: 24, level: 0.7 };
      p.oscillators[2] = { ...O(p,2), on: true, wave: "square", octave: -1, level: 0.4 };
      p.cutoff = 2800;
      p.resonance = 9;
      p.glide = 0.08;
      p.fx.distortion = 0.4;
      p.fx.chorus = 0.5;
    },
  },
  {
    name: "Trap Bell",
    category: "Trap",
    mutate: (p) => {
      O(p,0).wave = "sine";
      p.oscillators[1] = { ...O(p,1), on: true, wave: "triangle", octave: 2, level: 0.3 };
      p.amp = { attack: 0.001, decay: 0.5, sustain: 0, release: 0.6 };
      p.cutoff = 5200;
      p.fx.delay = 0.35;
      p.fx.reverb = 0.4;
    },
  },
  {
    name: "808 Sub Glide",
    category: "Bass",
    mutate: (p) => {
      O(p,0).wave = "sine";
      O(p,0).octave = -2;
      O(p,1).on = false;
      p.cutoff = 300;
      p.glide = 0.12;
      p.amp = { attack: 0.004, decay: 1.2, sustain: 0.4, release: 0.5 };
      p.fx.distortion = 0.25;
    },
  },
  {
    name: "Detroit Stab",
    category: "Detroit Techno",
    mutate: (p) => {
      O(p,0).wave = "sawtooth";
      p.oscillators[1] = { ...O(p,1), on: true, wave: "square", detune: -8, level: 0.5 };
      p.cutoff = 2200;
      p.resonance = 11;
      p.amp = { attack: 0.002, decay: 0.22, sustain: 0, release: 0.25 };
      p.fx.reverb = 0.4;
      p.fx.delay = 0.28;
    },
  },
  {
    name: "Dub Chord",
    category: "Dub",
    mutate: (p) => {
      O(p,0).wave = "square";
      p.oscillators[1] = { ...O(p,1), on: true, wave: "sawtooth", detune: 11, level: 0.4 };
      p.cutoff = 1300;
      p.amp = { attack: 0.01, decay: 0.3, sustain: 0.1, release: 0.4 };
      p.fx.delay = 0.55;
      p.fx.delayFeedback = 0.6;
      p.fx.reverb = 0.5;
    },
  },
  {
    name: "Neuro Growl",
    category: "Bass",
    mutate: (p) => {
      O(p,0).wave = "sawtooth";
      O(p,0).octave = -1;
      p.oscillators[1] = { ...O(p,1), on: true, wave: "square", octave: -1, detune: 15, level: 0.6 };
      p.cutoff = 700;
      p.resonance = 18;
      p.lfos[0] = { on: true, rate: 6, wave: "sine", amount: 0.6, destination: "filter" };
      p.fx.distortion = 0.65;
      p.fx.bitcrush = 0.2;
    },
  },
  {
    name: "Sci-Fi Sweep",
    category: "FX",
    mutate: (p) => {
      O(p,0).wave = "sawtooth";
      p.noise = 0.2;
      p.cutoff = 500;
      p.filterEnv = { attack: 1.4, decay: 1.2, sustain: 0.6, release: 1.5, amount: 7000 };
      p.amp = { attack: 0.8, decay: 1.4, sustain: 0.7, release: 2 };
      p.fx.reverb = 0.7;
      p.fx.delay = 0.4;
    },
  },
  {
    name: "Juno Poly",
    category: "Keys",
    mutate: (p) => {
      O(p,0).wave = "sawtooth";
      p.oscillators[1] = { ...O(p,1), on: true, wave: "square", detune: 7, octave: 0, level: 0.45 };
      p.cutoff = 3200;
      p.amp = { attack: 0.05, decay: 0.5, sustain: 0.7, release: 0.8 };
      p.fx.chorus = 0.6;
    },
  },
  {
    name: "Prophet Strings",
    category: "Pads",
    mutate: (p) => {
      O(p,0).wave = "sawtooth";
      p.oscillators[1] = { ...O(p,1), on: true, wave: "sawtooth", detune: 18, level: 0.6 };
      p.cutoff = 1800;
      p.amp = { attack: 0.5, decay: 0.8, sustain: 0.85, release: 1.8 };
      p.fx.reverb = 0.55;
      p.fx.chorus = 0.5;
    },
  },
  {
    name: "Analog Brass",
    category: "Brass",
    mutate: (p) => {
      O(p,0).wave = "sawtooth";
      p.oscillators[1] = { ...O(p,1), on: true, wave: "sawtooth", detune: -9, level: 0.55 };
      p.cutoff = 1200;
      p.filterEnv = { attack: 0.12, decay: 0.4, sustain: 0.5, release: 0.4, amount: 4200 };
      p.amp = { attack: 0.08, decay: 0.3, sustain: 0.8, release: 0.4 };
    },
  },
  {
    name: "Soft Flute",
    category: "Keys",
    mutate: (p) => {
      O(p,0).wave = "sine";
      p.noise = 0.12;
      p.cutoff = 2600;
      p.amp = { attack: 0.12, decay: 0.2, sustain: 0.8, release: 0.4 };
      p.fx.reverb = 0.4;
    },
  },
  {
    name: "Organ Drawbar",
    category: "Keys",
    mutate: (p) => {
      O(p,0).wave = "sine";
      p.oscillators[1] = { ...O(p,1), on: true, wave: "sine", octave: 1, level: 0.4 };
      p.oscillators[2] = { ...O(p,2), on: true, wave: "sine", octave: 2, semitone: 7, level: 0.25 };
      p.amp = { attack: 0.005, decay: 0.05, sustain: 1, release: 0.12 };
      p.fx.chorus = 0.35;
    },
  },
  {
    name: "Clav Funk",
    category: "Keys",
    mutate: (p) => {
      O(p,0).wave = "square";
      p.cutoff = 2800;
      p.resonance = 8;
      p.amp = { attack: 0.002, decay: 0.16, sustain: 0.1, release: 0.15 };
      p.fx.distortion = 0.25;
    },
  },
  {
    name: "Wurli Warm",
    category: "Keys",
    mutate: (p) => {
      O(p,0).wave = "sine";
      p.oscillators[1] = { ...O(p,1), on: true, wave: "triangle", octave: 1, level: 0.3 };
      p.cutoff = 2200;
      p.amp = { attack: 0.005, decay: 0.9, sustain: 0.25, release: 0.6 };
      p.fx.chorus = 0.3;
      p.fx.reverb = 0.25;
    },
  },
  {
    name: "Bell Toy",
    category: "Bells",
    mutate: (p) => {
      O(p,0).wave = "sine";
      p.oscillators[1] = { ...O(p,1), on: true, wave: "sine", semitone: 19, level: 0.3 };
      p.amp = { attack: 0.001, decay: 1.1, sustain: 0, release: 1.1 };
      p.fx.reverb = 0.5;
    },
  },
  {
    name: "Kalimba",
    category: "Bells",
    mutate: (p) => {
      O(p,0).wave = "triangle";
      p.cutoff = 3400;
      p.amp = { attack: 0.001, decay: 0.55, sustain: 0, release: 0.5 };
      p.fx.reverb = 0.35;
    },
  },
  {
    name: "Music Box",
    category: "Bells",
    mutate: (p) => {
      O(p,0).wave = "sine";
      p.oscillators[1] = { ...O(p,1), on: true, wave: "sine", octave: 2, level: 0.2 };
      p.amp = { attack: 0.001, decay: 0.9, sustain: 0, release: 0.9 };
      p.fx.reverb = 0.55;
      p.fx.delay = 0.2;
    },
  },
  {
    name: "Pluck Nylon",
    category: "Plucks",
    mutate: (p) => {
      O(p,0).wave = "triangle";
      p.cutoff = 2600;
      p.filterEnv = { attack: 0.001, decay: 0.16, sustain: 0, release: 0.2, amount: 2400 };
      p.amp = { attack: 0.002, decay: 0.3, sustain: 0, release: 0.3 };
    },
  },
  {
    name: "Saw Pluck",
    category: "Plucks",
    mutate: (p) => {
      O(p,0).wave = "sawtooth";
      p.oscillators[1] = { ...O(p,1), on: true, wave: "sawtooth", detune: 12, level: 0.5 };
      p.cutoff = 1800;
      p.filterEnv = { attack: 0.001, decay: 0.2, sustain: 0, release: 0.2, amount: 3600 };
      p.amp = { attack: 0.001, decay: 0.32, sustain: 0, release: 0.3 };
      p.fx.delay = 0.25;
    },
  },
  {
    name: "Chime Pluck",
    category: "Plucks",
    mutate: (p) => {
      O(p,0).wave = "square";
      p.oscillators[1] = { ...O(p,1), on: true, wave: "sine", octave: 1, level: 0.3 };
      p.cutoff = 4200;
      p.amp = { attack: 0.001, decay: 0.4, sustain: 0, release: 0.4 };
      p.fx.delay = 0.35;
      p.fx.reverb = 0.4;
    },
  },
  {
    name: "Acid Screech",
    category: "Acid",
    mutate: (p) => {
      O(p,0).wave = "square";
      O(p,0).octave = -1;
      p.cutoff = 400;
      p.resonance = 22;
      p.filterEnv = { attack: 0.001, decay: 0.22, sustain: 0.1, release: 0.2, amount: 5200 };
      p.amp = { attack: 0.001, decay: 0.3, sustain: 0.3, release: 0.2 };
      p.glide = 0.06;
      p.fx.distortion = 0.5;
    },
  },
  {
    name: "Acid Rubber",
    category: "Acid",
    mutate: (p) => {
      O(p,0).wave = "sawtooth";
      O(p,0).octave = -1;
      p.cutoff = 600;
      p.resonance = 17;
      p.filterEnv = { attack: 0.001, decay: 0.35, sustain: 0.05, release: 0.25, amount: 3800 };
      p.voiceMode = "mono";
      p.glide = 0.1;
      p.fx.delay = 0.3;
    },
  },
  {
    name: "Rave Stab",
    category: "Rave",
    mutate: (p) => {
      O(p,0).wave = "sawtooth";
      p.oscillators[1] = { ...O(p,1), on: true, wave: "square", detune: -12, level: 0.55 };
      p.cutoff = 2600;
      p.resonance = 9;
      p.amp = { attack: 0.001, decay: 0.2, sustain: 0, release: 0.2 };
      p.fx.reverb = 0.35;
      p.fx.distortion = 0.3;
    },
  },
  {
    name: "Trance Gate",
    category: "Rave",
    mutate: (p) => {
      O(p,0).wave = "sawtooth";
      p.oscillators[1] = { ...O(p,1), on: true, wave: "sawtooth", detune: 20, level: 0.6 };
      p.cutoff = 3000;
      p.lfos[0] = { on: true, rate: 8, wave: "square", amount: 0.8, destination: "volume" };
      p.amp = { attack: 0.02, decay: 0.3, sustain: 0.8, release: 0.5 };
      p.fx.reverb = 0.45;
    },
  },
  {
    name: "Donk Lead",
    category: "Rave",
    mutate: (p) => {
      O(p,0).wave = "square";
      p.cutoff = 3200;
      p.resonance = 14;
      p.amp = { attack: 0.001, decay: 0.18, sustain: 0, release: 0.15 };
      p.fx.distortion = 0.4;
    },
  },
  {
    name: "Wobble Bass",
    category: "Bass",
    mutate: (p) => {
      O(p,0).wave = "sawtooth";
      O(p,0).octave = -1;
      p.cutoff = 500;
      p.resonance = 15;
      p.lfos[0] = { on: true, rate: 3, wave: "sine", amount: 0.8, destination: "filter" };
      p.fx.distortion = 0.4;
    },
  },
  {
    name: "Slap Bass",
    category: "Bass",
    mutate: (p) => {
      O(p,0).wave = "square";
      O(p,0).octave = -1;
      p.cutoff = 1400;
      p.filterEnv = { attack: 0.001, decay: 0.12, sustain: 0.1, release: 0.2, amount: 3200 };
      p.amp = { attack: 0.001, decay: 0.28, sustain: 0.2, release: 0.2 };
    },
  },
  {
    name: "Upright Bass",
    category: "Bass",
    mutate: (p) => {
      O(p,0).wave = "triangle";
      O(p,0).octave = -1;
      p.cutoff = 900;
      p.amp = { attack: 0.01, decay: 0.5, sustain: 0.2, release: 0.35 };
      p.voiceMode = "mono";
      p.glide = 0.04;
    },
  },
  {
    name: "Drill Slide",
    category: "Bass",
    mutate: (p) => {
      O(p,0).wave = "sine";
      O(p,0).octave = -2;
      p.cutoff = 380;
      p.amp = { attack: 0.005, decay: 1.4, sustain: 0.4, release: 0.9 };
      p.voiceMode = "mono";
      p.glide = 0.22;
      p.fx.distortion = 0.25;
    },
  },
  {
    name: "Future Bass Chord",
    category: "Pads",
    mutate: (p) => {
      O(p,0).wave = "sawtooth";
      p.oscillators[1] = { ...O(p,1), on: true, wave: "sawtooth", detune: 25, level: 0.6 };
      p.cutoff = 2400;
      p.lfos[0] = { on: true, rate: 2, wave: "triangle", amount: 0.35, destination: "pitch" };
      p.amp = { attack: 0.03, decay: 0.5, sustain: 0.7, release: 0.7 };
      p.fx.reverb = 0.5;
      p.fx.chorus = 0.4;
    },
  },
  {
    name: "Vapor Pad",
    category: "Pads",
    mutate: (p) => {
      O(p,0).wave = "triangle";
      p.oscillators[1] = { ...O(p,1), on: true, wave: "sine", octave: 1, detune: 6, level: 0.35 };
      p.cutoff = 1400;
      p.amp = { attack: 1.2, decay: 1.4, sustain: 0.85, release: 2.4 };
      p.fx.reverb = 0.75;
      p.fx.chorus = 0.5;
      p.fx.delay = 0.35;
    },
  },
  {
    name: "Dark Drone",
    category: "Pads",
    mutate: (p) => {
      O(p,0).wave = "sawtooth";
      O(p,0).octave = -1;
      p.oscillators[1] = { ...O(p,1), on: true, wave: "sawtooth", octave: -2, detune: 9, level: 0.5 };
      p.cutoff = 700;
      p.amp = { attack: 1.8, decay: 2, sustain: 0.9, release: 3 };
      p.fx.reverb = 0.8;
    },
  },
  {
    name: "Crystal Pad",
    category: "Pads",
    mutate: (p) => {
      O(p,0).wave = "sine";
      p.oscillators[1] = { ...O(p,1), on: true, wave: "triangle", octave: 2, level: 0.3 };
      p.cutoff = 5200;
      p.amp = { attack: 0.6, decay: 1, sustain: 0.8, release: 1.6 };
      p.fx.reverb = 0.7;
      p.fx.delay = 0.3;
    },
  },
  {
    name: "Gritty Lead",
    category: "Leads",
    mutate: (p) => {
      O(p,0).wave = "sawtooth";
      p.cutoff = 2000;
      p.resonance = 10;
      p.fx.distortion = 0.55;
      p.fx.bitcrush = 0.15;
      p.voiceMode = "mono";
    },
  },
  {
    name: "Square Lead",
    category: "Leads",
    mutate: (p) => {
      O(p,0).wave = "square";
      p.cutoff = 3000;
      p.amp = { attack: 0.01, decay: 0.2, sustain: 0.8, release: 0.2 };
      p.voiceMode = "mono";
      p.glide = 0.03;
      p.fx.delay = 0.28;
    },
  },
  {
    name: "Whistle Lead",
    category: "Leads",
    mutate: (p) => {
      O(p,0).wave = "sine";
      p.lfos[2] = { on: true, rate: 5.5, wave: "sine", amount: 0.1, destination: "pitch" };
      p.amp = { attack: 0.06, decay: 0.2, sustain: 0.8, release: 0.3 };
      p.fx.reverb = 0.45;
      p.fx.delay = 0.3;
    },
  },
  {
    name: "Anthem Lead",
    category: "Leads",
    mutate: (p) => {
      O(p,0).wave = "sawtooth";
      p.oscillators[1] = { ...O(p,1), on: true, wave: "sawtooth", octave: 1, detune: 16, level: 0.55 };
      p.unison = { voices: 5, detune: 22, width: 0.8 };
      p.cutoff = 4200;
      p.fx.reverb = 0.5;
      p.fx.delay = 0.3;
    },
  },
  {
    name: "Chiptune Blip",
    category: "Retro",
    mutate: (p) => {
      O(p,0).wave = "square";
      p.cutoff = 6000;
      p.amp = { attack: 0.001, decay: 0.12, sustain: 0.3, release: 0.08 };
      p.fx.bitcrush = 0.5;
    },
  },
  {
    name: "8-Bit Bass",
    category: "Retro",
    mutate: (p) => {
      O(p,0).wave = "square";
      O(p,0).octave = -1;
      p.cutoff = 1200;
      p.amp = { attack: 0.001, decay: 0.2, sustain: 0.6, release: 0.1 };
      p.fx.bitcrush = 0.45;
    },
  },
  {
    name: "Tape Keys",
    category: "Retro",
    mutate: (p) => {
      O(p,0).wave = "triangle";
      p.cutoff = 1900;
      p.analog = 0.45;
      p.amp = { attack: 0.02, decay: 0.6, sustain: 0.4, release: 0.6 };
      p.fx.chorus = 0.45;
      p.fx.reverb = 0.3;
    },
  },
  {
    name: "Riser FX",
    category: "FX",
    mutate: (p) => {
      O(p,0).wave = "sawtooth";
      p.noise = 0.35;
      p.cutoff = 300;
      p.filterEnv = { attack: 3, decay: 1, sustain: 0.9, release: 1, amount: 9000 };
      p.amp = { attack: 2.5, decay: 1, sustain: 0.9, release: 1 };
      p.fx.reverb = 0.6;
    },
  },
  {
    name: "Downlifter",
    category: "FX",
    mutate: (p) => {
      O(p,0).wave = "sawtooth";
      p.noise = 0.3;
      p.cutoff = 6000;
      p.filterEnv = { attack: 0.01, decay: 2.4, sustain: 0, release: 1.2, amount: -5000 };
      p.amp = { attack: 0.01, decay: 2.4, sustain: 0.2, release: 1.4 };
      p.fx.reverb = 0.55;
    },
  },
  {
    name: "Noise Wash",
    category: "FX",
    mutate: (p) => {
      O(p,0).level = 0.1;
      p.noise = 0.8;
      p.cutoff = 1800;
      p.amp = { attack: 1.4, decay: 1.4, sustain: 0.7, release: 2 };
      p.fx.reverb = 0.8;
    },
  },
  {
    name: "Siren Alarm",
    category: "FX",
    mutate: (p) => {
      O(p,0).wave = "square";
      p.lfos[2] = { on: true, rate: 1.2, wave: "triangle", amount: 0.9, destination: "pitch" };
      p.cutoff = 3400;
      p.fx.distortion = 0.35;
      p.fx.reverb = 0.4;
    },
  },
  {
    name: "Techno Drone Bass",
    category: "Detroit Techno",
    mutate: (p) => {
      O(p,0).wave = "sawtooth";
      O(p,0).octave = -1;
      p.oscillators[1] = { ...O(p,1), on: true, wave: "square", octave: -2, level: 0.5 };
      p.cutoff = 520;
      p.resonance = 8;
      p.voiceMode = "mono";
      p.fx.distortion = 0.3;
    },
  },
  {
    name: "Submerge Pad",
    category: "Detroit Techno",
    mutate: (p) => {
      O(p,0).wave = "sawtooth";
      p.oscillators[1] = { ...O(p,1), on: true, wave: "triangle", detune: 10, level: 0.45 };
      p.cutoff = 1100;
      p.amp = { attack: 0.9, decay: 1.2, sustain: 0.85, release: 2.2 };
      p.fx.reverb = 0.7;
      p.fx.delay = 0.4;
    },
  },
  {
    name: "Electro Bleep",
    category: "Detroit Electro",
    mutate: (p) => {
      O(p,0).wave = "square";
      p.cutoff = 4200;
      p.resonance = 12;
      p.amp = { attack: 0.001, decay: 0.14, sustain: 0, release: 0.12 };
      p.fx.delay = 0.4;
      p.fx.delayFeedback = 0.45;
    },
  },
  {
    name: "Talkbox Vox",
    category: "Detroit Electro",
    mutate: (p) => {
      O(p,0).wave = "sawtooth";
      p.filterType = "bandpass";
      p.cutoff = 1200;
      p.resonance = 14;
      p.lfos[0] = { on: true, rate: 3.5, wave: "sine", amount: 0.5, destination: "filter" };
      p.fx.chorus = 0.4;
    },
  },
];

// ---- 100 additional factory presets, grouped by category ----
type PresetCfg = {
  wave?: OscillatorParams["wave"];
  wave2?: OscillatorParams["wave"] | null;
  oct?: number;
  oct2?: number;
  detune2?: number;
  level2?: number;
  cutoff?: number;
  res?: number;
  attack?: number;
  decay?: number;
  sustain?: number;
  release?: number;
  envAmt?: number;
  envDecay?: number;
  glide?: number;
  unison?: number;
  width?: number;
  drive?: number;
  dist?: number;
  chorus?: number;
  delay?: number;
  reverb?: number;
  crush?: number;
  noise?: number;
  lfo?: { rate: number; wave: "sine" | "triangle" | "square" | "sawtooth"; amount: number; destination: "filter" | "pitch" | "pan" | "volume" };
  filterType?: BiquadFilterType;
  arp?: boolean;
};
const mk = (name: string, category: string, c: PresetCfg): PresetDef => ({
  name,
  category,
  mutate: (p) => {
    if (c.wave) O(p, 0).wave = c.wave;
    if (c.oct !== undefined) O(p, 0).octave = c.oct;
    if (c.wave2 === null) O(p, 1).on = false;
    else if (c.wave2) {
      O(p, 1).on = true;
      O(p, 1).wave = c.wave2;
      if (c.oct2 !== undefined) O(p, 1).octave = c.oct2;
      if (c.detune2 !== undefined) O(p, 1).detune = c.detune2;
      if (c.level2 !== undefined) O(p, 1).level = c.level2;
    }
    if (c.cutoff !== undefined) p.cutoff = c.cutoff;
    if (c.res !== undefined) p.resonance = c.res;
    if (c.filterType) p.filterType = c.filterType;
    if (c.attack !== undefined) p.amp.attack = c.attack;
    if (c.decay !== undefined) p.amp.decay = c.decay;
    if (c.sustain !== undefined) p.amp.sustain = c.sustain;
    if (c.release !== undefined) p.amp.release = c.release;
    if (c.envAmt !== undefined) p.filterEnv.amount = c.envAmt;
    if (c.envDecay !== undefined) p.filterEnv.decay = c.envDecay;
    if (c.glide !== undefined) p.glide = c.glide;
    if (c.unison !== undefined) p.unison.voices = c.unison;
    if (c.width !== undefined) p.unison.width = c.width;
    if (c.drive !== undefined) p.drive = c.drive;
    if (c.dist !== undefined) p.fx.distortion = c.dist;
    if (c.chorus !== undefined) p.fx.chorus = c.chorus;
    if (c.delay !== undefined) p.fx.delay = c.delay;
    if (c.reverb !== undefined) p.fx.reverb = c.reverb;
    if (c.crush !== undefined) p.fx.bitcrush = c.crush;
    if (c.noise !== undefined) p.noise = c.noise;
    if (c.lfo) p.lfos[0] = { on: true, ...c.lfo };
    if (c.arp) p.arp = { on: true, rate: 1, direction: "up", octaves: 1, gate: 0.5 };
  },
});

SYNTH_PRESETS.push(
  // Bass
  mk("Sub Pressure", "Bass", { wave: "sine", wave2: null, oct: -1, cutoff: 500, attack: 0.003, sustain: 0.9, release: 0.2 }),
  mk("Reese Growl", "Bass", { wave: "sawtooth", wave2: "sawtooth", oct: -1, detune2: 22, cutoff: 800, res: 4, dist: 0.4, sustain: 0.8 }),
  mk("Pluck Bass", "Bass", { wave: "square", wave2: null, oct: -1, cutoff: 1400, envAmt: 2200, envDecay: 0.12, attack: 0.002, decay: 0.15, sustain: 0.05, release: 0.1 }),
  mk("Round Bass", "Bass", { wave: "triangle", wave2: "sine", oct: -1, cutoff: 900, attack: 0.01, sustain: 0.7, release: 0.25 }),
  mk("Wobble Bass", "Bass", { wave: "sawtooth", wave2: "square", oct: -1, cutoff: 600, res: 10, lfo: { rate: 2, wave: "sine", amount: 0.8, destination: "filter" }, sustain: 0.8 }),
  mk("Distorted 808", "Bass", { wave: "sine", wave2: null, oct: -1, cutoff: 400, dist: 0.55, drive: 0.5, attack: 0.002, decay: 0.5, sustain: 0.3, release: 0.3 }),
  mk("FM-Style Bass", "Bass", { wave: "square", wave2: "sawtooth", oct: -1, oct2: 0, detune2: 3, cutoff: 1100, envAmt: 1500, attack: 0.002, sustain: 0.5 }),
  mk("Upright-ish", "Bass", { wave: "triangle", wave2: null, cutoff: 1200, attack: 0.004, decay: 0.4, sustain: 0.15, release: 0.3 }),
  mk("Acid Bass II", "Bass", { wave: "sawtooth", wave2: null, oct: -1, cutoff: 650, res: 18, envAmt: 3800, envDecay: 0.18, glide: 0.05, dist: 0.35 }),
  mk("Deep Sub Drone", "Bass", { wave: "sine", wave2: "triangle", oct: -2, oct2: -1, cutoff: 300, attack: 0.15, sustain: 1, release: 0.8 }),
  // Lead
  mk("Saw Hero", "Lead", { wave: "sawtooth", wave2: "sawtooth", detune2: 10, cutoff: 3200, res: 6, glide: 0.04, delay: 0.3, reverb: 0.3 }),
  mk("Square Caller", "Lead", { wave: "square", wave2: null, cutoff: 2600, res: 8, glide: 0.06, attack: 0.005, sustain: 0.6 }),
  mk("Soft Flute Lead", "Lead", { wave: "triangle", wave2: "sine", oct2: 1, level2: 0.25, cutoff: 2000, attack: 0.08, sustain: 0.7, reverb: 0.4 }),
  mk("Aggro Stab Lead", "Lead", { wave: "sawtooth", wave2: "square", detune2: -8, cutoff: 3800, res: 10, dist: 0.4, attack: 0.002, decay: 0.2, sustain: 0.3 }),
  mk("Portamento Cry", "Lead", { wave: "sawtooth", wave2: null, cutoff: 2400, res: 12, glide: 0.12, lfo: { rate: 5.5, wave: "sine", amount: 0.25, destination: "pitch" } }),
  mk("Chip Lead", "Lead", { wave: "square", wave2: null, oct: 1, cutoff: 6000, attack: 0.001, decay: 0.1, sustain: 0.5, release: 0.08, crush: 0.3 }),
  mk("Wide Unison Lead", "Lead", { wave: "sawtooth", wave2: "sawtooth", detune2: 14, unison: 5, width: 0.8, cutoff: 3000, chorus: 0.5 }),
  mk("Dark Mono Lead", "Lead", { wave: "sawtooth", wave2: null, oct: -1, cutoff: 1600, res: 8, glide: 0.08, dist: 0.25 }),
  mk("Glass Lead", "Lead", { wave: "triangle", wave2: "sine", oct2: 2, level2: 0.2, cutoff: 4500, attack: 0.02, reverb: 0.5, delay: 0.35 }),
  mk("Vocal Lead", "Lead", { wave: "sawtooth", wave2: null, filterType: "bandpass", cutoff: 1100, res: 12, lfo: { rate: 4, wave: "sine", amount: 0.35, destination: "filter" }, chorus: 0.35 }),
  // Pad
  mk("Warm Analog Pad", "Pad", { wave: "sawtooth", wave2: "sawtooth", detune2: 12, cutoff: 1600, attack: 0.6, sustain: 0.85, release: 1.8, chorus: 0.5, reverb: 0.55 }),
  mk("Glass Pad", "Pad", { wave: "triangle", wave2: "sine", oct2: 1, cutoff: 2400, attack: 0.8, sustain: 0.8, release: 2.4, reverb: 0.7 }),
  mk("Dark Drone Pad", "Pad", { wave: "sawtooth", wave2: "square", oct: -1, detune2: 6, cutoff: 700, attack: 1.2, sustain: 0.9, release: 3, reverb: 0.6 }),
  mk("Strings Ensemble", "Pad", { wave: "sawtooth", wave2: "sawtooth", detune2: 18, unison: 4, width: 0.6, cutoff: 2000, attack: 0.4, sustain: 0.85, release: 1.5, chorus: 0.55 }),
  mk("Shimmer Pad", "Pad", { wave: "triangle", wave2: "triangle", oct2: 2, level2: 0.2, cutoff: 3000, attack: 0.9, sustain: 0.75, release: 2.8, reverb: 0.8, delay: 0.3 }),
  mk("Lo-Fi Pad", "Pad", { wave: "sawtooth", wave2: null, cutoff: 1200, attack: 0.5, sustain: 0.7, release: 1.6, crush: 0.35, noise: 0.08, chorus: 0.4 }),
  mk("Choir-ish Pad", "Pad", { wave: "sawtooth", wave2: "triangle", filterType: "bandpass", cutoff: 900, res: 4, attack: 0.7, sustain: 0.8, release: 2, reverb: 0.75 }),
  mk("Pulse Pad", "Pad", { wave: "square", wave2: "square", detune2: 8, cutoff: 1400, attack: 0.4, sustain: 0.7, release: 1.4, lfo: { rate: 0.8, wave: "triangle", amount: 0.4, destination: "filter" } }),
  mk("Ice Pad", "Pad", { wave: "sine", wave2: "triangle", oct2: 1, cutoff: 3500, attack: 1, sustain: 0.8, release: 3, reverb: 0.85 }),
  mk("Vintage String Pad", "Pad", { wave: "sawtooth", wave2: "sawtooth", detune2: 9, cutoff: 1800, attack: 0.35, sustain: 0.8, release: 1.2, chorus: 0.6, reverb: 0.4 }),
  // Keys
  mk("Electric Piano", "Keys", { wave: "triangle", wave2: "sine", oct2: 1, level2: 0.3, cutoff: 2200, attack: 0.002, decay: 0.8, sustain: 0.2, release: 0.5, chorus: 0.3 }),
  mk("Clav Funk", "Keys", { wave: "square", wave2: null, cutoff: 2800, res: 6, attack: 0.001, decay: 0.18, sustain: 0.1, release: 0.12, dist: 0.2 }),
  mk("Grand-ish Piano", "Keys", { wave: "triangle", wave2: "sine", oct2: 1, level2: 0.2, cutoff: 3500, attack: 0.001, decay: 1.2, sustain: 0.1, release: 0.4, reverb: 0.3 }),
  mk("Organ Drawbar", "Keys", { wave: "sine", wave2: "sine", oct2: 1, level2: 0.5, cutoff: 4000, attack: 0.005, sustain: 0.95, release: 0.1, chorus: 0.25 }),
  mk("Rock Organ", "Keys", { wave: "square", wave2: "sawtooth", level2: 0.3, cutoff: 3200, attack: 0.003, sustain: 0.9, release: 0.12, dist: 0.3, chorus: 0.35 }),
  mk("Wurly", "Keys", { wave: "sawtooth", wave2: "triangle", cutoff: 1800, attack: 0.002, decay: 0.6, sustain: 0.25, release: 0.35, dist: 0.15, chorus: 0.3 }),
  mk("Harpsi Pluck", "Keys", { wave: "square", wave2: null, oct: 1, cutoff: 4500, attack: 0.001, decay: 0.25, sustain: 0, release: 0.15 }),
  mk("Mellow Rhodes", "Keys", { wave: "sine", wave2: "triangle", cutoff: 1600, attack: 0.004, decay: 0.9, sustain: 0.3, release: 0.6, chorus: 0.4, reverb: 0.35 }),
  mk("Detroit Keys", "Keys", { wave: "triangle", wave2: "square", level2: 0.2, cutoff: 2000, attack: 0.003, decay: 0.5, sustain: 0.25, release: 0.4, delay: 0.25 }),
  mk("Toy Piano", "Keys", { wave: "square", wave2: "sine", oct: 1, oct2: 2, level2: 0.3, cutoff: 5000, attack: 0.001, decay: 0.4, sustain: 0.05, release: 0.3, crush: 0.15 }),
  // Pluck
  mk("Marimba Pluck", "Pluck", { wave: "sine", wave2: "triangle", cutoff: 2400, envAmt: 1800, envDecay: 0.15, attack: 0.001, decay: 0.3, sustain: 0, release: 0.2 }),
  mk("Kalimba", "Pluck", { wave: "triangle", wave2: null, oct: 1, cutoff: 3000, envAmt: 2000, envDecay: 0.1, attack: 0.001, decay: 0.35, sustain: 0, release: 0.25 }),
  mk("Acid Pluck", "Pluck", { wave: "sawtooth", wave2: null, cutoff: 900, res: 14, envAmt: 3200, envDecay: 0.12, attack: 0.001, decay: 0.15, sustain: 0, release: 0.1 }),
  mk("Harp Pluck", "Pluck", { wave: "triangle", wave2: "sawtooth", level2: 0.15, cutoff: 4000, attack: 0.001, decay: 0.7, sustain: 0, release: 0.5, reverb: 0.45 }),
  mk("Funk Guitar-ish", "Pluck", { wave: "sawtooth", wave2: "square", level2: 0.3, cutoff: 2200, envAmt: 1500, envDecay: 0.08, attack: 0.001, decay: 0.12, sustain: 0.05, release: 0.08, dist: 0.25 }),
  mk("Bell Pluck", "Pluck", { wave: "sine", wave2: "sine", oct2: 2, level2: 0.25, cutoff: 5000, attack: 0.001, decay: 0.9, sustain: 0, release: 0.7, reverb: 0.5 }),
  mk("Rubber Pluck", "Pluck", { wave: "square", wave2: null, cutoff: 1200, res: 8, envAmt: 1200, envDecay: 0.09, attack: 0.002, decay: 0.14, sustain: 0.05, release: 0.1 }),
  mk("Steel Drum-ish", "Pluck", { wave: "triangle", wave2: "sine", oct2: 1, detune2: 5, cutoff: 3800, attack: 0.001, decay: 0.5, sustain: 0.05, release: 0.4, delay: 0.2 }),
  mk("Muted Pluck", "Pluck", { wave: "sawtooth", wave2: null, cutoff: 700, envAmt: 900, envDecay: 0.07, attack: 0.001, decay: 0.1, sustain: 0, release: 0.06 }),
  mk("Dream Pluck", "Pluck", { wave: "triangle", wave2: "triangle", detune2: 10, cutoff: 2600, attack: 0.005, decay: 0.5, sustain: 0.1, release: 0.6, reverb: 0.6, chorus: 0.4 }),
  // Arp
  mk("Trance Arp", "Arp", { wave: "sawtooth", wave2: "square", level2: 0.3, cutoff: 2800, res: 8, envAmt: 2000, envDecay: 0.1, attack: 0.001, decay: 0.12, sustain: 0.1, release: 0.08, arp: true, delay: 0.3 }),
  mk("Chip Arp", "Arp", { wave: "square", wave2: null, cutoff: 5500, attack: 0.001, decay: 0.08, sustain: 0.2, release: 0.05, arp: true, crush: 0.25 }),
  mk("Dark Sequence", "Arp", { wave: "sawtooth", wave2: null, oct: -1, cutoff: 1100, res: 10, envAmt: 1600, envDecay: 0.14, attack: 0.002, decay: 0.16, sustain: 0.15, release: 0.1, arp: true, dist: 0.3 }),
  mk("Glass Arp", "Arp", { wave: "triangle", wave2: "sine", oct2: 1, cutoff: 4200, attack: 0.002, decay: 0.3, sustain: 0.1, release: 0.3, arp: true, reverb: 0.5 }),
  mk("Berlin School", "Arp", { wave: "sawtooth", wave2: "sawtooth", detune2: 7, cutoff: 1800, envAmt: 2400, envDecay: 0.18, attack: 0.002, decay: 0.2, sustain: 0.2, release: 0.15, arp: true, delay: 0.4 }),
  mk("Plucky Arp", "Arp", { wave: "square", wave2: null, cutoff: 2000, envAmt: 1800, envDecay: 0.09, attack: 0.001, decay: 0.1, sustain: 0, release: 0.08, arp: true }),
  mk("Wide Arp", "Arp", { wave: "sawtooth", wave2: "sawtooth", detune2: 15, unison: 4, width: 0.7, cutoff: 3000, attack: 0.002, decay: 0.15, sustain: 0.15, release: 0.12, arp: true, chorus: 0.4 }),
  mk("Minor Pulse", "Arp", { wave: "square", wave2: null, oct: -1, cutoff: 1400, res: 6, attack: 0.003, decay: 0.2, sustain: 0.3, release: 0.15, arp: true }),
  mk("Sparkle Arp", "Arp", { wave: "triangle", wave2: null, oct: 1, cutoff: 6000, attack: 0.001, decay: 0.2, sustain: 0.05, release: 0.2, arp: true, delay: 0.35, reverb: 0.4 }),
  mk("Driving 16ths", "Arp", { wave: "sawtooth", wave2: "square", oct: -1, cutoff: 1600, res: 8, envAmt: 1400, envDecay: 0.1, attack: 0.001, decay: 0.12, sustain: 0.2, release: 0.08, arp: true, dist: 0.2 }),
  // Strings
  mk("Chamber Strings", "Strings", { wave: "sawtooth", wave2: "sawtooth", detune2: 10, unison: 3, cutoff: 2200, attack: 0.25, sustain: 0.85, release: 1, chorus: 0.4, reverb: 0.45 }),
  mk("Pizzicato", "Strings", { wave: "sawtooth", wave2: null, cutoff: 2600, envAmt: 1200, envDecay: 0.06, attack: 0.001, decay: 0.12, sustain: 0, release: 0.1 }),
  mk("Cello Section", "Strings", { wave: "sawtooth", wave2: "triangle", oct: -1, cutoff: 1400, attack: 0.2, sustain: 0.8, release: 0.8, reverb: 0.4 }),
  mk("Synth Strings 80s", "Strings", { wave: "sawtooth", wave2: "square", detune2: 12, cutoff: 2600, attack: 0.3, sustain: 0.85, release: 1.2, chorus: 0.6 }),
  mk("Tremolo Strings", "Strings", { wave: "sawtooth", wave2: "sawtooth", detune2: 8, cutoff: 2400, attack: 0.15, sustain: 0.85, release: 0.9, lfo: { rate: 6, wave: "sine", amount: 0.3, destination: "volume" } }),
  mk("Octave Strings", "Strings", { wave: "sawtooth", wave2: "sawtooth", oct2: 1, detune2: 6, cutoff: 2000, attack: 0.3, sustain: 0.8, release: 1.1, reverb: 0.5 }),
  mk("Muted Strings", "Strings", { wave: "sawtooth", wave2: null, cutoff: 1100, attack: 0.2, sustain: 0.75, release: 0.7, chorus: 0.3 }),
  mk("Epic Strings", "Strings", { wave: "sawtooth", wave2: "sawtooth", detune2: 16, unison: 5, width: 0.7, cutoff: 2800, attack: 0.4, sustain: 0.9, release: 1.6, reverb: 0.65, chorus: 0.5 }),
  mk("Solo Violin-ish", "Strings", { wave: "sawtooth", wave2: null, cutoff: 2600, res: 3, attack: 0.12, sustain: 0.8, release: 0.4, glide: 0.03, lfo: { rate: 5.5, wave: "sine", amount: 0.15, destination: "pitch" } }),
  mk("Low Strings", "Strings", { wave: "sawtooth", wave2: "sawtooth", oct: -1, detune2: 10, cutoff: 900, attack: 0.35, sustain: 0.85, release: 1.3, reverb: 0.5 }),
  // Brass
  mk("Synth Brass", "Brass", { wave: "sawtooth", wave2: "square", level2: 0.3, cutoff: 2000, envAmt: 1200, envDecay: 0.2, attack: 0.06, sustain: 0.75, release: 0.3, chorus: 0.3 }),
  mk("Trumpet-ish", "Brass", { wave: "sawtooth", wave2: null, cutoff: 2400, res: 4, attack: 0.05, sustain: 0.8, release: 0.25, lfo: { rate: 5, wave: "sine", amount: 0.1, destination: "pitch" } }),
  mk("Brass Stab", "Brass", { wave: "sawtooth", wave2: "sawtooth", detune2: 8, cutoff: 2600, envAmt: 1800, envDecay: 0.15, attack: 0.005, decay: 0.25, sustain: 0.3, release: 0.2 }),
  mk("Tuba Bass", "Brass", { wave: "sawtooth", wave2: null, oct: -2, cutoff: 900, attack: 0.04, sustain: 0.8, release: 0.3 }),
  mk("Horn Section", "Brass", { wave: "sawtooth", wave2: "sawtooth", detune2: 12, unison: 3, cutoff: 2200, attack: 0.04, sustain: 0.8, release: 0.3, chorus: 0.35 }),
  mk("Muted Trumpet", "Brass", { wave: "sawtooth", wave2: null, cutoff: 1300, res: 5, attack: 0.05, sustain: 0.7, release: 0.25 }),
  mk("Fanfare", "Brass", { wave: "sawtooth", wave2: "square", detune2: 6, cutoff: 3000, envAmt: 1500, envDecay: 0.25, attack: 0.03, sustain: 0.85, release: 0.4, reverb: 0.4 }),
  mk("Soft Trombone", "Brass", { wave: "sawtooth", wave2: "triangle", cutoff: 1500, attack: 0.08, sustain: 0.8, release: 0.4, glide: 0.04 }),
  mk("Brass Swell", "Brass", { wave: "sawtooth", wave2: "sawtooth", detune2: 9, cutoff: 1800, envAmt: 1600, envDecay: 0.6, attack: 0.5, sustain: 0.85, release: 0.8, reverb: 0.5 }),
  mk("Funk Horn Hit", "Brass", { wave: "square", wave2: "sawtooth", level2: 0.4, cutoff: 2800, envAmt: 2000, envDecay: 0.1, attack: 0.002, decay: 0.15, sustain: 0.1, release: 0.12, dist: 0.2 }),
  // FX
  mk("Riser Sweep", "FX", { wave: "sawtooth", wave2: null, cutoff: 800, res: 10, attack: 1.5, sustain: 1, release: 1, lfo: { rate: 0.3, wave: "sawtooth", amount: 0.9, destination: "filter" }, noise: 0.15, reverb: 0.6 }),
  mk("Noise Sweep", "FX", { wave: "sine", wave2: null, noise: 0.6, cutoff: 1000, res: 8, attack: 1, sustain: 0.9, release: 1.5, lfo: { rate: 0.2, wave: "triangle", amount: 0.8, destination: "filter" } }),
  mk("Laser Zap", "FX", { wave: "square", wave2: null, oct: 1, cutoff: 5000, res: 12, glide: 0.02, lfo: { rate: 8, wave: "sawtooth", amount: 0.7, destination: "pitch" }, attack: 0.001, decay: 0.3, sustain: 0, release: 0.2 }),
  mk("Sub Drop", "FX", { wave: "sine", wave2: null, oct: -1, cutoff: 400, glide: 0.3, attack: 0.005, decay: 1, sustain: 0, release: 0.8, dist: 0.3 }),
  mk("Atmosphere", "FX", { wave: "triangle", wave2: "sawtooth", level2: 0.15, noise: 0.2, cutoff: 1200, attack: 2, sustain: 0.9, release: 3, reverb: 0.85, chorus: 0.5 }),
  mk("Vinyl Crackle", "FX", { wave: "sine", wave2: null, noise: 0.4, cutoff: 3000, attack: 0.01, sustain: 0.6, release: 0.5, crush: 0.4 }),
  mk("Metal Hit", "FX", { wave: "square", wave2: "square", detune2: 31, noise: 0.3, filterType: "bandpass", cutoff: 2500, res: 14, attack: 0.001, decay: 0.6, sustain: 0, release: 0.5, reverb: 0.5 }),
  mk("Wind", "FX", { wave: "sine", wave2: null, noise: 0.7, filterType: "bandpass", cutoff: 800, res: 6, attack: 1.2, sustain: 0.8, release: 2, lfo: { rate: 0.4, wave: "sine", amount: 0.5, destination: "filter" } }),
  mk("Alarm", "FX", { wave: "square", wave2: null, cutoff: 4000, lfo: { rate: 2, wave: "square", amount: 0.6, destination: "pitch" }, attack: 0.005, sustain: 0.9, release: 0.2 }),
  mk("Space Echo", "FX", { wave: "triangle", wave2: null, cutoff: 2000, attack: 0.3, sustain: 0.5, release: 1.5, delay: 0.7, reverb: 0.8 }),
  // Detroit Classics
  mk("UR Assault", "Detroit Classics", { wave: "sawtooth", wave2: "square", oct: -1, cutoff: 1200, res: 10, envAmt: 2400, envDecay: 0.15, attack: 0.002, decay: 0.18, sustain: 0.2, release: 0.12, dist: 0.4 }),
  mk("Model 500 Keys", "Detroit Classics", { wave: "triangle", wave2: "sine", oct2: 1, level2: 0.25, cutoff: 2000, attack: 0.004, decay: 0.6, sustain: 0.25, release: 0.5, delay: 0.3, reverb: 0.35 }),
  mk("Juan's Strings", "Detroit Classics", { wave: "sawtooth", wave2: "sawtooth", detune2: 14, cutoff: 1700, attack: 0.3, sustain: 0.85, release: 1.4, chorus: 0.5, reverb: 0.5 }),
  mk("Derrick's Stab", "Detroit Classics", { wave: "square", wave2: "sawtooth", level2: 0.35, cutoff: 2400, envAmt: 1600, envDecay: 0.1, attack: 0.001, decay: 0.14, sustain: 0.1, release: 0.1, delay: 0.25 }),
  mk("Kevin's Chord", "Detroit Classics", { wave: "sawtooth", wave2: "square", detune2: 8, cutoff: 1900, attack: 0.01, decay: 0.4, sustain: 0.4, release: 0.4, chorus: 0.35, reverb: 0.3 }),
  mk("Electro Bass 313", "Detroit Classics", { wave: "square", wave2: null, oct: -1, cutoff: 800, res: 8, envAmt: 1400, envDecay: 0.12, attack: 0.002, decay: 0.15, sustain: 0.15, release: 0.1, dist: 0.35 }),
  mk("Belleville Bells", "Detroit Classics", { wave: "sine", wave2: "sine", oct2: 2, level2: 0.3, cutoff: 4500, attack: 0.001, decay: 1, sustain: 0, release: 0.8, reverb: 0.55, delay: 0.3 }),
  mk("Highland Park Pad", "Detroit Classics", { wave: "sawtooth", wave2: "triangle", detune2: 10, cutoff: 1400, attack: 0.7, sustain: 0.8, release: 2, chorus: 0.45, reverb: 0.6 }),
  mk("Eastern Market Lead", "Detroit Classics", { wave: "square", wave2: "sawtooth", detune2: -6, cutoff: 3000, res: 8, glide: 0.05, attack: 0.004, sustain: 0.5, release: 0.25, delay: 0.3 }),
  mk("Motown Bass", "Detroit Classics", { wave: "triangle", wave2: "square", oct: -1, level2: 0.3, cutoff: 1100, attack: 0.004, decay: 0.3, sustain: 0.4, release: 0.2 }),
);

// TD-3-style acid bass (one oscillator, resonant 24 dB-style lowpass, envelope sweep, glide) and a
// classic analogue poly synth. Original SYNCLAB patches running on the built-in synth engine.
SYNTH_PRESETS.push(
  { name: "TD-3 Acid Saw", category: "Acid Bass", mutate: (p) => { O(p,0).wave = "sawtooth"; O(p,0).octave = -1; O(p,1).on = false; p.unison.voices = 1; p.voiceMode = "legato"; p.glide = 0.06; p.glideMode = "legato"; p.cutoff = 520; p.resonance = 18; p.drive = 0.35; p.amp = { attack: 0.002, decay: 0.25, sustain: 0.7, release: 0.08 }; p.filterEnv = { attack: 0.001, decay: 0.18, sustain: 0, release: 0.1, amount: 3200 }; p.fx = { ...p.fx, chorus: 0, reverb: 0.05, delay: 0.12, distortion: 0.2 }; } },
  { name: "TD-3 Acid Square", category: "Acid Bass", mutate: (p) => { O(p,0).wave = "square"; O(p,0).octave = -1; O(p,1).on = false; p.unison.voices = 1; p.voiceMode = "legato"; p.glide = 0.06; p.glideMode = "legato"; p.cutoff = 600; p.resonance = 16; p.drive = 0.4; p.amp = { attack: 0.002, decay: 0.25, sustain: 0.7, release: 0.08 }; p.filterEnv = { attack: 0.001, decay: 0.22, sustain: 0, release: 0.1, amount: 2800 }; p.fx = { ...p.fx, chorus: 0, reverb: 0.05, delay: 0.1, distortion: 0.3 }; } },
  { name: "TD-3 Squelch", category: "Acid Bass", mutate: (p) => { O(p,0).wave = "sawtooth"; O(p,0).octave = -1; O(p,1).on = false; p.unison.voices = 1; p.voiceMode = "legato"; p.glide = 0.09; p.glideMode = "legato"; p.cutoff = 380; p.resonance = 22; p.drive = 0.5; p.amp = { attack: 0.002, decay: 0.3, sustain: 0.6, release: 0.06 }; p.filterEnv = { attack: 0.001, decay: 0.14, sustain: 0, release: 0.08, amount: 4200 }; p.fx = { ...p.fx, chorus: 0, reverb: 0.03, delay: 0.15, distortion: 0.35 }; } },
  { name: "TD-3 Rubber Bass", category: "Acid Bass", mutate: (p) => { O(p,0).wave = "square"; O(p,0).octave = -1; O(p,1).on = false; p.unison.voices = 1; p.voiceMode = "legato"; p.glide = 0.04; p.glideMode = "legato"; p.cutoff = 700; p.resonance = 10; p.drive = 0.25; p.amp = { attack: 0.003, decay: 0.2, sustain: 0.8, release: 0.1 }; p.filterEnv = { attack: 0.001, decay: 0.25, sustain: 0.1, release: 0.12, amount: 1600 }; p.fx = { ...p.fx, chorus: 0, reverb: 0.05, delay: 0, distortion: 0.15 }; } },
  { name: "TD-3 Screamer", category: "Acid Bass", mutate: (p) => { O(p,0).wave = "sawtooth"; O(p,0).octave = 0; O(p,1).on = false; p.unison.voices = 1; p.voiceMode = "legato"; p.glide = 0.07; p.glideMode = "legato"; p.cutoff = 900; p.resonance = 20; p.drive = 0.6; p.amp = { attack: 0.002, decay: 0.2, sustain: 0.5, release: 0.08 }; p.filterEnv = { attack: 0.001, decay: 0.1, sustain: 0, release: 0.06, amount: 5000 }; p.fx = { ...p.fx, chorus: 0, reverb: 0.08, delay: 0.2, distortion: 0.45 }; } },
  { name: "TD-3 Deep Sub", category: "Acid Bass", mutate: (p) => { O(p,0).wave = "square"; O(p,0).octave = -2; O(p,1).on = false; p.unison.voices = 1; p.voiceMode = "legato"; p.glide = 0.05; p.glideMode = "legato"; p.cutoff = 300; p.resonance = 6; p.drive = 0.2; p.amp = { attack: 0.004, decay: 0.3, sustain: 0.9, release: 0.12 }; p.filterEnv = { attack: 0.001, decay: 0.3, sustain: 0.2, release: 0.15, amount: 900 }; p.fx = { ...p.fx, chorus: 0, reverb: 0.02, delay: 0, distortion: 0.1 }; } },
  { name: "TD-3 Warped", category: "Acid Bass", mutate: (p) => { O(p,0).wave = "sawtooth"; O(p,0).octave = -1; O(p,1).on = false; p.unison.voices = 1; p.voiceMode = "legato"; p.glide = 0.12; p.glideMode = "always"; p.cutoff = 550; p.resonance = 24; p.drive = 0.55; p.lfos[0] = { on: true, rate: 5, wave: "triangle", amount: 0.5, destination: "filter" }; p.amp = { attack: 0.002, decay: 0.25, sustain: 0.65, release: 0.08 }; p.filterEnv = { attack: 0.001, decay: 0.16, sustain: 0, release: 0.08, amount: 3600 }; p.fx = { ...p.fx, chorus: 0, reverb: 0.1, delay: 0.25, distortion: 0.4 }; } },
  { name: "TD-3 Stab", category: "Acid Bass", mutate: (p) => { O(p,0).wave = "square"; O(p,0).octave = 0; O(p,1).on = false; p.unison.voices = 1; p.voiceMode = "mono"; p.glide = 0; p.cutoff = 1400; p.resonance = 14; p.drive = 0.4; p.amp = { attack: 0.001, decay: 0.12, sustain: 0.1, release: 0.05 }; p.filterEnv = { attack: 0.001, decay: 0.08, sustain: 0, release: 0.05, amount: 3000 }; p.fx = { ...p.fx, chorus: 0, reverb: 0.06, delay: 0.18, distortion: 0.3 }; } },
  { name: "Poly Synth Brass", category: "Poly Synth", mutate: (p) => { O(p,0).wave = "sawtooth"; p.oscillators[1] = { ...O(p,1), on: true, wave: "sawtooth", octave: 0, detune: 9, level: 0.7 }; p.voiceMode = "poly"; p.unison = { voices: 2, detune: 10, width: 0.6 }; p.cutoff = 1600; p.resonance = 3; p.amp = { attack: 0.04, decay: 0.4, sustain: 0.75, release: 0.5 }; p.filterEnv = { attack: 0.06, decay: 0.5, sustain: 0.3, release: 0.4, amount: 2200 }; p.fx = { ...p.fx, chorus: 0.4, reverb: 0.3 }; } },
  { name: "Poly Synth Pad", category: "Poly Synth", mutate: (p) => { O(p,0).wave = "sawtooth"; p.oscillators[1] = { ...O(p,1), on: true, wave: "pulse", octave: 0, detune: -7, level: 0.55 }; p.voiceMode = "poly"; p.unison = { voices: 3, detune: 14, width: 0.8 }; p.cutoff = 1200; p.resonance = 2; p.amp = { attack: 0.6, decay: 0.8, sustain: 0.85, release: 1.6 }; p.filterEnv.amount = 900; p.fx = { ...p.fx, chorus: 0.5, reverb: 0.55, delay: 0.2 }; } },
  { name: "Poly Synth Strings", category: "Poly Synth", mutate: (p) => { O(p,0).wave = "sawtooth"; p.oscillators[1] = { ...O(p,1), on: true, wave: "sawtooth", octave: 0, detune: 12, level: 0.8 }; p.voiceMode = "poly"; p.unison = { voices: 3, detune: 16, width: 0.9 }; p.cutoff = 2000; p.resonance = 2; p.amp = { attack: 0.35, decay: 0.6, sustain: 0.9, release: 1.2 }; p.filterEnv.amount = 600; p.fx = { ...p.fx, chorus: 0.6, reverb: 0.5 }; } },
  { name: "Poly Synth Keys", category: "Poly Synth", mutate: (p) => { O(p,0).wave = "triangle"; p.oscillators[1] = { ...O(p,1), on: true, wave: "sine", octave: 1, detune: 4, level: 0.35 }; p.voiceMode = "poly"; p.unison = { voices: 1, detune: 0, width: 0 }; p.cutoff = 2600; p.resonance = 1; p.amp = { attack: 0.004, decay: 0.7, sustain: 0.3, release: 0.6 }; p.filterEnv = { attack: 0.001, decay: 0.4, sustain: 0.2, release: 0.3, amount: 1200 }; p.fx = { ...p.fx, chorus: 0.3, reverb: 0.35, delay: 0.15 }; } },
  { name: "Poly Synth Pluck", category: "Poly Synth", mutate: (p) => { O(p,0).wave = "square"; p.oscillators[1] = { ...O(p,1), on: true, wave: "sawtooth", octave: 0, detune: 6, level: 0.5 }; p.voiceMode = "poly"; p.unison = { voices: 2, detune: 8, width: 0.5 }; p.cutoff = 2400; p.resonance = 4; p.amp = { attack: 0.001, decay: 0.25, sustain: 0.15, release: 0.2 }; p.filterEnv = { attack: 0.001, decay: 0.18, sustain: 0.1, release: 0.15, amount: 2600 }; p.fx = { ...p.fx, chorus: 0.2, reverb: 0.25, delay: 0.2 }; } },
  { name: "Poly Synth Stab", category: "Poly Synth", mutate: (p) => { O(p,0).wave = "sawtooth"; p.oscillators[1] = { ...O(p,1), on: true, wave: "square", octave: 0, detune: -5, level: 0.6 }; p.voiceMode = "poly"; p.unison = { voices: 2, detune: 10, width: 0.6 }; p.cutoff = 2800; p.resonance = 5; p.amp = { attack: 0.001, decay: 0.15, sustain: 0.1, release: 0.12 }; p.filterEnv = { attack: 0.001, decay: 0.1, sustain: 0, release: 0.1, amount: 2400 }; p.fx = { ...p.fx, chorus: 0.25, reverb: 0.2, delay: 0.22 }; } },
  { name: "Poly Synth Choir", category: "Poly Synth", mutate: (p) => { O(p,0).wave = "sawtooth"; p.oscillators[1] = { ...O(p,1), on: true, wave: "sawtooth", octave: 0, detune: 15, level: 0.75 }; p.voiceMode = "poly"; p.unison = { voices: 4, detune: 20, width: 1 }; p.filterType = "bandpass"; p.cutoff = 1100; p.resonance = 3; p.amp = { attack: 0.25, decay: 0.5, sustain: 0.85, release: 0.9 }; p.filterEnv.amount = 400; p.fx = { ...p.fx, chorus: 0.55, reverb: 0.6 }; } },
  { name: "Poly Synth Bass", category: "Poly Synth", mutate: (p) => { O(p,0).wave = "sawtooth"; O(p,0).octave = -1; p.oscillators[1] = { ...O(p,1), on: true, wave: "square", octave: -1, detune: 5, level: 0.6 }; p.voiceMode = "poly"; p.unison = { voices: 1, detune: 0, width: 0 }; p.cutoff = 900; p.resonance = 4; p.amp = { attack: 0.003, decay: 0.3, sustain: 0.7, release: 0.2 }; p.filterEnv = { attack: 0.001, decay: 0.2, sustain: 0.2, release: 0.15, amount: 1400 }; p.fx = { ...p.fx, chorus: 0, reverb: 0.1 }; } },
  { name: "Poly Synth Dream", category: "Poly Synth", mutate: (p) => { O(p,0).wave = "triangle"; p.oscillators[1] = { ...O(p,1), on: true, wave: "sawtooth", octave: 1, detune: 10, level: 0.3 }; p.voiceMode = "poly"; p.unison = { voices: 3, detune: 12, width: 0.8 }; p.cutoff = 1500; p.resonance = 2; p.lfos[0] = { on: true, rate: 0.4, wave: "sine", amount: 0.3, destination: "filter" }; p.amp = { attack: 0.8, decay: 1, sustain: 0.8, release: 2.2 }; p.filterEnv.amount = 500; p.fx = { ...p.fx, chorus: 0.6, reverb: 0.7, delay: 0.3 }; } },
  { name: "Poly Atmos Horizon", category: "Poly Synth", mutate: (p) => { O(p,0).wave = "sawtooth"; p.oscillators[1] = { ...O(p,1), on: true, wave: "sawtooth", octave: 0, detune: 11, level: 0.7 }; p.voiceMode = "poly"; p.unison = { voices: 3, detune: 18, width: 1 }; p.cutoff = 1100; p.resonance = 2; p.lfos[0] = { on: true, rate: 0.12, wave: "sine", amount: 0.35, destination: "filter" }; p.amp = { attack: 1.4, decay: 1, sustain: 0.9, release: 3 }; p.fx = { ...p.fx, chorus: 0.6, reverb: 0.8, delay: 0.35 }; } },
  { name: "Poly Atmos Frozen Lake", category: "Poly Synth", mutate: (p) => { O(p,0).wave = "triangle"; p.oscillators[1] = { ...O(p,1), on: true, wave: "sine", octave: 1, detune: 7, level: 0.5 }; p.voiceMode = "poly"; p.unison = { voices: 3, detune: 10, width: 0.9 }; p.cutoff = 2400; p.resonance = 1; p.amp = { attack: 2, decay: 1, sustain: 0.85, release: 3.5 }; p.fx = { ...p.fx, chorus: 0.4, reverb: 0.9, delay: 0.4 }; } },
  { name: "Poly Atmos Night Drive", category: "Poly Synth", mutate: (p) => { O(p,0).wave = "sawtooth"; p.oscillators[1] = { ...O(p,1), on: true, wave: "square", octave: 0, detune: -9, level: 0.5 }; p.voiceMode = "poly"; p.unison = { voices: 2, detune: 14, width: 0.8 }; p.cutoff = 800; p.resonance = 5; p.lfos[0] = { on: true, rate: 0.25, wave: "triangle", amount: 0.4, destination: "filter" }; p.amp = { attack: 0.9, decay: 1, sustain: 0.8, release: 2.4 }; p.fx = { ...p.fx, chorus: 0.5, reverb: 0.7, delay: 0.3 }; } },
  { name: "Poly Atmos Dust Choir", category: "Poly Synth", mutate: (p) => { O(p,0).wave = "sawtooth"; p.oscillators[1] = { ...O(p,1), on: true, wave: "triangle", octave: 1, detune: 15, level: 0.6 }; p.voiceMode = "poly"; p.unison = { voices: 4, detune: 20, width: 1 }; p.cutoff = 1400; p.resonance = 3; p.lfos[0] = { on: true, rate: 4.5, wave: "sine", amount: 0.08, destination: "pitch" }; p.amp = { attack: 1.1, decay: 0.8, sustain: 0.9, release: 2.6 }; p.fx = { ...p.fx, chorus: 0.7, reverb: 0.85 }; } },
  { name: "Poly Atmos Deep Space", category: "Poly Synth", mutate: (p) => { O(p,0).wave = "sine"; p.oscillators[1] = { ...O(p,1), on: true, wave: "sawtooth", octave: -1, detune: 4, level: 0.35 }; p.voiceMode = "poly"; p.unison = { voices: 3, detune: 8, width: 1 }; p.cutoff = 700; p.resonance = 6; p.lfos[0] = { on: true, rate: 0.07, wave: "sine", amount: 0.5, destination: "filter" }; p.amp = { attack: 2.5, decay: 1, sustain: 1, release: 4 }; p.fx = { ...p.fx, reverb: 0.95, delay: 0.45 }; } },
  { name: "Poly Arp Belleville Run", category: "Poly Synth", mutate: (p) => { O(p,0).wave = "sawtooth"; p.oscillators[1] = { ...O(p,1), on: true, wave: "square", octave: 0, detune: 6, level: 0.5 }; p.voiceMode = "poly"; p.cutoff = 1800; p.resonance = 6; p.amp = { attack: 0.002, decay: 0.18, sustain: 0.2, release: 0.15 }; p.filterEnv = { attack: 0.001, decay: 0.15, sustain: 0.1, release: 0.1, amount: 2200 }; p.arp = { on: true, rate: 2, direction: "up", octaves: 2, gate: 0.5 }; p.fx = { ...p.fx, delay: 0.3, reverb: 0.3 }; } },
  { name: "Poly Arp Glass Cascade", category: "Poly Synth", mutate: (p) => { O(p,0).wave = "triangle"; p.oscillators[1] = { ...O(p,1), on: true, wave: "sine", octave: 1, detune: 3, level: 0.5 }; p.voiceMode = "poly"; p.cutoff = 4000; p.resonance = 2; p.amp = { attack: 0.002, decay: 0.3, sustain: 0.1, release: 0.4 }; p.arp = { on: true, rate: 2, direction: "down", octaves: 3, gate: 0.4 }; p.fx = { ...p.fx, delay: 0.45, reverb: 0.5 }; } },
  { name: "Poly Arp Bounce", category: "Poly Synth", mutate: (p) => { O(p,0).wave = "square"; p.oscillators[1] = { ...O(p,1), on: true, wave: "sawtooth", octave: 0, detune: 8, level: 0.4 }; p.voiceMode = "poly"; p.cutoff = 1300; p.resonance = 8; p.amp = { attack: 0.002, decay: 0.12, sustain: 0.1, release: 0.1 }; p.filterEnv = { attack: 0.001, decay: 0.1, sustain: 0, release: 0.08, amount: 2600 }; p.arp = { on: true, rate: 2, direction: "updown", octaves: 2, gate: 0.35 }; p.fx = { ...p.fx, delay: 0.25, reverb: 0.2 }; } },
  { name: "Poly Arp Random Stars", category: "Poly Synth", mutate: (p) => { O(p,0).wave = "sine"; p.oscillators[1] = { ...O(p,1), on: true, wave: "triangle", octave: 1, detune: 5, level: 0.5 }; p.voiceMode = "poly"; p.cutoff = 5000; p.amp = { attack: 0.003, decay: 0.4, sustain: 0, release: 0.5 }; p.arp = { on: true, rate: 4, direction: "random", octaves: 3, gate: 0.3 }; p.fx = { ...p.fx, delay: 0.5, reverb: 0.6 }; } },
  { name: "Poly Arp Motor City Pulse", category: "Poly Synth", mutate: (p) => { O(p,0).wave = "sawtooth"; p.oscillators[1] = { ...O(p,1), on: true, wave: "sawtooth", octave: 0, detune: 10, level: 0.6 }; p.voiceMode = "poly"; p.cutoff = 900; p.resonance = 10; p.amp = { attack: 0.001, decay: 0.1, sustain: 0.3, release: 0.08 }; p.filterEnv = { attack: 0.001, decay: 0.12, sustain: 0, release: 0.08, amount: 3000 }; p.arp = { on: true, rate: 4, direction: "alternate", octaves: 1, gate: 0.6 }; p.fx = { ...p.fx, delay: 0.2, reverb: 0.15 }; } },
  { name: "Poly Arp Trance Gate", category: "Poly Synth", mutate: (p) => { O(p,0).wave = "sawtooth"; p.oscillators[1] = { ...O(p,1), on: true, wave: "sawtooth", octave: 0, detune: 12, level: 0.7 }; p.voiceMode = "poly"; p.unison = { voices: 3, detune: 16, width: 0.9 }; p.cutoff = 2200; p.amp = { attack: 0.005, decay: 0.1, sustain: 0.6, release: 0.1 }; p.arp = { on: true, rate: 4, direction: "up", octaves: 1, gate: 0.8 }; p.fx = { ...p.fx, delay: 0.3, reverb: 0.45 }; } },
  { name: "Poly Rhythm Chopper", category: "Poly Synth", mutate: (p) => { O(p,0).wave = "sawtooth"; p.oscillators[1] = { ...O(p,1), on: true, wave: "square", octave: 0, detune: 7, level: 0.6 }; p.voiceMode = "poly"; p.unison = { voices: 2, detune: 12, width: 0.8 }; p.cutoff = 2000; p.lfos[0] = { on: true, rate: 8, wave: "square", amount: 0.9, destination: "volume" }; p.amp = { attack: 0.01, decay: 0.5, sustain: 0.9, release: 0.3 }; p.fx = { ...p.fx, reverb: 0.3, delay: 0.2 }; } },
  { name: "Poly Rhythm Pulse Wash", category: "Poly Synth", mutate: (p) => { O(p,0).wave = "triangle"; p.oscillators[1] = { ...O(p,1), on: true, wave: "sawtooth", octave: 0, detune: 9, level: 0.5 }; p.voiceMode = "poly"; p.cutoff = 1500; p.resonance = 4; p.lfos[0] = { on: true, rate: 4, wave: "square", amount: 0.7, destination: "volume" }; p.lfos[1] = { ...p.lfos[1], on: true, rate: 0.2, wave: "sine", amount: 0.4, destination: "filter" }; p.amp = { attack: 0.3, decay: 0.5, sustain: 0.9, release: 1.2 }; p.fx = { ...p.fx, chorus: 0.4, reverb: 0.6 }; } },
  { name: "Poly Rhythm Filter Step", category: "Poly Synth", mutate: (p) => { O(p,0).wave = "sawtooth"; p.oscillators[1] = { ...O(p,1), on: true, wave: "sawtooth", octave: 0, detune: 6, level: 0.6 }; p.voiceMode = "poly"; p.cutoff = 600; p.resonance = 12; p.lfos[0] = { on: true, rate: 6, wave: "square", amount: 0.6, destination: "filter" }; p.amp = { attack: 0.01, decay: 0.4, sustain: 0.9, release: 0.3 }; p.fx = { ...p.fx, delay: 0.25, reverb: 0.25 }; } },
  { name: "Poly Rhythm Shimmer Sync", category: "Poly Synth", mutate: (p) => { O(p,0).wave = "square"; p.oscillators[1] = { ...O(p,1), on: true, wave: "triangle", octave: 1, detune: 4, level: 0.5 }; p.voiceMode = "poly"; p.cutoff = 3000; p.lfos[0] = { on: true, rate: 2, wave: "triangle", amount: 0.8, destination: "volume" }; p.amp = { attack: 0.05, decay: 0.5, sustain: 0.9, release: 1 }; p.fx = { ...p.fx, chorus: 0.5, reverb: 0.7, delay: 0.35 }; } },
  { name: "Poly Rhythm Stab Sequence", category: "Poly Synth", mutate: (p) => { O(p,0).wave = "sawtooth"; p.oscillators[1] = { ...O(p,1), on: true, wave: "square", octave: 0, detune: 8, level: 0.5 }; p.voiceMode = "poly"; p.cutoff = 1600; p.resonance = 6; p.amp = { attack: 0.001, decay: 0.15, sustain: 0, release: 0.12 }; p.filterEnv = { attack: 0.001, decay: 0.12, sustain: 0, release: 0.1, amount: 2400 }; p.arp = { on: true, rate: 2, direction: "up", octaves: 1, gate: 0.25 }; p.fx = { ...p.fx, delay: 0.35, reverb: 0.3 }; } },
  { name: "Poly Keys Electric Glow", category: "Poly Synth", mutate: (p) => { O(p,0).wave = "triangle"; p.oscillators[1] = { ...O(p,1), on: true, wave: "sine", octave: 1, detune: 2, level: 0.4 }; p.voiceMode = "poly"; p.cutoff = 3200; p.amp = { attack: 0.003, decay: 0.9, sustain: 0.4, release: 0.6 }; p.lfos[0] = { on: true, rate: 4, wave: "sine", amount: 0.15, destination: "volume" }; p.fx = { ...p.fx, chorus: 0.4, reverb: 0.35 }; } },
  { name: "Poly Lead Soft Saw", category: "Poly Synth", mutate: (p) => { O(p,0).wave = "sawtooth"; p.oscillators[1] = { ...O(p,1), on: true, wave: "sawtooth", octave: 0, detune: 7, level: 0.6 }; p.voiceMode = "poly"; p.glide = 0.04; p.cutoff = 2600; p.resonance = 3; p.amp = { attack: 0.02, decay: 0.3, sustain: 0.8, release: 0.4 }; p.fx = { ...p.fx, delay: 0.25, reverb: 0.3 }; } },
);

// Original electro/techno bass voices, kept in the Acid Bass bank and single-oscillator path.
SYNTH_PRESETS.push(...([
  ["TD-3 Electro Motor City", { wave: "square", cutoff: 780, res: 9, envAmt: 1800, envDecay: 0.13, decay: 0.18, sustain: 0.25, glide: 0.035, drive: 0.22 }],
  ["TD-3 Electro Robot Funk", { wave: "sawtooth", cutoff: 1100, res: 12, envAmt: 2400, envDecay: 0.09, decay: 0.14, sustain: 0.1, glide: 0.02, dist: 0.24 }],
  ["TD-3 Electro Sub Glide", { wave: "square", oct: -2, cutoff: 240, res: 3, envAmt: 450, envDecay: 0.35, decay: 0.4, sustain: 0.85, release: 0.18, glide: 0.14, drive: 0.12 }],
  ["TD-3 Electro Rubber Bounce", { wave: "square", cutoff: 480, res: 13, envAmt: 2100, envDecay: 0.24, decay: 0.26, sustain: 0.35, glide: 0.075, dist: 0.18 }],
  ["TD-3 Electro Circuit Pluck", { wave: "sawtooth", cutoff: 1500, res: 7, envAmt: 1700, envDecay: 0.06, decay: 0.09, sustain: 0, release: 0.045, delay: 0.1 }],
  ["TD-3 Electro Breakbeat Bite", { wave: "square", cutoff: 950, res: 15, envAmt: 3000, envDecay: 0.11, decay: 0.16, sustain: 0.18, drive: 0.38, dist: 0.3 }],
  ["TD-3 Electro Neon Pulse", { wave: "sawtooth", cutoff: 620, res: 11, envAmt: 1900, envDecay: 0.2, sustain: 0.55, glide: 0.05, lfo: { rate: 3, wave: "triangle", amount: 0.18, destination: "filter" } }],
  ["TD-3 Electro Dry Machine", { wave: "square", cutoff: 1250, res: 5, envAmt: 800, envDecay: 0.08, decay: 0.12, sustain: 0.05, release: 0.04, drive: 0.15 }],
  ["TD-3 Techno Warehouse", { wave: "sawtooth", cutoff: 400, res: 19, envAmt: 3800, envDecay: 0.16, sustain: 0.6, glide: 0.055, drive: 0.48, dist: 0.32 }],
  ["TD-3 Techno Tunnel Sub", { wave: "triangle", oct: -2, cutoff: 350, res: 4, envAmt: 700, envDecay: 0.28, decay: 0.35, sustain: 0.8, release: 0.16, drive: 0.3 }],
  ["TD-3 Techno Steel Acid", { wave: "sawtooth", cutoff: 850, res: 23, envAmt: 4600, envDecay: 0.1, decay: 0.2, sustain: 0.3, drive: 0.55, dist: 0.4 }],
  ["TD-3 Techno Minimal Knock", { wave: "square", cutoff: 520, res: 8, envAmt: 1200, envDecay: 0.07, decay: 0.1, sustain: 0, release: 0.035, drive: 0.24 }],
  ["TD-3 Techno Hypnotic Slide", { wave: "sawtooth", cutoff: 460, res: 17, envAmt: 2800, envDecay: 0.3, sustain: 0.7, glide: 0.11, delay: 0.16, lfo: { rate: 0.3, wave: "sine", amount: 0.2, destination: "filter" } }],
  ["TD-3 Techno Industrial Grind", { wave: "square", cutoff: 680, res: 14, envAmt: 2600, envDecay: 0.15, sustain: 0.45, drive: 0.65, dist: 0.5, crush: 0.12 }],
  ["TD-3 Techno Peak Time", { wave: "sawtooth", cutoff: 1300, res: 20, envAmt: 4200, envDecay: 0.12, decay: 0.18, sustain: 0.25, glide: 0.04, drive: 0.45, dist: 0.28, delay: 0.12 }],
  ["TD-3 Techno Dub Pressure", { wave: "square", cutoff: 330, res: 10, envAmt: 1500, envDecay: 0.38, decay: 0.4, sustain: 0.4, release: 0.2, glide: 0.065, delay: 0.22, reverb: 0.08 }],
] satisfies [string, PresetCfg][]).map(([name, config]) => {
  const voice = mk(name, "Acid Bass", {
    wave2: null, oct: -1, unison: 1, width: 0, attack: 0.002,
    decay: 0.22, release: 0.08, glide: 0,
    chorus: 0, reverb: 0.02, delay: 0, dist: 0.12, drive: 0.2,
    ...config,
  });
  return { ...voice, mutate: (p: SynthPatch) => {
    voice.mutate(p);
    p.voiceMode = p.glide > 0 ? "legato" : "mono";
    p.glideMode = "legato";
    p.filterEnv = { ...p.filterEnv, attack: 0.001, sustain: 0, release: 0.08 };
    p.fx.delayFeedback = 0.25;
  } };
}));

// Additional SYNCE 4 voices; append without changing existing factory patches or saved music.
SYNTH_PRESETS.push(
  mk("SYNCE 4 Motor City Strings", "Strings", { wave: "sawtooth", wave2: "sawtooth", oct2: 0, detune2: 11, level2: 0.55, unison: 3, width: 0.8, cutoff: 1900, res: 2, envAmt: 450, attack: 0.32, decay: 0.65, sustain: 0.85, release: 1.3, drive: 0.05, dist: 0, chorus: 0.4, delay: 0, reverb: 0.35 }),
  mk("SYNCE 4 Silky Ensemble", "Strings", { wave: "sawtooth", wave2: "triangle", oct2: 0, detune2: -9, level2: 0.5, unison: 3, width: 0.9, cutoff: 1350, res: 1, envAmt: 250, attack: 0.55, decay: 0.8, sustain: 0.9, release: 1.8, drive: 0, dist: 0, chorus: 0.5, delay: 0, reverb: 0.4 }),
  mk("SYNCE 4 Cinematic Strings", "Strings", { wave: "sawtooth", wave2: "sawtooth", oct2: 0, detune2: 17, level2: 0.6, unison: 4, width: 0.85, cutoff: 2700, res: 2, envAmt: 850, attack: 0.75, decay: 1.1, sustain: 0.9, release: 2.4, drive: 0.05, dist: 0, chorus: 0.3, delay: 0, reverb: 0.6 }),
  mk("SYNCE 4 Low Cello Strings", "Strings", { wave: "sawtooth", wave2: "triangle", oct: -1, oct2: -1, detune2: 5, level2: 0.45, unison: 2, width: 0.45, cutoff: 1050, res: 3, envAmt: 350, attack: 0.22, decay: 0.5, sustain: 0.8, release: 0.9, drive: 0.08, dist: 0, chorus: 0.15, delay: 0, reverb: 0.25 }),
  mk("SYNCE 4 Pizzicato Strings", "Strings", { wave: "sawtooth", wave2: "triangle", oct2: 0, detune2: 4, level2: 0.3, unison: 2, width: 0.55, cutoff: 2100, res: 2, envAmt: 1800, envDecay: 0.065, attack: 0.002, decay: 0.18, sustain: 0, release: 0.12, drive: 0, dist: 0, chorus: 0.1, delay: 0, reverb: 0.2 }),
  mk("SYNCE 4 Tremolo Ensemble", "Strings", { wave: "sawtooth", wave2: "sawtooth", oct2: 0, detune2: 8, level2: 0.5, unison: 3, width: 0.7, cutoff: 2300, res: 2, envAmt: 400, attack: 0.2, decay: 0.55, sustain: 0.85, release: 1.1, drive: 0, dist: 0, chorus: 0.25, delay: 0, reverb: 0.3, lfo: { rate: 5, wave: "sine", amount: 0.22, destination: "volume" } }),
  mk("SYNCE 4 Detroit Chord Stab", "Stabs", { wave: "sawtooth", wave2: "square", oct2: 0, detune2: -7, level2: 0.45, unison: 2, width: 0.6, cutoff: 1800, res: 6, envAmt: 2400, envDecay: 0.1, attack: 0.002, decay: 0.2, sustain: 0, release: 0.15, drive: 0.15, dist: 0.08, chorus: 0.15, delay: 0.2, reverb: 0.2 }),
  mk("SYNCE 4 Warehouse Stab", "Stabs", { wave: "sawtooth", wave2: "sawtooth", oct2: 0, detune2: 15, level2: 0.6, unison: 3, width: 0.8, cutoff: 3200, res: 5, envAmt: 3000, envDecay: 0.12, attack: 0.001, decay: 0.26, sustain: 0, release: 0.18, drive: 0.25, dist: 0.2, chorus: 0.25, delay: 0.12, reverb: 0.3 }),
  mk("SYNCE 4 Dub Echo Stab", "Stabs", { wave: "square", wave2: "sawtooth", oct2: 0, detune2: 6, level2: 0.4, unison: 2, width: 0.7, cutoff: 950, res: 5, envAmt: 1400, envDecay: 0.18, attack: 0.005, decay: 0.3, sustain: 0, release: 0.24, drive: 0.08, dist: 0, chorus: 0.1, delay: 0.45, reverb: 0.35 }),
  mk("SYNCE 4 Brass Punch Stab", "Stabs", { wave: "sawtooth", wave2: "square", oct2: 0, detune2: 3, level2: 0.35, unison: 2, width: 0.4, cutoff: 2200, res: 3, envAmt: 3400, envDecay: 0.16, attack: 0.008, decay: 0.32, sustain: 0, release: 0.16, drive: 0.1, dist: 0, chorus: 0, delay: 0, reverb: 0.15 }),
  mk("SYNCE 4 Electro Needle Stab", "Stabs", { wave: "square", wave2: "triangle", oct2: 1, detune2: -3, level2: 0.25, unison: 1, width: 0.2, cutoff: 2900, res: 9, envAmt: 1900, envDecay: 0.055, attack: 0.001, decay: 0.1, sustain: 0, release: 0.07, drive: 0.12, dist: 0.1, chorus: 0, delay: 0.18, reverb: 0.08 }),
  mk("SYNCE 4 Muted House Stab", "Stabs", { wave: "triangle", wave2: "sawtooth", oct2: 0, detune2: 5, level2: 0.3, unison: 2, width: 0.5, cutoff: 1250, res: 2, envAmt: 900, envDecay: 0.09, attack: 0.004, decay: 0.16, sustain: 0, release: 0.1, drive: 0, dist: 0, chorus: 0.2, delay: 0.08, reverb: 0.12 }),
);

/** Starter notes so a new acid bass or poly synth channel plays straight away; fully editable in the piano roll. */
export const STARTER_NOTES: Record<string, Omit<import("./types").MidiNote, "id">[]> = {
  acid: [36, 36, 48, 36, 39, 36, 43, 46, 36, 36, 48, 41, 36, 39, 36, 34].map((pitch, step) => ({ step, length: step % 4 === 3 ? 2 : 1, pitch, velocity: step % 4 === 0 ? 1 : 0.7 })),
  poly: [[60, 63, 67], [58, 62, 65], [56, 60, 63], [55, 58, 62]].flatMap((chord, i) => chord.map((pitch) => ({ step: i * 4, length: 4, pitch, velocity: 0.8 }))),
};
export const starterNotesFor = (preset?: string) => {
  const set = preset?.startsWith("TD-3") ? STARTER_NOTES["acid"] : preset?.startsWith("Poly Synth") ? STARTER_NOTES["poly"] : undefined;
  return set?.map((n) => ({ ...n, id: uid() }));
};

SYNTH_PRESETS.push(
  ...MODULAR_PRESETS.map((m) => ({ name: m.name, category: "Modular Tech", mutate: (p: SynthPatch) => { p.modular = structuredClone(m.modular); p.voiceMode = "poly"; } })),
);

export const applyPreset = (name: string): SynthPatch => {
  const base = defaultPatch(name);
  const def = SYNTH_PRESETS.find((p) => p.name === name);
  if (def) def.mutate(base);
  return base;
};

const padDef = (kind: DrumPad["kind"], name: string, steps: number, kit: DrumKitId = "909", seed: number[] = []): DrumPad => ({
  id: uid(),
  name,
  kind,
  kit,
  volume: 0.8,
  pan: 0,
  pitch: 0,
  decay: 0.5,
  muted: false,
  solo: false,
  steps: Array.from({ length: steps }, (_, i) => (seed.includes(i) ? 1 : 0)),
});

export const DRUM_KITS: { id: DrumKitId; name: string; desc: string; decay: number; category: string }[] = [
  { id: "909", name: "TR-909", desc: "Punchy techno classic", decay: 0.5, category: "Classic Machines" },
  { id: "808", name: "TR-808", desc: "Long booming sub kick", decay: 0.9, category: "Classic Machines" },
  { id: "727", name: "TR-727", desc: "8-bit congas, agogo and cowbell", decay: 0.4, category: "Classic Machines" },
  { id: "r8", name: "R-8", desc: "Crisp PCM-style shells and cymbals", decay: 0.55, category: "Classic Machines" },
  { id: "707", name: "TR-707", desc: "Dry digital house kit", decay: 0.4, category: "Classic Machines" },
  { id: "606", name: "TR-606", desc: "Thin snappy drumatix", decay: 0.35, category: "Classic Machines" },
  { id: "cr78", name: "CR-78", desc: "Vintage preset rhythm box", decay: 0.3, category: "Classic Machines" },
  { id: "linn", name: "LinnDrum", desc: "80s electro-funk", decay: 0.55, category: "Classic Machines" },
  { id: "dmx", name: "DMX", desc: "Punchy 80s street kit", decay: 0.45, category: "Classic Machines" },
  { id: "simmons", name: "Simmons SDS", desc: "Electronic tom sweep", decay: 0.6, category: "Classic Machines" },
  { id: "mpc60", name: "MPC 60", desc: "Gritty 12-bit sampler", decay: 0.5, category: "Classic Machines" },
  { id: "acoustic", name: "Acoustic", desc: "Natural round kit", decay: 0.65, category: "Live Kits" },
  { id: "jazz", name: "Jazz Brush", desc: "Soft small-room kit", decay: 0.7, category: "Live Kits" },
  { id: "rock", name: "Rock Stadium", desc: "Big ambient shells", decay: 0.75, category: "Live Kits" },
  { id: "latin", name: "Latin Perc", desc: "Congas, timbales, clave", decay: 0.5, category: "Live Kits" },
  { id: "afrobeat", name: "Afrobeat", desc: "Warm groove percussion", decay: 0.55, category: "Live Kits" },
  { id: "detroit", name: "Detroit", desc: "Hard warehouse kit", decay: 0.45, category: "Genre Kits" },
  { id: "techno", name: "Techno Hard", desc: "Driving distorted kick", decay: 0.4, category: "Genre Kits" },
  { id: "house", name: "House Deep", desc: "Round kick, tight clap", decay: 0.45, category: "Genre Kits" },
  { id: "ghettotech", name: "Ghetto Tech", desc: "Fast Detroit booty kit", decay: 0.35, category: "Genre Kits" },
  { id: "lofi", name: "Lo-Fi", desc: "Dusty tape drums", decay: 0.6, category: "Genre Kits" },
  { id: "boombap", name: "Boom Bap", desc: "Dusty 90s hip-hop", decay: 0.55, category: "Genre Kits" },
  { id: "trap", name: "Trap", desc: "808 sub + fast hats", decay: 1, category: "Genre Kits" },
  { id: "drill", name: "Drill", desc: "Sliding 808 and rolls", decay: 1.1, category: "Genre Kits" },
  { id: "jungle", name: "Jungle", desc: "Chopped breakbeat kit", decay: 0.6, category: "Genre Kits" },
  { id: "industrial", name: "Industrial", desc: "Metallic hard noise", decay: 0.5, category: "Genre Kits" },
];

export const defaultPads = (steps = 16, kit: DrumKitId = "909"): DrumPad[] => [
  padDef("kick", "KICK", steps, kit),
  padDef("snare", "SNARE", steps, kit),
  padDef("clap", "CLAP", steps, kit),
  padDef("hat", "HI-HAT", steps, kit),
  padDef("openhat", "OPEN HAT", steps, kit),
  padDef("tom", "TOM", steps, kit),
  padDef("perc", "PERC", steps, kit),
  padDef("rim", "RIM", steps, kit),
  padDef("crash", "CRASH", steps, kit),
  padDef("ride", "RIDE", steps, kit),
  padDef("fx", "FX", steps, kit),
  ...kitExtraPads(kit, steps, DRUM_KITS.find((k) => k.id === kit)?.decay ?? 0.5, () => uid()),
];

export const TRACK_COLORS = [
  "oklch(0.78 0.16 195)",
  "oklch(0.75 0.19 330)",
  "oklch(0.82 0.17 95)",
  "oklch(0.72 0.18 265)",
  "oklch(0.78 0.18 145)",
  "oklch(0.75 0.19 30)",
];

export const KIND_LABEL: Record<TrackKind, string> = {
  audio: "AUDIO",
  instrument: "INSTRUMENT",
  midi: "MIDI",
  drum: "DRUMS",
  sampler: "SAMPLER",
  "ai-vocal": "AI VOCAL",
};

export const INSTRUMENTS: { category: string; items: string[] }[] = [
  { category: "SYNTH", items: ["Cybotron Lead", "Night Arp", "Metro Pluck", "Supersaw Anthem", "Hoover Rave", "Detroit Stab"] },
  { category: "ACID BASS", items: ["TD-3 Acid Saw", "TD-3 Acid Square"] },
  { category: "POLY SYNTH", items: ["Poly Synth Brass", "Poly Synth Pad"] },
  { category: "BASS", items: ["Sub Bass", "Ghetto Tech Bass", "303 Acid", "Reese Bass", "Moog Mono", "808 Sub Glide", "Neuro Growl"] },
  { category: "KEYS", items: ["Deep Keys", "Belleville Strings", "Rhodes Soul", "FM Bell", "Trap Bell", "Brass Stab"] },
  { category: "PAD", items: ["Warehouse Pad", "Void Ambient", "Glass Pad", "Choir Air", "Dub Chord"] },
  { category: "FX", items: ["Assembly Line", "Vocoder Bot", "Sci-Fi Sweep"] },
];

export const GENRES = [
  "Detroit Techno",
  "Detroit Electro",
  "Ghetto Tech",
  "House",
  "Hip-Hop",
  "Trap",
  "R&B",
  "Pop",
  "Breakbeat",
  "Industrial",
];
