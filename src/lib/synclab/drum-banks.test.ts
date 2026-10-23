import { describe, expect, it } from 'vitest';
import { appendDrumPad, recallDrumBank } from './drum-banks';

const pads = appendDrumPad({ steps: 16 }, 'kick', { name: 'KICK', kind: 'kick' });
const track = { pads: [{ ...pads[0], steps: [1, ...Array(15).fill(0)] }], steps: 16, activeDrumPattern: 0 };
describe('drum banks', () => {
  it('leaves every unused bank B-H entirely empty', () => {
    for (let bank = 1; bank < 8; bank++) expect(recallDrumBank(track, bank).pads).toEqual([]);
  });
  it('restores A without losing its sounds or hits', () => {
    const b = recallDrumBank(track, 1);
    expect(recallDrumBank({ ...b, steps: 16 }, 0).pads).toEqual(track.pads);
  });
  it('retains added sounds only in their bank through save/reopen', () => {
    const b = recallDrumBank(track, 1);
    b.pads = appendDrumPad({ ...b, steps: 16 }, 'conga', { name: 'CONGA', voice: 'conga_hi', kind: 'tom', kit: 'latin' });
    const a = recallDrumBank({ ...b, steps: 16 }, 0);
    const reopened = JSON.parse(JSON.stringify({ ...a, steps: 16 }));
    expect(recallDrumBank(reopened, 1).pads.map(p => [p.id, p.voice, p.kit])).toEqual([['conga', 'conga_hi', 'latin']]);
    expect(a.pads).toEqual(track.pads);
  });
  it('adds a separate sample pad with silent steps without replacing existing pads', () => {
    const result = appendDrumPad(track, 'sample', { name: 'My sample', sample: 'sample.wav', sampleUrl: 'blob:sample' });
    expect(result[0]).toEqual(track.pads[0]);
    expect(result[1]?.sampleUrl).toBe('blob:sample');
    expect(result[1]?.steps).toEqual(Array(16).fill(0));
  });
});