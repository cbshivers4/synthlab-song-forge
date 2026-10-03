// Controller library: manufacturers and devices with their factory-default CC
// layouts. Strips follow track order (strip 1 = first track on the timeline).
// Devices without a known fixed layout are listed as "learn" — their keys play
// notes and any knob can be assigned with MIDI Learn, but nothing is auto-mapped.

export type StripParam = "volume" | "pan" | "solo" | "mute" | "arm";
export type AutoMapHit = { strip: number; param: StripParam };

export type DeviceLook = {
  /** Number of faders, knobs, pads and piano keys drawn in the illustration. */
  faders: number;
  knobs: number;
  pads: number;
  keys: number;
  buttons: number;
  body: string;
  accent: string;
};

export type ControllerProfile = {
  id: string;
  maker: string;
  model: string;
  /** Matches the MIDI port name so the layout applies automatically. */
  port: RegExp;
  look: DeviceLook;
  /** Per-CC mapping, or null when the device is MIDI Learn only. */
  map: Record<number, AutoMapHit> | null;
  summary: string;
};

const range = (ccs: number[], param: StripParam) =>
  Object.fromEntries(ccs.map((cc, strip) => [cc, { strip, param }])) as Record<number, AutoMapHit>;
const seq = (from: number, n = 8) => Array.from({ length: n }, (_, i) => from + i);

export const CONTROLLERS: ControllerProfile[] = [
  {
    id: "korg-nanokontrol2", maker: "Korg", model: "nanoKONTROL2",
    port: /nano\s*kontrol\s*2/i,
    look: { faders: 8, knobs: 8, pads: 0, keys: 0, buttons: 24, body: "#1b1c1f", accent: "#e8e8e8" },
    map: { ...range(seq(0), "volume"), ...range(seq(16), "pan"), ...range(seq(32), "solo"), ...range(seq(48), "mute"), ...range(seq(64), "arm") },
    summary: "Faders = volume, knobs = pan, S / M / R = solo, mute, arm for tracks 1–8.",
  },
  {
    id: "korg-nanokontrol", maker: "Korg", model: "nanoKONTROL (original)",
    port: /nano\s*kontrol(?!\s*2)/i,
    look: { faders: 9, knobs: 9, pads: 0, keys: 0, buttons: 18, body: "#2a2b2f", accent: "#d0d0d0" },
    map: { ...range([2, 3, 4, 5, 6, 8, 9, 12, 13], "volume"), ...range([14, 15, 16, 17, 18, 19, 20, 21, 22], "pan") },
    summary: "Scene 1: faders = volume, knobs = pan for tracks 1–9.",
  },
  {
    id: "korg-nanokey", maker: "Korg", model: "nanoKEY2 / microKEY",
    port: /nano\s*key|micro\s*key/i,
    look: { faders: 0, knobs: 0, pads: 0, keys: 25, buttons: 4, body: "#1b1c1f", accent: "#ffffff" },
    map: null, summary: "Keys play the armed instrument. Assign extras with MIDI Learn.",
  },
  {
    id: "akai-midimix", maker: "Akai Professional", model: "MIDImix",
    port: /midi\s*mix/i,
    look: { faders: 9, knobs: 24, pads: 0, keys: 0, buttons: 16, body: "#26272b", accent: "#e23a3a" },
    map: { ...range([19, 23, 27, 31, 49, 53, 57, 61], "volume"), ...range([16, 20, 24, 28, 46, 50, 54, 58], "pan") },
    summary: "Faders = volume, top knob row = pan for tracks 1–8.",
  },
  {
    id: "akai-mpk-mini", maker: "Akai Professional", model: "MPK Mini (mk3)",
    port: /mpk\s*mini/i,
    look: { faders: 0, knobs: 8, pads: 8, keys: 25, buttons: 6, body: "#1c1c1e", accent: "#e23a3a" },
    map: range(seq(70), "volume"),
    summary: "Factory program: knobs 1–8 = volume for tracks 1–8; keys play the armed instrument.",
  },
  {
    id: "akai-apc-key", maker: "Akai Professional", model: "APC / MPD series",
    port: /apc|mpd/i,
    look: { faders: 0, knobs: 8, pads: 16, keys: 0, buttons: 8, body: "#1c1c1e", accent: "#e23a3a" },
    map: null, summary: "Pads play notes. Assign knobs with MIDI Learn.",
  },
  {
    id: "novation-lcxl", maker: "Novation", model: "Launch Control XL",
    port: /launch\s*control\s*xl/i,
    look: { faders: 8, knobs: 24, pads: 0, keys: 0, buttons: 16, body: "#121214", accent: "#ff8a00" },
    map: { ...range(seq(77), "volume"), ...range(seq(49), "pan") },
    summary: "Factory template 1: faders = volume, bottom knob row = pan for tracks 1–8.",
  },
  {
    id: "novation-launchkey", maker: "Novation", model: "Launchkey",
    port: /launchkey/i,
    look: { faders: 9, knobs: 8, pads: 16, keys: 49, buttons: 8, body: "#121214", accent: "#ff8a00" },
    map: null, summary: "Keys and pads play notes. Assign knobs and faders with MIDI Learn.",
  },
  {
    id: "behringer-xtouch-mini", maker: "Behringer", model: "X-Touch Mini",
    port: /x-?touch\s*mini/i,
    look: { faders: 1, knobs: 8, pads: 0, keys: 0, buttons: 16, body: "#202124", accent: "#f2c200" },
    map: range(seq(1), "volume"),
    summary: "Layer A (MC mode off): knobs 1–8 = volume for tracks 1–8.",
  },
  {
    id: "arturia-keylab", maker: "Arturia", model: "KeyLab / MiniLab",
    port: /keylab|minilab|beatstep/i,
    look: { faders: 0, knobs: 8, pads: 8, keys: 25, buttons: 4, body: "#ececec", accent: "#1a1a1a" },
    map: null, summary: "Keys and pads play notes. Assign knobs with MIDI Learn.",
  },
  {
    id: "ni-komplete", maker: "Native Instruments", model: "Komplete Kontrol / Maschine",
    port: /komplete|maschine|kontrol\s*s/i,
    look: { faders: 0, knobs: 8, pads: 0, keys: 49, buttons: 8, body: "#151517", accent: "#cfcfcf" },
    map: null, summary: "Keys play notes in MIDI mode. Assign knobs with MIDI Learn.",
  },
  {
    id: "maudio-oxygen", maker: "M-Audio", model: "Oxygen / Keystation",
    port: /oxygen|keystation/i,
    look: { faders: 9, knobs: 8, pads: 8, keys: 49, buttons: 6, body: "#1d1d20", accent: "#3aa0ff" },
    map: null, summary: "Keys play notes. Assign faders and knobs with MIDI Learn.",
  },
  {
    id: "generic", maker: "Other / Generic", model: "Any class-compliant MIDI device",
    port: /$^/,
    look: { faders: 4, knobs: 4, pads: 0, keys: 25, buttons: 2, body: "#222327", accent: "#8a8f98" },
    map: null, summary: "Keys play notes. Assign any knob or fader with MIDI Learn.",
  },
];

export const MAKERS = Array.from(new Set(CONTROLLERS.map((c) => c.maker)));

const KEY = "synclab.midi.controller";
const AUTO = "auto";

/** The chosen profile id, or "auto" to detect from the port name. */
export function chosenControllerId(): string {
  if (typeof window === "undefined") return AUTO;
  return window.localStorage.getItem(KEY) ?? AUTO;
}
export function setChosenControllerId(id: string) {
  try { window.localStorage.setItem(KEY, id); } catch { /* storage unavailable */ }
}

export function resolveController(portName: string | undefined): ControllerProfile | null {
  const id = chosenControllerId();
  if (id === "off") return null;
  if (id !== AUTO) return CONTROLLERS.find((c) => c.id === id) ?? null;
  return portName ? CONTROLLERS.find((c) => c.port.test(portName)) ?? null : null;
}

export function controllerAutoMap(portName: string | undefined, cc: number): AutoMapHit | null {
  return resolveController(portName)?.map?.[cc] ?? null;
}
