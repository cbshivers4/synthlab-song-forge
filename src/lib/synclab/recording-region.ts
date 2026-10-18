import type { MidiNote, Transport } from './types';
import { songSteps } from './timebase';
export function loopRegion(tp: Pick<Transport, 'bars' | 'loopStart' | 'loopEnd'>): [number, number] {
  const total = songSteps(tp.bars);
  const start = Math.max(0, Math.min(total - 1, tp.loopStart ?? 0));
  return [start, Math.min(total, Math.max(start + 1, tp.loopEnd ?? total))];
}
export function capturedNote(note: MidiNote, [start, end]: [number, number]): MidiNote | null {
  if (note.step < start || note.step >= end) return null;
  return { ...note, length: Math.min(note.length, end - note.step), recordedEnd: end };
}
export function boundedRegions(regions: [number, number][], bounds: [number, number]): [number, number][] {
  return regions.map(([a, b]): [number, number] => [Math.max(a, bounds[0]), Math.min(b, bounds[1])]).filter(([a, b]) => b > a);
}
