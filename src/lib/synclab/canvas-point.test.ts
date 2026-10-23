import { describe, expect, it } from "vitest";
import { rotateSidewaysPoint } from "./canvas-point";

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
