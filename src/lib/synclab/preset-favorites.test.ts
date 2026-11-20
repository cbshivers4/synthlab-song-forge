import { describe, expect, it } from "vitest";
import {
  FAVORITE_SLOTS,
  assignSlot,
  clearSlot,
  firstEmptySlot,
  normalizeSlots,
} from "./preset-favorites";

describe("synth favorite preset keys", () => {
  it("always has eight keys", () => {
    expect(FAVORITE_SLOTS).toBe(8);
    expect(normalizeSlots(undefined)).toHaveLength(8);
    expect(normalizeSlots(["A", "B", "C", "D", "E", "F", "G", "H", "I"])).toHaveLength(8);
  });
  it("storing a preset on a key replaces only that key", () => {
    const slots = assignSlot(
      assignSlot(normalizeSlots([]), 0, "Poly Synth Brass"),
      2,
      "Poly Synth Pad",
    );
    expect(assignSlot(slots, 0, "Poly Synth Keys")).toEqual([
      "Poly Synth Keys",
      null,
      "Poly Synth Pad",
      null,
      null,
      null,
      null,
      null,
    ]);
  });
  it("clearing a key empties it and leaves the others", () => {
    const slots = normalizeSlots(["A", "B", "C"]);
    expect(clearSlot(slots, 1)).toEqual(["A", null, "C", null, null, null, null, null]);
  });
  it("finds the first empty key, or -1 when full", () => {
    expect(firstEmptySlot(normalizeSlots(["A", null, "C"]))).toBe(1);
    expect(firstEmptySlot(normalizeSlots(["A", "B", "C", "D", "E", "F", "G", "H"]))).toBe(-1);
  });
  it("ignores out-of-range keys and blank names", () => {
    const slots = normalizeSlots(["A"]);
    expect(assignSlot(slots, 8, "X")).toEqual(slots);
    expect(assignSlot(slots, 1, "  ")).toEqual(slots);
  });
});
