import { describe, expect, it } from "vitest";
import { knobStep } from "@/components/studio/Knob";
import { snapDropStep, zoomAround } from "@/components/studio/timeline/drop-position";
import { clipCopyAfter } from "./workflow";
import { clearClip, peakHoldDb, peakHoldText, reportLevel } from "./clip-monitor";

describe("knobs", () => {
  it("snap to the step without drifting and stay in range", () => {
    expect(knobStep(0.30000000000000004, -1, 1, 0.01)).toBe(0.3);
    expect(knobStep(1.7, -1, 1, 0.01)).toBe(1);
    expect(knobStep(-3, -1, 1, 0.01)).toBe(-1);
  });
});

describe("dropping audio on the timeline", () => {
  it("lands on the grid under the pointer", () => {
    // 4 bars = 64 steps; 40% across = step 25.6 → nearest beat (grid 4) = 24
    expect(snapDropStep(0.4, 64, 4)).toBe(24);
    expect(snapDropStep(0.4, 64, 0)).toBeCloseTo(25.6);
    expect(snapDropStep(1, 64, 16)).toBe(48); // never starts past the last bar
  });
});

describe("arrangement zoom", () => {
  it("Ctrl+wheel zooms in and out between 1× and 8×", () => {
    expect(zoomAround(1, -100)).toBeGreaterThan(1);
    expect(zoomAround(1, 100)).toBe(1);
    expect(zoomAround(8, -100)).toBe(8);
  });
});

describe("duplicate clip", () => {
  it("the copy starts exactly where the original ends", () => {
    const clip = {
      id: "a",
      name: "VOX",
      peaks: [],
      duration: 1.3,
      start: 8,
      offset: 0,
      length: 1.3,
    };
    const copy = clipCopyAfter(clip, 0.125, "b");
    expect(copy.start).toBeCloseTo(8 + 1.3 / 0.125);
    expect(copy.id).toBe("b");
    expect(copy.name).toBe("VOX COPY");
  });
});

describe("mixer peak hold", () => {
  it("keeps the highest level until reset", () => {
    clearClip("t1");
    expect(peakHoldText("t1")).toBe("−∞");
    reportLevel("t1", 0.5);
    reportLevel("t1", 0.25);
    expect(peakHoldDb("t1")).toBeCloseTo(-6.02, 1);
    clearClip("t1");
    expect(peakHoldText("t1")).toBe("−∞");
  });
});
