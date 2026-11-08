import { describe, expect, it } from "vitest";
import { cleanLoopName, loopName, MAX_LOOP_NAME } from "./live-looper";

describe("live looper loop names", () => {
  it("falls back to LOOP n when a loop has no name", () => {
    expect(loopName({ index: 0, name: "" })).toBe("LOOP 1");
    expect(loopName({ index: 11, name: "   " })).toBe("LOOP 12");
  });
  it("shows the name the user gave the loop", () => {
    expect(loopName({ index: 2, name: "Vocal chop" })).toBe("Vocal chop");
  });
  it("keeps typed names on one line, trimmed and length-limited", () => {
    expect(cleanLoopName("  Bass\n  groove\t ")).toBe("Bass groove");
    expect(cleanLoopName("x".repeat(50))).toHaveLength(MAX_LOOP_NAME);
  });
});
