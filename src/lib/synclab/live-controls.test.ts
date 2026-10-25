import { describe, expect, it, vi } from 'vitest';
import { SyncLabEngine } from './audio-engine';
import { defaultPatch } from './presets';
import type { Track, SynthPatch } from './types';

describe('live sound-control dispatch', () => {
  it('updates a sounding voice once with the edited cutoff and does not trigger another note', () => {
    const engine = new SyncLabEngine();
    engine.ctx = { currentTime: 2 } as AudioContext;
    const patch = defaultPatch();
    const update = vi.fn();
    const voice = { end: 10, patch, update };
    const internals = engine as unknown as { liveVoices: Map<string, Set<typeof voice>> };
    internals.liveVoices.set('synth', new Set([voice]));
    const play = vi.spyOn(engine, 'playNote');
    const next: SynthPatch = { ...patch, cutoff: 40 };
    const tracks = [{ id: 'synth', patch: next }] as Track[];
    engine.syncSoundControls(tracks);
    engine.syncSoundControls(tracks);
    expect(update).toHaveBeenCalledExactlyOnceWith(next, 2);
    expect(voice.patch.cutoff).toBe(40);
    expect(play).not.toHaveBeenCalled();
  });
  it('expires completed voices rather than updating or reviving them', () => {
    const engine = new SyncLabEngine();
    engine.ctx = { currentTime: 12 } as AudioContext;
    const update = vi.fn();
    const voice = { end: 10, patch: defaultPatch(), update };
    const internals = engine as unknown as { liveVoices: Map<string, Set<typeof voice>> };
    internals.liveVoices.set('synth', new Set([voice]));
    engine.syncSoundControls([{ id: 'synth', patch: defaultPatch() }] as Track[]);
    expect(update).not.toHaveBeenCalled();
    expect(internals.liveVoices.has('synth')).toBe(false);
  });
  it('does not rewrite a held drum sound when only its steps change', () => {
    const engine = new SyncLabEngine();
    engine.ctx = { currentTime: 2 } as AudioContext;
    const pad = { id: 'kick', volume: 0.8, pan: 0, pitch: 0, steps: [1, 0] } as import('./types').DrumPad;
    const update = vi.fn();
    const voice = { end: 10, pad, update };
    const internals = engine as unknown as { liveDrums: Map<string, Set<typeof voice>> };
    internals.liveDrums.set(JSON.stringify(['drums', 'kick']), new Set([voice]));
    const edited = { ...pad, steps: [1, 1] };
    engine.syncSoundControls([{ id: 'drums', pads: [edited] }] as Track[]);
    expect(update).not.toHaveBeenCalled();
    expect(voice.pad).toBe(edited);
    const louder = { ...edited, volume: 1 };
    engine.syncSoundControls([{ id: 'drums', pads: [louder] }] as Track[]);
    expect(update).toHaveBeenCalledExactlyOnceWith(louder, 2);
  });
});