import { describe, expect, it } from "vitest";
import { faderGain, faderPosition, FADER_MAX_GAIN } from "./fader-taper";

const db = (gain: number) => 20 * Math.log10(gain);

describe("mixer fader taper", () => {
  it("the top of the fader is +6 dB, louder than unity", () => {
    expect(faderGain(1)).toBe(FADER_MAX_GAIN);
    expect(db(faderGain(1))).toBeCloseTo(6, 0);
  });
  it("unity gain (0 dB) sits at 80% of the throw", () => {
    expect(faderGain(0.8)).toBeCloseTo(1, 5);
    expect(faderPosition(1)).toBeCloseTo(0.8, 5);
  });
  it("the bottom of the fader is silent", () => {
    expect(faderGain(0)).toBe(0);
    expect(faderPosition(0)).toBe(0);
  });
  it("pushing the fader up from unity always makes it louder", () => {
    expect(faderGain(0.9)).toBeGreaterThan(faderGain(0.8));
    expect(faderGain(1)).toBeGreaterThan(faderGain(0.9));
  });
  it("position and gain convert back and forth", () => {
    for (const p of [0.02, 0.1, 0.3, 0.5, 0.75, 0.95])
      expect(faderPosition(faderGain(p))).toBeCloseTo(p, 6);
  });
});
