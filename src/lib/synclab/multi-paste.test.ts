import { describe, expect, it } from 'vitest';
import { clipboardOrigin, livePasteStep, multiPasteSteps } from './arrangement-edit';
import type { Track } from './types';

describe('copy and paste while playing', () => {
  it('a stopped paste lands exactly at the playhead', () => {
    expect(livePasteStep(37, false)).toBe(37);
  });
  it('a paste during playback lands on the nearest bar line', () => {
    expect(livePasteStep(65, true, undefined, 16)).toBe(64);
    expect(livePasteStep(78, true, undefined, 16)).toBe(80);
  });
  it('a clicked destination is used as-is even during playback', () => {
    expect(livePasteStep(65, true, 40, 16)).toBe(40);
  });
});

describe('copying several tracks', () => {
  it('pastes every track together, keeping their distance from each other', () => {
    expect(multiPasteSteps([0, 16, 0], 64)).toEqual([64, 80, 64]);
  });
  it('reads a copied span, drum region or first note as the left edge', () => {
    const base = { id: 't', name: 'T', kind: 'instrument', color: 'grey', volume: 1, pan: 0, muted: false, solo: false, armed: false, frozen: false, hidden: false, input: 'none', bus: 'master', steps: 16 } as Track;
    expect(clipboardOrigin(base, [16, 32])).toBe(16);
    expect(clipboardOrigin({ ...base, notes: [{ id: 'n', step: 8, length: 1, pitch: 60, velocity: 1 }] })).toBe(8);
    const pad = { id: 'k', name: 'Kick', kind: 'kick' as const, volume: 1, pan: 0, pitch: 0, decay: 0.5, muted: false, solo: false, steps: [1, 0, 0, 0] };
    expect(clipboardOrigin({ ...base, kind: 'drum', pads: [pad], patternRegion: [4, 8] })).toBe(4);
  });
});
