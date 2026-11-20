import { expect, it } from "vitest";
import { fitWindow } from "./window-bounds";
it("keeps the entire moved hardware window reachable", () => {
  expect(fitWindow({ x: 900, y: -50, w: 500, h: 400 }, { w: 1280, h: 900 })).toEqual({
    x: 780,
    y: 0,
    w: 500,
    h: 400,
  });
});
it("fits resized hardware in the sideways phone canvas", () => {
  expect(fitWindow({ x: 60, y: 30, w: 1200, h: 800 }, { w: 942, h: 654 })).toEqual({
    x: 0,
    y: 0,
    w: 942,
    h: 654,
  });
});
