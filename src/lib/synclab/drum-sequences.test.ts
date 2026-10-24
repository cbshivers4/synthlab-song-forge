import { describe, expect, it } from 'vitest';
import { appendDrumPad, DRUM_PATTERN_LABELS, recallDrumBank, recallDrumSequence } from './drum-banks';

const track = {
  steps: 16, activeDrumPattern: 0, patternRegion: [16, 32] as [number, number],
  pads: appendDrumPad({ steps: 16 }, 'kick', { kind: 'kick', sampleUrl: 'blob:original' }).map(pad => ({ ...pad,
    steps: [1, ...Array(15).fill(0)], probability: [0.8], stepPitch: [3], stepDecay: [0.6], flam: [0.2], retrig: [2], glitch: [0.4],
  })),
};

describe('independent drum patterns', () => {
  it('offers Patterns 1–8 without changing Banks A–H or pad sounds', () => {
    expect(DRUM_PATTERN_LABELS).toEqual([1, 2, 3, 4, 5, 6, 7, 8]);
    for (let index = 1; index < 8; index++) {
      const next = recallDrumSequence(track, index);
      expect(next.activeDrumSequence).toBe(index);
      expect(next.pads[0]?.steps).toEqual(Array(16).fill(0));
      expect(next.pads[0]?.sampleUrl).toBe('blob:original');
      expect(next.pads[0]?.id).toBe('kick');
      expect(track.activeDrumPattern).toBe(0);
    }
  });
  it('restores Pattern 1 hits, all hit metadata and loop region after manual serialization', () => {
    const second = { ...track, ...recallDrumSequence(track, 1) };
    const reopened = JSON.parse(JSON.stringify(second));
    const first = recallDrumSequence(reopened, 0);
    expect(first.pads).toEqual(track.pads);
    expect(first.patternRegion).toEqual([16, 32]);
  });
  it('keeps bank B empty and restores A and its selected pattern after bank switches', () => {
    const two = { ...track, ...recallDrumSequence(track, 1, true) };
    const b = { ...two, ...recallDrumBank(two, 1) };
    expect(b.pads).toEqual([]);
    const a = recallDrumBank(b, 0);
    expect(a.pads).toEqual(track.pads);
    expect(recallDrumSequence({ ...two, ...a }, 0).pads).toEqual(track.pads);
  });
  it('copies only rhythm data and recalls edited patterns independently', () => {
    const copied = { ...track, ...recallDrumSequence(track, 1, true) };
    expect(copied.pads).toEqual(track.pads);
    copied.pads = copied.pads.map(pad => ({ ...pad, pitch: 7, steps: Array(16).fill(0) }));
    const first = { ...copied, ...recallDrumSequence(copied, 0) };
    expect(first.pads[0]?.pitch).toBe(7);
    expect(first.pads[0]?.steps[0]).toBe(1);
    expect(recallDrumSequence(first, 1).pads[0]?.steps).toEqual(Array(16).fill(0));
  });
});