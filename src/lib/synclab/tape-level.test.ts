import { describe, expect, it } from "vitest";
import { autoLevelTake } from "./tape-level";

const SR = 48000;
function tone(amp: number, seconds = 1, freq = 220) {
  const data = new Float32Array(Math.round(SR * seconds));
  for (let i = 0; i < data.length; i++) data[i] = amp * Math.sin((2 * Math.PI * freq * i) / SR);
  return data;
}
const peak = (d: Float32Array) => d.reduce((m, v) => Math.max(m, Math.abs(v)), 0);
const dbOf = (v: number) => 20 * Math.log10(v);

describe("tape auto level", () => {
  it("raises a quiet microphone take (peaks -30 dB) to a -14 dB average level", () => {
    const take = { left: tone(10 ** (-30 / 20)), right: tone(10 ** (-30 / 20)), sampleRate: SR };
    const result = autoLevelTake(take);
    expect(result.boostDb).toBeCloseTo(19, 1);
    // a sine's average sits 3 dB under its peak: -14 dB average = -11 dB peak
    expect(dbOf(peak(take.left))).toBeCloseTo(-11, 1);
  });

  it("never turns a loud take (a mastered song) down or changes it", () => {
    const left = tone(0.95),
      right = tone(0.95);
    const before = left.slice();
    const result = autoLevelTake({ left, right, sampleRate: SR });
    expect(result.boostDb).toBe(0);
    expect(left).toEqual(before);
  });

  it("limits a loud spike so the boosted take stays under -1 dB", () => {
    const left = tone(0.02, 2);
    left[SR] = 0.9; // one loud click in a quiet take
    const right = left.slice();
    const result = autoLevelTake({ left, right, sampleRate: SR });
    expect(result.limited).toBe(true);
    expect(dbOf(peak(left))).toBeLessThanOrEqual(-1 + 1e-3);
    expect(dbOf(peak(right))).toBeLessThanOrEqual(-1 + 1e-3);
  });

  it("leaves a silent take silent", () => {
    const take = { left: new Float32Array(SR), right: new Float32Array(SR), sampleRate: SR };
    expect(autoLevelTake(take).boostDb).toBe(0);
    expect(peak(take.left)).toBe(0);
  });

  it("fills a silent side from the other so an interface IN 1 take plays in both speakers", () => {
    const take = { left: tone(0.1), right: new Float32Array(SR), sampleRate: SR };
    const result = autoLevelTake(take);
    expect(result.centered).toBe("left");
    expect(peak(take.right)).toBeCloseTo(peak(take.left), 5);
  });

  it("caps the boost at +24 dB for very quiet takes", () => {
    const take = { left: tone(0.005), right: tone(0.005), sampleRate: SR };
    expect(autoLevelTake(take).boostDb).toBeCloseTo(24, 5);
  });
});
