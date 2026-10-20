import type { SavedPad } from './pad-session';
import { wsolaStretch } from './stretch';

export function stretchPadPcm(input: Float32Array, speed: number): Float32Array {
  if (!Number.isFinite(speed) || speed < 0.25 || speed > 4) throw new Error('Stretch must be between 25% and 400%');
  if (input.length < 32) throw new Error('Sample is too short to stretch');
  const frame = Math.min(2048, 2 ** Math.floor(Math.log2(input.length)));
  return wsolaStretch(input, speed, frame, Math.min(384, frame / 4));
}

export function padChopRanges(pad: SavedPad): { start: number; end: number }[] {
  const starts = [...new Set([pad.start, ...(pad.slices ?? []).filter(v => Number.isFinite(v) && v > pad.start && v < pad.end)])].sort((a, b) => a - b);
  return starts.map((start, i) => ({ start, end: starts[i + 1] ?? pad.end }));
}

export function distributePadChops(pads: Record<number, SavedPad>, source: number, selected: number[], destination: number): Record<number, SavedPad> {
  const pad = pads[source];
  if (!pad) throw new Error('Source pad is empty');
  const ranges = padChopRanges(pad);
  const indices = [...new Set(selected)].sort((a, b) => a - b);
  if (!indices.length || indices.some(i => !ranges[i])) throw new Error('Select chops first');
  if (destination < 0 || destination + indices.length > 64) throw new Error('Not enough pads after the starting pad');
  if (source >= destination && source < destination + indices.length) throw new Error('Choose other pads so the source stays untouched');
  const next = { ...pads };
  indices.forEach((index, offset) => {
    const range = ranges[index];
    if (!range) return;
    next[destination + offset] = { ...pad, ...range, name: `${pad.name.slice(0, 12)} ${index + 1}`, cloudPath: pad.cloudPath, slices: undefined, steps: Array(16).fill(0) };
  });
  return next;
}

export function cropPadPeaks(pad: Pick<SavedPad, 'peaks' | 'start' | 'end'>): number[] {
  return pad.peaks.slice(Math.floor(pad.start * pad.peaks.length), Math.max(Math.floor(pad.start * pad.peaks.length) + 1, Math.ceil(pad.end * pad.peaks.length)));
}