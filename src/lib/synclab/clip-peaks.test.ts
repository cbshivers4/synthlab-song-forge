import { describe, expect, it } from "vitest";
import { visibleClipPeaks } from "./clip-peaks";

const ramp = Array.from({ length: 100 }, (_, i) => i / 100);

describe("timeline clip waveform", () => {
  it("does not draw a trimmed count-in lead-in, so beat 1 is drawn at the clip start", () => {
    // 10 s take, first 2 s were the lead-in before the song started
    const shown = visibleClipPeaks({ id: "t1", peaks: ramp, duration: 10, offset: 2, length: 8 });
    expect(shown.length).toBe(80);
    expect(shown[0]).toBeCloseTo(0.2);
  });
  it("stops drawing at the clip's played length (loop end), not the end of the file", () => {
    const shown = visibleClipPeaks({ id: "t1", peaks: ramp, duration: 10, offset: 1, length: 5 });
    expect(shown.length).toBe(50);
    expect(shown[shown.length - 1]).toBeCloseTo(0.59);
  });
  it("draws the whole file for an untrimmed clip", () => {
    expect(visibleClipPeaks({ id: "t1", peaks: ramp, duration: 10 })).toEqual(ramp);
  });
  it("older razor pieces whose peaks were already cropped are drawn unchanged", () => {
    const piece = ramp.slice(30);
    const shown = visibleClipPeaks({ id: "t1-b1762862770000", peaks: piece, duration: 10, offset: 3, length: 7 });
    expect(shown).toEqual(piece);
  });
  it("new razor pieces share the file's peaks and each draws its own part", () => {
    const right = visibleClipPeaks({ id: "t1-b1762862770000", peaks: ramp, peaksSpan: [0, 10], duration: 10, offset: 3, length: 7 });
    expect(right[0]).toBeCloseTo(0.3);
    expect(right.length).toBe(70);
  });
});
