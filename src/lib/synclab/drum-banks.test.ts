import { describe, expect, it } from 'vitest';
import { appendDrumPad, initializeDrumBanks, recallDrumBank, removeDrumPads } from './drum-banks';

const pads = appendDrumPad({ steps: 16 }, 'kick', { name: 'KICK', kind: 'kick' });
const track = { pads: pads.map(pad => ({ ...pad, steps: [1, ...Array(15).fill(0)] })), steps: 16, activeDrumPattern: 0 };
describe('drum banks', () => {
  it('clears legacy prefilled B-H while leaving Bank A exactly unchanged', () => {
    const legacy = { ...track, drumPatterns: Array.from({ length: 8 }, () => structuredClone(track.pads)) };
    const result = initializeDrumBanks(legacy);
    expect(result?.pads).toEqual(track.pads);
    expect(result?.drumPatterns[0]).toEqual(track.pads);
    for (let bank = 1; bank < 8; bank++) expect(result?.drumPatterns[bank]).toEqual([]);
  });
  it('clears an active legacy Bank B without overwriting saved A', () => {
    const bankA = structuredClone(track.pads);
    const result = initializeDrumBanks({ ...track, activeDrumPattern: 1, pads: appendDrumPad(track, 'other'), drumPatterns: [bankA, track.pads] });
    expect(result?.pads).toEqual([]);
    expect(result?.drumPatterns[0]).toEqual(bankA);
  });
  it('keeps pads added after the one-time reset through project save and reopen', () => {
    const initialized = initializeDrumBanks(track);
    if (!initialized) throw new Error('Initialization missing');
    const b = recallDrumBank({ ...track, ...initialized }, 1);
    const added = appendDrumPad({ ...track, ...b }, 'user-sample', { sampleUrl: 'blob:sample' });
    const saved = { ...track, ...initialized, ...b, pads: added };
    const a = recallDrumBank(saved, 0);
    const reopened = JSON.parse(JSON.stringify({ ...saved, ...a }));
    expect(initializeDrumBanks(reopened)).toBeUndefined();
    expect(recallDrumBank(reopened, 1).pads.map(p => p.id)).toEqual(['user-sample']);
    expect(a.pads).toEqual(track.pads);
  });
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
  it('deletes one sound pad while retaining the sample pad and other banks', () => {
    const b = recallDrumBank(track, 1);
    const withSound = appendDrumPad({ ...b, steps: 16 }, 'sound', { kind: 'snare' });
    const withSample = appendDrumPad({ pads: withSound, steps: 16 }, 'sample', { sampleUrl: 'blob:sample' });
    const deleted = removeDrumPads({ ...b, pads: withSample }, ['sound']);
    expect(deleted.pads.map(p => p.id)).toEqual(['sample']);
    expect(deleted.pads[0]?.sampleUrl).toBe('blob:sample');
    expect(deleted.drumPatterns[0]).toEqual(track.pads);
    expect(deleted.drumPatterns[1]?.map(p => p.id)).toEqual(['sample']);
  });
  it('deletes multiple pads and keeps the emptied bank empty after switching and reopening', () => {
    const b = recallDrumBank(track, 1);
    const added = appendDrumPad({ ...b, steps: 16 }, 'sound');
    const both = appendDrumPad({ pads: added, steps: 16 }, 'sample', { sampleCloudPath: 'saved/sample.wav' });
    const deleted = removeDrumPads({ ...b, pads: both }, ['sound', 'sample']);
    expect(deleted.pads).toEqual([]);
    const a = recallDrumBank({ ...b, ...deleted, steps: 16 }, 0);
    const reopened = JSON.parse(JSON.stringify({ ...a, steps: 16 }));
    expect(recallDrumBank(reopened, 1).pads).toEqual([]);
    expect(a.pads).toEqual(track.pads);
  });
});