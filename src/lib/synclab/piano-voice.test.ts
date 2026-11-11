import { describe, expect, it } from "vitest";
import { PIANO_RATE, pianoLayer, pianoZone, renderPianoNote } from "./piano-voice";
import { SYNTH_PRESETS, applyPreset } from "./presets";
import { keysPatch } from "./keyboardist";

const rms = (d: Float32Array, from: number, to: number) => {
  let s = 0;
  const a = Math.round(from * PIANO_RATE), b = Math.min(d.length, Math.round(to * PIANO_RATE));
  for (let i = a; i < b; i++) s += d[i]! * d[i]!;
  return Math.sqrt(s / Math.max(1, b - a));
};
/** brightness: how fast the signal moves relative to its level (rises with the mean frequency) */
const crossings = (d: Float32Array, from: number, to: number) => {
  let sd = 0, ss = 0;
  const a = Math.round(from * PIANO_RATE), b = Math.round(to * PIANO_RATE);
  for (let i = a + 1; i < b; i++) { const x = d[i]!, y = x - d[i - 1]!; sd += y * y; ss += x * x; }
  return Math.sqrt(sd / Math.max(1e-12, ss));
};

describe("piano engine", () => {
  it("maps keys to zones and velocities to layers", () => {
    expect(pianoZone(60)).toBe(60);
    expect(pianoZone(61)).toBe(60);
    expect(pianoZone(10)).toBe(21);
    expect([pianoLayer(0.2), pianoLayer(0.6), pianoLayer(1)]).toEqual([0, 1, 2]);
  });
  it("a grand note rings out and dies away like a struck string", () => {
    const d = renderPianoNote("grand", 60, 1);
    expect(d.every(Number.isFinite)).toBe(true);
    expect(d.reduce((m, v) => Math.max(m, Math.abs(v)), 0)).toBeLessThanOrEqual(0.9001);
    expect(rms(d, 0, 0.2)).toBeGreaterThan(rms(d, 1, 1.2) * 2);
    expect(rms(d, 1, 1.2)).toBeGreaterThan(0.005);
    // the tone darkens as the note decays
    expect(crossings(d, 0.01, 0.1)).toBeGreaterThan(crossings(d, 1.5, 1.6));
  });
  it("harder notes are brighter, not just louder", () => {
    expect(crossings(renderPianoNote("grand", 60, 2), 0.01, 0.1)).toBeGreaterThan(crossings(renderPianoNote("grand", 60, 0), 0.01, 0.1));
    expect(crossings(renderPianoNote("tine", 60, 2), 0.005, 0.05)).toBeGreaterThan(crossings(renderPianoNote("tine", 60, 0), 0.005, 0.05));
  });
  it("felt piano is darker than the bright grand", () => {
    expect(crossings(renderPianoNote("felt", 60, 1), 0.01, 0.1)).toBeLessThan(crossings(renderPianoNote("bright", 60, 1), 0.01, 0.1));
  });
  it("piano presets use the piano engine with the oscillators off", () => {
    for (const name of ["Grand-ish Piano", "Concert Grand", "Rhodes Soul", "Wurli Warm", "Poly Synth Concert Grand"]) {
      const p = applyPreset(name);
      expect(p.piano, name).toBeDefined();
      expect(p.oscillators.some((o) => o.on), name).toBe(false);
    }
    expect(SYNTH_PRESETS.filter((d) => applyPreset(d.name).piano).length).toBeGreaterThanOrEqual(25);
    expect(keysPatch("grand").piano?.model).toBe("grand");
  });
});
