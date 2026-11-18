import type { Track } from "./types";
import { tidyDrumSpan } from "./arrangement-edit";

/** "1 bar", "4 bars", "4 bars + 1 step" — drum-roll length in the same bars the timeline counts. */
export function barsLabel(steps: number, barSteps: number): string {
  const bars = Math.floor(steps / barSteps);
  const rest = steps - bars * barSteps;
  const b = bars === 1 ? "1 bar" : `${bars} bars`;
  if (!rest) return b;
  const s = rest === 1 ? "1 step" : `${rest} steps`;
  return bars ? `${b} + ${s}` : s;
}

/**
 * Lengths the drum-roll menu offers: whole bars up to the song length (never past it, unless the
 * pattern is already longer), plus the pattern's current length when it is not a whole bar count.
 */
export function drumLengthOptions(current: number, songBars: number, barSteps: number): { steps: number; label: string }[] {
  const maxBars = Math.max(1, songBars);
  const bars = [1, 2, 4, 8, 16, 32].filter((b) => b <= maxBars);
  if (!bars.includes(maxBars) && maxBars <= 32) bars.push(maxBars);
  const steps = bars.map((b) => b * barSteps);
  if (!steps.includes(current)) steps.push(current);
  return steps.sort((a, b) => a - b).map((s) => ({ steps: s, label: barsLabel(s, barSteps) }));
}

/**
 * A pattern a step or two longer than a bar line, with nothing in those extra steps, is a leftover
 * (it made the roll show one more bar than the timeline and drifted copies). Returns the trimmed
 * track, or null when the pattern already ends on a bar line or the extra steps hold hits.
 */
export function trimSilentDrumOverhang(track: Track, barSteps: number): Partial<Track> | null {
  if (track.kind !== "drum" || track.printedAudio) return null;
  const total = Math.max(1, track.steps || 16);
  const [, end] = tidyDrumSpan(track, [0, total], barSteps);
  if (end >= total) return null;
  const cut = <T,>(a?: T[]) => (a && a.length > end ? a.slice(0, end) : a);
  return {
    steps: end,
    pads: (track.pads ?? []).map((p) => ({
      ...p,
      steps: cut(p.steps) ?? p.steps,
      probability: cut(p.probability),
      stepPitch: cut(p.stepPitch),
      stepDecay: cut(p.stepDecay),
      flam: cut(p.flam),
      retrig: cut(p.retrig),
      glitch: cut(p.glitch),
    })),
    // A block edge on the stray step moves back onto the bar line.
    ...(track.cuts?.length ? { cuts: [...new Set(track.cuts.map((c) => (c > end && c <= total ? end : c)))].sort((a, b) => a - b) } : {}),
  };
}
