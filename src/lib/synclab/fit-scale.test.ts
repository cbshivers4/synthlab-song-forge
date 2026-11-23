import { describe, expect, it } from "vitest";
import { fitScale } from "./fit-scale";

/** Content of fixed area: laid out wider, it gets shorter. */
const reflowing = (area: number) => (scale: number) => {
  const w = 800 / scale;
  return { width: w, height: area / w };
};

describe("fitScale", () => {
  it("keeps full size when the panel already fits", () => {
    expect(fitScale(800, 600, () => ({ width: 800, height: 500 }))).toBe(1);
  });

  it("shrinks a too-tall panel until it fits the box height", () => {
    const measure = reflowing(800 * 900);
    const s = fitScale(800, 600, measure);
    expect(s).toBeLessThan(1);
    const size = measure(s);
    expect(size.height * s).toBeLessThanOrEqual(600.5);
  });

  it("never goes below the smallest size", () => {
    expect(fitScale(800, 100, () => ({ width: 800, height: 5000 }), 0.6)).toBe(0.6);
  });
});
