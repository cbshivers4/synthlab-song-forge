import type { PluginInstance, PluginParam } from "./types";
import { fxAnalysers, fxReadings, isOfflineContext, onDispose, shifter, type FxHelpers } from "./fx-dsp";
import { NOTE_NAMES, TUNE_SCALES, VOCAL_TUNE_PROCESSOR, ensureVocalTune, tuneReadings, vocalTuneReady } from "./vocal-tune";

/**
 * Studio effects pack. Every device builds its own real Web Audio signal path between one input
 * and one output node (insert size 2, like the other hardware effects). Analysis devices (Tuner,
 * VU Meter) pass audio through and expose live analysers; Vocal Tune runs in an AudioWorklet.
 */
export const STUDIO_KINDS = [
  "autofilter", "analogecho", "channelstrip", "stereochorus", "deesser", "expander", "stereoflanger", "multiband",
  "mustang", "stereophaser", "splitter", "vocaltune", "voicefx", "vumeter", "tuner", "tonegen", "openair",
] as const;
export type StudioKind = (typeof STUDIO_KINDS)[number];
export const isStudioKind = (kind: string): kind is StudioKind => (STUDIO_KINDS as readonly string[]).includes(kind);

export const STUDIO_DEVICES: [name: string, kind: StudioKind][] = [
  ["Auto Filter", "autofilter"], ["Analog Delay", "analogecho"], ["Channel Strip", "channelstrip"], ["Chorus", "stereochorus"],
  ["De-Esser", "deesser"], ["Expander", "expander"], ["Flanger", "stereoflanger"], ["Multiband Dynamics", "multiband"],
  ["Mustang Native", "mustang"], ["Phaser", "stereophaser"], ["Splitter", "splitter"], ["Vocal Tune", "vocaltune"],
  ["Voice FX", "voicefx"], ["VU Meter", "vumeter"], ["Tuner", "tuner"], ["Tone Generator", "tonegen"], ["Open Air", "openair"],
];

export const MUSTANG_MODELS = ["Tweed '57", "Blackface '65", "Tweed Bass '59", "British '60s", "British '80s", "American '90s", "Metal 2000", "Sonic Lead"] as const;
export const MUSTANG_CABS = ["1x12 Open Back", "2x12 Open Back", "4x10 Tweed", "4x12 Closed Back"] as const;
/** [input high-pass Hz, stage-1 gain range, stage-2 gain range, negative-side asymmetry, voicing Hz, voicing dB, bright dB] */
export const MUSTANG_VOICES = [
  [70, 8, 0.5, 0.85, 600, 2, 1], [80, 3, 0.2, 0.95, 500, -4, 4], [60, 12, 1.5, 0.8, 700, 3, 1.5], [90, 16, 3, 0.85, 1100, 4, 3],
  [100, 30, 8, 0.8, 800, 5, 2], [90, 40, 10, 0.9, 650, -6, 3], [140, 60, 14, 0.9, 600, -8, 2], [110, 48, 10, 0.85, 900, 2, 1],
] as const;
/** [low cut, high cut, resonance Hz, resonance dB] */
export const MUSTANG_CAB_VOICES = [[85, 5800, 110, 3], [80, 5200, 100, 3.5], [65, 4600, 95, 4], [75, 4200, 90, 6]] as const;
export const VOICE_CHARACTERS = ["Robot", "Telephone", "Megaphone", "AM Radio", "Monster", "Chipmunk", "Alien", "Walkie-Talkie", "Cyborg", "Ghost"] as const;
export const OPEN_AIR_SPACES = ["Vocal Booth", "Studio Room", "Live Room", "Chamber", "Plate", "Concert Hall", "Cathedral", "Parking Garage", "Stairwell", "Canyon"] as const;
/** [reverb time s, early-reflection spread ms, early taps, brightness 0..1] */
export const OPEN_AIR_ROOMS = [[0.25, 12, 6, 0.5], [0.6, 22, 10, 0.6], [1.1, 35, 14, 0.7], [1.6, 30, 18, 0.55], [2.2, 6, 24, 0.9], [2.8, 60, 16, 0.6], [5.5, 90, 14, 0.45], [2.4, 45, 20, 0.7], [3.2, 25, 22, 0.75], [4, 300, 5, 0.5]] as const;

/** Names shown on mode/model knobs instead of numbers. */
export const STUDIO_CHOICES: Record<string, readonly string[]> = {
  "autofilter:mode": ["Low Pass", "Band Pass", "High Pass", "Notch"],
  "autofilter:shape": ["Sine", "Triangle", "Square", "Saw"],
  "stereoflanger:shape": ["Sine", "Triangle"],
  "deesser:mode": ["Split", "Wide"],
  "deesser:listen": ["Off", "Listen"],
  "mustang:model": MUSTANG_MODELS,
  "mustang:cabinet": MUSTANG_CABS,
  "splitter:mode": ["Frequency", "Left / Right", "Mid / Side"],
  "vocaltune:key": NOTE_NAMES,
  "vocaltune:scale": TUNE_SCALES,
  "voicefx:character": VOICE_CHARACTERS,
  "vumeter:response": ["VU 300 ms", "Fast 50 ms"],
  "tuner:mute": ["Thru", "Mute"],
  "tuner:range": ["Guitar / Voice", "Bass"],
  "tonegen:wave": ["Sine", "Triangle", "Saw", "Square", "White Noise", "Pink Noise"],
  "tonegen:thru": ["Off", "On"],
  "openair:space": OPEN_AIR_SPACES,
};
const WHOLE = new Set(["stereochorus:voices", "stereophaser:stages", "vocaltune:transpose"]);
/** Knob step for a studio-pack control: whole numbers for choices and counts. */
export function studioStep(kind: string, id: string): number | undefined {
  const key = `${kind}:${id}`;
  return STUDIO_CHOICES[key] || WHOLE.has(key) ? 1 : undefined;
}
export function studioChoice(kind: string, id: string, v: number): string | undefined {
  const list = STUDIO_CHOICES[`${kind}:${id}`];
  return list ? list[Math.max(0, Math.min(list.length - 1, Math.round(v)))] : undefined;
}

const p = (id: string, name: string, value: number, min: number, max: number, unit?: string): PluginParam => ({ id, name, value, min, max, ...(unit ? { unit } : {}) });

export const STUDIO_PARAMS: Record<StudioKind, () => PluginParam[]> = {
  autofilter: () => [p("mode", "Filter Type", 0, 0, 3), p("cutoff", "Cutoff", 1200, 40, 18000, "Hz"), p("resonance", "Resonance", 4, 0.5, 20, "Q"), p("drive", "Drive", 0.2, 0, 1), p("rate", "LFO Rate", 1, 0.05, 16, "Hz"), p("shape", "LFO Shape", 0, 0, 3), p("depth", "LFO Depth", 0.5, 0, 1), p("env", "Envelope", 0.3, -1, 1), p("envSpeed", "Env Speed", 60, 5, 500, "ms"), p("stereo", "Stereo Phase", 0, 0, 180, "°"), p("mix", "Mix", 1, 0, 1), p("output", "Output", 0, -18, 6, "dB")],
  analogecho: () => [p("time", "Time", 350, 20, 2000, "ms"), p("feedback", "Feedback", 0.45, 0, 0.98), p("drive", "Drive", 0.3, 0, 1), p("age", "Age", 0.4, 0, 1), p("lowcut", "Low Cut", 100, 20, 1000, "Hz"), p("modRate", "Mod Speed", 0.6, 0.05, 8, "Hz"), p("modDepth", "Mod Depth", 0.25, 0, 1), p("pingpong", "Ping-Pong", 0, 0, 1), p("width", "Width", 1, 0, 1), p("mix", "Mix", 0.3, 0, 1), p("output", "Output", 0, -18, 6, "dB")],
  channelstrip: () => [p("lowcut", "Low Cut", 20, 20, 500, "Hz"), p("gate", "Gate", -80, -80, 0, "dB"), p("threshold", "Threshold", -18, -60, 0, "dB"), p("ratio", "Ratio", 2, 1, 20, ":1"), p("attack", "Attack", 10, 0.5, 100, "ms"), p("release", "Release", 120, 20, 1000, "ms"), p("makeup", "Makeup", 0, 0, 24, "dB"), p("low", "Low", 0, -15, 15, "dB"), p("midFreq", "Mid Freq", 1500, 200, 8000, "Hz"), p("mid", "Mid", 0, -15, 15, "dB"), p("high", "High", 0, -15, 15, "dB"), p("output", "Output", 0, -24, 12, "dB")],
  stereochorus: () => [p("voices", "Voices", 2, 1, 4), p("rate", "Rate", 0.8, 0.05, 10, "Hz"), p("depth", "Depth", 0.5, 0, 1), p("delay", "Delay", 14, 3, 40, "ms"), p("spread", "Spread", 0.8, 0, 1), p("lowcut", "Low Cut", 150, 20, 1000, "Hz"), p("tone", "Tone", 12000, 1000, 18000, "Hz"), p("mix", "Mix", 0.5, 0, 1)],
  deesser: () => [p("freq", "Frequency", 6500, 2000, 12000, "Hz"), p("threshold", "Threshold", -28, -60, 0, "dB"), p("range", "Range", 10, 0, 24, "dB"), p("release", "Release", 60, 10, 300, "ms"), p("mode", "Split / Wide", 0, 0, 1), p("listen", "Listen", 0, 0, 1), p("output", "Output", 0, -12, 12, "dB")],
  expander: () => [p("threshold", "Threshold", -40, -80, 0, "dB"), p("ratio", "Ratio", 2, 1, 10, ":1"), p("range", "Range", -40, -80, 0, "dB"), p("attack", "Attack", 5, 0.1, 100, "ms"), p("release", "Release", 150, 10, 2000, "ms"), p("output", "Output", 0, -12, 12, "dB")],
  stereoflanger: () => [p("rate", "Rate", 0.3, 0.02, 10, "Hz"), p("depth", "Depth", 0.7, 0, 1), p("delay", "Delay", 3, 2.7, 12, "ms"), p("feedback", "Feedback", 0.5, -0.95, 0.95), p("stereo", "Stereo Phase", 90, 0, 180, "°"), p("shape", "LFO Shape", 1, 0, 1), p("mix", "Mix", 0.5, 0, 1)],
  multiband: () => [p("lowSplit", "Low Split", 200, 40, 1000, "Hz"), p("highSplit", "High Split", 3000, 1000, 12000, "Hz"), p("lowThr", "Low Thresh", -24, -60, 0, "dB"), p("lowRatio", "Low Ratio", 3, 1, 20, ":1"), p("lowGain", "Low Gain", 0, -12, 12, "dB"), p("midThr", "Mid Thresh", -24, -60, 0, "dB"), p("midRatio", "Mid Ratio", 2.5, 1, 20, ":1"), p("midGain", "Mid Gain", 0, -12, 12, "dB"), p("highThr", "High Thresh", -24, -60, 0, "dB"), p("highRatio", "High Ratio", 3, 1, 20, ":1"), p("highGain", "High Gain", 0, -12, 12, "dB"), p("attack", "Attack", 10, 0.5, 200, "ms"), p("release", "Release", 150, 10, 1000, "ms"), p("output", "Output", 0, -12, 12, "dB")],
  mustang: () => [p("model", "Amp Model", 0, 0, 7), p("gain", "Gain", 0.5, 0, 1), p("volume", "Volume", 0.5, 0, 1), p("treble", "Treble", 0, -10, 10, "dB"), p("middle", "Middle", 0, -10, 10, "dB"), p("bass", "Bass", 0, -10, 10, "dB"), p("presence", "Presence", 0, -10, 10, "dB"), p("reverb", "Reverb", 0.15, 0, 1), p("cabinet", "Cabinet", 0, 0, 3), p("output", "Output", -6, -24, 6, "dB")],
  stereophaser: () => [p("stages", "Stages", 6, 2, 12), p("rate", "Rate", 0.4, 0.02, 10, "Hz"), p("depth", "Depth", 0.7, 0, 1), p("center", "Center", 900, 100, 5000, "Hz"), p("sharpness", "Sharpness", 1, 0.3, 8, "Q"), p("stereo", "Stereo Phase", 90, 0, 180, "°"), p("mix", "Mix", 0.5, 0, 1)],
  splitter: () => [p("mode", "Split Mode", 0, 0, 2), p("split1", "Split 1", 250, 40, 2000, "Hz"), p("split2", "Split 2", 3000, 1000, 16000, "Hz"), p("levelA", "Level A", 0, -60, 12, "dB"), p("levelB", "Level B", 0, -60, 12, "dB"), p("levelC", "Level C", 0, -60, 12, "dB"), p("panA", "Pan A", 0, -1, 1), p("panB", "Pan B", 0, -1, 1), p("panC", "Pan C", 0, -1, 1), p("output", "Output", 0, -18, 6, "dB")],
  vocaltune: () => [p("key", "Key", 0, 0, 11), p("scale", "Scale", 1, 0, 6), p("speed", "Retune Speed", 40, 0, 400, "ms"), p("amount", "Amount", 1, 0, 1), p("humanize", "Humanize", 0.3, 0, 1), p("transpose", "Transpose", 0, -12, 12, "st"), p("fine", "Reference", 0, -50, 50, "ct"), p("output", "Output", 0, -12, 12, "dB")],
  voicefx: () => [p("character", "Character", 0, 0, 9), p("pitch", "Pitch", 0, -12, 12, "st"), p("amount", "Amount", 0.6, 0, 1), p("tone", "Tone", 0, -1, 1), p("drive", "Drive", 0.3, 0, 1), p("mix", "Mix", 1, 0, 1), p("output", "Output", 0, -18, 6, "dB")],
  vumeter: () => [p("reference", "0 VU =", -18, -24, -6, "dBFS"), p("response", "Ballistics", 0, 0, 1), p("trim", "Trim", 0, -24, 24, "dB")],
  tuner: () => [p("reference", "A4 Reference", 440, 430, 450, "Hz"), p("mute", "Output", 0, 0, 1), p("range", "Range", 0, 0, 1)],
  tonegen: () => [p("wave", "Waveform", 0, 0, 5), p("frequency", "Frequency", 440, 20, 20000, "Hz"), p("fine", "Fine", 0, -100, 100, "ct"), p("level", "Level", -18, -60, 0, "dBFS"), p("thru", "Input Thru", 1, 0, 1)],
  openair: () => [p("space", "Space", 3, 0, 9), p("size", "Size", 1, 0.5, 2, "×"), p("predelay", "Pre-Delay", 15, 0, 250, "ms"), p("early", "Early", 0.6, 0, 1), p("tail", "Tail", 0.8, 0, 1), p("damping", "Damping", 0.4, 0, 1), p("width", "Width", 1, 0, 1.5), p("lowcut", "Low Cut", 120, 20, 800, "Hz"), p("highcut", "High Cut", 12000, 1500, 20000, "Hz"), p("mix", "Mix", 0.3, 0, 1), p("output", "Output", 0, -18, 6, "dB")],
};

type R = [string, Record<string, number>];
export const STUDIO_RECIPES: Record<StudioKind, R[]> = {
  autofilter: [
    ["Slow Sweep Pad", { rate: 0.12, depth: 0.8, env: 0, resonance: 3 }], ["Funky Envelope", { mode: 1, env: 0.8, depth: 0, resonance: 8, cutoff: 500, envSpeed: 30 }],
    ["Dubstep Wobble", { rate: 3, depth: 0.9, resonance: 10, cutoff: 400, drive: 0.6, env: 0 }], ["Stereo Swirl", { rate: 0.5, depth: 0.6, stereo: 180, env: 0 }],
    ["Square Chop", { shape: 2, rate: 4, depth: 0.7, cutoff: 3000, env: 0 }], ["Saw Rise", { shape: 3, rate: 2, depth: 0.7, resonance: 6, env: 0 }],
    ["High-Pass Build", { mode: 2, cutoff: 300, rate: 0.08, depth: 0.7, env: 0 }], ["Notch Phaser", { mode: 3, cutoff: 1500, rate: 0.4, depth: 0.8, resonance: 2, env: 0 }],
    ["Bass Quack", { env: 1, depth: 0, cutoff: 250, resonance: 12, envSpeed: 20, drive: 0.4 }], ["Reverse Envelope", { env: -0.8, depth: 0, cutoff: 6000, resonance: 5 }],
    ["Tremolo Filter", { rate: 6, depth: 0.5, cutoff: 2500, resonance: 1, env: 0 }], ["Acid Talk", { mode: 1, cutoff: 900, resonance: 14, rate: 1.5, depth: 0.5, env: 0.4, drive: 0.5 }],
    ["Gentle Movement", { rate: 0.3, depth: 0.3, env: 0.1, mix: 0.6, resonance: 1.5 }], ["Drum Bus Pump", { shape: 3, rate: 2, depth: 0.5, mode: 2, cutoff: 120, resonance: 2, env: 0 }],
  ],
  analogecho: [
    ["Slapback", { time: 95, feedback: 0.1, mix: 0.25, age: 0.3 }], ["Dub Siren", { time: 480, feedback: 0.85, drive: 0.6, age: 0.6, lowcut: 250, mix: 0.4 }],
    ["Ping-Pong Eighths", { time: 250, feedback: 0.5, pingpong: 1, mix: 0.35 }], ["Worn Out Tape", { time: 400, feedback: 0.55, age: 1, modDepth: 0.7, modRate: 0.9 }],
    ["Clean Digital-ish", { age: 0, drive: 0, modDepth: 0, feedback: 0.4, time: 375 }], ["Chorus Echo", { time: 35, feedback: 0.2, modDepth: 1, modRate: 1.2, mix: 0.45 }],
    ["Vocal Throw", { time: 600, feedback: 0.45, lowcut: 300, age: 0.5, mix: 0.3 }], ["Ambient Wash", { time: 1200, feedback: 0.8, age: 0.7, modDepth: 0.4, mix: 0.45, pingpong: 0.5 }],
    ["Short Double", { time: 22, feedback: 0, mix: 0.4, width: 0.6 }], ["Runaway Feedback", { time: 320, feedback: 0.98, drive: 0.8, mix: 0.4 }],
    ["Dark Quarter", { time: 500, feedback: 0.5, age: 0.9, lowcut: 150 }], ["Bright Repeats", { time: 300, feedback: 0.5, age: 0.05, lowcut: 400, drive: 0.1 }],
    ["Wide Stereo Bounce", { time: 180, feedback: 0.6, pingpong: 0.8, width: 1, mix: 0.3 }], ["Mono Space", { width: 0, time: 420, feedback: 0.35 }],
  ],
  channelstrip: [
    ["Lead Vocal", { lowcut: 90, threshold: -24, ratio: 3, attack: 8, release: 140, makeup: 4, midFreq: 3000, mid: 2, high: 3 }], ["Rap Vocal", { lowcut: 110, threshold: -22, ratio: 5, attack: 4, release: 90, makeup: 5, mid: 3, midFreq: 2500, low: -2 }],
    ["Kick Drum", { lowcut: 30, gate: -40, threshold: -16, ratio: 4, attack: 25, release: 80, makeup: 3, low: 4, mid: -5, midFreq: 400, high: 2 }], ["Snare", { lowcut: 80, gate: -35, threshold: -18, ratio: 4, attack: 15, release: 100, makeup: 3, midFreq: 5000, mid: 3, low: 1 }],
    ["Bass Guitar", { lowcut: 35, threshold: -20, ratio: 4, attack: 20, release: 200, makeup: 4, low: 3, midFreq: 800, mid: 2, high: -3 }], ["Acoustic Guitar", { lowcut: 100, threshold: -20, ratio: 2.5, attack: 15, release: 160, makeup: 2, midFreq: 400, mid: -3, high: 3 }],
    ["Electric Guitar", { lowcut: 90, threshold: -16, ratio: 2, attack: 20, release: 120, makeup: 1, midFreq: 2000, mid: 2, high: -2 }], ["Piano", { lowcut: 40, threshold: -18, ratio: 2, attack: 30, release: 250, makeup: 1, midFreq: 600, mid: -2, high: 2 }],
    ["Synth Pad", { lowcut: 150, threshold: -14, ratio: 1.5, attack: 40, release: 400, low: -3, high: 2 }], ["Podcast Voice", { lowcut: 80, gate: -50, threshold: -26, ratio: 4, attack: 6, release: 150, makeup: 6, midFreq: 3500, mid: 2, low: -1 }],
    ["Drum Overheads", { lowcut: 200, threshold: -14, ratio: 2, attack: 30, release: 120, high: 3, mid: -2, midFreq: 900 }], ["Hi-Hat Clean", { lowcut: 400, gate: -45, threshold: -20, ratio: 3, attack: 2, release: 60, high: 2 }],
    ["Backing Vocals", { lowcut: 140, threshold: -28, ratio: 4, attack: 10, release: 180, makeup: 5, low: -3, high: 4 }], ["Gentle Polish", { lowcut: 40, threshold: -10, ratio: 1.5, attack: 20, release: 200, makeup: 1, high: 1 }],
  ],
  stereochorus: [
    ["Classic Duo", { voices: 2, rate: 0.6, depth: 0.4 }], ["Lush Quad", { voices: 4, rate: 0.4, depth: 0.7, mix: 0.6 }], ["Vocal Thicken", { voices: 3, rate: 0.3, depth: 0.25, mix: 0.3, lowcut: 250 }],
    ["Clean Guitar", { voices: 2, rate: 0.9, depth: 0.5, delay: 10, mix: 0.45 }], ["Bass Chorus", { voices: 2, rate: 0.5, depth: 0.35, lowcut: 400, mix: 0.4 }], ["Wide Synth", { voices: 4, rate: 1.2, depth: 0.6, spread: 1, mix: 0.55 }],
    ["Dark Ensemble", { voices: 3, tone: 3500, depth: 0.6, rate: 0.5 }], ["Fast Shimmer", { voices: 2, rate: 4, depth: 0.3, tone: 16000 }], ["Seasick", { voices: 1, rate: 1.8, depth: 1, mix: 0.7 }],
    ["Mono Chorus", { voices: 2, spread: 0, rate: 0.7 }], ["Long Delay Chorus", { voices: 3, delay: 32, depth: 0.5, rate: 0.35 }], ["Subtle Air", { voices: 2, depth: 0.15, mix: 0.25, rate: 0.25 }],
    ["Keys Motion", { voices: 3, rate: 1.5, depth: 0.45, delay: 18, mix: 0.4 }], ["80s Strings", { voices: 4, rate: 0.7, depth: 0.85, delay: 24, mix: 0.65 }],
  ],
  deesser: [
    ["Female Vocal", { freq: 7500, threshold: -30, range: 10 }], ["Male Vocal", { freq: 5500, threshold: -28, range: 9 }], ["Gentle Smooth", { threshold: -24, range: 5 }],
    ["Heavy Sibilance", { threshold: -38, range: 16, release: 40 }], ["Podcast", { freq: 6000, threshold: -32, range: 12, mode: 1 }], ["Rap Vocal", { freq: 6800, threshold: -26, range: 8, release: 45 }],
    ["Hi-Hat Tamer", { freq: 9000, threshold: -30, range: 8, release: 80 }], ["Acoustic Strings", { freq: 4500, threshold: -26, range: 6, release: 100 }], ["Wide Band Soft", { mode: 1, threshold: -30, range: 6 }],
    ["Listen to Esses", { listen: 1, threshold: -34 }], ["Bright Cymbals", { freq: 11000, threshold: -28, range: 6 }], ["Harsh Upper Mids", { freq: 3200, threshold: -28, range: 7, release: 120 }],
    ["Whisper Control", { freq: 5000, threshold: -40, range: 14 }], ["Mastering Light", { freq: 8000, threshold: -20, range: 3, release: 120 }],
  ],
  expander: [
    ["Vocal Breath Cut", { threshold: -45, ratio: 2, range: -20, release: 200 }], ["Drum Tighten", { threshold: -30, ratio: 4, range: -40, attack: 0.5, release: 80 }], ["Guitar Noise", { threshold: -50, ratio: 3, range: -30, release: 250 }],
    ["Soft Room", { threshold: -40, ratio: 1.5, range: -12, release: 400 }], ["Hard Gate Style", { threshold: -35, ratio: 10, range: -80, attack: 0.3, release: 60 }], ["Podcast Silence", { threshold: -48, ratio: 3, range: -25, release: 300 }],
    ["Kick Bleed", { threshold: -28, ratio: 5, range: -35, attack: 1, release: 70 }], ["Snare Bleed", { threshold: -26, ratio: 4, range: -30, attack: 1, release: 110 }], ["Amp Hum", { threshold: -55, ratio: 2.5, range: -24, release: 500 }],
    ["Long Tail", { threshold: -50, ratio: 2, range: -18, release: 1200 }], ["Punchy Toms", { threshold: -32, ratio: 6, range: -45, release: 150 }], ["Light Touch", { threshold: -60, ratio: 1.3, range: -8 }],
    ["Synth Hiss", { threshold: -58, ratio: 2, range: -20, release: 350 }], ["Live Mic Bleed", { threshold: -38, ratio: 3, range: -20, release: 180, output: 1 }],
  ],
  stereoflanger: [
    ["Jet Plane", { rate: 0.1, depth: 0.9, feedback: 0.8 }], ["Negative Hollow", { feedback: -0.8, rate: 0.25 }], ["Through Zero Feel", { delay: 2.7, depth: 1, feedback: 0.3, rate: 0.2 }],
    ["Stereo Wide", { stereo: 180, rate: 0.4, mix: 0.5 }], ["Mono Classic", { stereo: 0, rate: 0.3 }], ["Fast Metallic", { rate: 3, feedback: 0.9, depth: 0.5 }],
    ["Subtle Shimmer", { depth: 0.3, feedback: 0.2, mix: 0.3 }], ["Sine Sweep", { shape: 0, rate: 0.5, feedback: 0.6 }], ["Drum Bus Jet", { rate: 0.08, depth: 0.8, feedback: 0.7, mix: 0.4 }],
    ["Robot Comb", { rate: 0.02, depth: 0.1, delay: 6, feedback: 0.9 }], ["Guitar Swirl", { rate: 0.6, depth: 0.7, feedback: 0.55, mix: 0.45 }], ["Deep Negative", { feedback: -0.95, depth: 0.8, rate: 0.15, delay: 5 }],
    ["Vocal Air", { rate: 0.2, depth: 0.4, feedback: 0.25, mix: 0.25, delay: 4 }], ["Wobble", { rate: 6, depth: 0.4, feedback: 0.4 }],
  ],
  multiband: [
    ["Master Glue", { lowThr: -18, lowRatio: 2, midThr: -16, midRatio: 1.8, highThr: -18, highRatio: 2, attack: 25, release: 200 }], ["Bass Tighten", { lowThr: -30, lowRatio: 6, lowGain: 2, attack: 15 }],
    ["Vocal Smooth", { midThr: -28, midRatio: 3, highThr: -30, highRatio: 4, highSplit: 5000 }], ["Drum Punch", { lowThr: -20, lowRatio: 4, lowGain: 2, midThr: -22, midRatio: 3, attack: 30, release: 100 }],
    ["Loud Master", { lowThr: -26, lowRatio: 4, midThr: -24, midRatio: 4, highThr: -24, highRatio: 4, lowGain: 2, midGain: 2, highGain: 2, output: -1 }], ["Tame Harshness", { highSplit: 2500, highThr: -32, highRatio: 5 }],
    ["Gentle Air", { highThr: -12, highRatio: 1.5, highGain: 3 }], ["Mud Control", { lowSplit: 300, highSplit: 1200, midThr: -30, midRatio: 4, midGain: -2 }], ["Podcast Voice", { lowSplit: 150, lowThr: -30, lowRatio: 5, midThr: -26, midRatio: 3, midGain: 2 }],
    ["Hip-Hop Low End", { lowSplit: 120, lowThr: -24, lowRatio: 5, lowGain: 3, attack: 20, release: 120 }], ["Bright Mix", { highSplit: 6000, highGain: 3, highThr: -20 }], ["Soft Broadcast", { lowRatio: 2, midRatio: 2, highRatio: 2, attack: 40, release: 400, output: 1 }],
    ["Electronic Bus", { lowSplit: 180, lowThr: -22, lowRatio: 5, highThr: -22, highRatio: 3, release: 80 }], ["Acoustic Balance", { lowSplit: 250, lowThr: -28, lowRatio: 3, midGain: 1, highThr: -26, highRatio: 2 }],
  ],
  mustang: [
    ["Tweed Blues", { model: 0, gain: 0.6, middle: 2, cabinet: 0, reverb: 0.2 }], ["Blackface Clean", { model: 1, gain: 0.3, treble: 3, bass: 2, middle: -2, cabinet: 1, reverb: 0.35 }],
    ["Surf Spring", { model: 1, gain: 0.25, treble: 5, reverb: 0.7, cabinet: 1 }], ["Bassman Crunch", { model: 2, gain: 0.7, middle: 3, cabinet: 2, reverb: 0.1 }],
    ["British Chime", { model: 3, gain: 0.5, treble: 3, presence: 2, cabinet: 1 }], ["British Rock", { model: 4, gain: 0.65, middle: 3, cabinet: 3, reverb: 0.1 }],
    ["80s Lead", { model: 4, gain: 0.9, volume: 0.7, presence: 4, cabinet: 3, reverb: 0.25 }], ["Modern Scoop", { model: 5, gain: 0.75, bass: 4, middle: -4, treble: 3, cabinet: 3, reverb: 0.05 }],
    ["Metal Rhythm", { model: 6, gain: 0.8, bass: 3, middle: -3, treble: 4, cabinet: 3, reverb: 0 }], ["Metal Lead", { model: 6, gain: 1, middle: 2, presence: 3, cabinet: 3, reverb: 0.2 }],
    ["Sonic Solo", { model: 7, gain: 0.85, middle: 4, volume: 0.6, cabinet: 1, reverb: 0.3 }], ["Country Twang", { model: 1, gain: 0.35, treble: 6, middle: -3, presence: 4, cabinet: 1, reverb: 0.2 }],
    ["Jazz Warm", { model: 0, gain: 0.2, treble: -6, bass: 3, cabinet: 2, reverb: 0.15 }], ["Motor City Grit", { model: 2, gain: 0.85, middle: 5, volume: 0.8, cabinet: 2, reverb: 0.05 }],
  ],
  stereophaser: [
    ["Vintage Four", { stages: 4, rate: 0.3, depth: 0.7 }], ["Deep Twelve", { stages: 12, rate: 0.2, depth: 0.9, sharpness: 2 }], ["Funky Eight", { stages: 8, rate: 1.6, depth: 0.6, center: 1200 }],
    ["Stereo Orbit", { stereo: 180, rate: 0.15, depth: 0.8 }], ["Mono Swirl", { stereo: 0, rate: 0.5 }], ["Slow Space", { rate: 0.05, depth: 1, center: 600, mix: 0.45 }],
    ["Sharp Resonant", { sharpness: 6, stages: 8, rate: 0.4 }], ["Guitar Swoosh", { stages: 4, rate: 0.8, depth: 0.6, center: 1500, mix: 0.5 }], ["Keys Wobble", { stages: 6, rate: 3, depth: 0.4, center: 1100 }],
    ["Bass Phase", { stages: 4, center: 300, depth: 0.6, rate: 0.6 }], ["Bright Air", { stages: 6, center: 3500, depth: 0.5, rate: 0.35 }], ["Subtle Motion", { depth: 0.3, mix: 0.3, rate: 0.25 }],
    ["Two Stage Soft", { stages: 2, rate: 0.5, depth: 0.8 }], ["Fast Flutter", { stages: 10, rate: 7, depth: 0.35 }],
  ],
  splitter: [
    ["Low Mono High Wide", { panA: 0, panB: -0.4, panC: 0.4, split1: 150 }], ["Bass Only", { levelB: -60, levelC: -60 }], ["Mids Only", { levelA: -60, levelC: -60 }],
    ["Highs Only", { levelA: -60, levelB: -60 }], ["Swap Left Right", { mode: 1, panA: 1, panB: -1 }], ["Left Only", { mode: 1, levelB: -60 }],
    ["Right Only", { mode: 1, levelA: -60 }], ["Mid Only (Mono)", { mode: 2, levelB: -60 }], ["Side Only", { mode: 2, levelA: -60 }],
    ["Wider Sides", { mode: 2, levelB: 4, levelA: -1 }], ["Bass Boost Split", { levelA: 4, split1: 120 }], ["Telephone Split", { levelA: -60, levelC: -60, split1: 400, split2: 3000 }],
    ["Air Lift", { levelC: 4, split2: 8000 }], ["Mono Bass Safety", { mode: 0, split1: 100, panA: 0, levelA: -1, levelC: 1 }],
  ],
  vocaltune: [
    ["Natural C Major", { key: 0, scale: 1, speed: 80, humanize: 0.5, amount: 0.8 }], ["Hard Tune Effect", { speed: 0, humanize: 0, amount: 1, scale: 0 }],
    ["Chromatic Gentle", { scale: 0, speed: 120, amount: 0.6, humanize: 0.6 }], ["A Minor Pop", { key: 9, scale: 2, speed: 30, humanize: 0.3 }],
    ["G Major Ballad", { key: 7, scale: 1, speed: 100, humanize: 0.7, amount: 0.85 }], ["E Minor R&B", { key: 4, scale: 2, speed: 45, humanize: 0.4 }],
    ["F Major Soft", { key: 5, scale: 1, speed: 150, humanize: 0.8, amount: 0.7 }], ["D Minor Trap", { key: 2, scale: 2, speed: 5, humanize: 0.1 }],
    ["Pentatonic Gospel", { key: 0, scale: 3, speed: 60, humanize: 0.5 }], ["Blues Bend", { key: 9, scale: 5, speed: 70, humanize: 0.6, amount: 0.75 }],
    ["Octave Up Robot", { transpose: 12, speed: 0, humanize: 0, scale: 0 }], ["Octave Down Voice", { transpose: -12, speed: 50, scale: 0 }],
    ["Harmonic Minor", { key: 9, scale: 6, speed: 40 }], ["432 Hz Reference", { fine: -32, scale: 0, speed: 60 }],
  ],
  voicefx: [
    ["Robot", { character: 0, amount: 0.8 }], ["Phone Call", { character: 1, amount: 0.7 }], ["Megaphone", { character: 2, amount: 0.8, drive: 0.6 }],
    ["Old Radio", { character: 3, amount: 0.7 }], ["Monster", { character: 4, amount: 0.8 }], ["Chipmunk", { character: 5, amount: 0.7 }],
    ["Alien", { character: 6, amount: 0.8 }], ["Walkie-Talkie", { character: 7, amount: 0.9, drive: 0.7 }], ["Cyborg", { character: 8, amount: 0.8 }],
    ["Ghost", { character: 9, amount: 0.8, mix: 0.8 }], ["Deep Narrator", { character: 4, pitch: 3, amount: 0.4, tone: -0.3 }], ["Tiny Robot", { character: 0, pitch: 7, amount: 0.6 }],
    ["Dark Demon", { character: 4, pitch: -5, amount: 1, drive: 0.6, tone: -0.5 }], ["Bright Cartoon", { character: 5, pitch: 3, tone: 0.5, amount: 0.5 }],
  ],
  vumeter: [
    ["Broadcast -20", { reference: -20 }], ["Mix -14", { reference: -14 }], ["Tracking -24", { reference: -24 }], ["Hot -10", { reference: -10 }],
    ["Mastering -12", { reference: -12 }], ["Fast Peaks", { response: 1 }], ["Fast -14", { response: 1, reference: -14 }], ["Cut 6 dB", { trim: -6 }],
    ["Boost 6 dB", { trim: 6 }], ["Cut 12 dB", { trim: -12 }], ["Gain Stage -22", { reference: -22 }], ["Loud -8", { reference: -8 }],
    ["Film -20 Fast", { reference: -20, response: 1 }], ["Boost 3 dB", { trim: 3 }],
  ],
  tuner: [
    ["Silent Tuning", { mute: 1 }], ["Bass Tuning", { range: 1 }], ["Silent Bass", { range: 1, mute: 1 }], ["A = 442 Orchestra", { reference: 442 }],
    ["A = 432", { reference: 432 }], ["A = 435 Historic", { reference: 435 }], ["A = 438", { reference: 438 }], ["A = 441", { reference: 441 }],
    ["A = 443", { reference: 443 }], ["A = 444", { reference: 444 }], ["A = 445", { reference: 445 }], ["Silent 442", { reference: 442, mute: 1 }],
    ["Bass 442", { reference: 442, range: 1 }], ["A = 446", { reference: 446 }],
  ],
  tonegen: [
    ["1 kHz Reference", { frequency: 1000 }], ["100 Hz Low Check", { frequency: 100 }], ["50 Hz Sub", { frequency: 50, level: -20 }], ["10 kHz Air", { frequency: 10000, level: -24 }],
    ["Pink Noise Mix Check", { wave: 5, level: -20 }], ["White Noise", { wave: 4, level: -24 }], ["Square 100 Hz", { wave: 3, frequency: 100, level: -24 }], ["Saw 220 Hz", { wave: 2, frequency: 220, level: -24 }],
    ["Triangle 440", { wave: 1 }], ["Tone Only (No Input)", { thru: 0 }], ["Calibrate -20 dBFS", { frequency: 1000, level: -20, thru: 0 }], ["A 432 Drone", { frequency: 432, level: -24 }],
    ["Detroit Bass Drone", { frequency: 55, wave: 2, level: -22 }], ["Ear Test 15 kHz", { frequency: 15000, level: -30 }],
  ],
  openair: [
    ["Vocal Booth", { space: 0, mix: 0.2, predelay: 0 }], ["Studio Room", { space: 1, mix: 0.25 }], ["Live Room Drums", { space: 2, mix: 0.3, early: 0.8, tail: 0.6 }],
    ["Echo Chamber", { space: 3, mix: 0.3, damping: 0.5 }], ["Bright Plate", { space: 4, mix: 0.25, predelay: 30, damping: 0.2 }], ["Concert Hall", { space: 5, mix: 0.35, predelay: 30 }],
    ["Cathedral", { space: 6, mix: 0.45, predelay: 50, size: 1.4 }], ["Parking Garage", { space: 7, mix: 0.35, early: 0.9 }], ["Stairwell", { space: 8, mix: 0.35, damping: 0.25 }],
    ["Canyon Echo", { space: 9, mix: 0.35, early: 1, tail: 0.5 }], ["Small Tight Room", { space: 1, size: 0.6, mix: 0.2 }], ["Huge Dark Hall", { space: 5, size: 1.8, damping: 0.8, mix: 0.4 }],
    ["Vocal Plate Long", { space: 4, size: 1.5, predelay: 60, lowcut: 250, mix: 0.25 }], ["Wide Ambient", { space: 6, width: 1.5, size: 2, mix: 0.5, highcut: 8000 }],
  ],
};

// ── DSP ────────────────────────────────────────────────────────────────────────
const BW = -3.0103; // Butterworth Q (dB) for low/high-pass crossovers
const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));
const db = (d: number) => Math.pow(10, d / 20);
const toDb = (g: number) => 20 * Math.log10(Math.max(1e-6, g));
const glide = (param: AudioParam, v: number, t: number, tc = 0.015) => param.setTargetAtTime(v, t, tc);
const curve = (fn: (x: number) => number, n = 2048) => {
  const c = new Float32Array(n);
  for (let i = 0; i < n; i++) c[i] = fn((i / (n - 1)) * 2 - 1);
  return c;
};
const softClip = (x: number, k: number) => Math.tanh(x * k) / Math.tanh(k);

/** Seeded noise so renders and live playback build identical impulses. */
const rng = (seed: number) => () => { seed = (seed * 16807) % 2147483647; return (seed / 2147483647) * 2 - 1; };

/** Periodic LFO (sine/triangle/square/saw) at a phase offset in degrees. */
const waveCache = new WeakMap<BaseAudioContext, Map<string, PeriodicWave>>();
function lfoWave(ctx: BaseAudioContext, shape: number, phaseDeg: number) {
  const key = `${Math.round(shape)}:${Math.round(phaseDeg)}`;
  let m = waveCache.get(ctx);
  if (!m) { m = new Map(); waveCache.set(ctx, m); }
  const hit = m.get(key);
  if (hit) return hit;
  const s = Math.round(shape);
  const f = (x: number) => s === 1 ? 1 - 4 * Math.abs(x - 0.5) : s === 2 ? (x < 0.5 ? 1 : -1) : s === 3 ? 1 - 2 * x : Math.sin(2 * Math.PI * x);
  const N = 256, H = 24, re = new Float32Array(H + 1), im = new Float32Array(H + 1);
  const ph = phaseDeg / 360;
  for (let n = 1; n <= H; n++) {
    let a = 0, b = 0;
    for (let i = 0; i < N; i++) { const x = i / N; const v = f((x + ph) % 1); a += v * Math.cos(2 * Math.PI * n * x); b += v * Math.sin(2 * Math.PI * n * x); }
    re[n] = (2 * a) / N; im[n] = (2 * b) / N;
  }
  const w = ctx.createPeriodicWave(re, im, { disableNormalization: true });
  m.set(key, w);
  return w;
}

/** Envelope follower: |x| smoothed by a low-pass whose time is in ms. */
function follower(ctx: BaseAudioContext, src: AudioNode, ms: number) {
  const rect = ctx.createWaveShaper(); rect.curve = curve((x) => Math.abs(x) * 1.4, 4097);
  const lp = ctx.createBiquadFilter(); lp.type = "lowpass"; lp.Q.value = BW;
  const set = (m: number, t?: number) => { const f = clamp(1000 / (2 * Math.PI * Math.max(0.5, m)), 0.3, 2000); t === undefined ? (lp.frequency.value = f) : glide(lp.frequency, f, t); };
  set(ms);
  src.connect(rect); rect.connect(lp);
  return { node: lp as AudioNode, set };
}

/** Gain computer: maps an envelope (0..2 linear) through fn into gain AudioParams. */
function computer(ctx: BaseAudioContext, env: AudioNode, targets: AudioParam[], fn: (lin: number) => number) {
  const SCALE = 2;
  const sense = ctx.createGain(); sense.gain.value = 1 / SCALE;
  const ws = ctx.createWaveShaper();
  const reshape = (f: (lin: number) => number) => { ws.curve = curve((x) => clamp(f(Math.abs(x) * SCALE), 0, 4), 8193); };
  reshape(fn);
  env.connect(sense); sense.connect(ws);
  for (const t of targets) { t.value = 0; ws.connect(t); }
  return { out: ws as AudioNode, reshape };
}

/** Lowest gain the computer produced recently, as dB of reduction (positive). */
function reductionReader(ctx: BaseAudioContext, src: AudioNode) {
  const an = ctx.createAnalyser(); an.fftSize = 256; src.connect(an);
  const buf = new Float32Array(an.fftSize);
  return () => { an.getFloatTimeDomainData(buf); let lo = 4; for (let i = 0; i < buf.length; i++) if (buf[i]! < lo) lo = buf[i]!; return Math.max(0, -toDb(lo)); };
}

function noiseBuffer(ctx: BaseAudioContext, seconds: number, pink: boolean) {
  const len = Math.max(1, Math.round(ctx.sampleRate * seconds));
  const b = ctx.createBuffer(1, len, ctx.sampleRate);
  const d = b.getChannelData(0), r = rng(pink ? 4242 : 1717);
  let b0 = 0, b1 = 0, b2 = 0, b3 = 0, b4 = 0, b5 = 0, b6 = 0;
  for (let i = 0; i < len; i++) {
    const w = r();
    if (!pink) { d[i] = w * 0.5; continue; }
    b0 = 0.99886 * b0 + w * 0.0555179; b1 = 0.99332 * b1 + w * 0.0750759; b2 = 0.969 * b2 + w * 0.153852;
    b3 = 0.8665 * b3 + w * 0.3104856; b4 = 0.55 * b4 + w * 0.5329522; b5 = -0.7616 * b5 - w * 0.016898;
    d[i] = (b0 + b1 + b2 + b3 + b4 + b5 + b6 + w * 0.5362) * 0.11; b6 = w * 0.115926;
  }
  return b;
}

/** Open Air impulse pair (early reflections + diffuse tail) for one space. */
export function openAirImpulse(ctx: BaseAudioContext, space: number, size: number, damping: number) {
  const sr = ctx.sampleRate;
  const room = OPEN_AIR_ROOMS[clamp(Math.round(space), 0, OPEN_AIR_ROOMS.length - 1)]!;
  const [rt0, spread0, taps, bright] = room;
  const rt = rt0 * size, spread = spread0 * size;
  const r = rng(1009 + space * 97);
  const eLen = Math.max(32, Math.round(sr * (spread / 1000 + 0.02)));
  const early = ctx.createBuffer(2, eLen, sr);
  for (let ch = 0; ch < 2; ch++) {
    const d = early.getChannelData(ch);
    d[0] = 0;
    for (let k = 0; k < taps; k++) {
      const t = (0.001 + ((k + 0.5 + r() * 0.4) / taps) * spread / 1000) * (1 + ch * 0.03 * r());
      const i = Math.min(eLen - 1, Math.round(t * sr));
      d[i] = (d[i] ?? 0) + (r() > 0 ? 1 : -1) * Math.pow(0.82, k) * (0.6 + 0.4 * Math.abs(r()));
    }
    if (space === 9) for (const [t, g] of [[0.3, 0.7], [0.62, 0.45], [0.95, 0.3]] as const) { const i = Math.min(eLen - 1, Math.round(t * size * sr)); d[i] = (d[i] ?? 0) + g; }
  }
  const tLen = Math.round(sr * Math.min(9, Math.max(0.2, rt * 1.3)));
  const tail = ctx.createBuffer(2, tLen, sr);
  const fc0 = 3000 + bright * 15000;
  for (let ch = 0; ch < 2; ch++) {
    const d = tail.getChannelData(ch); const rn = rng(77 + ch * 31 + space * 13);
    let y = 0, a = 0;
    const start = Math.round(sr * spread * 0.4 / 1000);
    for (let i = 0; i < tLen; i++) {
      const t = i / sr;
      if (i % 64 === 0) { const fc = Math.max(250, fc0 * Math.pow(2, -(t / Math.max(0.05, rt)) * (1 + damping * 6))); a = Math.exp((-2 * Math.PI * fc) / sr); }
      const env = i < start ? 0 : Math.exp((-6.9 * t) / Math.max(0.05, rt)) * Math.min(1, (i - start) / (sr * 0.01));
      let x = rn() * env;
      if (space === 7 && i % Math.round(sr * 0.034) === 0) x += env * 2.5; // garage flutter between parallel walls
      y = (1 - a) * x + a * y;
      d[i] = y;
    }
  }
  return { early, tail };
}

/** Stereo width (M/S) between one input and output. */
function widthStage(ctx: BaseAudioContext, input: AudioNode, out: AudioNode, width: number) {
  const split = ctx.createChannelSplitter(2), merge = ctx.createChannelMerger(2);
  const up = ctx.createGain(); up.channelCount = 2; up.channelCountMode = "explicit"; up.channelInterpretation = "speakers";
  input.connect(up); up.connect(split);
  const mid = ctx.createGain(), side = ctx.createGain(), sideInv = ctx.createGain();
  mid.gain.value = 0.5; sideInv.gain.value = -1;
  const sideAmt = ctx.createGain();
  split.connect(mid, 0); split.connect(mid, 1);
  const sL = ctx.createGain(), sR = ctx.createGain(); sL.gain.value = 0.5; sR.gain.value = -0.5;
  split.connect(sL, 0); split.connect(sR, 1); sL.connect(side); sR.connect(side);
  side.connect(sideAmt);
  mid.connect(merge, 0, 0); mid.connect(merge, 0, 1);
  sideAmt.connect(merge, 0, 0); sideAmt.connect(sideInv); sideInv.connect(merge, 0, 1);
  merge.connect(out);
  const set = (w: number, t?: number) => { t === undefined ? (sideAmt.gain.value = w) : glide(sideAmt.gain, w, t); };
  set(width);
  return set;
}

const VOICE_RECIPES: { semis: number; hp: number; lp: number; pk: [number, number]; ring: number; ringMix: number; comb: number; combFb: number; trem: number; tremDepth: number; echo: number; echoFb: number; drive: number }[] = [
  { semis: 0, hp: 120, lp: 7000, pk: [1200, 4], ring: 60, ringMix: 0.8, comb: 9, combFb: 0.6, trem: 0, tremDepth: 0, echo: 0, echoFb: 0, drive: 0.2 },
  { semis: 0, hp: 400, lp: 3200, pk: [1500, 6], ring: 0, ringMix: 0, comb: 0, combFb: 0, trem: 0, tremDepth: 0, echo: 0, echoFb: 0, drive: 0.45 },
  { semis: 0, hp: 650, lp: 4500, pk: [2000, 9], ring: 0, ringMix: 0, comb: 1.2, combFb: 0.35, trem: 0, tremDepth: 0, echo: 0, echoFb: 0, drive: 0.85 },
  { semis: 0, hp: 250, lp: 4200, pk: [1000, 4], ring: 0, ringMix: 0, comb: 0, combFb: 0, trem: 0.25, tremDepth: 0.2, echo: 0, echoFb: 0, drive: 0.35 },
  { semis: -7, hp: 40, lp: 5000, pk: [300, 6], ring: 0, ringMix: 0, comb: 0, combFb: 0, trem: 0, tremDepth: 0, echo: 0, echoFb: 0, drive: 0.35 },
  { semis: 7, hp: 160, lp: 14000, pk: [3000, 3], ring: 0, ringMix: 0, comb: 0, combFb: 0, trem: 0, tremDepth: 0, echo: 0, echoFb: 0, drive: 0.05 },
  { semis: 3, hp: 150, lp: 9000, pk: [2400, 5], ring: 420, ringMix: 0.5, comb: 4, combFb: 0.45, trem: 6, tremDepth: 0.4, echo: 0, echoFb: 0, drive: 0.15 },
  { semis: 0, hp: 500, lp: 2800, pk: [1800, 8], ring: 0, ringMix: 0, comb: 0, combFb: 0, trem: 0, tremDepth: 0, echo: 0, echoFb: 0, drive: 0.95 },
  { semis: -3, hp: 90, lp: 8000, pk: [900, 4], ring: 140, ringMix: 0.45, comb: 6, combFb: 0.75, trem: 0, tremDepth: 0, echo: 0, echoFb: 0, drive: 0.3 },
  { semis: -2, hp: 300, lp: 6000, pk: [2500, 3], ring: 0, ringMix: 0, comb: 0, combFb: 0, trem: 0.7, tremDepth: 0.55, echo: 180, echoFb: 0.55, drive: 0 },
];

export function buildStudioFx(ctx: BaseAudioContext, pl: PluginInstance, h: FxHelpers): { input: GainNode; output: GainNode } {
  const { val, live } = h;
  const kind = pl.kind as StudioKind;
  const input = ctx.createGain(), output = ctx.createGain();
  const wet = ctx.createGain(), dry = ctx.createGain();
  input.connect(dry); dry.connect(output); wet.connect(output);
  const offline = isOfflineContext(ctx);
  const sources: AudioScheduledSourceNode[] = [];
  const t0 = ctx.currentTime + 0.005;
  const start = <T extends AudioScheduledSourceNode>(s: T) => { s.start(t0); sources.push(s); return s; };
  const cleanups: (() => void)[] = [];
  onDispose(output, () => { for (const s of sources) { try { s.stop(); } catch { /* not started */ } } for (const c of cleanups) c(); });
  const register = (readings?: () => number[], analysers?: AnalyserNode[]) => {
    if (offline) return;
    if (readings) fxReadings.set(pl.id, readings);
    if (analysers) fxAnalysers.set(pl.id, analysers);
    cleanups.push(() => {
      if (readings && fxReadings.get(pl.id) === readings) fxReadings.delete(pl.id);
      if (analysers && fxAnalysers.get(pl.id) === analysers) fxAnalysers.delete(pl.id);
    });
  };
  const mix = (fallback: number) => {
    const set = (m: number, t?: number) => {
      const w = Math.sin((m * Math.PI) / 2), d = Math.cos((m * Math.PI) / 2);
      if (t === undefined) { wet.gain.value = w; dry.gain.value = d; } else { glide(wet.gain, w, t); glide(dry.gain, d, t); }
    };
    set(val("mix", fallback)); live("mix", set);
  };
  const fullWet = () => { wet.gain.value = 1; dry.gain.value = 0; };
  const level = (node: GainNode, id: string, fallback: number) => {
    node.gain.value = db(val(id, fallback));
    live(id, (v, t) => glide(node.gain, db(v), t));
  };
  const gain = (v = 1) => { const g = ctx.createGain(); g.gain.value = v; return g; };
  const bq = (type: BiquadFilterType, f: number, q?: number, g?: number) => {
    const b = ctx.createBiquadFilter(); b.type = type; b.frequency.value = clamp(f, 10, ctx.sampleRate / 2 - 100);
    if (q !== undefined) b.Q.value = q; if (g !== undefined) b.gain.value = g; return b;
  };
  const chain = (...nodes: AudioNode[]) => { for (let i = 0; i < nodes.length - 1; i++) nodes[i]!.connect(nodes[i + 1]!); return nodes[nodes.length - 1]!; };
  const stereoUp = (src: AudioNode) => { const g = ctx.createGain(); g.channelCount = 2; g.channelCountMode = "explicit"; g.channelInterpretation = "speakers"; src.connect(g); return g; };
  const lfo = (rate: number, shape: number, phase: number) => { const o = ctx.createOscillator(); o.setPeriodicWave(lfoWave(ctx, shape, phase)); o.frequency.value = rate; return start(o); };
  const nyq = ctx.sampleRate / 2 - 100;

  switch (kind) {
    case "autofilter": {
      const types: BiquadFilterType[] = ["lowpass", "bandpass", "highpass", "notch"];
      const drive = ctx.createWaveShaper(); drive.oversample = "2x";
      const setDrive = (d: number) => { drive.curve = curve((x) => softClip(x, 1 + d * 8) * (1 - d * 0.25)); };
      setDrive(val("drive", 0.2));
      input.connect(drive);
      const split = ctx.createChannelSplitter(2), merge = ctx.createChannelMerger(2);
      stereoUp(drive).connect(split);
      const mode = () => types[clamp(Math.round(val("mode", 0)), 0, 3)]!;
      const filters = [0, 1].map((ch) => { const f = bq(mode(), val("cutoff", 1200), val("resonance", 4)); split.connect(f, ch); f.connect(merge, 0, ch); return f; });
      merge.connect(wet);
      const lfos = [lfo(val("rate", 1), val("shape", 0), 0), lfo(val("rate", 1), val("shape", 0), val("stereo", 0))];
      const depths = lfos.map((o, i) => { const g = gain(val("depth", 0.5) * 3600); o.connect(g); g.connect(filters[i]!.detune); return g; });
      const env = follower(ctx, input, val("envSpeed", 60));
      const envAmt = gain(val("env", 0.3) * 6000); env.node.connect(envAmt); for (const f of filters) envAmt.connect(f.detune);
      mix(1); level(output, "output", 0);
      live("mode", () => { for (const f of filters) f.type = mode(); });
      live("cutoff", (v, t) => { for (const f of filters) glide(f.frequency, clamp(v, 20, nyq), t); });
      live("resonance", (v, t) => { for (const f of filters) glide(f.Q, v, t); });
      live("drive", (v) => setDrive(v));
      live("rate", (v, t) => { for (const o of lfos) glide(o.frequency, v, t); });
      const waves = () => { lfos[0]!.setPeriodicWave(lfoWave(ctx, val("shape", 0), 0)); lfos[1]!.setPeriodicWave(lfoWave(ctx, val("shape", 0), val("stereo", 0))); };
      live("shape", waves); live("stereo", waves);
      live("depth", (v, t) => { for (const g of depths) glide(g.gain, v * 3600, t); });
      live("env", (v, t) => glide(envAmt.gain, v * 6000, t));
      live("envSpeed", (v, t) => env.set(v, t));
      break;
    }
    case "analogecho": {
      const split = ctx.createChannelSplitter(2), merge = ctx.createChannelMerger(2);
      stereoUp(input).connect(split);
      const dL = ctx.createDelay(2.5), dR = ctx.createDelay(2.5);
      dL.delayTime.value = dR.delayTime.value = val("time", 350) / 1000;
      const pp = () => val("pingpong", 0), fb = () => val("feedback", 0.45);
      const inLL = gain(1), inRR = gain(1 - pp()), inRL = gain(pp());
      split.connect(inLL, 0); split.connect(inRR, 1); split.connect(inRL, 1);
      inLL.connect(dL); inRL.connect(dL); inRR.connect(dR);
      const satL = ctx.createWaveShaper(), satR = ctx.createWaveShaper();
      const setDrive = (d: number) => { const c = curve((x) => softClip(x, 1 + d * 5)); satL.curve = c; satR.curve = c; };
      setDrive(val("drive", 0.3));
      const ageHz = (a: number) => 12000 * (1 - a * 0.82);
      const hpL = bq("highpass", val("lowcut", 100), BW), hpR = bq("highpass", val("lowcut", 100), BW);
      const lpL = bq("lowpass", ageHz(val("age", 0.4)), BW), lpR = bq("lowpass", ageHz(val("age", 0.4)), BW);
      const outL = chain(dL, hpL, lpL, satL), outR = chain(dR, hpR, lpR, satR);
      const fLL = gain(fb() * (1 - pp())), fLR = gain(fb() * pp()), fRR = gain(fb() * (1 - pp())), fRL = gain(fb() * pp());
      outL.connect(fLL); fLL.connect(dL); outL.connect(fLR); fLR.connect(dR);
      outR.connect(fRR); fRR.connect(dR); outR.connect(fRL); fRL.connect(dL);
      outL.connect(merge, 0, 0); outR.connect(merge, 0, 1);
      const setWidth = widthStage(ctx, merge, wet, val("width", 1));
      const mod = lfo(val("modRate", 0.6), 1, 0);
      const modAmt = gain(val("modDepth", 0.25) * 0.003), modInv = gain(-1);
      mod.connect(modAmt); modAmt.connect(dL.delayTime); modAmt.connect(modInv); modInv.connect(dR.delayTime);
      const hiss = start(ctx.createBufferSource()); hiss.buffer = noiseBuffer(ctx, 2, true); hiss.loop = true;
      const hissG = gain(val("age", 0.4) * 0.01); hiss.connect(hissG); hissG.connect(dL); hissG.connect(dR);
      mix(0.3); level(output, "output", 0);
      const route = (t: number) => {
        const f = fb(), q = pp();
        glide(inRR.gain, 1 - q, t); glide(inRL.gain, q, t);
        glide(fLL.gain, f * (1 - q), t); glide(fRR.gain, f * (1 - q), t); glide(fLR.gain, f * q, t); glide(fRL.gain, f * q, t);
      };
      live("time", (v, t) => { glide(dL.delayTime, v / 1000, t, 0.08); glide(dR.delayTime, v / 1000, t, 0.08); });
      live("feedback", (_v, t) => route(t)); live("pingpong", (_v, t) => route(t));
      live("drive", (v) => setDrive(v));
      live("age", (v, t) => { glide(lpL.frequency, ageHz(v), t); glide(lpR.frequency, ageHz(v), t); glide(hissG.gain, v * 0.01, t); });
      live("lowcut", (v, t) => { glide(hpL.frequency, v, t); glide(hpR.frequency, v, t); });
      live("modRate", (v, t) => glide(mod.frequency, v, t));
      live("modDepth", (v, t) => glide(modAmt.gain, v * 0.003, t));
      live("width", (v, t) => setWidth(v, t));
      break;
    }
    case "channelstrip": {
      const hp = bq("highpass", val("lowcut", 20), BW);
      const gateVca = ctx.createGain();
      input.connect(hp); hp.connect(gateVca);
      const det = follower(ctx, hp, 8);
      const gateFn = () => { const thr = val("gate", -80); return (lin: number) => thr <= -79.5 ? 1 : Math.pow(clamp((toDb(lin) - (thr - 6)) / 6, 0, 1), 2); };
      const gate = computer(ctx, det.node, [gateVca.gain], gateFn());
      const comp = ctx.createDynamicsCompressor();
      comp.threshold.value = val("threshold", -18); comp.ratio.value = val("ratio", 2); comp.knee.value = 6;
      comp.attack.value = val("attack", 10) / 1000; comp.release.value = val("release", 120) / 1000;
      const makeup = gain(db(val("makeup", 0)));
      const low = bq("lowshelf", 100, undefined, val("low", 0)), mid = bq("peaking", val("midFreq", 1500), 0.9, val("mid", 0)), high = bq("highshelf", 8000, undefined, val("high", 0));
      chain(gateVca, comp, makeup, low, mid, high, wet);
      fullWet(); level(output, "output", 0);
      const gateRead = reductionReader(ctx, gate.out);
      register(() => [-comp.reduction, gateRead()]);
      live("lowcut", (v, t) => glide(hp.frequency, v, t));
      live("gate", () => gate.reshape(gateFn()));
      live("threshold", (v, t) => glide(comp.threshold, v, t)); live("ratio", (v, t) => glide(comp.ratio, v, t));
      live("attack", (v, t) => glide(comp.attack, v / 1000, t)); live("release", (v, t) => glide(comp.release, v / 1000, t));
      live("makeup", (v, t) => glide(makeup.gain, db(v), t));
      live("low", (v, t) => glide(low.gain, v, t)); live("mid", (v, t) => glide(mid.gain, v, t)); live("high", (v, t) => glide(high.gain, v, t));
      live("midFreq", (v, t) => glide(mid.frequency, v, t));
      break;
    }
    case "stereochorus": {
      const hp = bq("highpass", val("lowcut", 150), BW); input.connect(hp);
      const bus = gain(1); bus.connect(wet);
      const voices = [0, 1, 2, 3].map(() => {
        const d = ctx.createDelay(0.1), lp = bq("lowpass", val("tone", 12000), BW), pan = ctx.createStereoPanner(), g = gain(0);
        hp.connect(d); chain(d, lp, g, pan, bus);
        const o = lfo(val("rate", 0.8), 0, 0), amt = gain(0); o.connect(amt); amt.connect(d.delayTime);
        return { d, lp, pan, g, o, amt };
      });
      const apply = (t?: number) => {
        const n = clamp(Math.round(val("voices", 2)), 1, 4), base = val("delay", 14) / 1000, sw = Math.min(base * 0.8, 0.008) * val("depth", 0.5), sp = val("spread", 0.8);
        voices.forEach((v, i) => {
          const on = i < n; const pan = n === 1 ? 0 : sp * ((i / (n - 1)) * 2 - 1);
          const set = (param: AudioParam, x: number) => t === undefined ? (param.value = x) : glide(param, x, t);
          set(v.g.gain, on ? 1 / Math.sqrt(n) : 0); set(v.pan.pan, pan); set(v.d.delayTime, base + i * 0.0017); set(v.amt.gain, sw);
          v.o.setPeriodicWave(lfoWave(ctx, 0, (i * 360) / n));
        });
      };
      apply(); mix(0.5);
      for (const id of ["voices", "depth", "delay", "spread"]) live(id, (_v, t) => apply(t));
      live("rate", (v, t) => { for (const x of voices) glide(x.o.frequency, v, t); });
      live("lowcut", (v, t) => glide(hp.frequency, v, t));
      live("tone", (v, t) => { for (const x of voices) glide(x.lp.frequency, clamp(v, 100, nyq), t); });
      break;
    }
    case "deesser": {
      const f = () => clamp(val("freq", 6500), 500, nyq);
      const d1 = bq("highpass", f(), BW), d2 = bq("highpass", f(), BW);
      chain(input, d1, d2);
      const env = follower(ctx, d2, val("release", 60) * 0.5);
      const vHigh = ctx.createGain(), vWide = ctx.createGain();
      const fn = () => { const thr = val("threshold", -28), range = val("range", 10); return (lin: number) => { const over = toDb(lin) - thr; return over <= 0 ? 1 : db(-Math.min(range, over * 0.75)); }; };
      const comp = computer(ctx, env.node, [vHigh.gain, vWide.gain], fn());
      const lo1 = bq("lowpass", f(), BW), lo2 = bq("lowpass", f(), BW), hi1 = bq("highpass", f(), BW), hi2 = bq("highpass", f(), BW);
      const splitOut = gain(), wideOut = gain(), listenOut = gain();
      chain(input, lo1, lo2, splitOut); chain(input, hi1, hi2, vHigh, splitOut);
      chain(input, vWide, wideOut); d2.connect(listenOut);
      const post = gain(); splitOut.connect(post); wideOut.connect(post); listenOut.connect(post); post.connect(wet);
      const route = (t?: number) => {
        const L = val("listen", 0) >= 0.5, W = val("mode", 0) >= 0.5;
        const set = (g: GainNode, x: number) => t === undefined ? (g.gain.value = x) : glide(g.gain, x, t);
        set(splitOut, !L && !W ? 1 : 0); set(wideOut, !L && W ? 1 : 0); set(listenOut, L ? 1 : 0);
      };
      route(); fullWet(); level(output, "output", 0);
      const read = reductionReader(ctx, comp.out);
      register(() => [read()]);
      live("freq", (_v, t) => { for (const b of [d1, d2, lo1, lo2, hi1, hi2]) glide(b.frequency, f(), t); });
      live("threshold", () => comp.reshape(fn())); live("range", () => comp.reshape(fn()));
      live("release", (v, t) => env.set(v * 0.5, t));
      live("mode", (_v, t) => route(t)); live("listen", (_v, t) => route(t));
      break;
    }
    case "expander": {
      const env = follower(ctx, input, (val("attack", 5) + val("release", 150)) / 2);
      const vca = ctx.createGain();
      const fn = () => { const thr = val("threshold", -40), ratio = val("ratio", 2), range = val("range", -40); return (lin: number) => { const e = toDb(lin); if (e >= thr) return 1; return db(-Math.min((thr - e) * (ratio - 1), -range)); }; };
      const comp = computer(ctx, env.node, [vca.gain], fn());
      chain(input, vca, wet); fullWet(); level(output, "output", 0);
      const read = reductionReader(ctx, comp.out);
      register(() => [read()]);
      for (const id of ["threshold", "ratio", "range"]) live(id, () => comp.reshape(fn()));
      const tm = (t: number) => env.set((val("attack", 5) + val("release", 150)) / 2, t);
      live("attack", (_v, t) => tm(t)); live("release", (_v, t) => tm(t));
      break;
    }
    case "stereoflanger": {
      const split = ctx.createChannelSplitter(2), merge = ctx.createChannelMerger(2);
      stereoUp(input).connect(split);
      const base = () => val("delay", 3) / 1000 + val("depth", 0.7) * 0.004;
      const lines = [0, 1].map((ch) => {
        const d = ctx.createDelay(0.05); d.delayTime.value = base();
        const fbG = gain(val("feedback", 0.5)); split.connect(d, ch); d.connect(fbG); fbG.connect(d); d.connect(merge, 0, ch);
        const o = lfo(val("rate", 0.3), val("shape", 1), ch ? val("stereo", 90) : 0), amt = gain(val("depth", 0.7) * 0.004);
        o.connect(amt); amt.connect(d.delayTime);
        return { d, fbG, o, amt };
      });
      merge.connect(wet); mix(0.5);
      const depthDelay = (_v: number, t: number) => { for (const l of lines) { glide(l.d.delayTime, base(), t); glide(l.amt.gain, val("depth", 0.7) * 0.004, t); } };
      live("depth", depthDelay); live("delay", depthDelay);
      live("rate", (v, t) => { for (const l of lines) glide(l.o.frequency, v, t); });
      live("feedback", (v, t) => { for (const l of lines) glide(l.fbG.gain, v, t); });
      const waves = () => lines.forEach((l, ch) => l.o.setPeriodicWave(lfoWave(ctx, val("shape", 1), ch ? val("stereo", 90) : 0)));
      live("shape", waves); live("stereo", waves);
      break;
    }
    case "multiband": {
      const f1 = () => clamp(val("lowSplit", 200), 20, nyq), f2 = () => clamp(Math.max(val("highSplit", 3000), val("lowSplit", 200) * 1.5), 20, nyq);
      const l1 = bq("lowpass", f1(), BW), l2 = bq("lowpass", f1(), BW), r1 = bq("highpass", f1(), BW), r2 = bq("highpass", f1(), BW);
      const m1 = bq("lowpass", f2(), BW), m2 = bq("lowpass", f2(), BW), h1 = bq("highpass", f2(), BW), h2 = bq("highpass", f2(), BW);
      const sum = gain();
      const band = (pre: string) => {
        const c = ctx.createDynamicsCompressor(); c.knee.value = 6;
        c.threshold.value = val(`${pre}Thr`, -24); c.ratio.value = val(`${pre}Ratio`, 3);
        c.attack.value = val("attack", 10) / 1000; c.release.value = val("release", 150) / 1000;
        const g = gain(db(val(`${pre}Gain`, 0))); c.connect(g); g.connect(sum);
        live(`${pre}Thr`, (v, t) => glide(c.threshold, v, t)); live(`${pre}Ratio`, (v, t) => glide(c.ratio, v, t)); live(`${pre}Gain`, (v, t) => glide(g.gain, db(v), t));
        return c;
      };
      const [cl, cm, ch] = [band("low"), band("mid"), band("high")];
      chain(input, l1, l2, cl); chain(input, r1, r2); chain(r2, m1, m2, cm); chain(r2, h1, h2, ch);
      sum.connect(wet); fullWet(); level(output, "output", 0);
      register(() => [-cl.reduction, -cm.reduction, -ch.reduction]);
      const splits = (_v: number, t: number) => { for (const b of [l1, l2, r1, r2]) glide(b.frequency, f1(), t); for (const b of [m1, m2, h1, h2]) glide(b.frequency, f2(), t); };
      live("lowSplit", splits); live("highSplit", splits);
      live("attack", (v, t) => { for (const c of [cl, cm, ch]) glide(c.attack, v / 1000, t); });
      live("release", (v, t) => { for (const c of [cl, cm, ch]) glide(c.release, v / 1000, t); });
      break;
    }
    case "mustang": {
      const voice = () => MUSTANG_VOICES[clamp(Math.round(val("model", 0)), 0, 7)]!;
      const cab = () => MUSTANG_CAB_VOICES[clamp(Math.round(val("cabinet", 0)), 0, 3)]!;
      const hp = bq("highpass", voice()[0], BW);
      const s1 = ctx.createWaveShaper(), s2 = ctx.createWaveShaper(), power = ctx.createWaveShaper();
      s1.oversample = s2.oversample = "4x"; power.oversample = "2x";
      const couple = bq("highpass", 110, BW);
      const setGain = () => {
        const [, k1, k2, asym] = voice(); const g = val("gain", 0.5);
        const a = 1 + g * k1, b = 1 + g * k2;
        s1.curve = curve((x) => (x >= 0 ? softClip(x, a) : softClip(x, a * asym)) * 0.9);
        s2.curve = curve((x) => softClip(x, b));
      };
      const setPower = () => { const v = val("volume", 0.5); power.curve = curve((x) => softClip(x * (0.5 + v), 1 + v * 2.5) * (0.85 - v * 0.15)); };
      setGain(); setPower();
      const bass = bq("lowshelf", 120, undefined, val("bass", 0)), vc = bq("peaking", voice()[4], 0.8, voice()[5]);
      const middle = bq("peaking", 700, 0.7, val("middle", 0)), treble = bq("highshelf", 2500, undefined, val("treble", 0));
      const bright = bq("highshelf", 3000, undefined, voice()[6]), presence = bq("highshelf", 4500, undefined, val("presence", 0));
      const cHp = bq("highpass", cab()[0], BW), cLp1 = bq("lowpass", cab()[1], BW), cLp2 = bq("lowpass", cab()[1] * 1.3, BW), cRes = bq("peaking", cab()[2], 1.2, cab()[3]);
      const post = chain(input, hp, s1, couple, s2, bass, vc, middle, treble, bright, power, presence, cHp, cLp1, cLp2, cRes) as BiquadFilterNode;
      post.connect(wet);
      const verb = ctx.createConvolver(); verb.buffer = openAirImpulse(ctx, 4, 0.7, 0.6).tail;
      const send = gain(val("reverb", 0.15) * 0.5); post.connect(send); send.connect(verb); verb.connect(wet);
      fullWet(); level(output, "output", -6);
      live("model", (_v, t) => { const v = voice(); glide(hp.frequency, v[0], t); setGain(); glide(vc.frequency, v[4], t); glide(vc.gain, v[5], t); glide(bright.gain, v[6], t); });
      live("gain", () => setGain()); live("volume", () => setPower());
      live("bass", (v, t) => glide(bass.gain, v, t)); live("middle", (v, t) => glide(middle.gain, v, t)); live("treble", (v, t) => glide(treble.gain, v, t)); live("presence", (v, t) => glide(presence.gain, v, t));
      live("reverb", (v, t) => glide(send.gain, v * 0.5, t));
      live("cabinet", (_v, t) => { const c = cab(); glide(cHp.frequency, c[0], t); glide(cLp1.frequency, c[1], t); glide(cLp2.frequency, c[1] * 1.3, t); glide(cRes.frequency, c[2], t); glide(cRes.gain, c[3], t); });
      break;
    }
    case "stereophaser": {
      const n = clamp(Math.round(val("stages", 6)), 2, 12);
      const split = ctx.createChannelSplitter(2), merge = ctx.createChannelMerger(2);
      stereoUp(input).connect(split);
      const all: BiquadFilterNode[] = [];
      const lfos = [0, 1].map((ch) => {
        const stages = Array.from({ length: n }, (_, i) => bq("allpass", val("center", 900) * (1 + i * 0.12), val("sharpness", 1)));
        all.push(...stages);
        split.connect(stages[0]!, ch); chain(...stages); stages[n - 1]!.connect(merge, 0, ch);
        const o = lfo(val("rate", 0.4), 0, ch ? val("stereo", 90) : 0), amt = gain(val("depth", 0.7) * 2400);
        o.connect(amt); for (const s of stages) amt.connect(s.detune);
        return { o, amt };
      });
      merge.connect(wet); mix(0.5);
      live("rate", (v, t) => { for (const l of lfos) glide(l.o.frequency, v, t); });
      live("depth", (v, t) => { for (const l of lfos) glide(l.amt.gain, v * 2400, t); });
      live("center", (v, t) => all.forEach((s, i) => glide(s.frequency, clamp(v * (1 + (i % n) * 0.12), 20, nyq), t)));
      live("sharpness", (v, t) => { for (const s of all) glide(s.Q, v, t); });
      live("stereo", (v) => lfos[1]!.o.setPeriodicWave(lfoWave(ctx, 0, v)));
      break;
    }
    case "splitter": {
      const up = stereoUp(input);
      const f1 = () => clamp(val("split1", 250), 20, nyq), f2 = () => clamp(Math.max(val("split2", 3000), val("split1", 250) * 1.5), 20, nyq);
      const l1 = bq("lowpass", f1(), BW), l2 = bq("lowpass", f1(), BW), r1 = bq("highpass", f1(), BW), r2 = bq("highpass", f1(), BW);
      const m1 = bq("lowpass", f2(), BW), m2 = bq("lowpass", f2(), BW), h1 = bq("highpass", f2(), BW), h2 = bq("highpass", f2(), BW);
      chain(up, l1, l2); chain(up, r1, r2); chain(r2, m1, m2); chain(r2, h1, h2);
      const split = ctx.createChannelSplitter(2); up.connect(split);
      const leftM = ctx.createChannelMerger(2), rightM = ctx.createChannelMerger(2);
      split.connect(leftM, 0, 0); split.connect(rightM, 1, 1);
      const midG = gain(0.5); split.connect(midG, 0); split.connect(midG, 1);
      const sL = gain(0.5), sR = gain(-0.5), side = gain(), sideInv = gain(-1), sideM = ctx.createChannelMerger(2);
      split.connect(sL, 0); split.connect(sR, 1); sL.connect(side); sR.connect(side);
      side.connect(sideM, 0, 0); side.connect(sideInv); sideInv.connect(sideM, 0, 1);
      const paths = ["A", "B", "C"].map((k) => {
        const sum = gain(), lvl = gain(), pan = ctx.createStereoPanner();
        chain(sum, lvl, pan, wet);
        const setLvl = (v: number, t?: number) => { const g = v <= -59.5 ? 0 : db(v); t === undefined ? (lvl.gain.value = g) : glide(lvl.gain, g, t); };
        setLvl(val(`level${k}`, 0)); pan.pan.value = val(`pan${k}`, 0);
        live(`level${k}`, (v, t) => setLvl(v, t)); live(`pan${k}`, (v, t) => glide(pan.pan, v, t));
        return sum;
      });
      const taps: [AudioNode, number, number][] = [[l2, 0, 0], [m2, 1, 0], [h2, 2, 0], [leftM, 0, 1], [rightM, 1, 1], [midG, 0, 2], [sideM, 1, 2]];
      const gates = taps.map(([src, path]) => { const g = gain(0); src.connect(g); g.connect(paths[path]!); return g; });
      const route = (t?: number) => { const m = clamp(Math.round(val("mode", 0)), 0, 2); taps.forEach(([, , mode], i) => { const x = mode === m ? 1 : 0; t === undefined ? (gates[i]!.gain.value = x) : glide(gates[i]!.gain, x, t); }); };
      route(); fullWet(); level(output, "output", 0);
      live("mode", (_v, t) => route(t));
      const splits = (_v: number, t: number) => { for (const b of [l1, l2, r1, r2]) glide(b.frequency, f1(), t); for (const b of [m1, m2, h1, h2]) glide(b.frequency, f2(), t); };
      live("split1", splits); live("split2", splits);
      break;
    }
    case "vocaltune": {
      if (!vocalTuneReady(ctx)) {
        // Audio passes untouched until the worklet has loaded, then the chain rebuilds with correction.
        input.connect(output); wet.gain.value = 0; dry.gain.value = 0;
        ensureVocalTune(ctx).then(() => h.rebuild?.()).catch(() => { /* browser without AudioWorklet: stays a clean pass-through */ });
        break;
      }
      const ids = ["key", "scale", "speed", "amount", "humanize", "transpose", "fine", "output"] as const;
      const fallback: Record<string, number> = { key: 0, scale: 1, speed: 40, amount: 1, humanize: 0.3, transpose: 0, fine: 0, output: 0 };
      const params: Record<string, number> = {};
      for (const id of ids) params[id] = val(id, fallback[id]!);
      const node = new AudioWorkletNode(ctx, VOCAL_TUNE_PROCESSOR, { numberOfInputs: 1, numberOfOutputs: 1, outputChannelCount: [2], channelCount: 2, channelCountMode: "explicit", channelInterpretation: "speakers", processorOptions: { params, report: !offline } });
      input.connect(node); node.connect(wet); fullWet();
      if (!offline) {
        node.port.onmessage = (e) => tuneReadings.set(pl.id, e.data);
        cleanups.push(() => tuneReadings.delete(pl.id));
      }
      cleanups.push(() => node.port.postMessage({ type: "stop" }));
      for (const id of ids) live(id, (v) => node.port.postMessage({ type: "set", id, value: v }));
      break;
    }
    case "voicefx": {
      const rec = () => VOICE_RECIPES[clamp(Math.round(val("character", 0)), 0, VOICE_RECIPES.length - 1)]!;
      const shifted = gain();
      const setPitch = shifter(ctx, input, shifted, rec().semis + val("pitch", 0), (o) => sources.push(o));
      const hp = bq("highpass", rec().hp, BW), lp = bq("lowpass", rec().lp, BW), pk = bq("peaking", rec().pk[0], 1.2, rec().pk[1]);
      const tLow = bq("lowshelf", 250, undefined, 0), tHigh = bq("highshelf", 2500, undefined, 0);
      const ring = gain(1), ringOsc = start(ctx.createOscillator()), ringAmt = gain(0); ringOsc.connect(ringAmt); ringAmt.connect(ring.gain);
      const comb = ctx.createDelay(0.05), combFb = gain(0), combWet = gain(0), combSum = gain();
      const drive = ctx.createWaveShaper(); drive.oversample = "2x";
      const trem = gain(1), tremOsc = start(ctx.createOscillator()), tremAmt = gain(0); tremOsc.connect(tremAmt); tremAmt.connect(trem.gain);
      const post = gain();
      chain(shifted, hp, lp, pk, tLow, tHigh, ring);
      ring.connect(combSum); ring.connect(comb); comb.connect(combFb); combFb.connect(comb); comb.connect(combWet); combWet.connect(combSum);
      chain(combSum, drive, trem, post, wet);
      const echo = ctx.createDelay(1), echoFb = gain(0), echoWet = gain(0);
      post.connect(echo); echo.connect(echoFb); echoFb.connect(echo); echo.connect(echoWet); echoWet.connect(wet);
      const apply = (t?: number) => {
        const r = rec(), a = val("amount", 0.6), tone = val("tone", 0), dr = clamp(r.drive * 0.6 + val("drive", 0.3) * 0.6, 0, 1);
        const set = (param: AudioParam, x: number) => t === undefined ? (param.value = x) : glide(param, x, t);
        setPitch(r.semis + val("pitch", 0), t);
        set(hp.frequency, 20 + (r.hp - 20) * (0.3 + a * 0.7)); set(lp.frequency, clamp(r.lp + (18000 - r.lp) * (1 - a) * 0.6, 200, nyq));
        set(pk.frequency, r.pk[0]); set(pk.gain, r.pk[1] * a);
        set(tLow.gain, -tone * 8); set(tHigh.gain, tone * 9);
        const rm = r.ringMix * a; set(ring.gain, 1 - rm); set(ringAmt.gain, rm); set(ringOsc.frequency, Math.max(1, r.ring));
        set(comb.delayTime, Math.max(0.0005, r.comb / 1000)); set(combFb.gain, r.combFb * a); set(combWet.gain, r.comb > 0 ? 0.6 * a : 0);
        const td = r.tremDepth * a; set(trem.gain, 1 - td / 2); set(tremAmt.gain, td / 2); set(tremOsc.frequency, Math.max(0.1, r.trem));
        set(echo.delayTime, Math.max(0.001, r.echo / 1000)); set(echoFb.gain, r.echoFb * a); set(echoWet.gain, r.echo > 0 ? 0.5 * a : 0);
        drive.curve = curve((x) => softClip(x, 1 + dr * 12) * (1 - dr * 0.35));
      };
      apply(); mix(1); level(output, "output", 0);
      for (const id of ["character", "pitch", "amount", "tone", "drive"]) live(id, (_v, t) => apply(t));
      break;
    }
    case "vumeter": {
      const trim = gain(db(val("trim", 0)));
      input.connect(trim); trim.connect(wet); fullWet();
      const split = ctx.createChannelSplitter(2);
      stereoUp(trim).connect(split);
      const aL = ctx.createAnalyser(), aR = ctx.createAnalyser(); aL.fftSize = aR.fftSize = 2048;
      split.connect(aL, 0); split.connect(aR, 1);
      register(undefined, [aL, aR]);
      live("trim", (v, t) => glide(trim.gain, db(v), t));
      live("reference", () => {}); live("response", () => {});
      break;
    }
    case "tuner": {
      const an = ctx.createAnalyser(); an.fftSize = 4096; input.connect(an);
      const thru = gain(val("mute", 0) >= 0.5 ? 0 : 1); input.connect(thru); thru.connect(wet); fullWet();
      register(undefined, [an]);
      live("mute", (v, t) => glide(thru.gain, v >= 0.5 ? 0 : 1, t));
      live("reference", () => {}); live("range", () => {});
      break;
    }
    case "tonegen": {
      const osc = start(ctx.createOscillator());
      const white = start(ctx.createBufferSource()); white.buffer = noiseBuffer(ctx, 3, false); white.loop = true;
      const pink = start(ctx.createBufferSource()); pink.buffer = noiseBuffer(ctx, 3, true); pink.loop = true;
      const oG = gain(0), wG = gain(0), pG = gain(0), lvl = gain(db(val("level", -18)));
      osc.connect(oG); white.connect(wG); pink.connect(pG);
      for (const g of [oG, wG, pG]) g.connect(lvl);
      lvl.connect(wet); wet.gain.value = 1;
      const types: OscillatorType[] = ["sine", "triangle", "sawtooth", "square"];
      const setWave = (t?: number) => {
        const w = clamp(Math.round(val("wave", 0)), 0, 5);
        if (w < 4) osc.type = types[w]!;
        const set = (g: GainNode, x: number) => t === undefined ? (g.gain.value = x) : glide(g.gain, x, t);
        // Square/saw carry more energy than a sine; trim so the dBFS level stays honest.
        set(oG, w < 4 ? [1, 1, 0.55, 0.5][w]! : 0); set(wG, w === 4 ? 1.7 : 0); set(pG, w === 5 ? 1.7 : 0);
      };
      setWave();
      osc.frequency.value = clamp(val("frequency", 440), 20, nyq); osc.detune.value = val("fine", 0);
      dry.gain.value = val("thru", 1) >= 0.5 ? 1 : 0;
      live("wave", (_v, t) => setWave(t));
      live("frequency", (v, t) => glide(osc.frequency, clamp(v, 20, nyq), t, 0.03));
      live("fine", (v, t) => glide(osc.detune, v, t));
      live("level", (v, t) => glide(lvl.gain, db(v), t));
      live("thru", (v, t) => glide(dry.gain, v >= 0.5 ? 1 : 0, t));
      break;
    }
    case "openair": {
      const hp = bq("highpass", val("lowcut", 120), BW), lp = bq("lowpass", clamp(val("highcut", 12000), 500, nyq), BW);
      const pre = ctx.createDelay(1); pre.delayTime.value = val("predelay", 15) / 1000;
      chain(input, hp, lp, pre);
      const eG = gain(val("early", 0.6) * 0.6), tG = gain(val("tail", 0.8)), sum = gain();
      eG.connect(sum); tG.connect(sum);
      const setWidth = widthStage(ctx, sum, wet, val("width", 1));
      let convs: ConvolverNode[] = [];
      const load = () => {
        const ir = openAirImpulse(ctx, val("space", 3), val("size", 1), val("damping", 0.4));
        const e = ctx.createConvolver(), tl = ctx.createConvolver();
        e.buffer = ir.early; tl.buffer = ir.tail;
        pre.connect(e); pre.connect(tl); e.connect(eG); tl.connect(tG);
        const old = convs; convs = [e, tl];
        for (const c of old) { try { pre.disconnect(c); } catch { /* gone */ } }
        if (!offline && old.length) setTimeout(() => old.forEach((c) => c.disconnect()), 6000);
      };
      load();
      let timer: ReturnType<typeof setTimeout> | undefined;
      const reload = () => { if (timer) clearTimeout(timer); timer = setTimeout(load, 120); };
      cleanups.push(() => timer && clearTimeout(timer));
      mix(0.3); level(output, "output", 0);
      live("space", reload); live("size", reload); live("damping", reload);
      live("predelay", (v, t) => glide(pre.delayTime, v / 1000, t, 0.05));
      live("early", (v, t) => glide(eG.gain, v * 0.6, t)); live("tail", (v, t) => glide(tG.gain, v, t));
      live("width", (v, t) => setWidth(v, t));
      live("lowcut", (v, t) => glide(hp.frequency, v, t)); live("highcut", (v, t) => glide(lp.frequency, clamp(v, 500, nyq), t));
      break;
    }
  }
  return { input, output };
}
