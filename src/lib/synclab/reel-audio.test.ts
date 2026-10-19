import { describe, expect, it } from "vitest";
import { clampTapePosition, joinTapeChunks, tapeCurve, tapeDuration, reelTapeProgress, reelTapeRadius } from "./reel-audio";
describe("reel-to-reel audio", () => {
  const tape = { tapePosition: 0, tapeDuration: 120, timelinePosition: 0, timelineDuration: 240, master: true, recording: false, tapeMoving: false };
  it("uses recorded song length rather than a longer timeline", () => {
    expect(reelTapeProgress(tape)).toBe(0);
    expect(reelTapeProgress({ ...tape, timelinePosition: 60 })).toBe(0.5);
    expect(reelTapeProgress({ ...tape, timelinePosition: 120 })).toBe(1);
  });
  it("follows tape playback and rewind in either deck view", () => {
    expect(reelTapeProgress({ ...tape, tapeMoving: true, tapePosition: 30, timelinePosition: 120 })).toBe(0.25);
    expect(reelTapeProgress({ ...tape, master: false, tapePosition: 120 })).toBe(1);
  });
  it("uses song duration while recording rather than the growing capture", () => {
    expect(reelTapeProgress({ ...tape, recording: true, tapePosition: 60, tapeDuration: 60, timelineDuration: 120 })).toBe(0.5);
  });
  it("empties the supply hub at the end and conserves tape area", () => {
    expect(reelTapeRadius(0)).toBe(37);
    expect(reelTapeRadius(1)).toBe(90);
    expect(reelTapeRadius(0.25) ** 2 + reelTapeRadius(0.75) ** 2).toBeCloseTo(37 ** 2 + 90 ** 2);
  });
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