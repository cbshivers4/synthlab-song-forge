import { ACID_CLEAN_CATEGORY, POLY_CATEGORY_PREFIX, STANDARD_CATEGORIES } from "./preset-library";

/** Which synth's preset menu lists a factory category. */
export function presetMatchesSynth(category: string, style: string): boolean {
  const c = category.toLowerCase();
  const acid = c === "acid bass" || c === "acid" || c === ACID_CLEAN_CATEGORY.toLowerCase();
  const poly = c === "poly synth" || c.startsWith(POLY_CATEGORY_PREFIX.toLowerCase());
  const modular = c === "modular tech";
  const granular = c === "granular";
  if (style === "granular") return granular;
  if (style === "acid") return acid;
  if (style === "poly") return poly;
  if (style === "modular") return modular;
  return !acid && !poly && !modular && !granular;
}

/** The heading shown in a synth's own preset menu ("Poly Synth · Bass" → "Bass"). */
export function presetCategoryLabel(category: string): string {
  if (category === ACID_CLEAN_CATEGORY) return "Clean Bass";
  if (category.startsWith(POLY_CATEGORY_PREFIX)) return category.slice(POLY_CATEGORY_PREFIX.length);
  return category;
}

/** Standard categories first (Arpeggio … Woodwind), then the rest in library order, My Presets last. */
export function orderPresetGroups<T extends { category: string }>(groups: T[]): T[] {
  const rank = (c: string) => {
    if (c === "My Presets") return 1000;
    const i = (STANDARD_CATEGORIES as readonly string[]).indexOf(c);
    return i >= 0 ? i : 100;
  };
  return groups
    .map((g, i) => ({ g, i }))
    .sort((a, b) => rank(a.g.category) - rank(b.g.category) || a.i - b.i)
    .map((x) => x.g);
}

/* ---- Preset browser: every preset sorted by sound type, plus the genre/style it came from ---- */

export type PresetEntry = { name: string; category: string };
export type PresetGroup = { label: string; items: string[] };
export type PresetBrowserIndex = {
  /** Sound types (Bass, Lead, Pad…), alphabetical; every factory preset is in exactly one. */
  types: PresetGroup[];
  /** Genre styles (Detroit Techno, Rave…) for presets that came from a style group. */
  styles: PresetGroup[];
  /** The user's own saved presets. */
  mine: string[];
  /** Browse order used by the ◀ ▶ arrows: types in order, then My Presets. */
  order: string[];
};

/** Old group names that are really sound types. */
const TYPE_ALIASES: Record<string, string> = {
  Piano: "Piano",
  Pluck: "Pluck",
  Plucks: "Pluck",
  Bells: "Bell",
  Stabs: "Stab",
  Acid: "Acid Bass",
  "Acid Bass": "Acid Bass",
  "Clean Bass": "Clean Bass",
};

/** First match wins: what a preset sounds like, read from its name. */
const TYPE_RULES: [RegExp, string][] = [
  [/\b(empty rack|basic voice|init)\b/i, "Template"],
  [/\b(pad|ambient|mist|swell)\b/i, "Pad"],
  [/string/i, "Strings"],
  [/brass/i, "Brass"],
  [/organ/i, "Organ"],
  [/\b(flute|clarinet|oboe|woodwind|whistle)\b/i, "Woodwind"],
  [/\b(vox|vocoder|talkbox|vowel|choir|voices?|bot)\b/i, "Vocal"],
  [/\b(pluck|harp|guitar|marimba|steel drum)/i, "Pluck"],
  [/\b(bells?|kalimba|music box|chimes?)\b/i, "Bell"],
  [/\b(stab|chord)\b/i, "Stab"],
  [/\b(keys|piano|rhodes)\b/i, "Keyboard"],
  [/\barp/i, "Arpeggio"],
  [/\b(gate|sequence|seq)\b/i, "Sequence"],
  [/\b(lead|screech|screamer|hoover|donk)\b/i, "Lead"],
  [/\b(bass|sub|303|acid line)\b/i, "Bass"],
  [/\b(kick|snare|hat|perc|drum|knock|blip)\b/i, "Percussive"],
  [/\b(drone|noise|riser|bleep|assembly|fx)\b/i, "FX"],
];

export function soundTypeFromName(name: string): string {
  for (const [re, type] of TYPE_RULES) if (re.test(name)) return type;
  return "Synth";
}

/** Sound type and (optional) style for one preset, from its factory category and name. */
export function classifyPreset(
  entry: PresetEntry,
  granularTypes: Record<string, string> = {},
): { type: string; style?: string } {
  const label = presetCategoryLabel(entry.category);
  if (label === "Granular") return { type: granularTypes[entry.name] ?? "Texture" };
  if ((STANDARD_CATEGORIES as readonly string[]).includes(label)) return { type: label };
  if (TYPE_ALIASES[label]) {
    const style = /^TD-3 Electro\b/.test(entry.name)
      ? "Electro"
      : /^TD-3 Techno\b/.test(entry.name)
        ? "Techno"
        : undefined;
    return style ? { type: TYPE_ALIASES[label], style } : { type: TYPE_ALIASES[label] };
  }
  if (label === "Modular Tech") return modularClass(entry.name);
  // Anything else is a genre group (Detroit Techno, Rave, Retro…): keep it as the style, sort by sound.
  return { type: soundTypeFromName(entry.name), style: label };
}

/** Modular Tech racks: the main rack device they're built on (Step Sequencer, Chaos…) is the second list. */
const MODULAR_DEVICES: Record<string, string> = {
  Seq: "Step Sequencer",
  Chaos: "Chaos",
  Comb: "Comb Resonator",
  Follower: "Envelope Follower",
  Macro: "Macro",
  Ring: "Ring Modulator",
  Gate: "Gate",
};
export const MODULAR_CLASSIC_RACKS = "Classic Racks";
function modularClass(name: string): { type: string; style: string } {
  const rest = name.replace(/^Modular Tech /, "");
  const family = /^(\w+) /.exec(rest)?.[1] ?? "";
  const device = MODULAR_DEVICES[family];
  const sound = device ? rest.slice(family.length + 1) : rest;
  const type = soundTypeFromName(sound);
  return {
    type: type === "Synth" ? soundTypeFromName(rest) : type,
    style: device ?? MODULAR_CLASSIC_RACKS,
  };
}

export function presetBrowserIndex(
  factory: PresetEntry[],
  mine: string[] = [],
  granularTypes: Record<string, string> = {},
): PresetBrowserIndex {
  const types = new Map<string, string[]>();
  const styles = new Map<string, string[]>();
  const seen = new Set<string>();
  for (const entry of factory) {
    if (seen.has(entry.name)) continue;
    seen.add(entry.name);
    const { type, style } = classifyPreset(entry, granularTypes);
    (types.get(type) ?? types.set(type, []).get(type)!).push(entry.name);
    if (style) (styles.get(style) ?? styles.set(style, []).get(style)!).push(entry.name);
  }
  const sorted = (m: Map<string, string[]>) =>
    [...m].sort((a, b) => a[0].localeCompare(b[0])).map(([label, items]) => ({ label, items }));
  const typeGroups = sorted(types);
  return {
    types: typeGroups,
    styles: sorted(styles),
    mine: [...mine],
    order: [...typeGroups.flatMap((g) => g.items), ...mine],
  };
}
