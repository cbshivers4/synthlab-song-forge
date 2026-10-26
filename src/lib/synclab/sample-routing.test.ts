import { afterEach, describe, expect, it, vi } from "vitest";
import { SyncLabEngine } from "./audio-engine";
import type { Track } from "./types";

afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals(); });

function setup() {
  const param = () => ({ value: 1, setTargetAtTime: vi.fn(), cancelScheduledValues: vi.fn(), setValueAtTime: vi.fn(), linearRampToValueAtTime: vi.fn() });
  const node = () => ({ gain: param(), pan: param(), playbackRate: param(), connect: vi.fn(), disconnect: vi.fn(), start: vi.fn(), stop: vi.fn() });
  const engine = new SyncLabEngine();
  const ctx = { currentTime: 2, createGain: node, createStereoPanner: node, createAnalyser: node, createBufferSource: node } as unknown as AudioContext;
  engine.ctx = ctx;
  vi.spyOn(engine, "init").mockReturnValue(ctx);
  vi.spyOn(engine, "busNode").mockReturnValue(node() as unknown as GainNode);
  const buffers = Reflect.get(engine, "sampleBuffers") as Map<string, AudioBuffer>;
  buffers.set("tone.wav", { duration: 3 } as AudioBuffer);
  const inserts = vi.spyOn(engine, "setInserts").mockImplementation(() => {});
  const track = { id: "sample", kind: "sampler", volume: 0.7, gain: 1.3, pan: -0.2, bus: "instruments", sends: { reverb: 0.2, delay: 0.1, chorus: 0 }, muted: false, solo: false, plugins: [] } as unknown as Track;
  const tracks = [track];
  engine.syncMix(tracks);
  const sync = vi.spyOn(engine, "syncMix");
  return { engine, track, tracks, inserts, sync };
}

const sample = { url: "tone.wav", start: 0, end: 1, gain: 1, pitch: 0, rootNote: 60, loop: false, reverse: false, oneShot: true, attack: 0.002, release: 0.06 };

describe("sample playback routing after Stop", () => {
  it.each(["sample", "clip"])("restores %s routing with unchanged track state", kind => {
    vi.useFakeTimers();
    vi.stubGlobal("window", { setTimeout });
    const { engine, tracks, inserts, sync } = setup();
    engine.silenceChannels(["sample"]);
    vi.advanceTimersByTime(35);
    engine.syncMixIfChanged(tracks);
    expect(sync).not.toHaveBeenCalled();
    if (kind === "sample") engine.playSample("sample", sample, 60);
    else engine.playClip("sample", { url: "tone.wav" });
    const ch = engine.channel("sample");
    expect(sync).toHaveBeenCalledExactlyOnceWith(tracks);
    expect(inserts).toHaveBeenCalledExactlyOnceWith("sample", []);
    expect(ch.bus).toBe("instruments");
    expect(ch.trim.gain.setTargetAtTime).toHaveBeenLastCalledWith(1.3, 2, 0.02);
    expect(ch.gain.gain.setTargetAtTime).toHaveBeenLastCalledWith(0.7, 2, 0.02);
    expect(ch.pan.pan.setTargetAtTime).toHaveBeenLastCalledWith(-0.2, 2, 0.02);
    engine.playSample("sample", sample, 60);
    expect(sync).toHaveBeenCalledTimes(1);
    expect(inserts).toHaveBeenCalledTimes(1);
  });

  it("retains intentional mute rather than bypassing the mixer on a cold preview", () => {
    vi.useFakeTimers();
    vi.stubGlobal("window", { setTimeout });
    const { engine, track } = setup();
    engine.syncMix([{ ...track, muted: true }]);
    engine.silenceChannels(["sample"]);
    vi.advanceTimersByTime(35);
    engine.playSample("sample", sample, 60);
    expect(engine.channel("sample").gain.gain.setTargetAtTime).toHaveBeenLastCalledWith(0, 2, 0.02);
  });

  it.each(["instrument", "drum", "sampler"])("hardware bypass silences %s channel and synth sends without changing its fader or mute", kind => {
    const { engine, track } = setup();
    const bypassed = { ...track, kind: kind as Track["kind"], deviceBypassed: true };
    engine.syncMix([bypassed]);
    const ch = engine.channel(track.id);
    expect(ch.gain.gain.setTargetAtTime).toHaveBeenLastCalledWith(0, 2, 0.02);
    expect(ch.synthReverbScale.gain.setTargetAtTime).toHaveBeenLastCalledWith(0, 2, 0.02);
    expect(ch.synthChorusScale.gain.setTargetAtTime).toHaveBeenLastCalledWith(0, 2, 0.02);
    expect(bypassed.volume).toBe(0.7);
    expect(bypassed.muted).toBe(false);
    engine.syncMix([{ ...bypassed, deviceBypassed: false }]);
    expect(ch.gain.gain.setTargetAtTime).toHaveBeenLastCalledWith(0.7, 2, 0.02);
    engine.syncMix([{ ...bypassed, deviceBypassed: false, muted: true }]);
    expect(ch.gain.gain.setTargetAtTime).toHaveBeenLastCalledWith(0, 2, 0.02);
  });
});
describe("synth note routing after Stop", () => {
  it("restores the channel's mixer settings for live synth notes", () => {
    vi.useFakeTimers();
    vi.stubGlobal("window", { setTimeout });
    const { engine, tracks, inserts, sync } = setup();
    engine.silenceChannels(["sample"]);
    vi.advanceTimersByTime(35);
    engine.syncMixIfChanged(tracks);
    try { engine.playNote("sample", {} as never, 60, 0.2); } catch { /* voice build needs real nodes */ }
    const ch = engine.channel("sample");
    expect(sync).toHaveBeenCalledExactlyOnceWith(tracks);
    expect(inserts).toHaveBeenCalledExactlyOnceWith("sample", []);
    expect(ch.gain.gain.setTargetAtTime).toHaveBeenLastCalledWith(0.7, 2, 0.02);
  });
});
