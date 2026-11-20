/**
 * Granular Synth: plays a sound as a cloud of tiny overlapping "grains".
 * Each grain is a short, enveloped slice read from a source sound at a moving
 * position, pitched to the key you play. Sources are original built-in
 * textures (deterministic synthesis, cached per sample rate) or your own sample.
 */

export type GranularSource =
  "glass" | "choir" | "strings" | "bell" | "wind" | "piano" | "pluck" | "sample";
export type GrainShape = "smooth" | "triangle" | "sharp";

export interface GranularPatch {
  source: GranularSource;
  /** Your own sample (when source is "sample"). */
  sampleUrl?: string | undefined;
  sampleCloudPath?: string | undefined;
  sampleName?: string | undefined;
  /** Key the sample sounds at its own pitch (MIDI note). */
  sampleRoot?: number | undefined;
  /** Where grains read from, 0..1 of the source. */
  position: number;
  /** How far the read position moves per second, -1..1 of the source length. */
  scan: number;
  /** Random spread around the position, 0..1. */
  spray: number;
  /** Grain length in milliseconds. */
  size: number;
  /** Grains per second. */
  density: number;
  /** Transpose in semitones. */
  pitch: number;
  /** Random detune per grain, semitones. */
  pitchSpread: number;
  /** Spread grains across the stereo field, 0..1. */
  stereo: number;
  /** Chance a grain plays backwards, 0..1. */
  reverse: number;
  shape: GrainShape;
  /** Hold the read position still (ignores scan). */
  freeze: boolean;
  attack: number;
  release: number;
  cutoff: number;
  resonance: number;
  level: number;
}

export const GRANULAR_SOURCES: { id: GranularSource; label: string }[] = [
  { id: "glass", label: "Glass Pad" },
  { id: "choir", label: "Air Choir" },
  { id: "strings", label: "Tape Strings" },
  { id: "bell", label: "Steel Bell" },
  { id: "wind", label: "Wind Noise" },
  { id: "piano", label: "Struck Piano" },
  { id: "pluck", label: "Plucked String" },
  { id: "sample", label: "My sample" },
];

type NumericKey = {
  [K in keyof GranularPatch]-?: GranularPatch[K] extends number ? K : never;
}[keyof GranularPatch];

/** Every knob on the Granular Synth, grouped by panel; MIDI learn uses the same ranges. */
export const GRANULAR_KNOBS: {
  id: NumericKey;
  label: string;
  min: number;
  max: number;
  step: number;
  unit?: string;
  group: "grain" | "cloud" | "tone";
}[] = [
  { id: "position", label: "POSITION", min: 0, max: 1, step: 0.005, group: "grain" },
  { id: "size", label: "GRAIN SIZE", min: 5, max: 500, step: 1, unit: "ms", group: "grain" },
  { id: "density", label: "DENSITY", min: 1, max: 120, step: 1, unit: "/s", group: "grain" },
  { id: "spray", label: "SPRAY", min: 0, max: 1, step: 0.01, group: "grain" },
  { id: "scan", label: "SCAN", min: -1, max: 1, step: 0.01, group: "cloud" },
  { id: "pitch", label: "PITCH", min: -24, max: 24, step: 1, unit: "st", group: "cloud" },
  {
    id: "pitchSpread",
    label: "PITCH SPREAD",
    min: 0,
    max: 12,
    step: 0.05,
    unit: "st",
    group: "cloud",
  },
  { id: "stereo", label: "STEREO", min: 0, max: 1, step: 0.01, group: "cloud" },
  { id: "reverse", label: "REVERSE", min: 0, max: 1, step: 0.01, group: "cloud" },
  { id: "attack", label: "ATTACK", min: 0.002, max: 4, step: 0.001, unit: "s", group: "tone" },
  { id: "release", label: "RELEASE", min: 0.01, max: 6, step: 0.01, unit: "s", group: "tone" },
  { id: "cutoff", label: "CUTOFF", min: 80, max: 18000, step: 10, unit: "Hz", group: "tone" },
  { id: "resonance", label: "RES", min: 0.1, max: 18, step: 0.1, group: "tone" },
  { id: "level", label: "LEVEL", min: 0, max: 1.5, step: 0.01, group: "tone" },
];

export const defaultGranular = (): GranularPatch => ({
  source: "glass",
  position: 0.3,
  scan: 0.05,
  spray: 0.15,
  size: 120,
  density: 28,
  pitch: 0,
  pitchSpread: 0.1,
  stereo: 0.5,
  reverse: 0,
  shape: "smooth",
  freeze: false,
  attack: 0.3,
  release: 1.2,
  cutoff: 9000,
  resonance: 0.7,
  level: 0.8,
});

export const GRANULAR_PRESETS: { name: string; set: Partial<GranularPatch> }[] = [
  { name: "Granular Glass Cloud", set: {} },
  {
    name: "Granular Frozen Choir",
    set: {
      source: "choir",
      freeze: true,
      position: 0.45,
      spray: 0.08,
      size: 180,
      density: 34,
      attack: 0.6,
      release: 2,
    },
  },
  {
    name: "Granular Detroit Dust",
    set: {
      source: "strings",
      scan: 0.12,
      spray: 0.4,
      size: 60,
      density: 45,
      pitchSpread: 0.3,
      cutoff: 4200,
      stereo: 0.8,
    },
  },
  {
    name: "Granular Shimmer Rise",
    set: {
      source: "glass",
      pitchSpread: 12,
      size: 220,
      density: 22,
      reverse: 0.2,
      attack: 1.2,
      release: 2.5,
      stereo: 1,
    },
  },
  {
    name: "Granular Reverse Bells",
    set: { source: "bell", reverse: 0.8, size: 160, density: 18, spray: 0.3, release: 1.8 },
  },
  {
    name: "Granular Stutter Keys",
    set: {
      source: "strings",
      shape: "sharp",
      size: 35,
      density: 16,
      spray: 0,
      scan: 0,
      freeze: true,
      attack: 0.005,
      release: 0.3,
    },
  },
  {
    name: "Granular Wind Tunnel",
    set: {
      source: "wind",
      size: 250,
      density: 30,
      spray: 0.6,
      cutoff: 2800,
      resonance: 4,
      attack: 0.8,
      release: 2.2,
    },
  },
  {
    name: "Granular Bell Swarm",
    set: {
      source: "bell",
      size: 40,
      density: 70,
      spray: 0.5,
      pitchSpread: 0.5,
      stereo: 1,
      release: 1.5,
    },
  },
  {
    name: "Granular Choir Drift",
    set: {
      source: "choir",
      scan: 0.18,
      spray: 0.2,
      size: 140,
      density: 26,
      pitchSpread: 0.15,
      release: 2.5,
    },
  },
  {
    name: "Granular Octave Mist",
    set: {
      source: "glass",
      pitchSpread: 7,
      size: 300,
      density: 14,
      spray: 0.5,
      stereo: 1,
      attack: 1.5,
      release: 3,
      cutoff: 6000,
    },
  },
  {
    name: "Granular Pluck Grain",
    set: {
      source: "strings",
      attack: 0.002,
      release: 0.4,
      size: 50,
      density: 60,
      spray: 0.05,
      shape: "triangle",
    },
  },
  {
    name: "Granular Deep Drone",
    set: {
      source: "strings",
      pitch: -12,
      size: 400,
      density: 12,
      spray: 0.3,
      cutoff: 1800,
      attack: 1.5,
      release: 3,
    },
  },
  {
    name: "Granular Bitter Ice",
    set: {
      source: "bell",
      pitch: 12,
      size: 25,
      density: 90,
      spray: 0.7,
      stereo: 1,
      cutoff: 12000,
      release: 0.8,
    },
  },
  {
    name: "Granular Tape Wobble",
    set: {
      source: "strings",
      scan: -0.08,
      pitchSpread: 0.6,
      size: 200,
      density: 20,
      reverse: 0.3,
      cutoff: 5000,
    },
  },
  {
    name: "Granular Breath Pad",
    set: {
      source: "wind",
      position: 0.2,
      size: 320,
      density: 18,
      cutoff: 1500,
      resonance: 6,
      attack: 1,
      release: 2,
    },
  },
  {
    name: "Granular Frozen Glass Pad",
    set: {
      source: "glass",
      freeze: true,
      position: 0.6,
      size: 260,
      density: 24,
      spray: 0.1,
      attack: 1,
      release: 2.5,
      stereo: 0.8,
    },
  },
  {
    name: "Granular Rain Drops",
    set: {
      source: "bell",
      shape: "sharp",
      size: 15,
      density: 40,
      spray: 0.9,
      stereo: 1,
      attack: 0.002,
      release: 0.6,
      cutoff: 10000,
    },
  },
  {
    name: "Granular Ghost Choir",
    set: {
      source: "choir",
      scan: 0.03,
      pitchSpread: 0.25,
      size: 280,
      density: 20,
      reverse: 0.4,
      cutoff: 3500,
      attack: 1.2,
      release: 2.8,
    },
  },
  {
    name: "Granular Cloud Strings",
    set: {
      source: "strings",
      size: 180,
      density: 30,
      spray: 0.25,
      stereo: 0.9,
      attack: 0.8,
      release: 2,
    },
  },
  {
    name: "Granular Glitch Stutter",
    set: {
      source: "strings",
      shape: "sharp",
      size: 18,
      density: 50,
      spray: 0.6,
      freeze: true,
      attack: 0.002,
      release: 0.2,
      stereo: 0.7,
    },
  },
  {
    name: "Granular Sub Texture",
    set: {
      source: "strings",
      pitch: -24,
      size: 350,
      density: 10,
      spray: 0.2,
      cutoff: 900,
      attack: 0.6,
      release: 1.8,
    },
  },
  {
    name: "Granular Octave Choir",
    set: {
      source: "choir",
      pitchSpread: 12,
      size: 240,
      density: 16,
      spray: 0.3,
      stereo: 1,
      attack: 1,
      release: 2.4,
    },
  },
  {
    name: "Granular Wind Chimes",
    set: {
      source: "bell",
      pitch: 12,
      spray: 0.8,
      density: 25,
      size: 60,
      stereo: 1,
      attack: 0.01,
      release: 2.5,
    },
  },
  {
    name: "Granular Dust Storm",
    set: {
      source: "wind",
      size: 30,
      density: 80,
      spray: 1,
      reverse: 0.5,
      cutoff: 6000,
      stereo: 1,
      attack: 0.5,
      release: 1.5,
    },
  },
  {
    name: "Granular Tape Stretch",
    set: {
      source: "strings",
      scan: 0.02,
      size: 400,
      density: 14,
      spray: 0.05,
      pitchSpread: 0,
      cutoff: 4000,
      attack: 0.4,
      release: 1.6,
    },
  },
  {
    name: "Granular Reverse Swell",
    set: { source: "glass", reverse: 1, size: 300, density: 18, spray: 0.3, attack: 2, release: 3 },
  },
  {
    name: "Granular Metallic Swarm",
    set: {
      source: "bell",
      size: 12,
      density: 100,
      spray: 0.4,
      pitchSpread: 1,
      cutoff: 3000,
      resonance: 8,
      stereo: 1,
      release: 1.2,
    },
  },
  {
    name: "Granular Soft Keys",
    set: {
      source: "glass",
      shape: "triangle",
      size: 90,
      density: 40,
      spray: 0.05,
      attack: 0.005,
      release: 0.8,
    },
  },
  {
    name: "Granular Breath Voices",
    set: {
      source: "choir",
      position: 0.1,
      spray: 0.4,
      size: 150,
      density: 28,
      cutoff: 1800,
      resonance: 3,
      attack: 0.5,
      release: 1.6,
    },
  },
  {
    name: "Granular Scanning Bells",
    set: {
      source: "bell",
      scan: 0.3,
      size: 80,
      density: 30,
      spray: 0.15,
      stereo: 0.8,
      release: 1.4,
    },
  },
  {
    name: "Granular Low Choir Freeze",
    set: {
      source: "choir",
      pitch: -12,
      freeze: true,
      position: 0.7,
      size: 300,
      density: 16,
      cutoff: 2500,
      attack: 1,
      release: 2.5,
    },
  },
  {
    name: "Granular Shattered Glass",
    set: {
      source: "glass",
      shape: "sharp",
      size: 20,
      density: 60,
      spray: 0.7,
      pitchSpread: 2,
      stereo: 1,
      attack: 0.002,
      release: 0.9,
      cutoff: 12000,
    },
  },
  {
    name: "Granular Slow Motion Strings",
    set: {
      source: "strings",
      scan: 0.01,
      size: 450,
      density: 9,
      spray: 0.1,
      attack: 1.5,
      release: 3,
      cutoff: 3000,
    },
  },
  // ---- grain library: clouds, freezes, swarms, stutters, reversed grains, granular leads and basses ----
  {
    name: "Granular Pollen Cloud",
    set: {
      source: "glass",
      size: 22,
      density: 95,
      spray: 0.85,
      pitchSpread: 0.4,
      stereo: 1,
      attack: 0.4,
      release: 1.8,
      cutoff: 9000,
    },
  },
  {
    name: "Granular Frozen Piano",
    set: {
      source: "piano",
      freeze: true,
      position: 0.05,
      size: 240,
      density: 26,
      spray: 0.04,
      attack: 0.9,
      release: 2.6,
      stereo: 0.7,
    },
  },
  {
    name: "Granular Piano Dust",
    set: {
      source: "piano",
      size: 18,
      density: 85,
      spray: 0.9,
      pitchSpread: 0.2,
      stereo: 1,
      attack: 0.05,
      release: 1.4,
      cutoff: 7000,
    },
  },
  {
    name: "Granular Broken Piano",
    set: {
      source: "piano",
      shape: "sharp",
      size: 28,
      density: 14,
      spray: 0.7,
      reverse: 0.35,
      attack: 0.002,
      release: 0.5,
      stereo: 0.9,
    },
  },
  {
    name: "Granular Reverse Piano Swell",
    set: {
      source: "piano",
      reverse: 1,
      size: 360,
      density: 16,
      spray: 0.12,
      position: 0.08,
      attack: 2.2,
      release: 3,
      cutoff: 6000,
    },
  },
  {
    name: "Granular Piano Octaves",
    set: {
      source: "piano",
      pitchSpread: 12,
      size: 130,
      density: 32,
      spray: 0.06,
      attack: 0.01,
      release: 1.6,
      stereo: 0.8,
    },
  },
  {
    name: "Granular Harp Cloud",
    set: {
      source: "pluck",
      size: 70,
      density: 55,
      spray: 0.35,
      pitchSpread: 0.15,
      stereo: 1,
      attack: 0.004,
      release: 1.2,
    },
  },
  {
    name: "Granular Frozen Pluck",
    set: {
      source: "pluck",
      freeze: true,
      position: 0.02,
      size: 200,
      density: 30,
      spray: 0.03,
      attack: 0.7,
      release: 2.2,
      cutoff: 5200,
    },
  },
  {
    name: "Granular Koto Scatter",
    set: {
      source: "pluck",
      shape: "triangle",
      size: 45,
      density: 24,
      spray: 0.6,
      pitchSpread: 5,
      stereo: 1,
      attack: 0.002,
      release: 0.9,
    },
  },
  {
    name: "Granular String Rain",
    set: {
      source: "pluck",
      shape: "sharp",
      size: 12,
      density: 70,
      spray: 1,
      pitchSpread: 0.3,
      stereo: 1,
      attack: 0.002,
      release: 0.7,
      cutoff: 11000,
    },
  },
  {
    name: "Granular Grain Swarm",
    set: {
      source: "strings",
      size: 10,
      density: 120,
      spray: 0.75,
      pitchSpread: 0.8,
      stereo: 1,
      attack: 0.3,
      release: 1.5,
      cutoff: 8000,
    },
  },
  {
    name: "Granular Time Freeze Choir",
    set: {
      source: "choir",
      freeze: true,
      position: 0.33,
      size: 420,
      density: 12,
      spray: 0.02,
      attack: 1.6,
      release: 3.4,
      cutoff: 4800,
    },
  },
  {
    name: "Granular Cathedral Grains",
    set: {
      source: "choir",
      size: 380,
      density: 22,
      spray: 0.45,
      pitchSpread: 0.08,
      stereo: 1,
      attack: 2,
      release: 4.5,
      cutoff: 5500,
    },
  },
  {
    name: "Granular Whisper Grains",
    set: {
      source: "choir",
      size: 16,
      density: 75,
      spray: 0.95,
      reverse: 0.5,
      stereo: 1,
      cutoff: 2400,
      resonance: 5,
      attack: 0.3,
      release: 1.2,
    },
  },
  {
    name: "Granular Fifth Shimmer",
    set: {
      source: "glass",
      pitchSpread: 7,
      size: 260,
      density: 34,
      spray: 0.4,
      stereo: 1,
      reverse: 0.25,
      attack: 1.4,
      release: 3.2,
      cutoff: 14000,
    },
  },
  {
    name: "Granular Icicle Spray",
    set: {
      source: "bell",
      pitch: 24,
      size: 9,
      density: 110,
      spray: 0.9,
      stereo: 1,
      attack: 0.002,
      release: 1.1,
      cutoff: 16000,
    },
  },
  {
    name: "Granular Gamelan Grains",
    set: {
      source: "bell",
      shape: "triangle",
      size: 110,
      density: 12,
      spray: 0.55,
      pitchSpread: 3,
      stereo: 0.9,
      attack: 0.002,
      release: 2.2,
    },
  },
  {
    name: "Granular Bowed Metal",
    set: {
      source: "bell",
      freeze: true,
      position: 0.5,
      size: 480,
      density: 18,
      spray: 0.08,
      attack: 1.8,
      release: 3.5,
      cutoff: 3200,
      resonance: 7,
    },
  },
  {
    name: "Granular Underwater Cloud",
    set: {
      source: "glass",
      pitch: -12,
      size: 190,
      density: 40,
      spray: 0.6,
      cutoff: 700,
      resonance: 9,
      stereo: 1,
      attack: 0.9,
      release: 2.4,
    },
  },
  {
    name: "Granular Subterranean",
    set: {
      source: "wind",
      pitch: -24,
      size: 460,
      density: 14,
      spray: 0.4,
      cutoff: 500,
      resonance: 3,
      attack: 2,
      release: 4,
    },
  },
  {
    name: "Granular Sandstorm",
    set: {
      source: "wind",
      size: 8,
      density: 120,
      spray: 1,
      reverse: 0.5,
      stereo: 1,
      cutoff: 9000,
      resonance: 1.5,
      attack: 0.6,
      release: 1.4,
    },
  },
  {
    name: "Granular Ocean Grains",
    set: {
      source: "wind",
      scan: 0.4,
      size: 300,
      density: 26,
      spray: 0.7,
      stereo: 1,
      cutoff: 1300,
      resonance: 2,
      attack: 1.8,
      release: 3.5,
    },
  },
  {
    name: "Granular Stutter Choir",
    set: {
      source: "choir",
      shape: "sharp",
      freeze: true,
      position: 0.6,
      size: 40,
      density: 12,
      spray: 0,
      attack: 0.002,
      release: 0.25,
    },
  },
  {
    name: "Granular Gated Glass",
    set: {
      source: "glass",
      shape: "sharp",
      freeze: true,
      size: 55,
      density: 8,
      spray: 0,
      attack: 0.002,
      release: 0.35,
      stereo: 0.3,
    },
  },
  {
    name: "Granular Glitch Piano",
    set: {
      source: "piano",
      shape: "sharp",
      freeze: true,
      position: 0.02,
      size: 14,
      density: 30,
      spray: 0.25,
      pitchSpread: 12,
      attack: 0.002,
      release: 0.3,
      stereo: 1,
    },
  },
  {
    name: "Granular Backwards Choir",
    set: {
      source: "choir",
      reverse: 1,
      scan: -0.2,
      size: 260,
      density: 24,
      spray: 0.3,
      attack: 1.4,
      release: 2.5,
    },
  },
  {
    name: "Granular Tape Ghosts",
    set: {
      source: "strings",
      reverse: 0.6,
      scan: -0.05,
      pitchSpread: 1.2,
      size: 340,
      density: 11,
      spray: 0.5,
      cutoff: 2600,
      attack: 1,
      release: 3,
    },
  },
  {
    name: "Granular Riser Cloud",
    set: {
      source: "wind",
      scan: 0.8,
      pitchSpread: 4,
      size: 120,
      density: 60,
      spray: 0.6,
      stereo: 1,
      cutoff: 12000,
      resonance: 4,
      attack: 3.5,
      release: 1.2,
    },
  },
  {
    name: "Granular Particle Lead",
    set: {
      source: "strings",
      pitch: 12,
      shape: "triangle",
      size: 34,
      density: 90,
      spray: 0.08,
      pitchSpread: 0.05,
      attack: 0.01,
      release: 0.5,
      cutoff: 6500,
      resonance: 3,
    },
  },
  {
    name: "Granular Glass Lead",
    set: {
      source: "glass",
      pitch: 12,
      size: 60,
      density: 70,
      spray: 0.03,
      attack: 0.02,
      release: 0.7,
      cutoff: 10000,
      stereo: 0.4,
    },
  },
  {
    name: "Granular Grain Bass",
    set: {
      source: "strings",
      pitch: -24,
      shape: "triangle",
      size: 45,
      density: 75,
      spray: 0.02,
      pitchSpread: 0,
      attack: 0.004,
      release: 0.35,
      cutoff: 1100,
      resonance: 4,
      stereo: 0.1,
    },
  },
  {
    name: "Granular Pluck Bass",
    set: {
      source: "pluck",
      pitch: -12,
      size: 90,
      density: 50,
      spray: 0.02,
      attack: 0.002,
      release: 0.4,
      cutoff: 1600,
      resonance: 2.5,
      stereo: 0.1,
    },
  },
  {
    name: "Granular Music Box Cloud",
    set: {
      source: "bell",
      pitch: 12,
      shape: "triangle",
      size: 75,
      density: 20,
      spray: 0.4,
      reverse: 0.15,
      stereo: 1,
      attack: 0.003,
      release: 2.8,
      cutoff: 9000,
    },
  },
  {
    name: "Granular Broken Radio",
    set: {
      source: "choir",
      size: 20,
      density: 45,
      spray: 0.8,
      pitchSpread: 2,
      reverse: 0.4,
      cutoff: 3200,
      resonance: 12,
      stereo: 0.6,
      attack: 0.1,
      release: 0.9,
    },
  },
  {
    name: "Granular Slow Bloom",
    set: {
      source: "strings",
      scan: 0.03,
      size: 420,
      density: 20,
      spray: 0.35,
      pitchSpread: 0.2,
      stereo: 1,
      attack: 3.8,
      release: 5,
      cutoff: 7500,
    },
  },
  {
    name: "Granular Cloud Keys",
    set: {
      source: "piano",
      size: 160,
      density: 36,
      spray: 0.22,
      stereo: 0.9,
      attack: 0.01,
      release: 2.2,
      cutoff: 8500,
    },
  },
  {
    name: "Granular Vapor Choir",
    set: {
      source: "choir",
      pitch: 12,
      size: 220,
      density: 30,
      spray: 0.65,
      pitchSpread: 0.3,
      stereo: 1,
      cutoff: 7000,
      attack: 1.2,
      release: 3,
    },
  },
  {
    name: "Granular Detroit Night Drone",
    set: {
      source: "strings",
      pitch: -12,
      freeze: true,
      position: 0.8,
      size: 500,
      density: 10,
      spray: 0.12,
      pitchSpread: 7,
      cutoff: 1400,
      resonance: 5,
      attack: 2.5,
      release: 4.5,
    },
  },
  {
    name: "Granular Fireflies",
    set: {
      source: "glass",
      pitch: 24,
      shape: "sharp",
      size: 6,
      density: 35,
      spray: 1,
      pitchSpread: 1,
      stereo: 1,
      attack: 0.002,
      release: 1.6,
      cutoff: 15000,
    },
  },
  {
    name: "Granular Scatter Arp",
    set: {
      source: "pluck",
      shape: "sharp",
      size: 24,
      density: 9,
      spray: 0.9,
      pitchSpread: 12,
      stereo: 1,
      attack: 0.002,
      release: 0.4,
      cutoff: 9000,
    },
  },
];

/** Sound type for each grain preset, so the preset browser can sort them (Pad, Choir, Bell, Texture…). */
export const GRANULAR_PRESET_TYPES: Record<string, string> = {
  "Granular Glass Cloud": "Pad",
  "Granular Frozen Choir": "Choir",
  "Granular Detroit Dust": "Texture",
  "Granular Shimmer Rise": "FX",
  "Granular Reverse Bells": "Bell",
  "Granular Stutter Keys": "Rhythmic",
  "Granular Wind Tunnel": "Texture",
  "Granular Bell Swarm": "Bell",
  "Granular Choir Drift": "Choir",
  "Granular Octave Mist": "Pad",
  "Granular Pluck Grain": "Pluck",
  "Granular Deep Drone": "Drone",
  "Granular Bitter Ice": "Texture",
  "Granular Tape Wobble": "Texture",
  "Granular Breath Pad": "Pad",
  "Granular Frozen Glass Pad": "Pad",
  "Granular Rain Drops": "Rhythmic",
  "Granular Ghost Choir": "Choir",
  "Granular Cloud Strings": "Pad",
  "Granular Glitch Stutter": "Rhythmic",
  "Granular Sub Texture": "Drone",
  "Granular Octave Choir": "Choir",
  "Granular Wind Chimes": "Bell",
  "Granular Dust Storm": "Texture",
  "Granular Tape Stretch": "Texture",
  "Granular Reverse Swell": "FX",
  "Granular Metallic Swarm": "Texture",
  "Granular Soft Keys": "Keyboard",
  "Granular Breath Voices": "Choir",
  "Granular Scanning Bells": "Bell",
  "Granular Low Choir Freeze": "Choir",
  "Granular Shattered Glass": "FX",
  "Granular Slow Motion Strings": "Pad",
  "Granular Pollen Cloud": "Texture",
  "Granular Frozen Piano": "Pad",
  "Granular Piano Dust": "Texture",
  "Granular Broken Piano": "Rhythmic",
  "Granular Reverse Piano Swell": "FX",
  "Granular Piano Octaves": "Keyboard",
  "Granular Harp Cloud": "Pluck",
  "Granular Frozen Pluck": "Pad",
  "Granular Koto Scatter": "Pluck",
  "Granular String Rain": "Rhythmic",
  "Granular Grain Swarm": "Texture",
  "Granular Time Freeze Choir": "Choir",
  "Granular Cathedral Grains": "Choir",
  "Granular Whisper Grains": "Texture",
  "Granular Fifth Shimmer": "Pad",
  "Granular Icicle Spray": "Bell",
  "Granular Gamelan Grains": "Bell",
  "Granular Bowed Metal": "Drone",
  "Granular Underwater Cloud": "Texture",
  "Granular Subterranean": "Drone",
  "Granular Sandstorm": "Texture",
  "Granular Ocean Grains": "Texture",
  "Granular Stutter Choir": "Rhythmic",
  "Granular Gated Glass": "Rhythmic",
  "Granular Glitch Piano": "Rhythmic",
  "Granular Backwards Choir": "FX",
  "Granular Tape Ghosts": "FX",
  "Granular Riser Cloud": "FX",
  "Granular Particle Lead": "Lead",
  "Granular Glass Lead": "Lead",
  "Granular Grain Bass": "Bass",
  "Granular Pluck Bass": "Bass",
  "Granular Music Box Cloud": "Bell",
  "Granular Broken Radio": "Texture",
  "Granular Slow Bloom": "Pad",
  "Granular Cloud Keys": "Keyboard",
  "Granular Vapor Choir": "Choir",
  "Granular Detroit Night Drone": "Drone",
  "Granular Fireflies": "Texture",
  "Granular Scatter Arp": "Rhythmic",
};

export function granularFromPreset(name: string): GranularPatch | null {
  const p = GRANULAR_PRESETS.find((x) => x.name === name);
  return p ? { ...defaultGranular(), ...p.set } : null;
}

export const GRANULAR_ROOT = 60; // built-in sources sound at middle C

/* ---------------- deterministic built-in sources ---------------- */

function rng(seed: number) {
  let s = seed >>> 0 || 1;
  return () => {
    s ^= s << 13;
    s ^= s >>> 17;
    s ^= s << 5;
    return ((s >>> 0) % 1_000_000) / 1_000_000;
  };
}

/** Raw samples for a built-in source (mono, 4 s, root middle C). Pure, so it can be tested. */
export function synthSource(
  kind: Exclude<GranularSource, "sample">,
  sampleRate: number,
): Float32Array {
  const seconds = 4;
  const n = Math.floor(seconds * sampleRate);
  const out = new Float32Array(n);
  const f0 = 261.6256;
  const tau = Math.PI * 2;
  const r = rng(kind.length * 7919 + 17);
  if (kind === "glass") {
    const partials = [1, 2, 3, 4, 6, 8];
    const amps = [1, 0.5, 0.35, 0.22, 0.12, 0.07];
    for (let i = 0; i < n; i++) {
      const t = i / sampleRate;
      let v = 0;
      for (let p = 0; p < partials.length; p++) {
        const move = 1 + 0.5 * Math.sin(tau * (0.15 + p * 0.07) * t + p);
        v +=
          amps[p]! * move * Math.sin(tau * f0 * partials[p]! * (1 + (p % 2 ? 0.0015 : -0.001)) * t);
      }
      out[i] = v;
    }
  } else if (kind === "choir") {
    // band-limited saw through moving vowel formants (additive)
    const formants = [
      [700, 1220, 2600],
      [400, 1700, 2500],
      [300, 870, 2240],
    ];
    const H = 24;
    const gains = new Float64Array(H + 1);
    const phase = new Float64Array(H + 1);
    for (let h = 1; h <= H; h++) phase[h] = h;
    for (let i = 0; i < n; i++) {
      const t = i / sampleRate;
      const vib = 1 + 0.004 * Math.sin(tau * 5.2 * t);
      // vowel formant weights move slowly, so they are worked out every 128 samples
      if ((i & 127) === 0) {
        const morph = (Math.sin(tau * 0.25 * t) + 1) / 2;
        const a = formants[0]!,
          b = formants[Math.floor(t) % 2 ? 1 : 2]!;
        for (let h = 1; h <= H; h++) {
          const f = f0 * h;
          let g = 0;
          for (let k = 0; k < 3; k++) {
            const fc = a[k]! * (1 - morph) + b[k]! * morph;
            const bw = 90 + k * 60;
            g += (1 / (k + 1)) * Math.exp(-((f - fc) ** 2) / (2 * bw * bw));
          }
          gains[h] = g / h;
        }
      }
      let v = 0;
      for (let h = 1; h <= H; h++) {
        phase[h] = phase[h]! + (tau * f0 * h * vib) / sampleRate;
        v += gains[h]! * Math.sin(phase[h]!);
      }
      out[i] = v;
    }
  } else if (kind === "strings") {
    const detunes = [-0.006, -0.002, 0.003, 0.007];
    // four detuned band-limited saws read from one single-cycle table
    const T = 2048;
    const table = new Float32Array(T + 1);
    const H = Math.min(16, Math.floor(sampleRate / 2 / (f0 * 1.01)));
    for (let j = 0; j <= T; j++) {
      let v = 0;
      for (let h = 1; h <= H; h++) v += Math.sin((tau * h * j) / T) / h;
      table[j] = v;
    }
    const ph = detunes.map((d, k) => (((k * 0.23 + d * 10) % 1) + 1) % 1);
    for (let i = 0; i < n; i++) {
      const t = i / sampleRate;
      let v = 0;
      for (let k = 0; k < detunes.length; k++) {
        ph[k] = (ph[k]! + (f0 * (1 + detunes[k]!)) / sampleRate) % 1;
        const x = ph[k]! * T;
        const j = x | 0;
        v += table[j]! + (table[j + 1]! - table[j]!) * (x - j);
      }
      out[i] = v * (0.8 + 0.2 * Math.sin(tau * 0.4 * t));
    }
  } else if (kind === "bell") {
    const ratios = [1, 2.76, 5.4, 8.93, 13.34];
    const amps = [1, 0.6, 0.4, 0.25, 0.15];
    const strikes = [0, 1, 2, 3];
    // one strike, then the same strike again every second
    const strike = new Float32Array(n);
    for (let p = 0; p < ratios.length; p++) {
      const f = f0 * ratios[p]!;
      if (f >= sampleRate / 2) continue;
      const decay = Math.exp(-(1.2 + p * 0.9) / sampleRate);
      const c = Math.cos((tau * f) / sampleRate),
        sn = Math.sin((tau * f) / sampleRate);
      let re = amps[p]!,
        im = 0;
      for (let i = 0; i < n; i++) {
        strike[i] = strike[i]! + im;
        const nr = (re * c - im * sn) * decay;
        im = (re * sn + im * c) * decay;
        re = nr;
      }
    }
    for (const st of strikes) {
      const off = Math.floor(st * sampleRate);
      for (let i = off; i < n; i++) out[i] = out[i]! + strike[i - off]!;
    }
  } else if (kind === "piano") {
    // struck piano string: slightly stretched partials (inharmonic like real strings), bright attack,
    // the upper partials die first; struck again every second so grains always find a hammer hit
    const B = 0.0004;
    const strike = new Float32Array(Math.floor(sampleRate));
    for (let h = 1; h <= 14; h++) {
      const f = f0 * h * Math.sqrt(1 + B * h * h);
      if (f >= sampleRate / 2) break;
      const amp = (1 / h) * (h === 1 ? 1 : 0.9) * Math.exp(-((h - 3) ** 2) / 40);
      const decay = 1.6 + h * 0.55;
      for (let i = 0; i < strike.length; i++) {
        const t = i / sampleRate;
        strike[i] = strike[i]! + amp * Math.exp(-decay * t) * Math.sin(tau * f * t + h);
      }
    }
    for (let i = 0; i < Math.min(strike.length, 120); i++)
      strike[i] = strike[i]! + (r() * 2 - 1) * 0.25 * (1 - i / 120); // hammer thump
    for (let st = 0; st < seconds; st++) {
      const off = Math.floor(st * sampleRate);
      for (let i = 0; i < strike.length && off + i < n; i++)
        out[off + i] = out[off + i]! + strike[i]!;
    }
  } else if (kind === "pluck") {
    // plucked string (Karplus-Strong): a burst of noise in a tuned delay loop with a soft low-pass,
    // plucked again every half second
    const period = sampleRate / f0;
    const len = Math.max(2, Math.round(period));
    const loop = new Float32Array(len);
    let w = 0;
    for (let i = 0; i < n; i++) {
      if (i % Math.floor(sampleRate / 2) === 0) for (let k = 0; k < len; k++) loop[k] = r() * 2 - 1;
      const a = loop[w]!,
        b = loop[(w + 1) % len]!;
      const v = 0.497 * (a + b);
      loop[w] = v;
      out[i] = a;
      w = (w + 1) % len;
    }
  } else {
    // wind: noise through a slowly sweeping resonant band (state-variable filter)
    let low = 0,
      band = 0;
    for (let i = 0; i < n; i++) {
      const t = i / sampleRate;
      const fc = 500 + 1400 * (0.5 + 0.5 * Math.sin(tau * 0.2 * t));
      const f = 2 * Math.sin((Math.PI * fc) / sampleRate);
      const x = r() * 2 - 1;
      low += f * band;
      const high = x - low - 0.25 * band;
      band += f * high;
      out[i] = band;
    }
  }
  let peak = 0;
  for (let i = 0; i < n; i++) peak = Math.max(peak, Math.abs(out[i]!));
  const g = peak > 0 ? 0.8 / peak : 0;
  // short fades so grains reading the edges never click
  const fade = Math.floor(sampleRate * 0.01);
  for (let i = 0; i < n; i++) {
    const e = Math.min(1, i / fade, (n - 1 - i) / fade);
    out[i] = out[i]! * g * e;
  }
  return out;
}

/* ---------------- grain planning (pure) ---------------- */

export type Grain = {
  at: number;
  offset: number;
  length: number;
  rate: number;
  pan: number;
  reverse: boolean;
};

/**
 * Grains for one stretch of a note, from grain number `startIndex` up to `to` seconds after the note starts.
 * Offsets are seconds into the source; `random` makes the cloud repeatable in tests.
 */
export function planGrains(
  g: GranularPatch,
  midi: number,
  sourceSeconds: number,
  root: number,
  to: number,
  random: () => number,
  startIndex = 0,
): { grains: Grain[]; next: number } {
  const density = Math.max(1, Math.min(150, g.density));
  const step = 1 / density;
  const length = Math.max(0.005, Math.min(1, g.size / 1000));
  const grains: Grain[] = [];
  let i = startIndex;
  for (;;) {
    // slight timing jitter keeps the cloud from buzzing at the grain rate
    const at = i * step + (random() - 0.5) * step * 0.3 * Math.min(1, g.spray * 2 + 0.2);
    if (i * step >= to) break;
    i += 1;
    const scanPos = g.freeze ? g.position : g.position + g.scan * at;
    const wrapped = ((scanPos % 1) + 1) % 1;
    const sprayed = wrapped + (random() - 0.5) * g.spray;
    const semis = midi - root + g.pitch + (random() * 2 - 1) * g.pitchSpread;
    const rate = Math.pow(2, semis / 12);
    const span = length * rate;
    const maxStart = Math.max(0, sourceSeconds - span - 0.001);
    const offset = Math.max(0, Math.min(maxStart, sprayed * sourceSeconds));
    grains.push({
      at: Math.max(0, at),
      offset,
      length,
      rate,
      pan: (random() * 2 - 1) * Math.max(0, Math.min(1, g.stereo)),
      reverse: random() < g.reverse,
    });
  }
  return { grains, next: i };
}

const curves = new Map<GrainShape, Float32Array>();
export function grainCurve(shape: GrainShape): Float32Array {
  const hit = curves.get(shape);
  if (hit) return hit;
  const n = 64;
  const c = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const x = i / (n - 1);
    c[i] =
      shape === "smooth"
        ? Math.sin(Math.PI * x) ** 2
        : shape === "triangle"
          ? 1 - Math.abs(2 * x - 1)
          : Math.min(1, x * 20, (1 - x) * 20);
  }
  curves.set(shape, c);
  return c;
}

/* ---------------- Web Audio voice ---------------- */

const sourceCache = new Map<string, { fwd: AudioBuffer; rev: AudioBuffer }>();
const reversedCache = new WeakMap<AudioBuffer, AudioBuffer>();

export function builtInSource(
  ctx: BaseAudioContext,
  kind: Exclude<GranularSource, "sample">,
): AudioBuffer {
  const key = `${kind}:${ctx.sampleRate}`;
  const hit = sourceCache.get(key);
  if (hit) return hit.fwd;
  const data = synthSource(kind, ctx.sampleRate);
  const fwd = ctx.createBuffer(1, data.length, ctx.sampleRate);
  fwd.copyToChannel(data as Float32Array<ArrayBuffer>, 0);
  sourceCache.set(key, { fwd, rev: reverseBuffer(ctx, fwd) });
  return fwd;
}

/** Builds a built-in source ahead of the first note (when the browser is idle) so playing never waits for it. */
export function warmBuiltInSource(ctx: BaseAudioContext, kind: GranularSource) {
  if (kind === "sample" || sourceCache.has(`${kind}:${ctx.sampleRate}`) || warming.has(kind))
    return;
  warming.add(kind);
  const run = () => {
    try {
      builtInSource(ctx, kind);
    } finally {
      warming.delete(kind);
    }
  };
  const idle = (
    globalThis as { requestIdleCallback?: (fn: () => void, o?: { timeout: number }) => void }
  ).requestIdleCallback;
  if (idle) idle(run, { timeout: 1500 });
  else setTimeout(run, 200);
}
const warming = new Set<GranularSource>();

function reverseBuffer(ctx: BaseAudioContext, buf: AudioBuffer): AudioBuffer {
  const hit = reversedCache.get(buf);
  if (hit) return hit;
  const rev = ctx.createBuffer(buf.numberOfChannels, buf.length, buf.sampleRate);
  for (let c = 0; c < buf.numberOfChannels; c++) {
    const d = buf.getChannelData(c).slice();
    d.reverse();
    rev.copyToChannel(d, c);
  }
  reversedCache.set(buf, rev);
  return rev;
}

export type GranularVoice = { stop: (at: number) => void; end: number };

/**
 * Starts one note. Live contexts schedule grains a little ahead on a timer so
 * knob changes (read through `latest`) reach held notes; offline renders
 * schedule the whole note at once.
 */
export function playGranularVoice(
  ctx: BaseAudioContext,
  dest: AudioNode,
  buffer: AudioBuffer,
  root: number,
  patch: GranularPatch,
  latest: () => GranularPatch,
  midi: number,
  duration: number,
  velocity: number,
  t0: number,
  onGrain?: (position: number, at: number, length: number, reverse: boolean) => void,
): GranularVoice {
  const offline = typeof OfflineAudioContext !== "undefined" && ctx instanceof OfflineAudioContext;
  const amp = ctx.createGain();
  const filter = ctx.createBiquadFilter();
  filter.type = "lowpass";
  filter.frequency.value = Math.max(80, Math.min(18000, patch.cutoff));
  filter.Q.value = Math.max(0.1, Math.min(18, patch.resonance));
  amp.connect(filter).connect(dest);
  const level =
    Math.max(0, Math.min(1.5, patch.level)) * (0.4 + 0.6 * Math.max(0, Math.min(1, velocity)));
  // Overlapping grains add up: scale so dense clouds stay near the same loudness.
  const overlap = Math.max(1, (patch.density * patch.size) / 1000);
  const peak = (level * 1.6) / Math.sqrt(overlap);
  const attack = Math.max(0.002, patch.attack);
  const release = Math.max(0.01, patch.release);
  const offAt = t0 + Math.max(0.02, duration);
  amp.gain.setValueAtTime(0, t0);
  amp.gain.linearRampToValueAtTime(peak, t0 + attack);
  amp.gain.setValueAtTime(peak, Math.max(t0 + attack, offAt));
  amp.gain.setTargetAtTime(0, Math.max(t0 + attack, offAt), release / 4);
  const end = offAt + release + 0.1;
  const rev = reverseBuffer(ctx, buffer);
  const sources = new Set<AudioBufferSourceNode>();
  let next = 0;
  let planned = 0;
  let seed = (midi * 2654435761 + Math.floor(t0 * 1000)) >>> 0;
  const random = () => {
    seed ^= seed << 13;
    seed ^= seed >>> 17;
    seed ^= seed << 5;
    return ((seed >>> 0) % 1_000_000) / 1_000_000;
  };
  let stopped = false;

  const schedule = (until: number) => {
    const g = offline ? patch : latest();
    filter.frequency.setTargetAtTime(
      Math.max(80, Math.min(18000, g.cutoff)),
      Math.max(t0, ctx.currentTime),
      0.03,
    );
    filter.Q.setTargetAtTime(
      Math.max(0.1, Math.min(18, g.resonance)),
      Math.max(t0, ctx.currentTime),
      0.03,
    );
    const plan = planGrains(g, midi, buffer.duration, root, until - t0, random, next);
    next = plan.next;
    planned = until - t0;
    const curve = grainCurve(g.shape);
    for (const gr of plan.grains) {
      const at = t0 + gr.at;
      if (at >= end) continue;
      const src = ctx.createBufferSource();
      src.buffer = gr.reverse ? rev : buffer;
      src.playbackRate.value = gr.rate;
      const env = ctx.createGain();
      env.gain.value = 0;
      const pan = ctx.createStereoPanner();
      pan.pan.value = gr.pan;
      src.connect(env).connect(pan).connect(amp);
      const from = gr.reverse
        ? Math.max(0, buffer.duration - gr.offset - gr.length * gr.rate)
        : gr.offset;
      try {
        env.gain.setValueCurveAtTime(curve, at, gr.length);
        src.start(at, from, gr.length * gr.rate + 0.002);
        src.stop(at + gr.length + 0.01);
      } catch {
        continue;
      }
      sources.add(src);
      onGrain?.(gr.offset / buffer.duration, at, gr.length, gr.reverse);
      src.onended = () => {
        sources.delete(src);
        try {
          src.disconnect();
          env.disconnect();
          pan.disconnect();
        } catch {
          /* gone */
        }
      };
    }
  };

  let timer: ReturnType<typeof setInterval> | null = null;
  if (offline) {
    schedule(end);
  } else {
    const ahead = 0.15;
    schedule(Math.min(end, Math.max(ctx.currentTime, t0) + ahead));
    timer = setInterval(() => {
      if (stopped) return;
      const horizon = Math.min(end, ctx.currentTime + ahead);
      if (horizon > t0 + planned) schedule(horizon);
      if (ctx.currentTime >= end) cleanup();
    }, 40);
  }
  const cleanup = () => {
    if (timer) clearInterval(timer);
    timer = null;
    setTimeout(() => {
      try {
        amp.disconnect();
        filter.disconnect();
      } catch {
        /* gone */
      }
    }, 200);
  };

  return {
    end,
    stop: (at: number) => {
      if (stopped) return;
      stopped = true;
      try {
        amp.gain.cancelScheduledValues(at);
        amp.gain.setTargetAtTime(0, at, 0.015);
      } catch {
        /* gone */
      }
      for (const s of sources) {
        try {
          s.stop(at + 0.08);
        } catch {
          /* not started */
        }
      }
      cleanup();
    },
  };
}
