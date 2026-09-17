import type { DrumKitId, DrumPad, SynthPatch, TrackKind } from "./types";

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
  drum: "DRUM MACHINE",
  sampler: "SAMPLER",
  "ai-vocal": "AI VOCAL",
};

export const INSTRUMENTS: { category: string; items: string[] }[] = [
  { category: "SYNTH", items: ["Cybotron Lead", "Night Arp", "Metro Pluck", "Supersaw Anthem", "Hoover Rave", "Detroit Stab"] },
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
