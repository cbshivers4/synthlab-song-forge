import type { PluginInstance, PluginKind, PluginParam } from "./types";
import { PARAMS_BY_KIND, withDefaultParams } from "./plugins";

export interface EffectPreset { id: string; name: string; values: Record<string, number> }
type Recipe = [name: string, values: Record<string, number>];
const RECIPES: Record<PluginKind, Recipe[]> = {
  eq: [["Vocal Clarity", { low: -3, mid: 2, midFreq: 2400, high: 3 }], ["Warm Bass", { low: 4, mid: -2, midFreq: 600, high: -3 }], ["Drum Punch", { low: 3, mid: -3, midFreq: 450, high: 2 }], ["Soft Air", { high: 4, mid: -1 }]],
  paraeq: [["Vocal Presence", { b1freq: 85, b3on: 1, b3freq: 300, b3gain: -3, b5on: 1, b5freq: 3000, b5gain: 2.5, b7on: 1, b7gain: 2 }], ["Kick Definition", { b1freq: 28, b2on: 1, b2freq: 65, b2gain: 3, b4on: 1, b4freq: 400, b4gain: -4 }], ["Bass Focus", { b1freq: 30, b3on: 1, b3freq: 180, b3gain: -2, b8freq: 8000 }], ["Mix Polish", { b1freq: 25, b4on: 1, b4freq: 600, b4gain: -1.5, b7on: 1, b7gain: 1.5 }]],
  filter: [["Warm Low Pass", { cutoff: 2400, resonance: 1.5 }], ["Telephone", { type: 2, cutoff: 1400, resonance: 2 }], ["Sub Cleanup", { type: 1, cutoff: 100, resonance: 0.7 }], ["Acid Resonance", { cutoff: 900, resonance: 8, mix: 0.8 }]],
  drive: [["Tube Warmth", { drive: 0.18, tone: 6500, mix: 0.6, output: -2 }], ["Bass Grit", { drive: 0.55, tone: 2800, mix: 0.65, output: -4 }], ["Drum Crunch", { drive: 0.7, tone: 7000, mix: 0.45, output: -5 }], ["Soft Saturation", { drive: 0.1, tone: 10000, mix: 0.4 }]],
  compressor: [["Vocal Leveler", { threshold: -24, ratio: 3, attack: 12, release: 180, makeup: 3 }], ["Drum Glue", { threshold: -16, ratio: 4, attack: 25, release: 100, makeup: 2 }], ["Bass Control", { threshold: -22, ratio: 5, attack: 15, release: 220, makeup: 3 }], ["Gentle Bus", { threshold: -12, ratio: 2, attack: 30, release: 250, knee: 12 }]],
  delay: [["Vocal Slap", { time: 95, feedback: 0.12, mix: 0.18, tone: 6500 }], ["Wide Echo", { time: 420, feedback: 0.42, mix: 0.28 }], ["Dub Repeats", { time: 600, feedback: 0.72, mix: 0.35, tone: 3500, lowcut: 180 }], ["Short Rhythm", { time: 180, feedback: 0.3, mix: 0.22 }]],
  gain: [["Quiet Trim", { gain: -6 }], ["Left Utility", { pan: -1 }], ["Right Utility", { pan: 1 }], ["Invert Polarity", { phase: 1 }]],
  width: [["Mono Focus", { width: 0 }], ["Narrow Image", { width: 0.5 }], ["Wide Mix", { width: 1.4, output: -1 }], ["Extra Wide", { width: 1.8, output: -2 }]],
  reverb: [["Small Room", { decay: 0.55, predelay: 8, mix: 0.2, tone: 7000 }], ["Vocal Plate", { decay: 1.6, predelay: 40, mix: 0.25, lowcut: 180 }], ["Large Hall", { decay: 3.8, predelay: 35, mix: 0.35 }], ["Dark Atmosphere", { decay: 6, predelay: 70, mix: 0.5, tone: 3200 }]],
  chorus: [["Gentle Ensemble", { rate: 0.6, depth: 0.3, mix: 0.3 }], ["Wide Synth", { rate: 1.1, depth: 0.65, delay: 28, mix: 0.55 }], ["Bass Chorus", { rate: 0.4, depth: 0.25, mix: 0.25, delay: 12 }], ["Deep Motion", { rate: 2.4, depth: 0.9, feedback: 0.25 }]],
  flanger: [["Slow Jet", { rate: 0.15, depth: 0.85, feedback: 0.65 }], ["Metal Sweep", { rate: 0.8, depth: 0.8, feedback: 0.8, manual: 2 }], ["Subtle Flange", { rate: 0.3, depth: 0.3, mix: 0.25, feedback: 0.2 }], ["Fast Spin", { rate: 2.5, depth: 0.7, manual: 6 }]],
  phaser: [["Vintage Four", { rate: 0.3, depth: 0.7, stages: 4 }], ["Deep Eight", { rate: 0.4, depth: 0.9, stages: 8, resonance: 2 }], ["Funky Keys", { rate: 1.5, depth: 0.65, center: 1200 }], ["Slow Space", { rate: 0.1, depth: 0.8, center: 500, mix: 0.4 }]],
  tremolo: [["Gentle Pulse", { rate: 3, depth: 0.3 }], ["Chopped Rhythm", { rate: 8, depth: 1, shape: 1 }], ["Vintage Trem", { rate: 5.5, depth: 0.65 }], ["Slow Swell", { rate: 0.7, depth: 0.8, shape: 2 }]],
  autopan: [["Slow Drift", { rate: 0.2, depth: 0.7 }], ["Rhythm Pan", { rate: 2, depth: 0.8 }], ["Hard Alternation", { rate: 4, depth: 1, shape: 1 }], ["Gentle Movement", { rate: 0.6, depth: 0.3 }]],
  limiter: [["Safe Ceiling", { ceiling: -1, release: 100 }], ["Loud Preview", { ceiling: -1, input: 4, release: 80 }], ["Drum Safety", { ceiling: -0.8, release: 35 }], ["Soft Master", { ceiling: -1.5, input: 2, release: 180 }]],
  bitcrusher: [["Twelve Bit", { bits: 12, mix: 0.65 }], ["Eight Bit Arcade", { bits: 8, mix: 0.8, tone: 7000 }], ["Lo-Fi Drums", { bits: 6, mix: 0.4, tone: 5000 }], ["Broken Signal", { bits: 3, mix: 0.65, output: -3 }]],
  vocoder: [["Robot Voice", { carrier: 1, pitch: 110, bands: 16, detune: 8 }], ["Electro Choir", { carrier: 0, pitch: 220, unison: 5, detune: 22, mix: 0.9 }], ["Whisper Machine", { carrier: 2, bands: 24, sibilance: 0.6, response: 8 }], ["Dark Android", { pitch: 65, formant: -5, tone: 4500, response: 35 }]],
  gate: [["Vocal Cleanup", { threshold: -48, attack: 3, release: 180, range: -40 }], ["Tight Drums", { threshold: -30, attack: 0.5, release: 60 }], ["Soft Expander", { threshold: -55, release: 250, range: -18 }], ["Hard Gate", { threshold: -24, attack: 1, release: 35 }]],
  stepfilter: [["Electro Pulse", { rate: 8, cutoff: 6500, depth: 0.9, swing: 0.15 }], ["Techno Steps", { rate: 12, resonance: 7, cutoff: 4000, smooth: 0.015 }], ["Slow Sequence", { rate: 2, cutoff: 9000, depth: 0.65, smooth: 0.12 }], ["Broken Rhythm", { rate: 6, swing: 0.4, s2: 0.8, s3: 0.1, s5: 0.4, s7: 1 }]],
  resonator: [["Warm Body", { root: 43, spread: 0.2, decay: 1.2, damping: 0.6 }], ["Metal Bells", { root: 60, spread: 0.7, decay: 3.2, damping: 0.2 }], ["Deep Chamber", { root: 36, decay: 4, mix: 0.45 }], ["Short Wood", { root: 55, spread: 0.1, decay: 0.35, damping: 0.8 }]],
  scalechord: [["Minor Triads", { scale: 1, chord: 2 }], ["Major Sevenths", { chord: 3, inversion: 1 }], ["Minor Sevenths", { scale: 1, chord: 4 }], ["Open Fifths", { scale: 3, chord: 5, range: 2 }]],
  transient: [["Drum Punch", { attack: 0.65, sustain: -0.2 }], ["Soft Attack", { attack: -0.5, sustain: 0.15 }], ["Tight Percussion", { attack: 0.4, sustain: -0.65 }], ["Long Sustain", { attack: 0.15, sustain: 0.6, mix: 0.65 }]],
};
const TAPE_RECIPES: Recipe[] = [["Vintage Slap", { time: 110, feedback: 0.18, tone: 4200, mix: 0.2 }], ["Dub Tape", { time: 540, feedback: 0.7, tone: 2800, lowcut: 200, mix: 0.35 }], ["Warm Repeats", { time: 360, feedback: 0.4, tone: 5000, mix: 0.25 }], ["Long Tape Trail", { time: 800, feedback: 0.6, tone: 3200, mix: 0.3 }]];

export function effectPresets(plugin: Pick<PluginInstance, "kind" | "name">): EffectPreset[] {
  const defaults = Object.fromEntries(PARAMS_BY_KIND[plugin.kind]().map(p => [p.id, p.value]));
  const recipes = plugin.kind === "delay" && plugin.name.toLowerCase().includes("echo") ? TAPE_RECIPES : RECIPES[plugin.kind];
  return [["Default", {}] as Recipe, ...recipes].map(([name, values], index) => ({ id: `${plugin.kind}:${name}:${index}`, name, values: { ...defaults, ...values } }));
}

/** Match parameter values rather than local selection, so manual saves and all editors agree. */
export function currentEffectPreset(plugin: PluginInstance): EffectPreset | undefined {
  const params = withDefaultParams(plugin);
  return effectPresets(plugin).find(preset => params.every(p => preset.values[p.id] !== undefined && Math.abs(p.value - (preset.values[p.id] ?? 0)) < 0.000001));
}

export function effectPresetParams(plugin: PluginInstance, presetId: string): PluginParam[] | undefined {
  const preset = effectPresets(plugin).find(p => p.id === presetId);
  if (!preset) return undefined;
  return withDefaultParams(plugin).map(p => ({ ...p, value: Math.max(p.min, Math.min(p.max, preset.values[p.id] ?? p.value)) }));
}