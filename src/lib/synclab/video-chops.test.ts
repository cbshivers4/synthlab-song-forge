import { describe, expect, it } from "vitest";
import { moveVideoChop, snapVideoTime } from "./video-chops";
describe("video chop editing", () => {
  it("snaps musical divisions in source seconds", () => {
    expect(snapVideoTime(1.6, 120, 1)).toBe(2);
    expect(snapVideoTime(1.6, 120, 2)).toBe(2);
    expect(snapVideoTime(1.6, 120, 4)).toBe(1.5);
    expect(snapVideoTime(0.2, 120, 16)).toBe(0.25);
    expect(snapVideoTime(0.213, 120, 0)).toBe(0.213);
  });
  it("clamps edits to neighboring cuts and source boundaries", () => {
    expect(moveVideoChop([0, 1, 2], 1, 1.5, 3)).toEqual([0, 1.5, 2]);
    expect(moveVideoChop([0, 1, 2], 1, 3, 3)).toEqual([0, 1.99, 2]);
    expect(moveVideoChop([0, 1, 2], 1, -2, 3)).toEqual([0, 0.01, 2]);
    expect(moveVideoChop([0], 0, 5, 3)).toEqual([2.99]);
  });
});
