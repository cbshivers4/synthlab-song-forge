import { describe, expect, it } from "vitest";
import { clampHeaderWidth } from "./header-width";
import { scrollForThumbOnBar, thumbOnBar } from "./vscroll-math";

describe("track name column width", () => {
  it("phone can shrink the names to 120px to show more timeline", () => {
    expect(clampHeaderWidth(50, true)).toBe(120);
    expect(clampHeaderWidth(500, true)).toBe(420);
  });
  it("desktop keeps its 220–600px range", () => {
    expect(clampHeaderWidth(120, false)).toBe(220);
    expect(clampHeaderWidth(900, false)).toBe(600);
  });
});

describe("phone timeline horizontal scroll bar", () => {
  it("thumb on a 300px bar shows a third of a 1500px song in a 500px window", () => {
    expect(thumbOnBar(0, 1500, 500, 300)).toEqual({ size: 100, offset: 0 });
    const end = thumbOnBar(1000, 1500, 500, 300);
    expect(end.offset + end.size).toBeCloseTo(300);
  });
  it("dragging the thumb to the right end shows the end of the song", () => {
    expect(scrollForThumbOnBar(999, 1500, 500, 300)).toBe(1000);
    expect(scrollForThumbOnBar(-20, 1500, 500, 300)).toBe(0);
  });
});
