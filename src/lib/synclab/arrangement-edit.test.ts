import { describe, expect, it } from 'vitest';
import { materialEnd, pasteTrackContent, rightEdgeEdit, timelinePasteStep } from './arrangement-edit';
import type { Track } from './types';

const track: Track = { id: 'audio', name: 'Take', kind: 'audio', color: 'grey', volume: 0.7, pan: 0.2, muted: false, solo: false, armed: false, frozen: false, hidden: false, input: 'none', bus: 'master', steps: 16, clips: [{ id: 'clip', name: 'Take', duration: 2, length: 2, peaks: [1], start: 0 }] };
describe('arrangement paste', () => {
  it('pastes at the clicked location without substituting the playhead', () => {
    expect(timelinePasteStep(8, 32)).toBe(32);
    expect(pasteTrackContent(track, track, timelinePasteStep(8, 32), 0.125).clips?.[1]?.start).toBe(32);
  });
  it('pastes at the playhead when no area is specified', () => {
    expect(timelinePasteStep(24)).toBe(24);
    expect(pasteTrackContent(track, track, timelinePasteStep(24), 0.125).clips?.[1]?.start).toBe(24);
  });
  it('pastes on the same channel at its end/playhead without replacing its settings', () => {
    const next = pasteTrackContent(track, track, 16, 0.125);
    expect(next.id).toBe('audio');
    expect(next.volume).toBe(0.7);
    expect(next.clips?.map(c => c.start)).toEqual([0, 16]);
    expect(next.clips?.[1]?.id).not.toBe('clip');
    expect(materialEnd(next, 0.125)).toBe(32);
  });
  it('appends drum hits at the end of the drum track instead of overwriting the start', () => {
    const pad = { id: 'k', name: 'Kick', kind: 'kick' as const, volume: 1, pan: 0, pitch: 0, decay: 0.5, muted: false, solo: false, steps: [1, 0, 0, 0] };
    const drums: Track = { ...track, kind: 'drum', clips: [], steps: 4, pads: [pad] };
    const next = pasteTrackContent(drums, drums, materialEnd(drums, 0.125), 0.125);
    expect(next.steps).toBe(8);
    expect(next.pads?.[0]?.steps).toEqual([1, 0, 0, 0, 1, 0, 0, 0]);
  });
  it('places note content at the playhead once rather than repeating it before that position', () => {
    const source = { ...track, kind: 'instrument' as const, clips: [], notes: [{ id: 'n', step: 0, length: 4, pitch: 60, velocity: 1 }] };
    const next = pasteTrackContent(source, source, 32, 0.125);
    expect(next.notes?.[1]).toMatchObject({ step: 32, recordedEnd: 48 });
    expect(next.notes?.[0]?.step).toBe(0);
  });
});
describe('clip right edge', () => {
  const clip = { id: 'c', name: 'Take', duration: 2, peaks: [1] };
  it('stretches a full two-second take to four seconds instead of capping its edge', () => {
    expect(rightEdgeEdit(clip, 2, 2, false)).toEqual({ seconds: 4, length: 2, stretch: 2 });
  });
  it('reveals available source before stretching and respects offset', () => {
    expect(rightEdgeEdit({ ...clip, duration: 6, offset: 2, length: 2 }, 2, 2, false).stretch).toBeNull();
    expect(rightEdgeEdit({ ...clip, duration: 6, offset: 2, length: 2 }, 4, 2, false).stretch).toBe(3);
  });
  it('converts a rate-adjusted clip into timeline seconds', () => {
    expect(rightEdgeEdit({ ...clip, speed: 2 }, 3, 2, false)).toEqual({ seconds: 4, length: 2, stretch: 4 });
  });
});