import { describe, expect, it } from "vitest";
import { waveformDisplayGain } from "./signal-display";

describe("live waveform display", () => {
  it("makes a quiet audible synth visible without changing its samples", () => {
    const samples = new Float32Array([0, 0.01, -0.01]);
    const gain = waveformDisplayGain(0.01);
    expect(gain).toBe(64);
    expect(samples[1]).toBeCloseTo(0.01);
    expect((samples[1] ?? 0) * gain).toBeCloseTo(0.64);
  });
  it("keeps silence flat and full-scale audio unamplified", () => {
    expect(waveformDisplayGain(0)).toBe(1);
    expect(waveformDisplayGain(1)).toBe(1);
    expect(waveformDisplayGain(Number.NaN)).toBe(1);
  });
});
