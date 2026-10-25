import { describe, expect, it, vi } from "vitest";
import { SyncLabEngine } from "./audio-engine";

describe("saved sampler rendering", () => {
  const sample = { url: "saved-sample.wav", start: 0, end: 1, gain: 1, pitch: 0, rootNote: 60, loop: false, reverse: false, oneShot: true, attack: 0.002, release: 0.06 };

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