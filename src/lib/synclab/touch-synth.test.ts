import { describe, expect, it } from 'vitest';
import { touchPitch, touchCutoff, loopsToNotes, TOUCH_LANES, TOUCH_LOOP_STEPS, TOUCH_SCALES, TOUCH_SOUNDS } from './touch-synth';
import { applyPreset } from './presets';
describe('touch synth', () => {
 it('quantizes gestures to the chosen scale over two octaves', () => {
   expect(touchPitch(0,0,3,'Minor pentatonic')).toBe(48);
   expect(touchPitch(1,0,3,'Minor pentatonic')).toBe(72);
   for(let i=0;i<=100;i++) expect(TOUCH_SCALES['Minor pentatonic']).toContain(touchPitch(i/100,0,3,'Minor pentatonic')%12);
 });
 it('root and octave transpose the played pitch', () => {
   expect(touchPitch(0,7,4,'Major')).toBe(67);
 });
 it('vertical gestures change real filter cutoff', () => {
   expect(touchCutoff(0)).toBe(180); expect(touchCutoff(1)).toBe(14400);
   expect(touchCutoff(.8)).toBeGreaterThan(touchCutoff(.2));
 });
  it('every sound resolves to its own selected patch', () => {
    for(const sound of TOUCH_SOUNDS) expect(applyPreset(sound).name).toBe(sound);
  });
  it('has the five loop lanes: drums, bass, poly, melody, stabs', () => {
    expect(TOUCH_LANES.map(l => l.id)).toEqual(['drums','bass','poly','melody','stabs']);
    expect(TOUCH_LANES[0].drums?.length).toBe(5);
  });
  it('flattens recorded lane loops into timeline notes at the playhead', () => {
    const notes = loopsToNotes({ bass: [{ step: 4, pitch: 36, length: 1, vel: .9 }], drums: [{ step: 0, pitch: 0, length: .5, vel: 1 }] }, 64, 1);
    expect(notes).toHaveLength(2);
    expect(notes.find(n => n.pitch === 36 && n.step === 68)).toBeTruthy();
    expect(notes.find(n => n.step === 64)?.pitch).toBe(36);
    expect(loopsToNotes({}, 0, 1)).toEqual([]);
    expect(TOUCH_LOOP_STEPS).toBe(32);
  });
});
