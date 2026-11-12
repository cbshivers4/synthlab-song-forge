import { describe, expect, it } from 'vitest';
import { boundedRegions, capturedNote, loopRegion, snapRecordedStep } from './recording-region';
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
describe('snap recorded notes', () => {
 it('moves a slightly late or early note onto the nearest 1/16 line', () => {
  expect(snapRecordedStep(16.3, 1, [16, 32], true)).toBe(16);
  expect(snapRecordedStep(19.7, 1, [16, 32], true)).toBe(20);
 });
 it('uses a coarser grid when chosen', () => {
  expect(snapRecordedStep(17.6, 4, [16, 32], true)).toBe(16);
  expect(snapRecordedStep(18.2, 4, [16, 32], true)).toBe(20);
 });
 it('wraps a note played just before the loop end to the loop start', () => {
  expect(snapRecordedStep(31.8, 1, [16, 32], true)).toBe(16);
 });
 it('never snaps before the recorded region', () => {
  expect(snapRecordedStep(15.9, 4, [16, 32], true)).toBe(16);
 });
});
