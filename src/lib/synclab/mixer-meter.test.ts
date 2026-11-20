import { describe, expect, it } from "vitest";
import {
  dbColor,
  LEVEL_RED,
  mixerDbToFraction,
  mixerFractionToDb,
  mixerSegmentDb,
} from "./level-colors";

describe("real mixer overload scale", () => {
  it("lights red segments at unity and at the clip threshold", () => {
    for (const peak of [0.985, 1]) {
      const lit = Math.round(mixerDbToFraction(20 * Math.log10(peak)) * 32);
      expect(dbColor(mixerSegmentDb(lit - 1))).toBe(LEVEL_RED);
    }
  });
  it("agrees with its printed 0 dB position and keeps quiet audio below red", () => {
    expect(mixerFractionToDb(mixerDbToFraction(0))).toBeCloseTo(0);
    expect(dbColor(mixerSegmentDb(Math.round(mixerDbToFraction(-12) * 32) - 1))).not.toBe(
      LEVEL_RED,
    );
  });
});
