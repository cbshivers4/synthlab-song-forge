import { describe, expect, it } from "vitest";
import {
  createTuneCore,
  detectPitch,
  nearestScaleNote,
  vocalTuneWorkletSource,
} from "./vocal-tune";

const tone = (hz: number, sr: number, n: number, offset = 0) =>
  Float32Array.from(
    { length: n },
    (_, i) =>
      0.5 * Math.sin((2 * Math.PI * hz * (i + offset)) / sr) +
      0.15 * Math.sin((4 * Math.PI * hz * (i + offset)) / sr),
  );
const midiOf = (hz: number) => 69 + 12 * Math.log2(hz / 440);

describe("pitch detection (Tuner and Vocal Tune)", () => {
  it("finds a guitar low E and a sung A within 2 cents", () => {
    expect(
      Math.abs(1200 * Math.log2(detectPitch(tone(82.41, 24000, 2048), 24000, 30, 1200) / 82.41)),
    ).toBeLessThan(2);
    expect(
      Math.abs(1200 * Math.log2(detectPitch(tone(440, 11025, 512), 11025, 70, 1000) / 440)),
    ).toBeLessThan(2);
  });
  it("reports no pitch for silence", () => {
    expect(detectPitch(new Float32Array(1024), 24000, 30, 1200)).toBe(0);
  });
});

describe("Vocal Tune scale snapping", () => {
  it("snaps an out-of-key note to the nearest note of C major", () => {
    expect(nearestScaleNote(midiOf(230), 0, 1, -1)).toBe(57); // A3
    expect(nearestScaleNote(60.8, 0, 1, -1)).toBe(60); // just above C4, far from D4 → C4
    expect(nearestScaleNote(61.3, 0, 1, -1)).toBe(62); // closer to D4
  });
  it("chromatic allows every note and holds the current note until clearly left", () => {
    expect(nearestScaleNote(61.2, 0, 0, -1)).toBe(61);
    expect(nearestScaleNote(60.55, 0, 0, 60)).toBe(60);
    expect(nearestScaleNote(60.7, 0, 0, 60)).toBe(61);
  });
});

describe("Vocal Tune correction", () => {
  it("pulls a flat 230 Hz voice to A3 (220 Hz) in C major with fast retune", () => {
    const sr = 44100;
    const core = createTuneCore(sr, detectPitch, nearestScaleNote, {
      key: 0,
      scale: 1,
      speed: 0,
      amount: 1,
      humanize: 0,
    });
    const out: number[] = [];
    for (let b = 0; b < 400; b++) {
      const inp = tone(230, sr, 128, b * 128);
      const o = [new Float32Array(128), new Float32Array(128)];
      core.process([inp, inp], o);
      out.push(...o[0]!);
    }
    const tail = Float32Array.from(out.slice(-4096));
    const hz = detectPitch(
      tail.filter((_, i) => i % 2 === 0),
      sr / 2,
      70,
      1000,
    );
    expect(Math.abs(1200 * Math.log2(hz / 220))).toBeLessThan(25);
    expect(core.reading().target).toBe(57);
  });
  it("amount 0 leaves the pitch alone", () => {
    const sr = 44100;
    const core = createTuneCore(sr, detectPitch, nearestScaleNote, { amount: 0, speed: 0 });
    const out: number[] = [];
    for (let b = 0; b < 300; b++) {
      const inp = tone(230, sr, 128, b * 128);
      const o = [new Float32Array(128), new Float32Array(128)];
      core.process([inp, inp], o);
      out.push(...o[0]!);
    }
    const hz = detectPitch(
      Float32Array.from(out.slice(-4096)).filter((_, i) => i % 2 === 0),
      sr / 2,
      70,
      1000,
    );
    expect(Math.abs(1200 * Math.log2(hz / 230))).toBeLessThan(10);
  });
  it("builds a self-contained worklet module", () => {
    const src = vocalTuneWorkletSource();
    expect(src).toContain("registerProcessor");
    expect(() =>
      new Function("AudioWorkletProcessor", "registerProcessor", "sampleRate", src)(
        class {},
        () => {},
        48000,
      ),
    ).not.toThrow();
  });
});
