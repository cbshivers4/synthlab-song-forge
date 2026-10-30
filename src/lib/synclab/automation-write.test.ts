import { describe, expect, it } from 'vitest';
import { laneReads, laneWrites, liveValue, movedLiveParams, writePoint } from './automation-write';
import type { Track } from './types';

const track = { volume: 0.8, pan: -0.25, sends: { reverb: 0.3, delay: 0.1, chorus: 0 } } as Track;

describe('fader and pan automation recording', () => {
  it('moving the fader or pan marks only those lanes as touched', () => {
    expect(movedLiveParams(track, { volume: 0.5 })).toEqual(['volume']);
    expect(movedLiveParams(track, { pan: 0.5, muted: true })).toEqual(['pan']);
    expect(movedLiveParams(track, { sends: { reverb: 0.6, delay: 0.1, chorus: 0 } })).toEqual(['sendReverb']);
    expect(movedLiveParams(track, { name: 'X' })).toEqual([]);
  });
  it('records the live fader value at the heard step, replacing a point already there', () => {
    expect(liveValue(track, 'volume')).toBe(0.8);
    expect(liveValue(track, 'pan')).toBe(-0.25);
    expect(writePoint([{ step: 0, value: 1 }, { step: 4, value: 0.2 }], 4, 0.8)).toEqual([{ step: 0, value: 1 }, { step: 4, value: 0.8 }]);
  });
  it('Write always records, Touch only while moving, Latch from first touch on; Latch plays back before it is touched', () => {
    expect(laneWrites({ mode: 'write' }, false, false)).toBe(true);
    expect(laneWrites({ mode: 'touch' }, false, false)).toBe(false);
    expect(laneWrites({ mode: 'touch' }, true, false)).toBe(true);
    expect(laneWrites({ mode: 'latch' }, false, true)).toBe(true);
    expect(laneWrites({ mode: 'write', locked: true }, true, true)).toBe(false);
    expect(laneReads({ mode: 'latch' }, false, false)).toBe(true);
    expect(laneReads({ mode: 'latch' }, false, true)).toBe(false);
    expect(laneReads({ mode: 'touch' }, true, false)).toBe(false);
  });
});
