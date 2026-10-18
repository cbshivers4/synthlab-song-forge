import { describe, expect, it } from 'vitest';
import { boundedRegions, capturedNote, loopRegion } from './recording-region';
import { unrollNotes } from './note-cuts';
describe('loop recording', () => {
 const bounds: [number, number] = [16,32];
 const note = {id:'live', step:20, length:1, pitch:60, velocity:0.9};
 it('displays a live captured note only once', () => {
  const n = capturedNote(note,bounds);
  expect(n).not.toBeNull();
  expect(unrollNotes(n ? [n] : [],16,64).map(n=>n.step)).toEqual([20]);
 });
 it('rejects manual notes outside markers and trims crossing notes', () => {
  expect(capturedNote({...note,step:15},bounds)).toBeNull();
  expect(capturedNote({...note,step:32},bounds)).toBeNull();
  expect(capturedNote({...note,step:31.5,length:4},bounds)?.length).toBe(0.5);
 });
 it('bounds drum parts and cuts to markers', () => {
  expect(boundedRegions([[0,24],[24,64]],bounds)).toEqual([[16,24],[24,32]]);
  expect(loopRegion({bars:4,loopStart:16,loopEnd:32})).toEqual(bounds);
 });
});
