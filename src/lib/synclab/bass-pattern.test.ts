import { describe, expect, it } from "vitest";
import { BASS_PATTERN_PRESETS, patternToNotes, degreeSemis } from "./bass-pattern";

describe("bass step patterns", () => {
  it("places your notes on the steps you chose, following each bar's root", () => {
    const p = Array.from({ length: 16 }, (_, i) => (i === 2 ? { degree: 0, accent: true, tie: false } : i === 6 ? { degree: 4, accent: false, tie: false } : null));
    const n = patternToNotes(p, [9, 5], 16, 1, true);
    expect(n.map((x) => [x.step, x.pitch])).toEqual([[2, 33], [6, 40], [18, 29], [22, 36]]);
    expect(n[0]!.velocity).toBe(1);
  });
  it("ties merge into one longer note", () => {
    const p = [{ degree: 0, accent: false, tie: true }, { degree: 0, accent: false, tie: false }, ...Array(14).fill(null)];
    expect(patternToNotes(p, [0], 16, 1, true)).toMatchObject([{ step: 0, length: 2 }]);
  });
  it("ships 12 different presets", () => {
    expect(BASS_PATTERN_PRESETS).toHaveLength(12);
    expect(new Set(BASS_PATTERN_PRESETS.map((p) => JSON.stringify(p.steps))).size).toBe(12);
    expect(degreeSemis(7, true)).toBe(12);
  });
});

import { shiftPattern, filterHalf } from "./bass-pattern";
describe("bass pattern shift and halves", () => {
  const p = [{ degree: 0, accent: true, tie: false }, null, { degree: 7, accent: false, tie: false }, null, { degree: 3, accent: false, tie: false }, null, null, null];
  it("shift right by 1 wraps", () => {
    expect(shiftPattern(p, 1)[1]?.degree).toBe(0);
    expect(shiftPattern(p, -1)[7]?.degree).toBe(0);
  });
  it("on-beat keeps steps 1 and 5 only; off-beat keeps the rest", () => {
    expect(filterHalf(p, "on").map((s) => s?.degree ?? null)).toEqual([0, null, null, null, 3, null, null, null]);
    expect(filterHalf(p, "off").map((s) => s?.degree ?? null)).toEqual([null, null, 7, null, null, null, null, null]);
  });
});
