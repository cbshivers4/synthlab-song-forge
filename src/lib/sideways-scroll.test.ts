import { describe, expect, it } from "vitest";
import { followFinger, sidewaysTouchDelta } from "./sideways-scroll";
import { rotateSidewaysPoint } from "./synclab/canvas-point";

describe("sideways menu swipe scrolling", () => {
  it("maps a finger move on the glass the same way tap positions are mapped", () => {
    const a = rotateSidewaysPoint(100, 300, 360);
    const b = rotateSidewaysPoint(160, 290, 360);
    expect(sidewaysTouchDelta(60, -10)).toEqual({ dx: b.x - a.x, dy: b.y - a.y });
  });

  it("a sideways swipe on the glass scrolls the menu list up or down", () => {
    // Finger moves right on the glass = up the rotated menu, so the list scrolls further down.
    const { dy } = sidewaysTouchDelta(80, 0);
    expect(followFinger(0, dy, 860)).toBe(80);
    expect(followFinger(80, sidewaysTouchDelta(-80, 0).dy, 860)).toBe(0);
  });

  it("never scrolls past the top or bottom of the menu", () => {
    expect(followFinger(10, 50, 860)).toBe(0);
    expect(followFinger(850, -50, 860)).toBe(860);
  });
});
