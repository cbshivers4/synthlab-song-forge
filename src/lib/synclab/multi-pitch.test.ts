import { describe, expect, it } from "vitest";
import {
  DEFAULT_MULTI_PITCH,
  chordAt,
  chordName,
  notePitches,
  padOffset,
  padPitches,
  type MultiPitchSettings,
} from "./multi-pitch";

const spread = (over: Partial<MultiPitchSettings> = {}): MultiPitchSettings => ({
  ...DEFAULT_MULTI_PITCH,
  mode: "spread",
  ...over,
});

describe("multi pitch spread", () => {
  it("chromatic pads climb one semitone each from the root pad", () => {
    expect(Array.from({ length: 16 }, (_, i) => padOffset(i, spread()))).toEqual([
      0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15,
    ]);
  });
  it("pads below a moved root pad play lower", () => {
    const s = spread({ rootPad: 8 });
    expect(padOffset(8, s)).toBe(0);
    expect(padOffset(7, s)).toBe(-1);
    expect(padOffset(0, s)).toBe(-8);
  });
  it("major scale skips notes outside the key", () => {
    const s = spread({ scale: "major" });
    expect([0, 1, 2, 3, 4, 5, 6, 7].map((p) => padOffset(p, s))).toEqual([
      0, 2, 4, 5, 7, 9, 11, 12,
    ]);
    expect(padOffset(0, { rootPad: 1, scale: "major" })).toBe(-1);
  });
  it("each pad plays exactly one pitch", () => {
    expect(padPitches(5, spread())).toEqual([5]);
  });
  it("off plays nothing extra", () => {
    expect(padPitches(3, DEFAULT_MULTI_PITCH)).toEqual([]);
    expect(notePitches(7, DEFAULT_MULTI_PITCH)).toEqual([7]);
  });
});

describe("multi pitch chords", () => {
  const chord = (over: Partial<MultiPitchSettings> = {}) => spread({ mode: "chord", ...over });
  it("in-key chords follow the major scale: I, ii, iii", () => {
    const s = chord({ scale: "major" });
    expect(padPitches(0, s)).toEqual([0, 4, 7]);
    expect(padPitches(1, s)).toEqual([2, 5, 9]);
    expect(padPitches(2, s)).toEqual([4, 7, 11]);
  });
  it("in-key chords in minor make the first pad a minor chord", () => {
    expect(padPitches(0, chord({ scale: "minor" }))).toEqual([0, 3, 7]);
  });
  it("fixed chord shapes stack on every pad", () => {
    expect(padPitches(2, chord({ chord: "minor" }))).toEqual([2, 5, 9]);
    expect(padPitches(0, chord({ chord: "dom7" }))).toEqual([0, 4, 7, 10]);
  });
  it("a recorded chord note rebuilds the same chord on playback", () => {
    const s = chord({ scale: "major" });
    const padRoot = padOffset(1, s);
    expect(notePitches(padRoot, s)).toEqual(padPitches(1, s));
  });
  it("chromatic in-key falls back to major triads", () => {
    expect(chordAt(3, "chromatic", "diatonic")).toEqual([3, 7, 10]);
  });
  it("names chords from the sample's root note", () => {
    expect(chordName([0, 4, 7], 60)).toBe("C");
    expect(chordName([9, 12, 16], 60)).toBe("Am");
    expect(chordName([0, 4, 7, 10], 60)).toBe("C7");
  });
});

describe("sampler notes in multi pitch", async () => {
  const { triggerNote } = await import("./schedule-step");
  const sampler = (multiPitch: MultiPitchSettings) => ({
    id: "s",
    kind: "sampler",
    sampler: {
      url: "u",
      start: 0,
      end: 1,
      rootNote: 60,
      pitch: 0,
      slices: [0, 0.25, 0.5, 0.75],
      multiPitch,
    },
  });
  const run = (multiPitch: MultiPitchSettings, midi: number) => {
    const calls: { start: number; end: number; midi: number }[] = [];
    const engine = {
      playSample: (_id: string, s: { start: number; end: number }, m: number) =>
        calls.push({ start: s.start, end: s.end, midi: m }),
    };
    triggerNote(engine as never, sampler(multiPitch) as never, midi, 1, 0.9);
    return calls;
  };
  it("a pad note plays the chosen chop at the pad's pitch, not another chop", () => {
    const calls = run(spread({ source: 2 }), 63);
    expect(calls).toEqual([{ start: 0.5, end: 0.75, midi: 63 }]);
  });
  it("a chord note plays every chord tone of the chosen chop", () => {
    const calls = run(spread({ mode: "chord", source: 1, scale: "major" }), 60);
    expect(calls.map((c) => c.midi)).toEqual([60, 64, 67]);
    expect(calls.every((c) => c.start === 0.25 && c.end === 0.5)).toBe(true);
  });
  it("a missing chop falls back to the whole sample", () => {
    expect(run(spread({ source: 9 }), 62)).toEqual([{ start: 0, end: 1, midi: 62 }]);
  });
});
