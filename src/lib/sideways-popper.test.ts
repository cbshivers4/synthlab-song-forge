import { describe, expect, it } from "vitest";
import { placeSideways } from "./sideways-popper";

// Sideways phone canvas: 669 wide × 360 tall layout.
const view = { viewW: 669, viewH: 360 };

describe("sideways pop-up placement", () => {
  it("opens a menu just under its button, lined up with the button's left edge", () => {
    const r = placeSideways({
      ...view,
      anchor: { left: 300, top: 100, right: 340, bottom: 124 },
      width: 176,
      height: 150,
      side: "bottom",
      align: "start",
      offset: 4,
    });
    expect(r).toMatchObject({ x: 300, y: 128, side: "bottom" });
  });

  it("never lets a menu run off the right edge of the screen", () => {
    const r = placeSideways({
      ...view,
      anchor: { left: 620, top: 100, right: 660, bottom: 124 },
      width: 176,
      height: 150,
      align: "start",
    });
    expect(r.x).toBe(669 - 8 - 176);
  });

  it("flips above the button when there is more room there", () => {
    const r = placeSideways({
      ...view,
      anchor: { left: 100, top: 280, right: 140, bottom: 304 },
      width: 176,
      height: 150,
      side: "bottom",
      offset: 4,
    });
    expect(r.side).toBe("top");
    expect(r.y).toBe(280 - 4 - 150);
  });

  it("caps a tall list to the room left so it can scroll instead of being cut off", () => {
    const r = placeSideways({
      ...view,
      anchor: { left: 100, top: 40, right: 140, bottom: 64 },
      width: 200,
      height: 900,
      side: "bottom",
      offset: 4,
    });
    expect(r.maxH).toBe(360 - 8 - 68);
    expect(r.y).toBe(68);
  });
});
