import { describe, expect, it } from "vitest";
import { barsLabel, drumLengthOptions, trimSilentDrumOverhang } from "./drum-roll-length";
import type { Track } from "./types";

const drum = (steps: number, hits: number[], cuts?: number[]): Track => ({
  id: "t", name: "SNARE", kind: "drum", steps, cuts,
  pads: [{ id: "p", name: "Snare", kind: "snare", volume: 1, pan: 0, pitch: 0, decay: 1, muted: false, solo: false, steps: Array.from({ length: steps }, (_, i) => (hits.includes(i) ? 1 : 0)) }],
} as unknown as Track);

describe("drum roll length", () => {
  it("counts in bars like the timeline", () => {
    expect(barsLabel(16, 16)).toBe("1 bar");
    expect(barsLabel(64, 16)).toBe("4 bars");
    expect(barsLabel(65, 16)).toBe("4 bars + 1 step");
  });

  it("never offers more bars than the song has", () => {
    expect(drumLengthOptions(16, 8, 16).map((o) => o.steps)).toEqual([16, 32, 64, 128]);
    expect(drumLengthOptions(16, 12, 16).map((o) => o.steps)).toEqual([16, 32, 64, 128, 192]);
  });

  it("trims a silent stray step so a 4-bar snare shows 4 bars", () => {
    const fixed = trimSilentDrumOverhang(drum(65, [4, 12, 60], [65]), 16);
    expect(fixed?.steps).toBe(64);
    expect(fixed?.pads?.[0]?.steps.length).toBe(64);
    expect(fixed?.cuts).toEqual([64]);
  });

  it("keeps a stray step that holds a hit", () => {
    expect(trimSilentDrumOverhang(drum(65, [4, 64]), 16)).toBeNull();
    expect(trimSilentDrumOverhang(drum(64, [4]), 16)).toBeNull();
  });
});
