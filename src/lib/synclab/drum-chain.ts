/**
 * Pattern chaining: a drum track can play its patterns 1–8 (of the active bank) in an order,
 * each for a number of bars, repeating across the song — e.g. 1 ×2, 2 ×1, 1 ×1, 3 ×4.
 * Live playback and the offline export both resolve the pattern here, so they always agree.
 * The pattern on screen is read from the pads (it may have unsaved edits); others from their slots.
 */
import type { DrumPad, Track } from "./types";

export interface DrumChainItem { slot: number; bars: number }
export interface DrumChain { on: boolean; items: DrumChainItem[] }

const clampSlot = (v: number) => Math.max(0, Math.min(7, Math.round(v)));

/** Which chain item plays at song step `n`, and the step inside that item. */
export function chainPosition(items: DrumChainItem[], n: number, stepsPerBar: number): { item: DrumChainItem; index: number; stepInItem: number } | null {
  const list = items.filter((i) => i.bars > 0);
  const totalBars = list.reduce((sum, i) => sum + i.bars, 0);
  if (!totalBars) return null;
  const cycle = totalBars * stepsPerBar;
  let pos = ((n % cycle) + cycle) % cycle;
  for (let index = 0; index < list.length; index++) {
    const item = list[index]!;
    const len = item.bars * stepsPerBar;
    if (pos < len) return { item, index: items.indexOf(item), stepInItem: pos };
    pos -= len;
  }
  return null;
}

/**
 * The pads to play at song step `n` with their step index, following the chain.
 * Returns null when the track has no active chain (play its pads as usual).
 */
export function chainedPads(t: Pick<Track, "pads" | "steps" | "drumChain" | "drumSequences" | "activeDrumPattern" | "activeDrumSequence">, n: number, stepsPerBar: number): { pads: DrumPad[]; s: number; slot: number } | null {
  const chain = t.drumChain;
  if (!chain?.on || !chain.items.length || !t.pads) return null;
  const at = chainPosition(chain.items, n, stepsPerBar);
  if (!at) return null;
  const slot = clampSlot(at.item.slot);
  if (slot === clampSlot(t.activeDrumSequence ?? 0)) {
    const len = Math.max(1, t.steps);
    return { pads: t.pads, s: at.stepInItem % len, slot };
  }
  const seq = t.drumSequences?.[clampSlot(t.activeDrumPattern ?? 0)]?.[slot];
  if (!seq) return { pads: [], s: 0, slot }; // an empty pattern slot plays silence
  const len = Math.max(1, seq.steps);
  const pads = t.pads.map((pad) => {
    const h = seq.hits[pad.id];
    return { ...pad, steps: h?.steps ?? [], probability: h?.probability, stepPitch: h?.stepPitch, stepDecay: h?.stepDecay, flam: h?.flam, retrig: h?.retrig, glitch: h?.glitch };
  });
  return { pads, s: at.stepInItem % len, slot };
}
