import { describe, expect, it } from 'vitest';
import { factoryKitPad, renderVintageDrum } from './vintage-drums';
import { defaultPads } from './presets';
import type { DrumKitId, DrumPad } from './types';
const kits: DrumKitId[] = ['808', '909', '727', 'linn', 'r8', 'latin', 'jazz', 'rock'];
describe('distinct original vintage drum audio', () => {
  for (const kit of kits) it(`${kit} produces finite audible PCM for every pad`, () => {
    for (const kind of ['kick','snare','clap','hat','openhat','tom','perc','rim','crash','ride','fx'] as DrumPad['kind'][]) {
      const pcm = renderVintageDrum(kit, kind, .5, 22050);
      expect(pcm).not.toBeNull();
      if (!pcm) return;
      expect(pcm.every(Number.isFinite)).toBe(true);
      expect(Math.max(...pcm.slice(0,10000).map(Math.abs))).toBeGreaterThan(.01);
      expect(pcm.every(v => Math.abs(v) <= 1)).toBe(true);
    }
  });
  it('the requested machines and genre kits have different kick/snare/hat waveforms', () => {
    for (const kind of ['kick','snare','hat'] as DrumPad['kind'][]) {
      const voices = kits.map(kit => renderVintageDrum(kit, kind, .5, 22050));
      for (let i=0; i<voices.length; i++) for (let j=i+1; j<voices.length; j++) {
        const a=voices[i], b=voices[j]; if (!a || !b) throw new Error('missing voice');
        let distance=0;
        for (let f=100; f<3000; f++) distance += ((a[f] ?? 0)-(b[f] ?? 0))**2;
        expect(distance/2900).toBeGreaterThan(.0005);
      }
    }
  });
  it('808 has a longer booming kick tail than 909', () => {
    const a=renderVintageDrum('808','kick',.5,22050), b=renderVintageDrum('909','kick',.5,22050);
    expect(a?.length).toBeGreaterThan(b?.length ?? Infinity);
  });
  it('factory kit replaces loaded samples but preserves patterns, IDs and MIDI notes', () => {
    const pad={...defaultPads()[0], sample:'old.wav',sampleUrl:'blob:old',note:44} as DrumPad;
    const result=factoryKitPad(pad,'727',.4);
    expect(result.sampleUrl).toBeUndefined(); expect(result.sample).toBeUndefined();
    expect(result.name).toBe('LOW CONGA'); expect(result.id).toBe(pad.id); expect(result.steps).toBe(pad.steps); expect(result.note).toBe(44);
    expect(factoryKitPad(result,'909',.5).name).toBe('KICK');
  });
  it('decay changes the rendered audio tail', () => {
    expect(renderVintageDrum('rock','snare',.8,22050)?.length).toBeGreaterThan(renderVintageDrum('rock','snare',.2,22050)?.length ?? Infinity);
  });
});
