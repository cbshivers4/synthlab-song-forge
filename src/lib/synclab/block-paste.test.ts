import { describe, expect, it } from 'vitest';
import { copyPartSpan, pasteTrackContent } from './arrangement-edit';
import { cutTrackMaterial } from './workflow';
import type { Track } from './types';

const pad = { id: 'k', name: 'Kick', kind: 'kick' as const, volume: 1, pan: 0, pitch: 0, decay: 0.5, muted: false, solo: false, steps: [1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0] };
const base: Track = { id: 'd', name: 'Kick', kind: 'drum', color: 'grey', volume: 0.7, pan: 0, muted: false, solo: false, armed: false, frozen: false, hidden: false, input: 'none', bus: 'master', steps: 16, clips: [], pads: [pad] };
// Eight separate 1-bar blocks across bars 1-8 (16 steps per bar).
const eightBlocks: Track = { ...base, patternRegion: [0, 128], cuts: [16, 32, 48, 64, 80, 96, 112] };

describe('pasting copied blocks keeps them separate', () => {
  it('eight copied 1-bar blocks paste as eight 1-bar blocks, not one long block', () => {
    const next = pasteTrackContent(eightBlocks, eightBlocks, 128, 0.125);
    const pastedCuts = next.cuts!.filter(c => c >= 128 && c <= 256);
    expect(pastedCuts).toEqual([128, 144, 160, 176, 192, 208, 224, 240, 256]);
  });
  it('a copied 2-bar block made of two 1-bar blocks keeps its middle cut', () => {
    const { track } = copyPartSpan(eightBlocks, [32, 64], 0.125);
    const next = pasteTrackContent(eightBlocks, track, 128, 0.125);
    expect(next.cuts!.filter(c => c >= 128)).toEqual([128, 144, 160]);
  });
});

describe('copying only the boxed blocks', () => {
  it('a box over bars 3-4 copies just those 2 bars of hits', () => {
    const { track, span } = copyPartSpan(eightBlocks, [32, 64], 0.125);
    expect(span).toEqual([32, 64]);
    const next = pasteTrackContent(base, track, 0, 0.125);
    expect(next.patternRegion).toEqual([0, 32]);
    expect(next.pads![0]!.steps.slice(0, 32).filter(v => v > 0).length).toBe(8);
  });
  it('cutting a boxed 4-bar group only empties those 4 bars', () => {
    const { patch, span } = cutTrackMaterial(eightBlocks, 120, 8, undefined, [0, 64]);
    expect(span).toEqual([0, 64]);
    const steps = patch.pads![0]!.steps;
    expect(steps.slice(0, 64).some(v => v > 0)).toBe(false);
    expect(steps.slice(64, 128).filter(v => v > 0).length).toBe(16);
  });
  it('a boxed synth part copies only the notes inside it', () => {
    const synth: Track = { ...base, kind: 'instrument', pads: undefined, steps: 64, cuts: [16, 32],
      notes: [{ id: 'a', pitch: 60, step: 0, length: 4, velocity: 0.8 }, { id: 'b', pitch: 62, step: 20, length: 4, velocity: 0.8 }, { id: 'c', pitch: 64, step: 40, length: 4, velocity: 0.8 }] };
    const { track } = copyPartSpan(synth, [16, 32], 0.125);
    expect(track.notes!.map(n => n.pitch)).toEqual([62]);
  });
});
