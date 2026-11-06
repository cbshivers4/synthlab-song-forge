import { describe, expect, it } from "vitest";
import { scrollTopForThumb, thumbGeometry } from "./vscroll-math";

describe("phone timeline vertical scroll bar", () => {
  it("thumb shows how much of the track list is visible and where", () => {
    // 600px of tracks in a 200px window: thumb is a third of the bar
    expect(thumbGeometry(0, 600, 200)).toEqual({ height: 200 / 3, offset: 0 });
    // scrolled to the bottom: thumb sits at the bottom of the bar
    const end = thumbGeometry(400, 600, 200);
    expect(end.offset + end.height).toBeCloseTo(200);
  });
  it("dragging the thumb to the bottom shows the last track; to the top shows the first", () => {
    expect(scrollTopForThumb(1000, 600, 200)).toBe(400);
    expect(scrollTopForThumb(-50, 600, 200)).toBe(0);
  });
});
