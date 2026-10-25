import { afterEach, describe, expect, it, vi } from 'vitest';
import { SyncLabEngine } from './audio-engine';
import type { Track } from './types';

afterEach(() => vi.useRealTimers());

function setup() {
  const node = () => ({ gain: { value: 1, setTargetAtTime: vi.fn(), cancelScheduledValues: vi.fn() }, pan: { setTargetAtTime: vi.fn() }, connect: vi.fn(), disconnect: vi.fn() });
  const engine = new SyncLabEngine();
  const ctx = { currentTime: 2, createGain: node, createStereoPanner: node, createAnalyser: node } as unknown as AudioContext;
  engine.ctx = ctx;
  vi.spyOn(engine, 'init').mockReturnValue(ctx);
  vi.spyOn(engine, 'busNode').mockReturnValue(node() as unknown as GainNode);
  engine.reverbSend = node() as unknown as GainNode;
  engine.chorusSend = node() as unknown as GainNode;
  engine.delaySend = node() as unknown as GainNode;
  const channel = engine.channel('synth');
  return { engine, channel };
}

describe('independent synth effect sends', () => {
  it('connects each scale to only its matching return', () => {
    const { engine, channel } = setup();
    expect(channel.synthReverbScale).not.toBe(channel.synthChorusScale);
    expect(channel.synthReverbScale.connect).toHaveBeenCalledExactlyOnceWith(engine.reverbSend);
    expect(channel.synthChorusScale.connect).toHaveBeenCalledExactlyOnceWith(engine.chorusSend);
  });
  it('keeps both independent sends following fader, automation, mute and solo', () => {
    const { engine, channel } = setup();
    const track = { id: 'synth', volume: 0.4, pan: 0, muted: false, solo: false } as Track;
    engine.syncMix([track]);
    for (const send of [channel.synthReverbScale, channel.synthChorusScale]) expect(send.gain.setTargetAtTime).toHaveBeenLastCalledWith(0.4, 2, 0.02);
    engine.automate('synth', { volume: 0.7 });
    for (const send of [channel.synthReverbScale, channel.synthChorusScale]) expect(send.gain.setTargetAtTime).toHaveBeenLastCalledWith(0.7, 2, 0.02);
    engine.syncMix([{ ...track, muted: true }]);
    for (const send of [channel.synthReverbScale, channel.synthChorusScale]) expect(send.gain.setTargetAtTime).toHaveBeenLastCalledWith(0, 2, 0.02);
    engine.syncMix([track, { ...track, id: 'other', solo: true }]);
    for (const send of [channel.synthReverbScale, channel.synthChorusScale]) expect(send.gain.setTargetAtTime).toHaveBeenLastCalledWith(0, 2, 0.02);
  });
  it('disconnects both destinations when the channel is removed', () => {
    vi.useFakeTimers();
    vi.stubGlobal('window', { setTimeout });
    const { engine, channel } = setup();
    engine.removeChannel('synth');
    vi.advanceTimersByTime(35);
    expect(channel.synthReverbScale.disconnect).toHaveBeenCalledOnce();
    expect(channel.synthChorusScale.disconnect).toHaveBeenCalledOnce();
    vi.unstubAllGlobals();
  });
});