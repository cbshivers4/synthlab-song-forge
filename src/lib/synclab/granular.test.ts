import { describe, expect, it } from "vitest";
import { GRANULAR_PRESETS, GRANULAR_ROOT, defaultGranular, planGrains, synthSource } from "./granular";
import { applyPreset } from "./presets";

const seq = () => { let s = 1; return () => { s = (s * 16807) % 2147483647; return s / 2147483647; }; };

describe("Granular Synth", () => {
  it("plays about DENSITY grains per second", () => {
    const g = { ...defaultGranular(), density: 40 };
    const { grains } = planGrains(g, 60, 4, GRANULAR_ROOT, 2, seq());
    expect(grains.length).toBeGreaterThanOrEqual(78);
    expect(grains.length).toBeLessThanOrEqual(81);
  });

  it("pitches grains to the key played: an octave up plays at double speed", () => {
    const g = { ...defaultGranular(), pitchSpread: 0 };
    const { grains } = planGrains(g, 72, 4, 60, 0.5, seq());
    expect(grains.every((gr) => Math.abs(gr.rate - 2) < 1e-9)).toBe(true);
  });

  it("FREEZE holds the read position even with SCAN turned up", () => {
    const g = { ...defaultGranular(), freeze: true, scan: 1, spray: 0, position: 0.5 };
    const { grains } = planGrains(g, 60, 4, 60, 3, seq());
    expect(grains.every((gr) => Math.abs(gr.offset - 2) < 1e-6)).toBe(true);
  });

  it("REVERSE at 100% plays every grain backwards", () => {
    const g = { ...defaultGranular(), reverse: 1 };
    const { grains } = planGrains(g, 60, 4, 60, 1, seq());
    expect(grains.length).toBeGreaterThan(0);
    expect(grains.every((gr) => gr.reverse)).toBe(true);
  });

  it("continues a held note without repeating or skipping grains", () => {
    const g = defaultGranular();
    const r = seq();
    const a = planGrains(g, 60, 4, 60, 0.5, r);
    const b = planGrains(g, 60, 4, 60, 1, r, a.next);
    expect(a.grains.length + b.grains.length).toBe(planGrains(g, 60, 4, 60, 1, seq()).grains.length);
  });

  it("built-in sources are real, clean sound", () => {
    for (const kind of ["glass", "choir", "strings", "bell", "wind"] as const) {
      const d = synthSource(kind, 8000);
      let peak = 0;
      for (const v of d) { expect(Number.isFinite(v)).toBe(true); peak = Math.max(peak, Math.abs(v)); }
      expect(peak, kind).toBeGreaterThan(0.5);
      expect(peak, kind).toBeLessThanOrEqual(0.8 + 1e-6);
    }
  });

  it("has 15 presets that each load a grain cloud", () => {
    expect(GRANULAR_PRESETS).toHaveLength(15);
    for (const p of GRANULAR_PRESETS) expect(applyPreset(p.name).granular, p.name).toBeTruthy();
  });
});
