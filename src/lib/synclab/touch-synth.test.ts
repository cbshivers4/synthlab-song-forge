import { describe, expect, it } from 'vitest';
import { touchDrumAt, TOUCH_DRUM_COLUMNS, touchPitch, touchCutoff, loopsToNotes, placeLoopNote, eraseLoopNote, TOUCH_LANES, TOUCH_LOOP_STEPS, TOUCH_SCALES, TOUCH_SOUNDS } from './touch-synth';
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
    expect(TOUCH_LANES[0]?.drums?.slice(0, 5)).toEqual(['kick', 'snare', 'hat', 'clap', 'tom']);
  });
  it('flattens recorded lane loops into timeline notes at the playhead', () => {
    const notes = loopsToNotes({ bass: [{ step: 4, pitch: 36, length: 1, vel: .9 }], drums: [{ step: 0, pitch: 0, length: .5, vel: 1 }] }, 64, 1);
    expect(notes).toHaveLength(2);
    expect(notes.find(n => n.pitch === 36 && n.step === 68)).toBeTruthy();
    expect(notes.find(n => n.step === 64)?.pitch).toBe(36);
    expect(loopsToNotes({}, 0, 1)).toEqual([]);
    expect(TOUCH_LOOP_STEPS).toBe(32);
  });
  it('drum pad: column 1 is the kick only', () => {
    for (const y of [0, .3, .7, 1]) expect(TOUCH_LANES[0]?.drums?.[touchDrumAt(.1, y)]).toBe('kick');
  });
  it('drum pad: column 2 is closed hi-hat at the bottom and open hi-hat at the top', () => {
    expect(TOUCH_LANES[0]?.drums?.[touchDrumAt(.37, .2)]).toBe('hat');
    expect(TOUCH_LANES[0]?.drums?.[touchDrumAt(.37, .8)]).toBe('openhat');
  });
  it('drum pad: column 3 is the snare only and column 4 the clap only', () => {
    for (const y of [0, .5, 1]) expect(TOUCH_LANES[0]?.drums?.[touchDrumAt(.6, y)]).toBe('snare');
    for (const y of [0, .5, 1]) expect(TOUCH_LANES[0]?.drums?.[touchDrumAt(.95, y)]).toBe('clap');
  });
  it('drum pad has four columns', () => {
    expect(TOUCH_DRUM_COLUMNS.map(c => c.label)).toEqual(['KICK', 'HI-HAT', 'SNARE', 'CLAP']);
  });
});
