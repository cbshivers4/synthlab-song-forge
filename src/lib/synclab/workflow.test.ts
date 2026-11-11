import { describe, expect, it } from 'vitest';
import { deleteSelectedPart, selectedClip, selectedPartBounds } from './workflow';
import type { Track } from './types';

const track = (values: Partial<Track>) => ({ id: 'track', kind: 'audio', ...values }) as Track;
describe('selected-part workflow', () => {
  it('does nothing when only a channel is selected', () => {
    expect(deleteSelectedPart(track({ notes: [{ id: 'n', step: 0, length: 1, pitch: 60, velocity: 1 }] }), 120, 4)).toBeNull();
  });
  it('deletes only the selected audio clip and preserves sibling clips', () => {
    const patch = deleteSelectedPart(track({ activeClipId: 'a', clips: [{ id: 'a', name: 'A', duration: 2, peaks: [] }, { id: 'b', name: 'B', duration: 2, peaks: [] }] }), 120, 4);
    expect(patch?.clips?.map(c => c.id)).toEqual(['b']);
    expect(patch).not.toHaveProperty('id');
  });
  it('erases one bar of repeating notes without erasing other bars', () => {
    const patch = deleteSelectedPart(track({ kind: 'instrument', steps: 16, activeRegion: 0, notes: [{ id: 'n', step: 0, length: 1, pitch: 60, velocity: 1 }] }), 120, 4, [16, 32]);
    expect(patch?.notes?.map(n => n.step)).toEqual([0, 32, 48]);
    expect(patch?.steps).toBe(64);
  });
  it('erases one drum loop without muting the repeated beat in sibling bars', () => {
    const t = track({ kind: 'drum', activeRegion: 0, steps: 16, pads: [{ id: 'kick', steps: [1, 0, 0, 0] }] as Track['pads'] });
    const patch = deleteSelectedPart(t, 120, 4, [16, 32]);
    expect(patch?.pads?.[0]?.steps[0]).toBe(1);
    expect(patch?.pads?.[0]?.steps[16]).toBe(0);
    expect(patch?.pads?.[0]?.steps[32]).toBe(1);
  });
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
  it('deletes the tapped note block, not a hidden recorded take on the same channel', () => {
    const notes = [{ id: 'a', step: 0, length: 1, pitch: 60, velocity: 1 }, { id: 'b', step: 20, length: 1, pitch: 62, velocity: 1 }];
    const t = track({ kind: 'instrument', steps: 64, notes, cuts: [16], activeRegion: 16, activeClipId: 'take', printedAudio: false, clips: [{ id: 'take', name: 'TAKE 1', duration: 2, peaks: [] }] });
    expect(selectedClip(t)).toBeUndefined();
    const patch = deleteSelectedPart(t, 120, 4);
    expect(patch?.clips).toBeUndefined();
    expect(patch?.notes?.map(n => n.id)).toEqual(['a']);
  });
  it('deletes a whole cut block even when it sits outside the loop markers', () => {
    const notes = [{ id: 'a', step: 0, length: 1, pitch: 60, velocity: 1 }, { id: 'b', step: 40, length: 1, pitch: 62, velocity: 1 }];
    const t = track({ kind: 'instrument', steps: 64, notes, cuts: [32], activeRegion: 32 });
    const patch = deleteSelectedPart(t, 120, 4, [0, 16]);
    expect(patch?.notes?.map(n => n.id)).toEqual(['a']);
  });
});
