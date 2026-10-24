import { afterEach, describe, expect, it, vi } from 'vitest';
import { SyncLabEngine } from './audio-engine';

afterEach(() => vi.unstubAllGlobals());

describe('drum gesture audio unlocking', () => {
  function setup(state: string, play = vi.fn().mockResolvedValue(undefined)) {
    const urls: string[] = [];
    vi.stubGlobal('navigator', { audioSession: { type: 'auto' } });
    vi.stubGlobal('Audio', class {
      constructor(url: string) { urls.push(url); }
      setAttribute = vi.fn();
      play = play;
    });
    const engine = new SyncLabEngine();
    const resume = vi.fn().mockResolvedValue(undefined);
    engine.ctx = { state, resume } as unknown as AudioContext;
    return { engine, resume, play, urls };
  }

  it('unlocks media immediately on the first audio gesture with real silent PCM', () => {
    const { engine, resume, play, urls } = setup('suspended');
    engine.init();
    expect(resume).toHaveBeenCalledTimes(1);
    expect(play).toHaveBeenCalledTimes(1);
    expect(navigator.audioSession?.type).toBe('playback');
    const wav = Buffer.from(urls[0]?.split(',')[1] ?? '', 'base64');
    expect(wav.readUInt32LE(40)).toBe(80);
    expect(wav.length).toBe(124);
    expect([...wav.subarray(44)]).toEqual(Array(80).fill(128));
    engine.init();
    expect(play).toHaveBeenCalledTimes(1);
  });

  it('resumes interrupted phone audio and retries a rejected media unlock on the next tap', async () => {
    const play = vi.fn().mockRejectedValueOnce(new Error('gesture required')).mockResolvedValue(undefined);
    const { engine, resume } = setup('interrupted', play);
    engine.init();
    await Promise.resolve();
    engine.init();
    expect(resume).toHaveBeenCalledTimes(2);
    expect(play).toHaveBeenCalledTimes(2);
  });
});