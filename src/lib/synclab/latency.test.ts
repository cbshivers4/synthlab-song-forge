import { describe, expect, it } from "vitest";
import { alignedTake, clampLatencyMs, outputDelay, preRollTake } from "./latency";

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
  it("trims the count-in lead-in so beat 1 of the take sits on the song's beat 1", () => {
    // recorder opened at 1.0 s, the song's first beat was heard at 3.0 s, 10 ms mic delay
    const take = preRollTake(0, 3, 1, 10, 0.01);
    expect(take.start).toBe(0);
    expect(take.offset).toBeCloseTo(2.01);
    expect(take.length).toBeCloseTo(7.99);
  });
  it("never skips audio when the recorder started after the song", () => {
    expect(preRollTake(32, 1, 1.5, 4, 0)).toEqual({ start: 32, offset: 0, length: 4 });
  });
});
