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
  return groups.map((g, i) => ({ g, i })).sort((a, b) => rank(a.g.category) - rank(b.g.category) || a.i - b.i).map((x) => x.g);
}
