import { describe, expect, it } from "vitest";
import { REEL_DESIGNS, parseReelDesign } from "./reel-designs";

describe("reel designs", () => {
  it("offers five distinct machines with unique ids and names", () => {
    expect(REEL_DESIGNS.map((d) => d.id)).toEqual([
      "classic",
      "studio",
      "broadcast",
      "midnight",
      "field",
    ]);
    expect(new Set(REEL_DESIGNS.map((d) => d.name)).size).toBe(5);
  });
  it("falls back to the original deck for unknown values", () => {
    expect(parseReelDesign("midnight")).toBe("midnight");
    expect(parseReelDesign("vintage-hack")).toBe("classic");
    expect(parseReelDesign(null)).toBe("classic");
  });
});
