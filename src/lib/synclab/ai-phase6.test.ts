import { describe, expect, it } from "vitest";
import { shapeMelody } from "./hum-to-beat";
import { generateBass, varyBass } from "./bass-gen";
import { AI_DAILY_LIMIT, limitMessage } from "../ai-quota";

describe("AI daily allowance", () => {
  it("is 25 uses per person per day", () => {
    expect(AI_DAILY_LIMIT).toBe(25);
    expect(limitMessage()).toContain("25");
  });
});

describe("Hum to Beat melody shaping", () => {
  const notes = [{ step: 0, length: 2, pitch: 61, velocity: 0.8 }, { step: 4, length: 2, pitch: 66, velocity: 0.8 }];
  it("transposes every note by the chosen semitones", () => {
    expect(shapeMelody(notes, 12, null).map((n) => n.pitch)).toEqual([73, 78]);
  });
  it("snaps out-of-key notes to the nearest note of A minor", () => {
    // C#4 (61) → C4 (60); F#4 (66) → F4 (65), lower note wins ties
    expect(shapeMelody(notes, 0, { tonic: 9, minor: true }).map((n) => n.pitch)).toEqual([60, 65]);
  });
  it("keeps timing untouched", () => {
    expect(shapeMelody(notes, 3, { tonic: 0, minor: false }).map((n) => [n.step, n.length])).toEqual([[0, 2], [4, 2]]);
  });
});

describe("Bass Generator regenerate", () => {
  const base = generateBass([9, 5, 0, 7], "electro", 16, 1);
  it("variation 0 is the plain bassline", () => {
    expect(varyBass(base, 0, true, 16)).toEqual(base);
  });
  it("a new variation differs but keeps each bar's first root note", () => {
    const v = varyBass(base, 3, true, 16);
    expect(v.map((n) => `${n.step}:${n.pitch}`).join()).not.toEqual(base.map((n) => `${n.step}:${n.pitch}`).join());
    for (let bar = 0; bar < 4; bar++) {
      const first = (xs: typeof base) => xs.filter((n) => Math.floor(n.step / 16) === bar).sort((a, b) => a.step - b.step)[0]!;
      expect(first(v).pitch).toBe(first(base).pitch);
    }
  });
  it("the same variation number always gives the same line, and notes never overlap", () => {
    const a = varyBass(base, 5, true, 16), b = varyBass(base, 5, true, 16);
    expect(a.map((n) => [n.step, n.pitch])).toEqual(b.map((n) => [n.step, n.pitch]));
    const sorted = [...a].sort((x, y) => x.step - y.step);
    for (let i = 1; i < sorted.length; i++) expect(sorted[i]!.step).toBeGreaterThanOrEqual(sorted[i - 1]!.step + sorted[i - 1]!.length);
  });
});

import { BASS_TEMPLATES, cleanBassPatch, riffBass, rootsFromKey, PROGRESSIONS } from "./bass-gen";
import { applyPreset } from "./presets";

describe("Bass Generator templates and clean sound", () => {
  const line = (id: string) => {
    const t = BASS_TEMPLATES.find((x) => x.id === id)!;
    const roots = rootsFromKey(t.tonic, t.minor, PROGRESSIONS.find((p) => p.id === t.prog)!.degrees, 4);
    return riffBass(roots, t.riff, 16, t.octave);
  };
  it("every template plays a different melody (pitch order relative to its key)", () => {
    const shapes = BASS_TEMPLATES.map((t) => {
      const ns = line(t.id);
      return ns.map((n) => `${n.step}:${n.pitch - ns[0]!.pitch}`).join(",");
    });
    expect(new Set(shapes).size).toBe(BASS_TEMPLATES.length);
  });
  it("each template answers bar 1 with a different bar 2", () => {
    for (const t of BASS_TEMPLATES) {
      const ns = line(t.id);
      const bar = (b: number) => ns.filter((n) => Math.floor(n.step / 16) === b).map((n) => `${n.step % 16}:${n.pitch}`).join(",");
      expect(bar(1)).not.toBe(bar(0));
    }
  });
  it("generated bass has no drive, no resonant peak and a round tone", () => {
    for (const t of BASS_TEMPLATES) {
      const p = cleanBassPatch(applyPreset(t.sound));
      expect(p.clean).toBe(true);
      expect(p.drive).toBe(0);
      expect(p.resonance).toBeLessThanOrEqual(1);
      expect(p.fx.distortion + (p.fx.saturation ?? 0) + (p.fx.bitcrush ?? 0)).toBe(0);
      expect(p.cutoff).toBeLessThanOrEqual(1200);
    }
  });
});
