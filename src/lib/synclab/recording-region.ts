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
 * Does a take keep going when the loop jumps back to its start? Only Overdub keeps going round
 * (microphone passes, layered synth notes); Replace ends the take and playback at the loop end so
 * nothing you just recorded plays back on its own. Printed drum/instrument takes always end there.
 */
export function loopKeepsRecording(
  tp: Pick<Transport, 'overdub' | 'replace'>,
  rec: { mic: boolean; print: boolean; synth: boolean },
): boolean {
  if (rec.print || (!rec.mic && !rec.synth)) return false;
  return !!tp.overdub && !tp.replace;
}
/** True when `step` is the loop start right after the loop's last step was scheduled (the next pass begins). */
export function isLoopWrap(prev: number | null, step: number, tp: Pick<Transport, 'bars' | 'loop' | 'loopStart' | 'loopEnd'>): boolean {
  if (!tp.loop || prev == null) return false;
  const [lo, hi] = loopRegion(tp);
  return step === lo && prev === hi - 1;
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
/**
 * Snap a recorded note's start to the nearest grid line (grid in steps), so a take lands
 * on the beat instead of a little before or after it. A note snapped past the end of the
 * recorded region wraps to its start when looping, otherwise it stays on the last line.
 */
export function snapRecordedStep(pos: number, grid: number, [start, end]: [number, number], wrap: boolean): number {
  if (!(grid > 0) || !Number.isFinite(pos)) return pos;
  let s = Math.round(pos / grid) * grid;
  if (s >= end) s = wrap ? start : Math.max(start, Math.floor((end - 0.001) / grid) * grid);
  return Math.max(start, s);
}
export function capturedNote(note: MidiNote, [start, end]: [number, number]): MidiNote | null {
  if (note.step < start || note.step >= end) return null;
  return { ...note, length: Math.min(note.length, end - note.step), recordedEnd: end };
}
export function boundedRegions(regions: [number, number][], bounds: [number, number]): [number, number][] {
  return regions.map(([a, b]): [number, number] => [Math.max(a, bounds[0]), Math.min(b, bounds[1])]).filter(([a, b]) => b > a);
}
