import { describe, expect, it } from "vitest";
import { loopPreviewOffset } from "./loop-preview-phase";

describe("looped preview timing", () => {
  it("lines the pattern up with the song's bars while the song plays", () => {
    // 2-bar (32-step) pattern, 120 BPM: step = 0.125 s, loop = 4 s. Song at step 40 → 8 steps into the loop.
    const off = loopPreviewOffset({
      when: 10,
      loopSec: 4,
      loopSteps: 32,
      song: { step: 40, time: 10, dur: 0.125 },
      previous: null,
    });
    expect(off).toBeCloseTo(1);
  });
  it("keeps the groove's place when Generate is pressed again without the song", () => {
    // old loop started at t=2 and is 4 s long; at t=7 it is a quarter of the way through
    const off = loopPreviewOffset({
      when: 7,
      loopSec: 4,
      loopSteps: 32,
      song: null,
      previous: { startedAt: 2, loopSec: 4 },
    });
    expect(off).toBeCloseTo(1);
  });
  it("starts a first preview from the top", () => {
    expect(
      loopPreviewOffset({ when: 3, loopSec: 4, loopSteps: 32, song: null, previous: null }),
    ).toBe(0);
  });
});
