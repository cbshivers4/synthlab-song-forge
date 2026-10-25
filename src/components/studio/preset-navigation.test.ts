import { describe, expect, it } from "vitest";
import { adjacentPreset } from "./preset-navigation";

describe("preset browsing", () => {
  const presets = ["Bass", "Lead", "Pad"];
  it("steps forward and backward in menu order", () => {
    expect(adjacentPreset(presets, "Lead", 1)).toBe("Pad");
    expect(adjacentPreset(presets, "Lead", -1)).toBe("Bass");
  });
  it("wraps at both ends", () => {
    expect(adjacentPreset(presets, "Pad", 1)).toBe("Bass");
    expect(adjacentPreset(presets, "Bass", -1)).toBe("Pad");
  });
  it("starts custom patches at the corresponding end", () => {
    expect(adjacentPreset(presets, "Custom", 1)).toBe("Bass");
    expect(adjacentPreset(presets, undefined, -1)).toBe("Pad");
  });
  it("handles empty and single-preset libraries", () => {
    expect(adjacentPreset([], undefined, 1)).toBeUndefined();
    expect(adjacentPreset(["Bass"], "Bass", -1)).toBe("Bass");
  });
});