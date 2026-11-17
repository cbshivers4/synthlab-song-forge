import { describe, expect, it, vi } from 'vitest';
import { OFFLINE_LIVE, scheduleStep } from './schedule-step';
import { defaultPatch } from './presets';
import type { Track, Transport } from './types';

const base = { color: 'grey', volume: 0.8, pan: 0, muted: false, solo: false, armed: false, frozen: false, hidden: false, input: 'none', bus: 'master' } as const;
const synth: Track = { ...base, id: 's', name: 'Synth', kind: 'instrument', steps: 16, patch: defaultPatch(), notes: [{ id: 'n1', step: 4, length: 2, pitch: 48, velocity: 0.9 }] };
const tp = { bpm: 120, bars: 4, step: 0, playing: true, loop: false, swing: 0, metronome: false } as unknown as Transport;
const engine = () => ({ tempo: 0, playNote: vi.fn(), playDrum: vi.fn(), playClip: vi.fn(), playSample: vi.fn(), playClick: vi.fn(), setPitchBend: vi.fn(), setModWheel: vi.fn() });

describe('unmute is instant during live playback', () => {
  it('live playback keeps a muted channel running behind its silent fader', () => {
    const e = engine();
    for (let n = 0; n < 16; n++) scheduleStep(e as never, [{ ...synth, muted: true }], tp, n, n * 0.125, { ...OFFLINE_LIVE, includeSilenced: true });
    expect(e.playNote).toHaveBeenCalledTimes(1);
  });
  it('exports still leave muted and soloed-out channels out', () => {
    const e = engine();
    const other: Track = { ...synth, id: 'o', solo: true, notes: [] };
    for (let n = 0; n < 16; n++) scheduleStep(e as never, [{ ...synth, muted: true }], tp, n, n * 0.125, OFFLINE_LIVE);
    for (let n = 0; n < 16; n++) scheduleStep(e as never, [synth, other], tp, n, n * 0.125, OFFLINE_LIVE);
    expect(e.playNote).not.toHaveBeenCalled();
  });
});
