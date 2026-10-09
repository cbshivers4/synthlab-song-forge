import { describe, expect, it } from "vitest";
import { clampTapePosition, joinTapeChunks, tapeCurve, tapeDuration } from "./reel-audio";
describe("reel-to-reel audio", () => {
  it("joins blocks including final partial blocks", () => {
    expect(Array.from(joinTapeChunks([new Float32Array([1, 2]), new Float32Array([3])]))).toEqual([1, 2, 3]);
    expect(joinTapeChunks([]).length).toBe(0);
  });
  it("bounds seeking", () => {
    expect(clampTapePosition(-4, 10)).toBe(0); expect(clampTapePosition(13, 10)).toBe(10); expect(clampTapePosition(NaN, 10)).toBe(0);
  });
  it("halves duration at double speed", () => {
    expect(tapeDuration({ left: new Float32Array(48000), right: new Float32Array(48000), sampleRate: 48000 }, 2)).toBe(0.5);
  });
  it("has a transparent zero-drive curve and bounded saturation", () => {
    const clean = tapeCurve(0), driven = tapeCurve(1);
    expect(clean[0]).toBe(-1); expect(clean[2047]).toBe(1);
    expect(driven[1535]).toBeGreaterThan(clean[1535] ?? 0);
    expect(Array.from(driven).every((sample) => Math.abs(sample) <= 1)).toBe(true);
  });
});