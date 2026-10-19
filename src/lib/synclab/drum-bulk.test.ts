import { describe, expect, it } from 'vitest';
import { editDrumPads } from './drum-bulk';
import type { DrumPad } from './types';
const pads: DrumPad[] = ['kick', 'snare'].map((name, i) => ({ id: name, name, kind: i ? 'snare' : 'kick', volume: 0.8, pan: 0, pitch: i, decay: 0.5, muted: false, solo: false, steps: [0.7, 0, 0.35, 0], stepPitch: [2, 0, 4, 0] }));
describe('all drum edits', () => {
  it('tweaks every pad sound while retaining hits and identities', () => {
    const result = editDrumPads(pads, { scope: 'sounds', patch: { pitch: 7, decay: 0.3 } });
    expect(result.map(p => [p.id, p.pitch, p.decay, p.steps])).toEqual(pads.map(p => [p.id, 7, 0.3, p.steps]));
    expect(pads[0]?.pitch).toBe(0);
  });
  it('changes existing hits on every pad without creating notes', () => {
    expect(editDrumPads(pads, { scope: 'hits', field: 'steps', value: 0.9 }).map(p => p.steps)).toEqual([[0.9, 0, 0.9, 0], [0.9, 0, 0.9, 0]]);
  });
  it('keeps all-hit edits inside loop positions', () => {
    expect(editDrumPads(pads, { scope: 'hits', field: 'steps', value: 1 }, [0, 2]).map(p => p.steps)).toEqual([[1, 0, 0.35, 0], [1, 0, 0.35, 0]]);
  });
  it('moves hits with their pitch values on every pad', () => {
    const result = editDrumPads(pads, { scope: 'shift', amount: 1 });
    expect(result.map(p => p.steps)).toEqual([[0, 0.7, 0, 0.35], [0, 0.7, 0, 0.35]]);
    expect(result[0]?.stepPitch).toEqual([0, 2, 0, 4]);
  });
  it('nudges inside loop and leaves outside hits untouched', () => {
    const result = editDrumPads(pads, { scope: 'shift', amount: 1 }, [0, 2]);
    expect(result[0]?.steps).toEqual([0, 0.7, 0.35, 0]);
    expect(result[0]?.stepPitch).toEqual([0, 2, 4, 0]);
  });
});