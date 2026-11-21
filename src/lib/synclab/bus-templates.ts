import type { CustomBusId, PluginDef, PluginInstance } from "./types";
import { instantiate } from "./plugins";

/** One effect in a bus template: a device by its catalog name, with optional starting knob values. */
export interface BusTemplateStep {
  effect: string;
  params?: Record<string, number>;
}

/** A recallable effect chain for a mixer bus (Vocal Chain, Drum Bus…). */
export interface BusTemplate {
  id: string;
  name: string;
  description: string;
  color: string;
  effects: BusTemplateStep[];
  /** true for the ones that ship with the app */
  factory?: boolean;
}

export const FACTORY_BUS_TEMPLATES: BusTemplate[] = [
  {
    id: "vocal-chain",
    name: "Vocal Chain",
    description: "Lead vocal: clean-up, de-ess, smooth compression, a little echo and room.",
    color: "oklch(0.75 0.19 330)",
    effects: [
      {
        effect: "Channel Strip",
        params: { lowcut: 90, threshold: -20, ratio: 3, attack: 6, release: 120, makeup: 4 },
      },
      { effect: "De-Esser", params: { threshold: -30, range: 10 } },
      {
        effect: "Bus Compressor",
        params: { threshold: -14, ratio: 2, attack: 15, release: 180, makeup: 1 },
      },
      { effect: "Stereo Delay", params: { time: 330, feedback: 0.25, mix: 0.12, lowcut: 300 } },
      { effect: "Hall Reverb", params: { decay: 1.6, predelay: 30, mix: 0.18, lowcut: 250 } },
    ],
  },
  {
    id: "rap-vocal",
    name: "Rap Vocal",
    description: "Up-front, punchy voice with grit and tight control.",
    color: "oklch(0.72 0.2 20)",
    effects: [
      {
        effect: "Channel Strip",
        params: { lowcut: 100, threshold: -22, ratio: 4, attack: 3, release: 90, makeup: 5 },
      },
      { effect: "De-Esser", params: { threshold: -28, range: 12 } },
      { effect: "Tube Drive", params: { drive: 0.15, mix: 0.35 } },
      { effect: "Bus Compressor", params: { threshold: -12, ratio: 3, attack: 5, release: 120 } },
      { effect: "Stereo Delay", params: { time: 250, feedback: 0.2, mix: 0.08 } },
    ],
  },
  {
    id: "backing-vocals",
    name: "Backing Vocals",
    description: "Wide, soft harmonies that sit behind the lead.",
    color: "oklch(0.78 0.14 300)",
    effects: [
      { effect: "Channel Strip", params: { lowcut: 150, threshold: -24, ratio: 4, makeup: 4 } },
      { effect: "De-Esser", params: { threshold: -32, range: 12 } },
      { effect: "Studio Chorus", params: { depth: 0.4, mix: 0.3 } },
      { effect: "Stereo Width", params: { width: 1.6 } },
      { effect: "Hall Reverb", params: { decay: 2.4, mix: 0.3, lowcut: 300 } },
    ],
  },
  {
    id: "drum-bus",
    name: "Drum Bus",
    description: "Glue the kit together with punch and a little colour.",
    color: "oklch(0.75 0.19 30)",
    effects: [
      {
        effect: "Bus Compressor",
        params: { threshold: -16, ratio: 4, attack: 20, release: 120, makeup: 3 },
      },
      { effect: "Tube Drive", params: { drive: 0.2, mix: 0.5 } },
      { effect: "Channel EQ", params: { low: 2, high: 2 } },
      { effect: "Brickwall Limiter", params: { ceiling: -1 } },
    ],
  },
  {
    id: "bass-bus",
    name: "Bass Bus",
    description: "Solid, even low end with a bit of warmth.",
    color: "oklch(0.7 0.16 250)",
    effects: [
      { effect: "Channel EQ", params: { low: 2, mid: -2, midFreq: 400 } },
      { effect: "Bus Compressor", params: { threshold: -18, ratio: 4, attack: 10, release: 160 } },
      { effect: "Tube Drive", params: { drive: 0.25, tone: 3000, mix: 0.4 } },
    ],
  },
  {
    id: "instrument-glue",
    name: "Instrument Glue",
    description: "Keys, guitars and pads blended into one gentle group.",
    color: "oklch(0.82 0.17 95)",
    effects: [
      { effect: "Channel EQ" },
      { effect: "Bus Compressor", params: { threshold: -14, ratio: 2, attack: 30, release: 200 } },
      { effect: "Stereo Width", params: { width: 1.2 } },
    ],
  },
  {
    id: "guitar-bus",
    name: "Guitar Bus",
    description: "Tidy guitars with a touch of spring reverb.",
    color: "oklch(0.72 0.15 60)",
    effects: [
      { effect: "Channel EQ", params: { low: -3, high: 1 } },
      { effect: "Bus Compressor", params: { threshold: -16, ratio: 3, attack: 12, release: 150 } },
      { effect: "Spring Reverb Pedal" },
    ],
  },
  {
    id: "synth-space",
    name: "Synth Space",
    description: "Chorus, echo and a big hall for leads and pads.",
    color: "oklch(0.72 0.18 265)",
    effects: [
      { effect: "Studio Chorus", params: { mix: 0.25 } },
      { effect: "Stereo Delay", params: { feedback: 0.4, mix: 0.2 } },
      { effect: "Hall Reverb", params: { decay: 3, mix: 0.25 } },
    ],
  },
  {
    id: "fx-wash",
    name: "FX Wash",
    description: "Filtered tape echo into a long reverb for risers and textures.",
    color: "oklch(0.78 0.18 145)",
    effects: [
      { effect: "Analog Filter", params: { cutoff: 6000 } },
      { effect: "Tape Echo", params: { feedback: 0.55, mix: 0.35 } },
      { effect: "Hall Reverb", params: { decay: 5, mix: 0.45 } },
    ],
  },
  {
    id: "lofi-bus",
    name: "Lo-Fi Bus",
    description: "Old tape and crushed bits for a dusty sound.",
    color: "oklch(0.7 0.08 80)",
    effects: [
      { effect: "Retro Transformer" },
      { effect: "Bit Crusher", params: { bits: 10, mix: 0.4 } },
      { effect: "Analog Filter", params: { cutoff: 4500 } },
    ],
  },
  {
    id: "empty",
    name: "Empty Bus",
    description: "No effects — add your own.",
    color: "oklch(0.78 0.16 195)",
    effects: [],
  },
].map((t) => ({ ...t, factory: true }));

/** Factory templates with the producer's saved changes on top, then their own templates. */
export function allBusTemplates(user: BusTemplate[]): BusTemplate[] {
  const byId = new Map(user.map((t) => [t.id, t]));
  const factory = FACTORY_BUS_TEMPLATES.map((t) =>
    byId.has(t.id) ? { ...byId.get(t.id)!, factory: true } : t,
  );
  const own = user.filter((t) => !FACTORY_BUS_TEMPLATES.some((f) => f.id === t.id));
  return [...factory, ...own];
}

/** Builds real effect inserts for a template; devices missing from the catalog are skipped. */
export function templatePlugins(template: BusTemplate, defs: PluginDef[]): PluginInstance[] {
  const out: PluginInstance[] = [];
  for (const step of template.effects) {
    const def = defs.find((d) => d.name === step.effect);
    if (!def) continue;
    const inst = instantiate(def);
    if (step.params)
      inst.params = inst.params.map((p) => {
        const v = step.params?.[p.id];
        return v === undefined ? p : { ...p, value: Math.min(p.max, Math.max(p.min, v)) };
      });
    out.push(inst);
  }
  return out;
}

/** A template from the effects currently on a bus, keeping their knob values. */
export function templateFromPlugins(
  base: Pick<BusTemplate, "id" | "name" | "description" | "color">,
  plugins: PluginInstance[],
): BusTemplate {
  return {
    ...base,
    effects: plugins.map((p) => ({
      effect: p.name,
      params: Object.fromEntries(p.params.map((x) => [x.id, x.value])),
    })),
  };
}

export const newCustomBusId = (): CustomBusId => `cb-${Math.random().toString(36).slice(2, 10)}`;

export const isCustomBusId = (id: string): id is CustomBusId => id.startsWith("cb-");

/* ---------- device-local storage of the producer's templates ---------- */

const KEY = "synclab.bus-templates.v1";
export const BUS_TEMPLATES_EVENT = "synclab:bus-templates";

export function loadUserBusTemplates(): BusTemplate[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = JSON.parse(window.localStorage.getItem(KEY) ?? "[]") as unknown;
    if (!Array.isArray(raw)) return [];
    return raw.filter(
      (t): t is BusTemplate =>
        !!t && typeof t.id === "string" && typeof t.name === "string" && Array.isArray(t.effects),
    );
  } catch {
    return [];
  }
}

export function saveUserBusTemplates(list: BusTemplate[]) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(KEY, JSON.stringify(list.map(({ factory: _f, ...t }) => t)));
  } catch {
    /* storage unavailable */
  }
  window.dispatchEvent(new CustomEvent(BUS_TEMPLATES_EVENT));
}
