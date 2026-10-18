import { describe, expect, it } from 'vitest';
import { selectedClip, selectedPartBounds } from './workflow';
import type { Track } from './types';

const track = (values: Partial<Track>) => ({ id: 'track', kind: 'audio', ...values }) as Track;
describe('selected-part workflow', () => {
  it('never treats an unselected first audio clip as the selected part', () => {
    const t = track({ clips: [{ id: 'clip', name: 'Take', duration: 2, peaks: [] }] });
    expect(selectedClip(t)).toBeUndefined();
    expect(selectedPartBounds(t, 120, 4)).toBeNull();
  });
  it('fits the loop to the explicit audio clip at its timeline position', () => {
    const t = track({ activeClipId: 'clip', clips: [{ id: 'clip', name: 'Take', start: 16, duration: 2, peaks: [] }] });
    expect(selectedPartBounds(t, 120, 4)).toEqual([16, 32]);
  });
  it('keeps selected drum parts inside loop-bounded edits', () => {
    expect(selectedPartBounds(track({ kind: 'drum', activeRegion: 24, cuts: [24], patternRegion: [16, 32] }), 120, 4)).toEqual([24, 32]);
  });
});