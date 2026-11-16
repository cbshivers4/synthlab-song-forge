import { beforeEach, describe, expect, it } from 'vitest';
import { DRUM_KITS, SYNTH_PRESETS } from './presets';
import { ALL_TOUCH_PROGRAMS, ARP_PROGRAM_GATES, TOUCH_KIT_PROGRAMS, TOUCH_PROGRAM_GROUPS } from './touch-programs';
import { createLoopPattern, genreLoops, TOUCH_LOOP_GENRES, TOUCH_LOOP_LIBRARY } from './touch-loop-library';
import { eraseLoopStep, gateArpById, gateArpHit, gateDegree, loopStepsFor, loopsToNotes, resizeLoops, touchPitch, touchX, TOUCH_GATE_ARPS, TOUCH_LANES, TOUCH_SCALE_GROUPS, TOUCH_SCALES } from './touch-synth';
import { deleteTouchSet, readTouchSets, saveTouchSet } from './touch-user-sets';

const presetNames = new Set(SYNTH_PRESETS.map((p) => p.name));

describe('Touch Synth sounds (iKaossilator-style programs)', () => {
  it('has six sound categories plus drum kits, 168 sounds in all, every one a real factory sound', () => {
    expect(TOUCH_PROGRAM_GROUPS.map((g) => g.label)).toEqual(['LEAD', 'ACOUSTIC', 'BASS', 'CHORD', 'ARP / GATE', 'SE / FX']);
    expect(ALL_TOUCH_PROGRAMS.length + TOUCH_KIT_PROGRAMS.length).toBe(168);
    expect(new Set(ALL_TOUCH_PROGRAMS).size).toBe(ALL_TOUCH_PROGRAMS.length);
    for (const name of ALL_TOUCH_PROGRAMS) expect(presetNames.has(name), name).toBe(true);
    expect(TOUCH_KIT_PROGRAMS.map((k) => k.id)).toEqual(DRUM_KITS.map((k) => k.id));
  });
  it('every arp/gate sound starts a real gate rhythm', () => {
    const arpGroup = TOUCH_PROGRAM_GROUPS.find((g) => g.id === 'arp')!;
    for (const name of arpGroup.programs) expect(gateArpById(ARP_PROGRAM_GATES[name]).steps.length, name).toBeGreaterThan(0);
  });
  it('every scale is listed in exactly one scale group', () => {
    const listed = TOUCH_SCALE_GROUPS.flatMap((g) => g.scales);
    expect(new Set(listed).size).toBe(listed.length);
    expect([...listed].sort()).toEqual(Object.keys(TOUCH_SCALES).sort());
  });
});

describe('Touch Synth pad', () => {
  it('RANGE widens the pad: 1 octave ends one octave up, 4 octaves ends four up', () => {
    expect(touchPitch(1, 0, 3, 'Major', 1)).toBe(60);
    expect(touchPitch(1, 0, 3, 'Major', 4)).toBe(96);
  });
  it('touchX finds where a pitch sits on the pad', () => {
    for (const x of [0, .25, .5, 1]) {
      const pitch = touchPitch(x, 2, 3, 'Dorian', 2);
      expect(touchPitch(touchX(pitch, 2, 3, 'Dorian', 2), 2, 3, 'Dorian', 2)).toBe(pitch);
    }
  });
  it('gate-arp notes stay in the chosen scale and the octave jump is a true octave', () => {
    for (const scale of ['Minor pentatonic', 'Major', 'Blues', 'Hirajoshi']) {
      const len = TOUCH_SCALES[scale]!.length;
      for (const arp of TOUCH_GATE_ARPS) for (const hit of arp.steps) for (const d of hit?.deg ?? []) {
        expect(TOUCH_SCALES[scale]).toContain(touchPitch(.3, 0, 3, scale, 2, gateDegree(d, len)) % 12);
      }
      const base = touchPitch(.3, 0, 3, scale, 2);
      expect(touchPitch(.3, 0, 3, scale, 2, gateDegree(100, len))).toBe(base + 12);
    }
  });
  it('gate-arp patterns repeat on the 16th grid; Off plays no pattern', () => {
    const gate8 = gateArpById('gate8');
    expect(gateArpHit(gate8, 0)).not.toBeNull();
    expect(gateArpHit(gate8, 1)).toBeNull();
    expect(gateArpHit(gate8, 2)).not.toBeNull();
    expect(gateArpById('off').steps).toHaveLength(0);
    expect(gateArpById('nope').id).toBe('off');
  });
});

describe('Touch Synth loop sequencer', () => {
  it('loop length is 1, 2 or 4 bars; old sets with no length stay 2 bars', () => {
    expect(loopStepsFor(1)).toBe(16);
    expect(loopStepsFor(undefined)).toBe(32);
    expect(loopStepsFor(4)).toBe(64);
    expect(loopStepsFor(3)).toBe(32);
  });
  it('making the loop longer repeats what you recorded; shorter keeps the notes', () => {
    const loops = { bass: [{ step: 2, pitch: 36, length: 1, vel: .9 }] };
    expect(resizeLoops(loops, 16, 64)['bass']?.map((n) => n.step)).toEqual([2, 18, 34, 50]);
    expect(resizeLoops(loops, 32, 16)).toBe(loops);
  });
  it('hold-to-erase removes only the current part at the current step', () => {
    const a = { step: 4, pitch: 36, length: 1, vel: .9 };
    const loops = { bass: [a, { ...a, step: 5 }], melody: [a] };
    const out = eraseLoopStep(loops, 'bass', 4);
    expect(out['bass']?.map((n) => n.step)).toEqual([5]);
    expect(out['melody']).toEqual([a]);
    expect(eraseLoopStep(loops, 'bass', 9)).toBe(loops);
  });
  it('send to timeline leaves out muted parts and notes past the loop end', () => {
    const loops = { bass: [{ step: 0, pitch: 36, length: 1, vel: .9 }, { step: 20, pitch: 38, length: 1, vel: .9 }], melody: [{ step: 1, pitch: 60, length: 1, vel: .9 }] };
    const notes = loopsToNotes(loops, 0, 1, 16, { melody: true });
    expect(notes.map((n) => n.pitch)).toEqual([36]);
  });
});

describe('Touch Synth loop sets', () => {
  it('every factory set has a real drum kit, tempo and four real sounds', () => {
    const kits = new Set(DRUM_KITS.map((k) => k.id));
    for (const preset of TOUCH_LOOP_LIBRARY) {
      expect(kits.has(preset.pattern.kit), preset.genre).toBe(true);
      expect(preset.pattern.bpm).toBeGreaterThanOrEqual(60);
      expect(preset.pattern.bpm).toBeLessThanOrEqual(190);
      for (const name of Object.values(preset.pattern.sounds)) expect(presetNames.has(name), `${preset.genre}: ${name}`).toBe(true);
    }
    expect(TOUCH_LOOP_GENRES).toEqual(expect.arrayContaining(['Electro', 'Ghetto Tech', 'Dubstep', 'Trance', 'Amapiano', 'Lo-Fi Hip-Hop', 'Drill']));
  });
  it('4-bar sets fill 64 steps and 1-bar sets stay inside 16', () => {
    const preset = TOUCH_LOOP_LIBRARY[0]!;
    const four = Object.values(genreLoops(preset, 0, preset.scale, 4)).flat();
    expect(Math.max(...four.map((n) => n.step))).toBeGreaterThanOrEqual(48);
    for (const n of four) expect(n.step + n.length).toBeLessThanOrEqual(64);
    for (const n of Object.values(genreLoops(preset, 0, preset.scale, 1)).flat()) expect(n.step + n.length).toBeLessThanOrEqual(16);
  });
  it('CREATE writes a new in-scale set: same seed same set, different seed different set', () => {
    for (const preset of TOUCH_LOOP_LIBRARY.filter((p) => p.variation === 0)) {
      const a = createLoopPattern(preset.pattern, 42);
      expect(createLoopPattern(preset.pattern, 42)).toEqual(a);
      expect(JSON.stringify(createLoopPattern(preset.pattern, 43))).not.toBe(JSON.stringify(a));
      const loops = genreLoops({ variation: 0, pattern: a }, 0);
      for (const lane of TOUCH_LANES) {
        expect(loops[lane.id]?.length, `${preset.genre} ${lane.id}`).toBeGreaterThan(0);
        if (!lane.drums) for (const n of loops[lane.id] ?? []) expect(TOUCH_SCALES[a.scale]).toContain(n.pitch % 12);
      }
      expect(a.kick).toEqual(preset.pattern.kick);
    }
  });
});

describe('My Sets', () => {
  beforeEach(() => {
    const store = new Map<string, string>();
    (globalThis as { localStorage?: unknown }).localStorage = { getItem: (k: string) => store.get(k) ?? null, setItem: (k: string, v: string) => void store.set(k, v), removeItem: (k: string) => void store.delete(k) };
  });
  it('saves a set, replaces one with the same name, and deletes it', () => {
    const base = { root: 2, scale: 'Dorian', bars: 4, bpm: 124, sounds: { bass: 'Sub Bass' }, loops: { bass: [{ step: 0, pitch: 38, length: 1, vel: .9 }] } };
    const first = saveTouchSet({ ...base, name: 'Night Ride' });
    saveTouchSet({ ...base, name: 'night ride', bars: 1 });
    const sets = readTouchSets();
    expect(sets).toHaveLength(1);
    expect(sets[0]?.id).toBe(first.id);
    expect(sets[0]?.bars).toBe(1);
    deleteTouchSet(first.id);
    expect(readTouchSets()).toEqual([]);
  });
});
