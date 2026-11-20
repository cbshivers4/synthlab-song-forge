import { describe, expect, it } from "vitest";
import type { DrumPad } from "./types";
import { cycleRoll, hasFlam, mutatePad, rollSize, toggleFlam } from "./drum-fills";

const pad = (steps: number[], extra: Partial<DrumPad> = {}): DrumPad => ({
  id: "p",
  name: "Snare",
  kind: "snare",
  volume: 0.8,
  pan: 0,
  pitch: 0,
  decay: 0.5,
  muted: false,
  solo: false,
  steps,
  ...extra,
});
const seq = (...xs: number[]) => {
  let i = 0;
  return () => xs[i++ % xs.length]!;
};

describe("Flam", () => {
  it("adds a flam to every hit and leaves empty steps alone", () => {
    const r = toggleFlam(pad([1, 0, 0.7, 0]))!;
    expect(r.on).toBe(true);
    expect(r.patch.flam).toEqual([0.5, 0, 0.5, 0]);
  });
  it("a second press takes the flams off again", () => {
    const p = pad([1, 0, 0.7, 0], { flam: [0.5, 0, 0.5, 0] });
    expect(hasFlam(p)).toBe(true);
    expect(toggleFlam(p)!.patch.flam).toEqual([0, 0, 0, 0]);
  });
  it("only flams hits inside the loop", () => {
    expect(toggleFlam(pad([1, 0, 1, 0]), [2, 4])!.patch.flam).toEqual([0, 0, 0.5, 0]);
  });
  it("does nothing on a sound with no hits", () => {
    expect(toggleFlam(pad([0, 0, 0, 0]))).toBeNull();
  });
});

describe("Roll", () => {
  it("cycles every hit through 2, 3 and 4 hits per step, then back to single hits", () => {
    let p = pad([1, 0, 1, 0]);
    const sizes: number[] = [];
    for (let k = 0; k < 4; k++) {
      const r = cycleRoll(p)!;
      sizes.push(r.size);
      p = { ...p, ...r.patch };
    }
    expect(sizes).toEqual([2, 3, 4, 1]);
    expect(rollSize(p)).toBe(1);
  });
  it("writes the roll only on hits", () => {
    expect(cycleRoll(pad([1, 0, 0, 1]))!.patch.retrig).toEqual([2, 1, 1, 2]);
  });
});

describe("Mutate", () => {
  it("always changes the pattern, even at the lowest setting", () => {
    const before = [1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0];
    const r = mutatePad(pad(before), 0, undefined, seq(0.3, 0.9, 0.55, 0.1))!;
    expect(r.added + r.moved + r.removed + r.changed).toBeGreaterThanOrEqual(2);
    expect(r.patch.steps).not.toEqual(before);
  });
  it("makes more changes when the MUTATE knob is turned up", () => {
    const steps = Array(16).fill(0);
    const low = mutatePad(pad(steps), 0, undefined, seq(0.13, 0.71, 0.37, 0.92, 0.05, 0.58))!;
    const high = mutatePad(pad(steps), 1, undefined, seq(0.13, 0.71, 0.37, 0.92, 0.05, 0.58))!;
    const total = (r: typeof low) => r.added + r.moved + r.removed + r.changed;
    expect(total(low)).toBe(2);
    expect(total(high)).toBe(8);
  });
  it("never moves or removes the first beat of a bar", () => {
    for (let k = 0; k < 40; k++) {
      const r = mutatePad(pad([1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0]), 1)!;
      expect(r.patch.steps![0]).toBeGreaterThan(0);
    }
  });
  it("keeps changes inside the loop", () => {
    for (let k = 0; k < 20; k++) {
      const r = mutatePad(pad(Array(16).fill(0)), 1, [4, 8])!;
      r.patch.steps!.forEach((v, i) => {
        if (i < 4 || i >= 8) expect(v).toBe(0);
      });
    }
  });
  it("a moved hit keeps its flam and roll", () => {
    // step 2 hit (not a bar start) moves to step 3: rand → pick 2, x 0.1 (move), pick neighbour 3
    const p = pad([1, 0, 1, 0], { flam: [0, 0, 0.5, 0], retrig: [1, 1, 3, 1] });
    const r = mutatePad(p, 0, undefined, seq(0.5, 0.1, 0.25), 16)!;
    expect(r.moved).toBeGreaterThanOrEqual(1);
    const at = r.patch.steps!.findIndex((v, i) => i > 0 && v > 0);
    expect(r.patch.flam![at]).toBe(0.5);
    expect(r.patch.retrig![at]).toBe(3);
  });
});
