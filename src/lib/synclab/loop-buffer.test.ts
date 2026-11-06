import { describe, expect, it } from "vitest";
import { foldLoopTail } from "./loop-buffer";

describe("foldLoopTail", () => {
  it("cuts the loop to exactly the bars length", () => {
    const [out] = foldLoopTail([new Float32Array([1, 2, 3, 4, 5, 6])], 4);
    expect(out!.length).toBe(4);
  });
  it("adds the release tail back onto the start so the last note rings into bar 1", () => {
    const [out] = foldLoopTail([new Float32Array([1, 2, 3, 4, 0.5, 0.25])], 4);
    expect(Array.from(out!)).toEqual([1.5, 2.25, 3, 4]);
  });
});
