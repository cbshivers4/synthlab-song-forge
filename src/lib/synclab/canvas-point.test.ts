import { describe, expect, it } from "vitest";
import { rotateSidewaysPoint, rotateSidewaysRect } from "./canvas-point";

// The sideways canvas is body { transform: rotate(90deg) translateY(-100%) } with
// width = screen height and height = screen width. Layout (0,0) lands at the
// screen's top-right corner; layout (screenH, screenW) lands at bottom-left.
describe("rotateSidewaysPoint", () => {
  const W = 400; // screen width (portrait)
  const H = 800; // screen height

  it("maps the screen top-right corner to layout (0, 0)", () => {
    expect(rotateSidewaysPoint(W, 0, W)).toEqual({ x: 0, y: 0 });
  });

  it("maps the screen top-left corner to layout (0, screenWidth)", () => {
    expect(rotateSidewaysPoint(0, 0, W)).toEqual({ x: 0, y: W });
  });

  it("maps the screen bottom-right corner to layout (screenHeight, 0)", () => {
    expect(rotateSidewaysPoint(W, H, W)).toEqual({ x: H, y: 0 });
  });

  it("maps the screen bottom-left corner to layout (screenHeight, screenWidth)", () => {
    expect(rotateSidewaysPoint(0, H, W)).toEqual({ x: H, y: W });
  });

  it("a finger moving 'up' in the turned UI moves along screen X", () => {
    const a = rotateSidewaysPoint(200, 400, W);
    const b = rotateSidewaysPoint(100, 400, W);
    expect(b.y - a.y).toBe(100); // layout Y increases as screen X decreases
    expect(b.x - a.x).toBe(0);
  });
});

describe("rotateSidewaysRect", () => {
  const W = 400;
  // Screen box of an element inside a scrolled panel: whatever the scroll, the box is where the finger is.
  const box = { left: 100, top: 300, right: 200, bottom: 350 };

  it("swaps the axes of the screen box into layout space", () => {
    expect(rotateSidewaysRect(box, W)).toEqual({ left: 300, top: 200, right: 350, bottom: 300, width: 50, height: 100 });
  });

  it("a tap near the element's screen-left edge lands in the bottom part of its layout rect", () => {
    const r = rotateSidewaysRect(box, W);
    const pt = rotateSidewaysPoint(110, 325, W);
    const fromTop = (pt.y - r.top) / r.height;
    expect(fromTop).toBeCloseTo(0.9);
  });
});
