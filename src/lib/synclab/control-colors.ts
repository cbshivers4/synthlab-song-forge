/**
 * Device-only colour choices for the hardware controls themselves (never project data): the knob
 * light ring, the knob body, sliders/faders and the device front panel. One set applies to every
 * device; each device may override any part. Applied as one generated <style> so every device —
 * including effects, the mixer and portalled windows — follows without per-component styling.
 */
import { useSyncExternalStore } from "react";
import { inkFor } from "./color-prefs";

export type ControlPart = "ring" | "body" | "slider" | "face";
/** Unset part = the device keeps its own built-in look for that part. */
export type ControlColors = Partial<Record<ControlPart, string>>;

export const CONTROL_PARTS: { part: ControlPart; label: string; fallback: string }[] = [
  { part: "ring", label: "Knob ring", fallback: "#8ea2ff" },
  { part: "body", label: "Knob body", fallback: "#2b2f38" },
  { part: "slider", label: "Sliders & faders", fallback: "#45c8b5" },
  { part: "face", label: "Front panel", fallback: "#2a2e36" },
];

/**
 * Devices with knobs or sliders, matched by the class/attribute their root already carries.
 * Order matters: a device listed later wins inside one listed earlier (effects inside the mixer,
 * mastering devices inside the effects list).
 */
export const CONTROL_DEVICES = [
  { id: "mixer", label: "Mixer", scope: ".mx-console" },
  { id: "drums", label: "Drum machine", scope: ".drum-hardware" },
  { id: "synth-spec4", label: "Spec 4", scope: '.synth-hardware[data-synth-style="spec4"]' },
  { id: "synth-acid", label: "Acid Bass", scope: '.synth-hardware[data-synth-style="acid"]' },
  { id: "synth-poly", label: "Poly Synth", scope: '.synth-hardware[data-synth-style="poly"]' },
  {
    id: "synth-modular",
    label: "Modular Tech",
    scope: '.synth-hardware[data-synth-style="modular"]',
  },
  {
    id: "synth-granular",
    label: "Granular Synth",
    scope: '.synth-hardware[data-synth-style="granular"]',
  },
  { id: "touch", label: "Touch Synth", scope: ".kaoss-face" },
  { id: "sampler", label: "Sampler", scope: ".sampler-device" },
  { id: "pads", label: "Sample pads", scope: '[data-studio-panel="pads"]' },
  { id: "video", label: "Video Sampler", scope: '[data-skin-panel="video"]' },
  { id: "bass", label: "Bass Generator", scope: '[data-skin-panel="bass"]' },
  { id: "live-drummer", label: "Live Drummer", scope: ".drummer-device:not(.keys-device)" },
  { id: "live-keys", label: "Live Keys", scope: ".keys-device" },
  { id: "dj", label: "DJ Decks", scope: ".dj-device" },
  { id: "looper", label: "Live Looper", scope: '[data-studio-panel="looper"]' },
  { id: "hum", label: "Hum to Beat", scope: '[data-skin-panel="hum"]' },
  { id: "tape", label: "Tape & CD Recorder", scope: '[data-skin-panel="reel"]' },
  { id: "effects", label: "Effects", scope: ".fx-face" },
  { id: "amps", label: "Guitar amps & pedals", scope: ".amproom" },
  { id: "mastering", label: "Mastering", scope: '[data-skin-panel="mastering"]' },
] as const;
export type ControlDeviceId = (typeof CONTROL_DEVICES)[number]["id"];

export interface ControlColorPrefs {
  all: ControlColors;
  devices: Partial<Record<ControlDeviceId, ControlColors>>;
}
export const CONTROL_COLOR_DEFAULTS: ControlColorPrefs = { all: {}, devices: {} };

const HEX = /^#[0-9a-f]{6}$/i;
const PARTS: ControlPart[] = ["ring", "body", "slider", "face"];
const DEVICE_IDS = new Set<string>(CONTROL_DEVICES.map((d) => d.id));

function cleanColors(raw: unknown): ControlColors {
  const r = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  const out: ControlColors = {};
  for (const p of PARTS) {
    const v = r[p];
    if (typeof v === "string" && HEX.test(v.trim())) out[p] = v.trim().toLowerCase();
  }
  return out;
}

/** Never trust stored values: only #rrggbb colours on known parts and devices survive. */
export function sanitizeControlColors(raw: unknown): ControlColorPrefs {
  const r = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  const devices: ControlColorPrefs["devices"] = {};
  const rd = (r["devices"] && typeof r["devices"] === "object" ? r["devices"] : {}) as Record<
    string,
    unknown
  >;
  for (const [id, v] of Object.entries(rd)) {
    if (!DEVICE_IDS.has(id)) continue;
    const c = cleanColors(v);
    if (Object.keys(c).length) devices[id as ControlDeviceId] = c;
  }
  return { all: cleanColors(r["all"]), devices };
}

/** Faces that get the front-panel colour as their background (the scope root or inside it). */
const FACES =
  ".fx-face, .drummer-device, .dj-device, .amproom, .bassgen-device, .kaoss-face, .cassette-deck, .cd-burner, .tape-deck, .mx-console, .hardware-device:not(.studio-wallpaper)";

const mix = (c: string, other: string, pct: number) =>
  `color-mix(in oklab, ${c} ${100 - pct}%, ${other} ${pct}%)`;

function rulesFor(scope: string, c: ControlColors): string {
  const w = `:where(${scope})`;
  const out: string[] = [];
  if (c.ring) out.push(`${w} .hardware-knob { --knob-accent: ${c.ring} !important; }`);
  if (c.body)
    out.push(
      `${w} .hardware-knob { --knob-body-hi: ${mix(c.body, "white", 22)} !important; --knob-body-lo: ${mix(c.body, "black", 55)} !important; --knob-cap-hi: ${mix(c.body, "white", 8)} !important; --knob-cap-lo: ${mix(c.body, "black", 35)} !important; --knob-mark: ${inkFor(c.body)} !important; }`,
    );
  if (c.slider)
    out.push(
      `${w} .ui-slider-range { background: ${c.slider} !important; }`,
      `${w} .ui-slider-track { background: ${mix(c.slider, "transparent", 72)} !important; }`,
      `${w} .ui-slider-thumb { background: linear-gradient(180deg, ${mix(c.slider, "white", 30)}, ${c.slider} 45%, ${mix(c.slider, "black", 30)}) !important; border-color: ${mix(c.slider, "black", 45)} !important; }`,
      `${w} input[type="range"] { accent-color: ${c.slider} !important; }`,
    );
  if (c.face) {
    const ink = inkFor(c.face);
    out.push(
      `${w} { --surface: ${c.face} !important; --surface-2: ${mix(c.face, "white", 8)} !important; --card: ${c.face} !important; --foreground: ${ink} !important; --muted-foreground: ${mix(ink, c.face, 35)} !important; }`,
      `${w}:is(${FACES}), ${w} :is(${FACES}) { background: linear-gradient(180deg, ${mix(c.face, "white", 10)}, ${mix(c.face, "black", 22)}) !important; color: ${ink}; }`,
    );
  }
  return out.join("\n");
}

/** The stylesheet for the given choices: the all-devices set first, then each device's own. */
export function controlColorCss(p: ControlColorPrefs): string {
  const all = CONTROL_DEVICES.map((d) => d.scope).join(", ");
  const parts = [rulesFor(all, p.all)];
  for (const d of CONTROL_DEVICES) {
    const own = p.devices[d.id];
    if (own) parts.push(rulesFor(d.scope, own));
  }
  return parts.filter(Boolean).join("\n");
}

/** What a device actually shows for each part: its own choice, else the all-devices one. */
export function effectiveColors(p: ControlColorPrefs, id: ControlDeviceId): ControlColors {
  return { ...p.all, ...p.devices[id] };
}

const KEY = "synclab.control-colors";
let cached: ControlColorPrefs | null = null;
const subs = new Set<() => void>();

export function controlColors(): ControlColorPrefs {
  if (cached) return cached;
  try {
    cached = sanitizeControlColors(JSON.parse(localStorage.getItem(KEY) || "{}"));
  } catch {
    cached = { all: {}, devices: {} };
  }
  return cached;
}

function save(next: ControlColorPrefs) {
  cached = sanitizeControlColors(next);
  try {
    localStorage.setItem(KEY, JSON.stringify(cached));
  } catch {
    /* storage blocked */
  }
  for (const fn of subs) fn();
}

/** Set (colour) or clear (undefined) one part, for all devices or one device. */
export function setControlColor(
  target: "all" | ControlDeviceId,
  part: ControlPart,
  color: string | undefined,
) {
  const p = controlColors();
  const current = target === "all" ? p.all : (p.devices[target] ?? {});
  const nextColors: ControlColors = { ...current };
  if (color) nextColors[part] = color;
  else delete nextColors[part];
  save(
    target === "all"
      ? { ...p, all: nextColors }
      : { ...p, devices: { ...p.devices, [target]: nextColors } },
  );
}

/** Back to the built-in look: one device's own colours, or everything. */
export function resetControlColors(target: "all" | ControlDeviceId | "everything") {
  const p = controlColors();
  if (target === "everything") return save({ all: {}, devices: {} });
  if (target === "all") return save({ ...p, all: {} });
  const devices = { ...p.devices };
  delete devices[target];
  save({ ...p, devices });
}

const subscribe = (fn: () => void) => {
  subs.add(fn);
  return () => {
    subs.delete(fn);
  };
};

export function useControlColors(): ControlColorPrefs {
  return useSyncExternalStore(subscribe, controlColors, () => CONTROL_COLOR_DEFAULTS);
}

/** Keep the generated stylesheet in <head> in step with the saved colours. Returns the cleanup. */
export function startControlColors(doc: Document = document) {
  const apply = () => {
    let el = doc.getElementById("synclab-control-colors") as HTMLStyleElement | null;
    if (!el) {
      el = doc.createElement("style");
      el.id = "synclab-control-colors";
      doc.head.appendChild(el);
    }
    el.textContent = controlColorCss(controlColors());
  };
  apply();
  return subscribe(apply);
}
