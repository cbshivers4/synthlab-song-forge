import { describe, expect, it } from 'vitest';
import { timelineUsesWaveform } from './timeline-content';
import type { Track } from './types';

const clips: Track['clips'] = [{ id: 'take', name: 'Take', duration: 8, peaks: [0.2] }];

describe('timeline razor target', () => {
  for (const kind of ['instrument', 'midi', 'sampler', 'drum'] as const) {
    it(`cuts the visible ${kind} pattern rather than its hidden recording`, () => {
      expect(timelineUsesWaveform({ kind, clips, printedAudio: false })).toBe(false);
    });
    it(`cuts the visible ${kind} recording when wave playback is selected`, () => {
      expect(timelineUsesWaveform({ kind, clips, printedAudio: true })).toBe(true);
    });
  }
  it('cuts imported audio regardless of the instrument playback flag', () => {
    expect(timelineUsesWaveform({ kind: 'audio', clips, printedAudio: false })).toBe(true);
  });
  it('uses patterns when there is no recording', () => {
    expect(timelineUsesWaveform({ kind: 'drum', clips: [], printedAudio: true })).toBe(false);
  });
});