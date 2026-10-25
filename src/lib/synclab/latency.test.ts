import { describe, expect, it } from "vitest";
import { alignedTake, clampLatencyMs, outputDelay } from "./latency";

describe("latency compensation", () => {
  it("adds base and output latency", () => {
    expect(outputDelay({ baseLatency: 0.01, outputLatency: 0.03 })).toBeCloseTo(0.04);
  });
  it("skips the input delay at the start of a mic take", () => {
    expect(alignedTake(16, 4, 0.05)).toEqual({ start: 16, offset: 0.05, length: 3.95 });
  });
  it("limits the offset setting to 0–300 ms", () => {
    expect(clampLatencyMs(900)).toBe(300);
    expect(clampLatencyMs(-5)).toBe(0);
  });
});
