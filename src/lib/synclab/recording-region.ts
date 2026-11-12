import type { MidiNote, Transport } from './types';
import { songSteps } from './timebase';
export function loopRegion(tp: Pick<Transport, 'bars' | 'loopStart' | 'loopEnd'>): [number, number] {
  const total = songSteps(tp.bars);
  const start = Math.max(0, Math.min(total - 1, tp.loopStart ?? 0));
  return [start, Math.min(total, Math.max(start + 1, tp.loopEnd ?? total))];
}
/** The step the scheduler plays after `step`: wraps inside the loop only while loop is on, otherwise at the song end. */
export function nextPlayStep(step: number, tp: Pick<Transport, 'bars' | 'loop' | 'loopStart' | 'loopEnd'>): number {
  const total = songSteps(tp.bars);
  const next = step + 1;
  if (tp.loop) {
    const [lo, hi] = loopRegion(tp);
    return next >= hi ? lo : next;
  }
  return next >= total ? 0 : next;
}
/**
 * Length (in steps, quarter-step resolution) of a note you heard for `seconds` live.
 * A recorded note keeps that length, so the take rings out like the note you played
 * instead of being chopped to one step. A held key may make it longer, never shorter.
 */
export function heardNoteSteps(seconds: number, stepDur: number, heldSteps = 0): number {
  const live = stepDur > 0 ? Math.round((seconds / stepDur) * 4) / 4 : 0;
  return Math.max(0.25, live, heldSteps);
}
export function capturedNote(note: MidiNote, [start, end]: [number, number]): MidiNote | null {
  if (note.step < start || note.step >= end) return null;
  return { ...note, length: Math.min(note.length, end - note.step), recordedEnd: end };
}
export function boundedRegions(regions: [number, number][], bounds: [number, number]): [number, number][] {
  return regions.map(([a, b]): [number, number] => [Math.max(a, bounds[0]), Math.min(b, bounds[1])]).filter(([a, b]) => b > a);
}
