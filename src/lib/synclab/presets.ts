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

export const DRUM_KITS: { id: DrumKitId; name: string; desc: string; decay: number }[] = [
  { id: "909", name: "TR-909", desc: "Punchy techno classic", decay: 0.5 },
  { id: "808", name: "TR-808", desc: "Long booming sub kick", decay: 0.9 },
  { id: "707", name: "TR-707", desc: "Dry digital house kit", decay: 0.4 },
  { id: "606", name: "TR-606", desc: "Thin snappy drumatix", decay: 0.35 },
  { id: "linn", name: "LinnDrum", desc: "80s electro-funk", decay: 0.55 },
  { id: "acoustic", name: "Acoustic", desc: "Natural round kit", decay: 0.65 },
  { id: "detroit", name: "Detroit", desc: "Hard warehouse kit", decay: 0.45 },
  { id: "lofi", name: "Lo-Fi", desc: "Dusty tape drums", decay: 0.6 },
  { id: "trap", name: "Trap", desc: "808 sub + fast hats", decay: 1 },
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
