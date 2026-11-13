import { describe, expect, it } from 'vitest';
import { noteCopy, pasteTrackContent } from './arrangement-edit';
import { scheduleStep, OFFLINE_LIVE } from './schedule-step';
import { defaultPatch } from './presets';
import { nextPlayStep } from './recording-region';
import { songSteps } from './timebase';
import type { Track, Transport } from './types';

const STEP = 0.125; // 120 BPM

/** Steps (song positions) at which each track actually sounds over the whole song, like playback. */
function heard(tracks: Track[], bars: number): { notes: number[]; hits: number[] } {
  const tp = { bpm: 120, bars, loop: false, swing: 0, metronome: false } as unknown as Transport;
  const notes: number[] = [];
  const hits: number[] = [];
  let step = 0;
  const collector = {
    tempo: 120,
    playNote: (_id: string, _p: unknown, _m: number, _d: number, _v: number, when: number) => notes.push(Math.round(when / STEP)),
    playDrum: (_id: string, _p: unknown, _v: number, when: number) => hits.push(Math.round(when / STEP)),
  };
  const engine = new Proxy(collector, { get: (o, k) => (k in o ? (o as Record<string | symbol, unknown>)[k] : () => {}) }) as never;
  for (let i = 0; i < songSteps(bars); i++) {
    scheduleStep(engine, tracks, tp, step, i * STEP, OFFLINE_LIVE);
    step = nextPlayStep(step, tp);
  }
  return { notes, hits };
}

const base = { color: 'grey', volume: 0.8, pan: 0, muted: false, solo: false, armed: false, frozen: false, hidden: false, input: 'none' as const, bus: 'master', clips: [] };
const synth = (notes: number[]): Track => ({
  ...base, id: 's', name: 'Synth', kind: 'instrument', steps: 16, patch: defaultPatch(),
  notes: notes.map((step, i) => ({ id: `n${i}`, step, length: 1, pitch: 60, velocity: 0.8 })),
} as Track);
const kick = (steps: number[]) => ({ id: 'k', name: 'Kick', kind: 'kick' as const, volume: 1, pan: 0, pitch: 0, decay: 0.5, muted: false, solo: false, steps });
const drums = (): Track => ({ ...base, id: 'd', name: 'Drums', kind: 'drum', steps: 16, pads: [kick([1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0])] } as Track);
const every = (from: number, to: number, gap: number) => Array.from({ length: (to - from) / gap }, (_, i) => from + i * gap);

describe('copy and paste past bar 4 stays in time', () => {
  it('a 1-bar synth loop copied over 4 bars and pasted at bar 5 plays on every beat of all 8 bars, once', () => {
    const t = synth([0, 4, 8, 12]);
    const copy = noteCopy(t, [0, 64])!;
    expect(copy.notes).toHaveLength(16);
    const pasted = pasteTrackContent(t, { ...t, notes: copy.notes }, 64, STEP, { origin: copy.span[0], length: 64, shownEnd: 64 });
    expect(pasted.steps % 16).toBe(0);
    expect(heard([pasted], 8).notes.sort((a, b) => a - b)).toEqual(every(0, 128, 4));
  });

  it('a pasted note keeps its place in the bar instead of jumping to the paste point', () => {
    const t = synth([2]);
    const copy = noteCopy(t, [0, 16])!;
    const pasted = pasteTrackContent(t, { ...t, notes: copy.notes }, 64, STEP, { origin: copy.span[0], length: 16, shownEnd: 64 });
    expect(heard([pasted], 5).notes.sort((a, b) => a - b)).toEqual([2, 18, 34, 50, 66]);
  });

  it('the drums and the synth still line up after both are pasted at bar 5', () => {
    const t = synth([0, 8]);
    const copy = noteCopy(t, [0, 64])!;
    const s2 = pasteTrackContent(t, { ...t, notes: copy.notes }, 64, STEP, { origin: 0, length: 64, shownEnd: 64 });
    const d = drums();
    const d2 = pasteTrackContent(d, { ...d, patternRegion: [0, 64] }, 64, STEP, { shownEnd: 64 });
    const { notes, hits } = heard([s2, d2], 8);
    expect(notes.sort((a, b) => a - b)).toEqual(every(0, 128, 8));
    expect(hits.sort((a, b) => a - b)).toEqual(every(0, 128, 4));
  });

  it('a beat pasted at bar 7 of a 4-bar song leaves bars 5 and 6 empty', () => {
    const d = drums();
    const next = pasteTrackContent(d, { ...d, patternRegion: [0, 16] }, 96, STEP, { shownEnd: 64 });
    const hits = heard([next], 8).hits;
    expect(hits.filter((s) => s >= 64 && s < 96)).toEqual([]);
    expect(hits.filter((s) => s >= 96 && s < 112)).toEqual([96, 100, 104, 108]);
    expect(hits.filter((s) => s < 64)).toHaveLength(16);
  });

  it('pasting a bar inside an 8-bar song keeps the loop playing in the bars after it', () => {
    const d = drums();
    const next = pasteTrackContent(d, { ...d, patternRegion: [0, 16] }, 16, STEP, { shownEnd: 128 });
    expect(heard([next], 8).hits.sort((a, b) => a - b)).toEqual(every(0, 128, 4));
  });
});
