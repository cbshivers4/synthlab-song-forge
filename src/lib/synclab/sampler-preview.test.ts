import { describe, expect, it, vi } from "vitest";
import { SyncLabEngine } from "./audio-engine";

describe("saved sampler rendering", () => {
  const sample = {
    url: "saved-sample.wav",
    start: 0,
    end: 1,
    gain: 1,
    pitch: 0,
    rootNote: 60,
    loop: false,
    reverse: false,
    oneShot: true,
    attack: 0.002,
    release: 0.06,
  };

  it("does not restart a released pad after its sample finishes decoding", async () => {
    const engine = new SyncLabEngine();
    vi.spyOn(engine, "init").mockReturnValue({} as AudioContext);
    let finish: ((buffer: AudioBuffer) => void) | undefined;
    vi.spyOn(engine, "ensureBuffer").mockImplementation(
      () =>
        new Promise((resolve) => {
          finish = resolve;
        }),
    );
    const play = vi.spyOn(engine, "playSample");
    engine.playSample("sampler", sample, 60, 2, 1, undefined, "chop-0");
    engine.stopVoiceKey("sampler", "chop-0");
    finish?.({} as AudioBuffer);
    await Promise.resolve();
    expect(play).toHaveBeenCalledTimes(1);
  });

  it("resolves a saved sample before looking up the render buffer", async () => {
    const engine = new SyncLabEngine();
    vi.spyOn(engine, "init").mockReturnValue({} as AudioContext);
    const load = vi.spyOn(engine, "ensureBuffer").mockResolvedValue(null);
    expect(await engine.renderSample(sample)).toBeNull();
    expect(load).toHaveBeenCalledExactlyOnceWith("saved-sample.wav");
  });

  it("also resolves the original before attempting a reversed preview", async () => {
    const engine = new SyncLabEngine();
    vi.spyOn(engine, "init").mockReturnValue({} as AudioContext);
    const load = vi.spyOn(engine, "ensureBuffer").mockResolvedValue(null);
    expect(await engine.renderSample({ ...sample, reverse: true })).toBeNull();
    expect(load).toHaveBeenCalledExactlyOnceWith("saved-sample.wav");
  });
});
