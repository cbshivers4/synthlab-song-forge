import type { PluginInstance, PluginKind, PluginParam } from "./types";
import { PARAMS_BY_KIND, deviceParams, withDefaultParams } from "./plugins";
import { isTapeEcho } from "./device-params";
import { CREATIVE_KINDS, CREATIVE_RECIPES } from "./creative-fx";

export interface EffectPreset {
  id: string;
  name: string;
  values: Record<string, number>;
}
type Recipe = [name: string, values: Record<string, number>];
const RECIPES: Record<PluginKind, Recipe[]> = {
  eq: [
    ["Vocal Clarity", { low: -3, mid: 2, midFreq: 2400, high: 3 }],
    ["Warm Bass", { low: 4, mid: -2, midFreq: 600, high: -3 }],
    ["Drum Punch", { low: 3, mid: -3, midFreq: 450, high: 2 }],
    ["Soft Air", { high: 4, mid: -1 }],
  ],
  paraeq: [
    [
      "Vocal Presence",
      {
        b1freq: 85,
        b3on: 1,
        b3freq: 300,
        b3gain: -3,
        b5on: 1,
        b5freq: 3000,
        b5gain: 2.5,
        b7on: 1,
        b7gain: 2,
      },
    ],
    [
      "Kick Definition",
      { b1freq: 28, b2on: 1, b2freq: 65, b2gain: 3, b4on: 1, b4freq: 400, b4gain: -4 },
    ],
    ["Bass Focus", { b1freq: 30, b3on: 1, b3freq: 180, b3gain: -2, b8freq: 8000 }],
    ["Mix Polish", { b1freq: 25, b4on: 1, b4freq: 600, b4gain: -1.5, b7on: 1, b7gain: 1.5 }],
  ],
  filter: [
    ["Warm Low Pass", { cutoff: 2400, resonance: 1.5 }],
    ["Telephone", { type: 2, cutoff: 1400, resonance: 2 }],
    ["Sub Cleanup", { type: 1, cutoff: 100, resonance: 0.7 }],
    ["Acid Resonance", { cutoff: 900, resonance: 8, mix: 0.8 }],
  ],
  drive: [
    ["Tube Warmth", { drive: 0.18, tone: 6500, mix: 0.6, output: -2 }],
    ["Bass Grit", { drive: 0.55, tone: 2800, mix: 0.65, output: -4 }],
    ["Drum Crunch", { drive: 0.7, tone: 7000, mix: 0.45, output: -5 }],
    ["Soft Saturation", { drive: 0.1, tone: 10000, mix: 0.4 }],
  ],
  compressor: [
    ["Vocal Leveler", { threshold: -24, ratio: 3, attack: 12, release: 180, makeup: 3 }],
    ["Drum Glue", { threshold: -16, ratio: 4, attack: 25, release: 100, makeup: 2 }],
    ["Bass Control", { threshold: -22, ratio: 5, attack: 15, release: 220, makeup: 3 }],
    ["Gentle Bus", { threshold: -12, ratio: 2, attack: 30, release: 250, knee: 12 }],
  ],
  delay: [
    ["Vocal Slap", { time: 95, feedback: 0.12, mix: 0.18, tone: 6500 }],
    ["Wide Echo", { time: 420, feedback: 0.42, mix: 0.28 }],
    ["Dub Repeats", { time: 600, feedback: 0.72, mix: 0.35, tone: 3500, lowcut: 180 }],
    ["Short Rhythm", { time: 180, feedback: 0.3, mix: 0.22 }],
  ],
  gain: [
    ["Quiet Trim", { gain: -6 }],
    ["Left Utility", { pan: -1 }],
    ["Right Utility", { pan: 1 }],
    ["Invert Polarity", { phase: 1 }],
  ],
  width: [
    ["Mono Focus", { width: 0 }],
    ["Narrow Image", { width: 0.5 }],
    ["Wide Mix", { width: 1.4, output: -1 }],
    ["Extra Wide", { width: 1.8, output: -2 }],
  ],
  reverb: [
    ["Small Room", { decay: 0.55, predelay: 8, mix: 0.2, tone: 7000 }],
    ["Vocal Plate", { decay: 1.6, predelay: 40, mix: 0.25, lowcut: 180 }],
    ["Large Hall", { decay: 3.8, predelay: 35, mix: 0.35 }],
    ["Dark Atmosphere", { decay: 6, predelay: 70, mix: 0.5, tone: 3200 }],
  ],
  chorus: [
    ["Gentle Ensemble", { rate: 0.6, depth: 0.3, mix: 0.3 }],
    ["Wide Synth", { rate: 1.1, depth: 0.65, delay: 28, mix: 0.55 }],
    ["Bass Chorus", { rate: 0.4, depth: 0.25, mix: 0.25, delay: 12 }],
    ["Deep Motion", { rate: 2.4, depth: 0.9, feedback: 0.25 }],
  ],
  flanger: [
    ["Slow Jet", { rate: 0.15, depth: 0.85, feedback: 0.65 }],
    ["Metal Sweep", { rate: 0.8, depth: 0.8, feedback: 0.8, manual: 2 }],
    ["Subtle Flange", { rate: 0.3, depth: 0.3, mix: 0.25, feedback: 0.2 }],
    ["Fast Spin", { rate: 2.5, depth: 0.7, manual: 6 }],
  ],
  phaser: [
    ["Vintage Four", { rate: 0.3, depth: 0.7, stages: 4 }],
    ["Deep Eight", { rate: 0.4, depth: 0.9, stages: 8, resonance: 2 }],
    ["Funky Keys", { rate: 1.5, depth: 0.65, center: 1200 }],
    ["Slow Space", { rate: 0.1, depth: 0.8, center: 500, mix: 0.4 }],
  ],
  tremolo: [
    ["Gentle Pulse", { rate: 3, depth: 0.3 }],
    ["Chopped Rhythm", { rate: 8, depth: 1, shape: 1 }],
    ["Vintage Trem", { rate: 5.5, depth: 0.65 }],
    ["Slow Swell", { rate: 0.7, depth: 0.8, shape: 2 }],
  ],
  autopan: [
    ["Slow Drift", { rate: 0.2, depth: 0.7 }],
    ["Rhythm Pan", { rate: 2, depth: 0.8 }],
    ["Hard Alternation", { rate: 4, depth: 1, shape: 1 }],
    ["Gentle Movement", { rate: 0.6, depth: 0.3 }],
  ],
  limiter: [
    ["Safe Ceiling", { ceiling: -1, release: 100 }],
    ["Loud Preview", { ceiling: -1, input: 4, release: 80 }],
    ["Drum Safety", { ceiling: -0.8, release: 35 }],
    ["Soft Master", { ceiling: -1.5, input: 2, release: 180 }],
  ],
  bitcrusher: [
    ["Twelve Bit", { bits: 12, mix: 0.65 }],
    ["Eight Bit Arcade", { bits: 8, mix: 0.8, tone: 7000 }],
    ["Lo-Fi Drums", { bits: 6, mix: 0.4, tone: 5000 }],
    ["Broken Signal", { bits: 3, mix: 0.65, output: -3 }],
  ],
  vocoder: [
    ["Robot Voice", { carrier: 1, pitch: 110, bands: 16, detune: 8 }],
    ["Electro Choir", { carrier: 0, pitch: 220, unison: 5, detune: 22, mix: 0.9 }],
    ["Whisper Machine", { carrier: 2, bands: 24, sibilance: 0.6, response: 8 }],
    ["Dark Android", { pitch: 65, formant: -5, tone: 4500, response: 35 }],
  ],
  gate: [
    ["Vocal Cleanup", { threshold: -48, attack: 3, release: 180, range: -40 }],
    ["Tight Drums", { threshold: -30, attack: 0.5, release: 60 }],
    ["Soft Expander", { threshold: -55, release: 250, range: -18 }],
    ["Hard Gate", { threshold: -24, attack: 1, release: 35 }],
  ],
  stepfilter: [
    ["Electro Pulse", { rate: 8, cutoff: 6500, depth: 0.9, swing: 0.15 }],
    ["Techno Steps", { rate: 12, resonance: 7, cutoff: 4000, smooth: 0.015 }],
    ["Slow Sequence", { rate: 2, cutoff: 9000, depth: 0.65, smooth: 0.12 }],
    ["Broken Rhythm", { rate: 6, swing: 0.4, s2: 0.8, s3: 0.1, s5: 0.4, s7: 1 }],
  ],
  resonator: [
    ["Warm Body", { root: 43, spread: 0.2, decay: 1.2, damping: 0.6 }],
    ["Metal Bells", { root: 60, spread: 0.7, decay: 3.2, damping: 0.2 }],
    ["Deep Chamber", { root: 36, decay: 4, mix: 0.45 }],
    ["Short Wood", { root: 55, spread: 0.1, decay: 0.35, damping: 0.8 }],
  ],
  scalechord: [
    ["Minor Triads", { scale: 1, chord: 2 }],
    ["Major Sevenths", { chord: 3, inversion: 1 }],
    ["Minor Sevenths", { scale: 1, chord: 4 }],
    ["Open Fifths", { scale: 3, chord: 5, range: 2 }],
  ],
  transient: [
    ["Drum Punch", { attack: 0.65, sustain: -0.2 }],
    ["Soft Attack", { attack: -0.5, sustain: 0.15 }],
    ["Tight Percussion", { attack: 0.4, sustain: -0.65 }],
    ["Long Sustain", { attack: 0.15, sustain: 0.6, mix: 0.65 }],
  ],
  ...(Object.fromEntries(CREATIVE_KINDS.map((k) => [k, []])) as unknown as Record<
    (typeof CREATIVE_KINDS)[number],
    Recipe[]
  >),
};
const TAPE_RECIPES: Recipe[] = [
  [
    "Vintage Slap",
    { time: 110, feedback: 0.18, tone: 4200, mix: 0.2, heads: 1, wow: 0.2, saturation: 0.35 },
  ],
  [
    "Dub Tape",
    {
      time: 540,
      feedback: 0.7,
      tone: 2800,
      lowcut: 200,
      mix: 0.35,
      heads: 3,
      wow: 0.45,
      saturation: 0.6,
    },
  ],
  [
    "Warm Repeats",
    { time: 360, feedback: 0.4, tone: 5000, mix: 0.25, heads: 2, wow: 0.3, saturation: 0.5 },
  ],
  [
    "Long Tape Trail",
    { time: 800, feedback: 0.6, tone: 3200, mix: 0.3, heads: 1, wow: 0.55, saturation: 0.4 },
  ],
];

// Append recipes to preserve existing factory IDs and saved parameter matches.
const MORE_RECIPES: Record<PluginKind, Recipe[]> = {
  eq: [
    ["Electro Bass Scoop", { low: 3.5, mid: -4, midFreq: 800, high: 1 }],
    ["Techno Kick Weight", { low: 5, mid: -2.5, midFreq: 350, high: 1.5, mix: -2 }],
    ["Jazz Warmth", { low: 1.5, mid: 1, midFreq: 1200, high: -2 }],
    ["Acoustic Sparkle", { low: -2, mid: -1.5, midFreq: 500, high: 4.5 }],
    ["Vocal De-Mud", { low: -4, mid: -3, midFreq: 300, high: 2 }],
    ["Gentle Master Tilt", { low: -1, mid: -0.5, midFreq: 700, high: 1.5 }],
  ],
  paraeq: [
    [
      "Airy Lead Vocal",
      {
        b1freq: 100,
        b3on: 1,
        b3freq: 350,
        b3gain: -2.5,
        b5on: 1,
        b5freq: 3500,
        b5gain: 2,
        b7on: 1,
        b7freq: 12000,
        b7gain: 3,
      },
    ],
    [
      "Techno Sub Shape",
      {
        b1freq: 24,
        b2on: 1,
        b2freq: 55,
        b2gain: 4,
        b4on: 1,
        b4freq: 500,
        b4gain: -3,
        b8freq: 6500,
      },
    ],
    [
      "Snare Crack",
      { b1freq: 110, b3on: 1, b3freq: 220, b3gain: 2, b5on: 1, b5freq: 2500, b5gain: 4, b5q: 1.4 },
    ],
    [
      "Hi-Hat Smooth",
      { b1freq: 600, b6on: 1, b6freq: 7000, b6gain: -3, b6q: 2, b7on: 1, b7gain: 1 },
    ],
    [
      "Piano Body",
      {
        b1freq: 60,
        b3on: 1,
        b3freq: 250,
        b3gain: 2,
        b4on: 1,
        b4freq: 800,
        b4gain: -2,
        b7on: 1,
        b7gain: 1.5,
      },
    ],
    [
      "Master Gentle Smile",
      {
        b1freq: 22,
        b2on: 1,
        b2gain: 1,
        b4on: 1,
        b4freq: 450,
        b4gain: -1,
        b7on: 1,
        b7gain: 1.2,
        output: -1,
      },
    ],
  ],
  filter: [
    ["Deep Dub Low Pass", { cutoff: 650, resonance: 2.8, mix: 0.9 }],
    ["Bright Synth Sweep", { cutoff: 5200, resonance: 4, mix: 0.75 }],
    ["Radio Band Pass", { type: 2, cutoff: 2200, resonance: 1.2, mix: 0.9 }],
    ["Thin Percussion", { type: 1, cutoff: 650, resonance: 1.1 }],
    ["Soft Pad Veil", { cutoff: 1800, resonance: 0.6, mix: 0.7 }],
    ["Resonant Electro Bite", { cutoff: 1400, resonance: 6.5, input: -3, output: -2 }],
  ],
  drive: [
    ["Electro Bass Edge", { drive: 0.42, tone: 3800, mix: 0.7, lowcut: 35, output: -4 }],
    ["Techno Drum Dirt", { drive: 0.82, tone: 5200, mix: 0.55, output: -6 }],
    ["Warm Vocal Edge", { drive: 0.12, tone: 8000, mix: 0.35, lowcut: 90, output: -1.5 }],
    ["Fuzzy Lead", { drive: 0.9, tone: 2400, mix: 0.85, output: -8 }],
    ["Parallel Drum Heat", { drive: 0.6, tone: 9500, mix: 0.25, output: -3 }],
    ["Dark Synth Saturation", { drive: 0.35, tone: 1800, mix: 0.6, output: -3 }],
  ],
  compressor: [
    [
      "Intimate Vocal",
      { threshold: -28, ratio: 2.5, attack: 18, release: 240, knee: 15, makeup: 2 },
    ],
    ["Rap Vocal Grip", { threshold: -20, ratio: 4.5, attack: 5, release: 90, knee: 5, makeup: 3 }],
    [
      "Techno Drum Bus",
      { threshold: -18, ratio: 6, attack: 20, release: 75, knee: 3, makeup: 2.5 },
    ],
    [
      "Acoustic Leveling",
      { threshold: -26, ratio: 2, attack: 35, release: 300, knee: 18, makeup: 1.5 },
    ],
    ["Punchy Snare", { threshold: -15, ratio: 5, attack: 40, release: 65, makeup: 2 }],
    [
      "Smooth Master Glue",
      { threshold: -10, ratio: 1.5, attack: 50, release: 350, knee: 20, makeup: 0.5 },
    ],
  ],
  delay: [
    ["Electro Stutter", { time: 125, feedback: 0.48, mix: 0.3, tone: 8500 }],
    ["Techno Echo Grid", { time: 375, feedback: 0.55, mix: 0.32, lowcut: 250 }],
    ["Airy Vocal Trail", { time: 480, feedback: 0.32, mix: 0.2, tone: 9000, lowcut: 200 }],
    [
      "Deep Dub Space",
      { time: 750, feedback: 0.78, mix: 0.38, tone: 2200, lowcut: 320, output: -2 },
    ],
    ["Ambient Cascade", { time: 1050, feedback: 0.65, mix: 0.42, tone: 5500, lowcut: 180 }],
    ["Percussion Flutter", { time: 65, feedback: 0.3, mix: 0.16, tone: 4500, lowcut: 400 }],
  ],
  gain: [
    ["Headroom Minus 3", { gain: -3 }],
    ["Headroom Minus 12", { gain: -12 }],
    ["Gentle Boost", { gain: 2 }],
    ["Half Left", { pan: -0.5 }],
    ["Half Right", { pan: 0.5 }],
    ["Inverted Quiet Trim", { gain: -6, phase: 1 }],
  ],
  width: [
    ["Centered Bass", { width: 0.15, output: -0.5 }],
    ["Intimate Vocal Image", { width: 0.7 }],
    ["Open Drum Room", { width: 1.25, output: -0.5 }],
    ["Spacious Pads", { width: 1.65, output: -1.5 }],
    ["Left Narrow Layer", { width: 0.4, pan: -0.4, output: -2 }],
    ["Right Wide Layer", { width: 1.3, pan: 0.4, output: -2 }],
  ],
  reverb: [
    ["Intimate Vocal Room", { decay: 0.85, predelay: 22, mix: 0.16, tone: 6500, lowcut: 160 }],
    ["Bright Snare Plate", { decay: 1.2, predelay: 12, mix: 0.24, tone: 11000, lowcut: 300 }],
    ["Jazz Club", { decay: 1.4, predelay: 18, mix: 0.22, tone: 5200, lowcut: 100 }],
    ["Techno Warehouse", { decay: 3.2, predelay: 55, mix: 0.38, tone: 6200, lowcut: 280 }],
    ["Ambient Cathedral", { decay: 7.2, predelay: 85, mix: 0.55, tone: 7800, lowcut: 220 }],
    ["Dark Drum Chamber", { decay: 2.1, predelay: 5, mix: 0.3, tone: 2600, lowcut: 250 }],
  ],
  chorus: [
    ["Analog String Ensemble", { rate: 0.35, depth: 0.7, delay: 32, mix: 0.6 }],
    ["Electro Keys", { rate: 1.8, depth: 0.45, delay: 18, mix: 0.4, feedback: 0.12 }],
    ["Dreamy Guitar", { rate: 0.75, depth: 0.55, delay: 24, mix: 0.35 }],
    ["Vocal Double Color", { rate: 0.25, depth: 0.2, delay: 35, mix: 0.2 }],
    ["Liquid Pad", { rate: 0.18, depth: 0.85, delay: 38, mix: 0.65, feedback: 0.2 }],
    ["Fast Wobble", { rate: 4.5, depth: 0.75, delay: 10, mix: 0.5 }],
  ],
  flanger: [
    ["Tape-Like Sweep", { rate: 0.12, depth: 0.6, manual: 3, feedback: 0.4, mix: 0.4 }],
    ["Electro Metallic", { rate: 1.2, depth: 0.9, manual: 1.5, feedback: 0.75 }],
    ["Wide Pad Jet", { rate: 0.08, depth: 1, manual: 8, feedback: 0.6, mix: 0.6 }],
    ["Percussion Comb", { rate: 0.6, depth: 0.25, manual: 2.5, feedback: 0.85, mix: 0.35 }],
    ["Shallow Vocal Swirl", { rate: 0.2, depth: 0.2, manual: 5, feedback: 0.15, mix: 0.18 }],
    ["Sci-Fi Spin", { rate: 3.8, depth: 0.95, manual: 10, feedback: 0.7, mix: 0.65 }],
  ],
  phaser: [
    ["Soul Guitar", { rate: 0.65, depth: 0.5, center: 900, stages: 4, mix: 0.35 }],
    ["Electro Sweep", { rate: 1.8, depth: 0.85, center: 1600, stages: 6, resonance: 2.5 }],
    ["Deep Pad Orbit", { rate: 0.07, depth: 0.95, center: 600, stages: 8, resonance: 1.4 }],
    ["Rhodes Motion", { rate: 0.9, depth: 0.45, center: 1100, stages: 4, mix: 0.4 }],
    ["Talking Bass", { rate: 2.2, depth: 0.65, center: 450, stages: 6, resonance: 3, mix: 0.45 }],
    ["Fast Psychedelic", { rate: 4, depth: 0.8, center: 2200, stages: 8, resonance: 2 }],
  ],
  tremolo: [
    ["Soul Guitar Pulse", { rate: 4.2, depth: 0.45 }],
    ["Electric Piano Drift", { rate: 2.2, depth: 0.35 }],
    ["Techno Hard Chop", { rate: 12, depth: 0.95, shape: 1, output: -1 }],
    ["Ambient Breathing", { rate: 0.25, depth: 0.7, shape: 2 }],
    ["Electro Flicker", { rate: 16, depth: 0.75, shape: 1 }],
    ["Soft Triangle Pulse", { rate: 6.5, depth: 0.5, shape: 2 }],
  ],
  autopan: [
    ["Ambient Orbit", { rate: 0.08, depth: 0.9 }],
    ["Electro Alternator", { rate: 6, depth: 0.85, shape: 1 }],
    ["Percussion Travel", { rate: 3, depth: 0.65, shape: 2 }],
    ["Left-Biased Drift", { rate: 0.35, depth: 0.4, center: -0.4 }],
    ["Right-Biased Drift", { rate: 0.35, depth: 0.4, center: 0.4 }],
    ["Slow Triangle Sweep", { rate: 0.15, depth: 1, shape: 2 }],
  ],
  limiter: [
    ["Streaming Headroom", { ceiling: -1.2, input: 1, release: 140 }],
    ["Punch Preservation", { ceiling: -1, input: 2, release: 40 }],
    ["Dense Electronic Mix", { ceiling: -0.8, input: 5, release: 110 }],
    ["Vocal Peak Catcher", { ceiling: -2, release: 75 }],
    ["Gentle Piano Safety", { ceiling: -1.5, release: 260 }],
    ["Conservative Bus Ceiling", { ceiling: -3, input: 0.5, release: 160 }],
  ],
  bitcrusher: [
    ["Dusty Drum Texture", { bits: 10, mix: 0.35, tone: 6500, output: -1 }],
    ["Electro Console", { bits: 7, mix: 0.6, tone: 10000, output: -2 }],
    ["Four Bit Bass", { bits: 4, mix: 0.5, tone: 3200, output: -4 }],
    ["Subtle Digital Grain", { bits: 14, mix: 0.4, tone: 14000 }],
    ["Dark Pixel Pad", { bits: 5, mix: 0.3, tone: 1800, output: -2 }],
    ["Two Bit Destruction", { bits: 2, mix: 0.45, tone: 4500, output: -6 }],
  ],
  vocoder: [
    [
      "Detroit Electro Voice",
      { carrier: 1, pitch: 82.4, bands: 16, detune: 12, formant: -2, unison: 3, response: 10 },
    ],
    [
      "Bright Synth Choir",
      { carrier: 0, pitch: 261.6, bands: 24, detune: 28, unison: 5, formant: 2, tone: 12000 },
    ],
    ["Deep Robot Bass", { carrier: 1, pitch: 55, bands: 12, formant: -7, tone: 3200, unison: 2 }],
    [
      "Airy Noise Whisper",
      { carrier: 2, bands: 24, response: 5, sibilance: 0.8, width: 1.8, mix: 0.85 },
    ],
    [
      "Slow Android Choir",
      { carrier: 0, pitch: 146.8, response: 90, detune: 35, unison: 5, formant: -3 },
    ],
    [
      "Keyboard Electro Lead",
      {
        play: 1,
        pitch: 220,
        glide: 120,
        carrier: 0,
        bands: 16,
        unison: 4,
        detune: 18,
        response: 8,
      },
    ],
  ],
  gate: [
    ["Quiet Spoken Vocal", { threshold: -52, attack: 4, release: 220, range: -30 }],
    ["Snare Isolation", { threshold: -26, attack: 0.2, release: 95, range: -60 }],
    ["Tight Kick Tail", { threshold: -32, attack: 0.3, release: 45, range: -50 }],
    ["Gentle Room Reduction", { threshold: -60, attack: 8, release: 400, range: -12 }],
    ["Synth Staccato", { threshold: -20, attack: 0.5, release: 20, range: -70 }],
    ["Long Vocal Release", { threshold: -44, attack: 6, release: 600, range: -24 }],
  ],
  stepfilter: [
    [
      "Acid Staircase",
      {
        rate: 8,
        cutoff: 4800,
        resonance: 9,
        smooth: 0.02,
        s1: 0.15,
        s2: 0.3,
        s3: 0.5,
        s4: 0.8,
        s5: 1,
        s6: 0.6,
        s7: 0.4,
        s8: 0.2,
      },
    ],
    [
      "Dub Offbeats",
      {
        rate: 4,
        cutoff: 2500,
        resonance: 3,
        swing: 0.25,
        smooth: 0.08,
        s1: 0.2,
        s2: 0.85,
        s3: 0.15,
        s4: 0.7,
      },
    ],
    ["Techno Rapid Grid", { rate: 16, cutoff: 7000, resonance: 6, smooth: 0.005, depth: 1 }],
    [
      "Ambient Evolving Steps",
      { rate: 0.75, cutoff: 11000, resonance: 2, smooth: 0.22, depth: 0.6 },
    ],
    [
      "Electro Band Pass",
      { mode: 2, rate: 6, cutoff: 3600, resonance: 4.5, swing: 0.12, mix: 0.75 },
    ],
    [
      "High Pass Percussion",
      { mode: 1, rate: 10, cutoff: 1800, resonance: 1.5, depth: 0.5, smooth: 0.04, mix: 0.6 },
    ],
  ],
  resonator: [
    ["Electro Tuned Bass", { root: 31, spread: 0.15, decay: 1.6, damping: 0.65, mix: 0.3 }],
    ["Glass Chimes", { root: 72, spread: 0.85, decay: 2.5, damping: 0.12, mix: 0.4 }],
    ["Wooden Percussion Body", { root: 50, spread: 0.18, decay: 0.55, damping: 0.75, mix: 0.28 }],
    ["Industrial Ring", { root: 42, spread: 1, decay: 3.8, damping: 0.25, mix: 0.5 }],
    ["Ambient Harmonic Cloud", { root: 57, spread: 0.6, decay: 6.5, damping: 0.35, mix: 0.55 }],
    ["Short Tuned Pluck", { root: 64, spread: 0.25, decay: 0.22, damping: 0.5, mix: 0.4 }],
  ],
  scalechord: [
    ["C Minor Open Triads", { root: 0, scale: 1, chord: 2, inversion: 1, range: 2 }],
    ["D Minor Seventh Spread", { root: 2, scale: 1, chord: 4, inversion: 2, range: 2 }],
    ["F Major Seventh Lift", { root: 5, scale: 0, chord: 3, inversion: 2, range: 2 }],
    ["A Minor Low Triads", { root: 9, scale: 1, chord: 2, inversion: 0, range: 1 }],
    ["G Open Fifth Stack", { root: 7, scale: 3, chord: 5, inversion: 1, range: 3 }],
    ["E Major High Triads", { root: 4, scale: 0, chord: 1, inversion: 2, range: 3 }],
  ],
  transient: [
    ["Techno Kick Snap", { attack: 0.85, sustain: -0.35, sensitivity: 0.7, output: -2 }],
    ["Snare Front Edge", { attack: 0.7, sustain: 0.1, sensitivity: 0.65, output: -1.5 }],
    ["Brushes Soften", { attack: -0.35, sustain: 0.25, sensitivity: 0.4, mix: 0.75 }],
    ["Dry Percussion", { attack: 0.25, sustain: -0.85, sensitivity: 0.7 }],
    ["Ambient Tail Lift", { attack: -0.2, sustain: 0.8, mix: 0.55, output: -2 }],
    ["Gentle Mix Definition", { attack: 0.2, sustain: -0.1, sensitivity: 0.45, mix: 0.5 }],
  ],
  ...CREATIVE_RECIPES,
};
const MORE_TAPE_RECIPES: Recipe[] = [
  [
    "Motor City Slap",
    {
      time: 85,
      feedback: 0.22,
      tone: 3600,
      mix: 0.18,
      lowcut: 120,
      heads: 1,
      wow: 0.15,
      saturation: 0.55,
    },
  ],
  [
    "Dark Dub Feedback",
    {
      time: 680,
      feedback: 0.8,
      tone: 1800,
      lowcut: 350,
      mix: 0.4,
      output: -3,
      heads: 2,
      wow: 0.5,
      saturation: 0.7,
    },
  ],
  [
    "Worn Vocal Echo",
    {
      time: 290,
      feedback: 0.28,
      tone: 3200,
      lowcut: 180,
      mix: 0.22,
      heads: 1,
      wow: 0.7,
      saturation: 0.4,
    },
  ],
  [
    "Warm Guitar Trail",
    {
      time: 440,
      feedback: 0.45,
      tone: 4800,
      lowcut: 100,
      mix: 0.28,
      heads: 2,
      wow: 0.25,
      saturation: 0.45,
    },
  ],
  [
    "Tape Space Wash",
    {
      time: 1150,
      feedback: 0.68,
      tone: 2500,
      lowcut: 240,
      mix: 0.48,
      output: -2,
      heads: 3,
      wow: 0.6,
      saturation: 0.5,
    },
  ],
  [
    "Percussion Tape Bounce",
    {
      time: 165,
      feedback: 0.5,
      tone: 5800,
      lowcut: 450,
      mix: 0.26,
      heads: 3,
      wow: 0.1,
      saturation: 0.3,
    },
  ],
];

const KEEP = new Set(["output", "gain", "ceiling", "makeup", "input"]);
const CHARACTERS: [string, (i: number) => number][] = [
  ["Gentle Touch", (i) => 0.22 + (i % 3) * 0.08],
  ["Pushed Hard", (i) => 0.78 + (i % 3) * 0.07],
  ["Low Range Color", (i) => (i % 2 ? 0.38 : 0.12)],
  ["Upper Range Color", (i) => (i % 2 ? 0.62 : 0.9)],
];
/** Four range-spanning factory settings per device; integer switches keep their default. */
function characterRecipes(kind: PluginKind): Recipe[] {
  const params = PARAMS_BY_KIND[kind]();
  return CHARACTERS.map(
    ([name, at]) =>
      [
        name,
        Object.fromEntries(
          params.flatMap((q, i) => {
            if (
              KEEP.has(q.id) ||
              /^b\d+(on|type)$/.test(q.id) ||
              ["protect", "phase", "steps", "play"].includes(q.id)
            )
              return [];
            const integer =
              Number.isInteger(q.min) &&
              Number.isInteger(q.max) &&
              Number.isInteger(q.value) &&
              q.max - q.min <= 32 &&
              !q.unit &&
              q.max - q.min > 2;
            const v = q.min + at(i) * (q.max - q.min);
            return [[q.id, integer ? Math.round(v) : Math.round(v * 1000) / 1000]];
          }),
        ),
      ] as Recipe,
  );
}

export function effectPresets(plugin: Pick<PluginInstance, "kind" | "name">): EffectPreset[] {
  const defaults = Object.fromEntries(
    deviceParams(plugin.kind, plugin.name).map((p) => [p.id, p.value]),
  );
  const tapeEcho = isTapeEcho(plugin);
  const recipes = tapeEcho
    ? [...TAPE_RECIPES, ...MORE_TAPE_RECIPES]
    : [...RECIPES[plugin.kind], ...MORE_RECIPES[plugin.kind]];
  return [["Default", {}] as Recipe, ...recipes, ...characterRecipes(plugin.kind)]
    .slice(0, 15)
    .map(([name, values], index) => ({
      id: `${plugin.kind}:${name}:${index}`,
      name,
      values: { ...defaults, ...values },
    }));
}

/** Match parameter values rather than local selection, so manual saves and all editors agree. */
export function currentEffectPreset(plugin: PluginInstance): EffectPreset | undefined {
  const params = withDefaultParams(plugin);
  return effectPresets(plugin).find((preset) =>
    params.every(
      (p) =>
        preset.values[p.id] !== undefined &&
        Math.abs(p.value - Math.max(p.min, Math.min(p.max, preset.values[p.id] ?? 0))) < 0.000001,
    ),
  );
}

export function effectPresetParams(
  plugin: PluginInstance,
  presetId: string,
): PluginParam[] | undefined {
  const preset = effectPresets(plugin).find((p) => p.id === presetId);
  if (!preset) return undefined;
  return withDefaultParams(plugin).map((p) => ({
    ...p,
    value: Math.max(p.min, Math.min(p.max, preset.values[p.id] ?? p.value)),
  }));
}
