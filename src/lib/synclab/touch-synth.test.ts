import { describe, expect, it } from 'vitest';
import { touchPitch, touchCutoff, loopsToNotes, placeLoopNote, eraseLoopNote, TOUCH_LANES, TOUCH_LOOP_STEPS, TOUCH_SCALES, TOUCH_SOUNDS } from './touch-synth';
import { applyPreset } from './presets';
describe('touch synth', () => {
 it('places a note in one lane without changing the other loops', () => {
   const bass = [{ step: 4, pitch: 36, length: 1, vel: .9 }];
   const result = placeLoopNote({ bass }, 'melody', { step: 31.8, pitch: 60, length: 4, vel: .9 });
   expect(result['bass']).toEqual(bass);
   expect(result['melody']).toEqual([{ step: 31, pitch: 60, length: 1, vel: .9 }]);
 });
 it('erases just one note and keeps all other notes and lanes', () => {
   const a = { step: 0, pitch: 36, length: 1, vel: .9 };
   const b = { ...a, step: 4 };
   const result = eraseLoopNote({ bass: [a, b], melody: [a] }, 'bass', 0);
   expect(result['bass']).toEqual([b]);
   expect(result['melody']).toEqual([a]);
 });
 it('exports notes from all five loops together', () => {
   const loops = Object.fromEntries(TOUCH_LANES.map(l => [l.id, [{ step: 0, pitch: l.drums ? 0 : 60, length: 1, vel: .9 }]]));
   expect(loopsToNotes(loops, 0, 7).map(n => n.id.split('-')[1])).toEqual(['drums', 'bass', 'poly', 'melody', 'stabs']);
 });
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
    expect(TOUCH_LANES[0]?.drums?.length).toBe(5);
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
