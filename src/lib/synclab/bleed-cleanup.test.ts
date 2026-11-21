import { describe, expect, it } from "vitest";
import { cleanBleed, leftover } from "./bleed-cleanup";
import { partsFor, qualityFor } from "./ai-stems";

const SR = 44100;
const tone = (f: number, amp: number, len = SR) =>
  Float32Array.from({ length: len }, (_, t) => amp * Math.sin((2 * Math.PI * f * t) / SR));
const add = (a: Float32Array, b: Float32Array) => a.map((v, i) => v + b[i]!);
/** Energy of one frequency (single-bin DFT) in the middle of the signal. */
const energyAt = (x: Float32Array, f: number) => {
  let re = 0,
    im = 0;
  for (let t = 4096; t < x.length - 4096; t++) {
    re += x[t]! * Math.cos((2 * Math.PI * f * t) / SR);
    im += x[t]! * Math.sin((2 * Math.PI * f * t) / SR);
  }
  return re * re + im * im;
};

describe("bleed cleanup", () => {
  // Stem A is a 220 Hz part with 30% of B's 1760 Hz part leaking in, and the reverse.
  const a = add(tone(220, 0.5), tone(1760, 0.15));
  const b = add(tone(1760, 0.5), tone(220, 0.15));
  const stems = [
    { left: a, right: a },
    { left: b, right: b },
  ];

  it("turns the leaking sound down by more than 10x with Strong, keeping the part itself", () => {
    const [ca] = cleanBleed(stems, "strong");
    expect(energyAt(ca!.left, 1760) / energyAt(a, 1760)).toBeLessThan(0.1);
    expect(energyAt(ca!.left, 220) / energyAt(a, 220)).toBeGreaterThan(0.8);
  });

  it("Light removes less bleed than Strong", () => {
    const [light] = cleanBleed(stems, "light");
    const [strong] = cleanBleed(stems, "strong");
    expect(energyAt(light!.left, 1760)).toBeGreaterThan(energyAt(strong!.left, 1760));
    expect(energyAt(light!.left, 1760) / energyAt(a, 1760)).toBeLessThan(0.5);
  });

  it("Off returns the stems untouched", () => {
    expect(cleanBleed(stems, "off")).toBe(stems);
  });

  it("a rival decides ownership but is not returned", () => {
    const out = cleanBleed([stems[0]!], "strong", [stems[1]!]);
    expect(out).toHaveLength(1);
    expect(energyAt(out[0]!.left, 1760) / energyAt(a, 1760)).toBeLessThan(0.1);
  });

  it("leftover is the whole minus its parts", () => {
    const whole = { left: Float32Array.of(1, 2, 3), right: Float32Array.of(1, 1, 1) };
    const r = leftover(whole, [
      { left: Float32Array.of(1, 1, 1), right: Float32Array.of(0, 1, 0) },
    ]);
    expect([...r.left]).toEqual([0, 1, 2]);
    expect([...r.right]).toEqual([1, 0, 1]);
  });
});

describe("AI stem choices", () => {
  it("uses the 6-instrument model only when guitar or piano is picked", () => {
    expect(qualityFor(["vocals", "drums", "bass"])).toBe("clean");
    expect(qualityFor(["vocals", "guitar"])).toBe("six");
    expect(qualityFor(["piano"])).toBe("six");
  });
  it("instrumental sums every non-vocal part of the model used", () => {
    expect(partsFor("instrumental", "clean")).toEqual(["drums", "bass", "other"]);
    expect(partsFor("instrumental", "six")).toEqual(["drums", "bass", "guitar", "piano", "other"]);
    expect(partsFor("bass", "six")).toEqual(["bass"]);
  });
});
