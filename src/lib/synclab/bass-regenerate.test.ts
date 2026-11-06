import { describe, expect, it } from "vitest";
import { BASS_STYLES, generateBass, varyBass } from "./bass-gen";

const shape = (notes: { step: number; length: number; pitch: number }[]) => notes.map((n) => `${n.step}:${n.length}:${n.pitch}`).join(",");
const roots = [9, 5, 0, 7];

describe("Bass Generator: Regenerate always makes a new pattern", () => {
  it("the default Roots style (one held note per bar) gets a new pattern on every press", () => {
    const base = generateBass(roots, "roots", 16, 1);
    const takes = [1, 2, 3, 4, 5].map((v) => shape(varyBass(base, v, true, 16)));
    for (const t of takes) expect(t).not.toBe(shape(base));
    expect(new Set(takes).size).toBeGreaterThan(1);
  });

  it("every style changes on Regenerate, and notes stay inside their bar without overlapping", () => {
    for (const { id } of BASS_STYLES) {
      const base = generateBass(roots, id, 16, 1);
      const v = varyBass(base, 1, true, 16);
      expect(shape(v), id).not.toBe(shape(base));
      const used = new Set<number>();
      for (const n of v) {
        expect(Math.floor(n.step / 16), id).toBe(Math.floor((n.step + n.length - 1) / 16));
        for (let s = n.step; s < n.step + n.length; s++) {
          expect(used.has(s), `${id} overlap at ${s}`).toBe(false);
          used.add(s);
        }
      }
    }
  });
});
