import { describe, expect, it } from "vitest";
import { meterWindowSize, METER_POLL_MS } from "./meter-window";

describe("meterWindowSize", () => {
  for (const rate of [44100, 48000, 96000]) {
    it(`at ${rate} Hz the meter window covers the gap between two 20 fps reads`, () => {
      const size = meterWindowSize(rate);
      expect((size / rate) * 1000).toBeGreaterThanOrEqual(METER_POLL_MS);
      expect(Math.log2(size) % 1).toBe(0);
      expect(size).toBeLessThanOrEqual(32768);
    });
  }
  it("the old 1024-sample window was too short to catch every hit", () => {
    expect((1024 / 48000) * 1000).toBeLessThan(METER_POLL_MS);
    expect(meterWindowSize(48000)).toBe(8192);
  });
});
