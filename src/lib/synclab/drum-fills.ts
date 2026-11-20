import type { DrumPad } from "./types";

/**
 * Flam, Roll and Mutate for one drum sound. They write the per-hit flam/retrig fields that
 * scheduleStep already plays (and exports), so what you hear is what is saved — no second copy.
 * An active loop (region) limits every change to the looped part of the pattern.
 */
export type DrumRegion = [number, number] | undefined;
type HitField = "stepPitch" | "stepDecay" | "probability" | "flam" | "retrig" | "glitch";
const META: HitField[] = ["stepPitch", "stepDecay", "probability", "flam", "retrig", "glitch"];
const fallback = (f: HitField) =>
  f === "stepDecay" || f === "probability" || f === "retrig" ? 1 : 0;

/** Same rule as the bulk drum edits: a step is editable when one of its repeats lands inside the loop. */
export function editableSteps(count: number, region: DrumRegion): number[] {
  return Array.from({ length: count }, (_, i) => i).filter((i) => {
    if (!region) return true;
    const first = i + Math.max(0, Math.ceil((region[0] - i) / Math.max(1, count))) * count;
    return first < region[1];
  });
}

const hitsOf = (pad: DrumPad, region: DrumRegion) =>
  editableSteps(pad.steps.length, region).filter((i) => (pad.steps[i] ?? 0) > 0);
const filled = (pad: DrumPad, f: HitField) =>
  Array.from({ length: pad.steps.length }, (_, i) => pad[f]?.[i] ?? fallback(f));

/** Default grace-note amount: about 30 ms after the main hit at a little over half its level. */
export const FLAM_AMOUNT = 0.5;

/** True when any hit of this sound has a flam. */
export function hasFlam(pad: DrumPad, region?: DrumRegion) {
  return hitsOf(pad, region).some((i) => (pad.flam?.[i] ?? 0) > 0);
}

/** Flam on every hit (or off again when they already have one). */
export function toggleFlam(
  pad: DrumPad,
  region?: DrumRegion,
): { patch: Partial<DrumPad>; on: boolean; hits: number } | null {
  const hits = hitsOf(pad, region);
  if (!hits.length) return null;
  const on = !hasFlam(pad, region);
  const flam = filled(pad, "flam");
  for (const i of hits) flam[i] = on ? FLAM_AMOUNT : 0;
  return { patch: { flam }, on, hits: hits.length };
}

/** Current roll size: the most hits any step of this sound plays (1 = no roll). */
export function rollSize(pad: DrumPad, region?: DrumRegion) {
  return hitsOf(pad, region).reduce((m, i) => Math.max(m, Math.round(pad.retrig?.[i] ?? 1)), 1);
}

/** Each press makes every hit a faster roll: 2 → 3 → 4 hits per step, then back to single hits. */
export function cycleRoll(
  pad: DrumPad,
  region?: DrumRegion,
): { patch: Partial<DrumPad>; size: number; hits: number } | null {
  const hits = hitsOf(pad, region);
  if (!hits.length) return null;
  const now = rollSize(pad, region);
  const size = now >= 4 ? 1 : now + 1;
  const retrig = filled(pad, "retrig");
  for (const i of hits) retrig[i] = size;
  return { patch: { retrig }, size, hits: hits.length };
}

export type MutateResult = {
  patch: Partial<DrumPad>;
  added: number;
  removed: number;
  moved: number;
  changed: number;
};

/**
 * Mutate: a handful of musical changes, more as the MUTATE knob goes up (2 at 0, 8 at full).
 * Hits move to a nearby empty step, drop out or swap between ghost and accent; empty steps can
 * gain a hit. The first beat of every bar is never moved or removed, so the groove keeps its anchor.
 * A moved hit carries its own pitch/decay/chance/flam/roll with it.
 */
export function mutatePad(
  pad: DrumPad,
  amount: number,
  region?: DrumRegion,
  rand: () => number = Math.random,
  stepsPerBar = 16,
): MutateResult | null {
  const count = pad.steps.length;
  const editable = editableSteps(count, region);
  if (!editable.length) return null;
  const steps = pad.steps.slice();
  const meta = Object.fromEntries(
    META.filter((f) => pad[f]).map((f) => [f, filled(pad, f)]),
  ) as Partial<Record<HitField, number[]>>;
  const r = { added: 0, removed: 0, moved: 0, changed: 0 };
  const changes = Math.max(2, Math.round(2 + Math.max(0, Math.min(1, amount)) * 6));
  const pick = <T>(xs: T[]) => xs[Math.min(xs.length - 1, Math.floor(rand() * xs.length))]!;
  const anchor = (i: number) => i % Math.max(1, stepsPerBar) === 0;
  let done = 0;
  for (let attempt = 0; done < changes && attempt < changes * 6; attempt++) {
    const i = pick(editable);
    const v = steps[i] ?? 0;
    if (v <= 0) {
      steps[i] = Math.round((0.45 + rand() * 0.45) * 100) / 100;
      for (const f of META) if (meta[f]) meta[f]![i] = fallback(f);
      r.added++;
      done++;
      continue;
    }
    const x = rand();
    const hits = steps.filter((s) => s > 0).length;
    if (!anchor(i) && x < 0.35) {
      const near = [i - 1, i + 1, i - 2, i + 2].filter(
        (j) => j >= 0 && j < count && editable.includes(j) && (steps[j] ?? 0) <= 0,
      );
      if (near.length) {
        const j = pick(near);
        steps[j] = v;
        steps[i] = 0;
        for (const f of META)
          if (meta[f]) {
            meta[f]![j] = meta[f]![i]!;
            meta[f]![i] = fallback(f);
          }
        r.moved++;
        done++;
        continue;
      }
    }
    if (!anchor(i) && x < 0.6 && hits > 1) {
      steps[i] = 0;
      r.removed++;
      done++;
      continue;
    }
    steps[i] = v > 0.6 ? 0.35 : 1;
    r.changed++;
    done++;
  }
  if (!done) return null;
  return { patch: { steps, ...meta }, ...r };
}

/** Plain-words summary for the toast, e.g. "2 hits added · 1 moved". */
export function mutateSummary(r: MutateResult) {
  const parts = [
    r.added && `${r.added} hit${r.added === 1 ? "" : "s"} added`,
    r.moved && `${r.moved} moved`,
    r.removed && `${r.removed} removed`,
    r.changed && `${r.changed} louder/softer`,
  ].filter(Boolean);
  return parts.join(" · ");
}
