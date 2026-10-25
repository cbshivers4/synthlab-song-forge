import type { PluginDef, PluginInstance, PluginKind } from "./types";

/** Browser categories for every effect device. */
export const EFFECT_CATEGORIES = [
  "EQ & Filter", "Dynamics", "Distortion & Saturation", "Delay & Reverb", "Modulation",
  "Pitch & Voice", "Stereo & Imaging", "Rhythm & Gate", "Utility",
] as const;
export type EffectCategory = (typeof EFFECT_CATEGORIES)[number];

const CATEGORY: Record<PluginKind, EffectCategory> = {
  eq: "EQ & Filter", paraeq: "EQ & Filter", filter: "EQ & Filter", resonator: "EQ & Filter",
  compressor: "Dynamics", limiter: "Dynamics", gate: "Dynamics", transient: "Dynamics", maximizer: "Dynamics",
  drive: "Distortion & Saturation", bitcrusher: "Distortion & Saturation", demolition: "Distortion & Saturation", distmatrix: "Distortion & Saturation", amp: "Distortion & Saturation", retro: "Distortion & Saturation",
  delay: "Delay & Reverb", reverb: "Delay & Reverb",
  chorus: "Modulation", flanger: "Modulation", phaser: "Modulation", tremolo: "Modulation", modulator: "Modulation", modfx: "Modulation", ensemble: "Modulation", unison: "Modulation",
  vocoder: "Pitch & Voice", pitchvoice: "Pitch & Voice", scalechord: "Pitch & Voice",
  width: "Stereo & Imaging", autopan: "Stereo & Imaging", imager: "Stereo & Imaging",
  stepfilter: "Rhythm & Gate", trigate: "Rhythm & Gate", sidechain: "Rhythm & Gate",
  gain: "Utility",
};
export const effectCategory = (kind: PluginKind): EffectCategory => CATEGORY[kind] ?? "Utility";

/** Catchy SYNCLAB hardware model names, keyed by the device's built-in name. */
const BRANDS: Record<string, string> = {
  "Channel EQ": "Woodward Tone Desk", "Pro-EQ 8": "Octane Precision EQ", "Analog Filter": "Belle Isle Filter",
  "Tube Drive": "Furnace Tube Drive", "Bus Compressor": "Assembly Line Glue", "Stereo Delay": "Twin Tower Delay",
  "Tape Echo": "Motor City Space Echo", "Stereo Width": "Riverwalk Widener", "Utility Gain": "Gauge Utility",
  "Hall Reverb": "Fox Theatre Hall", "Studio Chorus": "Velvet Chorus", "Jet Flanger": "Jet Stream Flanger",
  "Phase Shifter": "Orbit Phase Shifter", "Tremolo": "Pulse Valve Tremolo", "Auto Panner": "Crosstown Panner",
  "Brickwall Limiter": "Brickyard Limiter", "Bit Crusher": "Pixel Grinder", "VX-16 Vintage Vocoder": "VX-16 Robot Choir",
  "Noise Gate": "Night Shift Gate", "Pulse Grid Filter": "Pulse Grid Sequencer", "Harmonic Body": "Harmonic Bell Body",
  "Chord Compass": "Chord Compass", "Transient Architect": "Transient Architect", "FX Modulator": "Wobble Factory",
  "Mod Engine": "Mod Engine 3000", "Retro Transformer": "Time Machine Retro", "Triple Filter Gate": "Tri-Band Chopper",
  "Demolition Unit": "Wrecking Ball Demolisher", "Pitch & Voice Synth": "Shapeshifter Voice", "Maximizer": "Loudness Overdrive",
  "Stereo Imager": "Panorama Imager", "Unison Expander": "Army of Eight", "Guitar & Bass Amp": "Eight Mile Amp Stack",
  "Chorus Ensemble": "Symphony Ensemble", "Sidechain Pump": "Pump Station", "Distortion Matrix": "Chaos Matrix",
};
export const effectBrand = (plugin: Pick<PluginInstance | PluginDef, "name">) => BRANDS[plugin.name] ?? plugin.name;

/** Where each device places its display window, so units do not share one layout. */
const POSITIONS = ["left", "right", "top", "bottom", "center"] as const;
export type DisplayPosition = (typeof POSITIONS)[number];
export function displayPosition(plugin: Pick<PluginInstance, "kind" | "name">): DisplayPosition {
  const key = `${plugin.kind}:${plugin.name}`;
  let h = 0;
  for (let i = 0; i < key.length; i++) h = (h * 31 + key.charCodeAt(i)) >>> 0;
  return POSITIONS[h % POSITIONS.length]!;
}

export function groupByCategory<T extends { kind: PluginKind }>(items: T[]): [EffectCategory, T[]][] {
  return EFFECT_CATEGORIES.map(c => [c, items.filter(i => effectCategory(i.kind) === c)] as [EffectCategory, T[]]).filter(([, list]) => list.length > 0);
}
