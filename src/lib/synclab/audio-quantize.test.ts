import { describe, expect, it } from "vitest";
import { beatLines, firstTransient, fitSpeedToBars, snapSteps } from "./audio-quantize";

describe("audio quantize", () => {
  it("finds the first hit after silence", () => {
    const sr = 1000;
    const s = new Float32Array(1000);
    s[250] = 0.9;
    expect(firstTransient(s, sr, 0, 1)).toBeCloseTo(0.25, 3);
  });
  it("snaps clip start to the grid", () => {
    expect(snapSteps(5.4, 4)).toBe(4);
    expect(snapSteps(6.1, 4)).toBe(8);
  });
  it("fits a 2.1 s loop at 120 bpm to one bar", () => {
    const r = fitSpeedToBars(2.1, 1, 1, 120);
    expect(r.bars).toBe(1);
    expect(r.speed).toBeCloseTo(1.05, 3);
  });
  it("draws beat lines on the song's beats", () => {
    const lines = beatLines(2, 1.1, 1, 120); // clip starts on 1/8 note
    expect(lines[0]?.at).toBeCloseTo(0.25, 3);
    expect(lines[1]?.at).toBeCloseTo(0.75, 3);
  });
});
