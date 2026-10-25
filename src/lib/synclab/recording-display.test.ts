import { describe, expect, it } from "vitest";
import { recordingFollowScroll, recordingPosition } from "./recording-display";

describe("recording measure display", () => {
  it("shows bar 2 beat 4 approaching bar 3 in 4/4", () => {
    expect(recordingPosition(28, 4)).toEqual({ bar: 2, beat: 4, nextBar: 3, beatsRemaining: 1, progress: 0.75 });
  });
  it("changes measures on the actual signature boundary", () => {
    expect(recordingPosition(12, 3)).toEqual({ bar: 2, beat: 1, nextBar: 3, beatsRemaining: 3, progress: 0 });
  });
  it("keeps the recording cursor within view using the channel-header width", () => {
    const left = recordingFollowScroll(64, 128, 1800, 300, 600, 0);
    expect(left).toBe(810);
    expect(1050 - left).toBe(240);
  });
  it("retains native scroll when the cursor is already visible", () => {
    expect(recordingFollowScroll(32, 128, 1800, 300, 600, 400)).toBe(400);
  });
});