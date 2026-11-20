import { describe, expect, it } from "vitest";
import { fitBassline, songContentBars } from "./bass-fit";
import { pasteEndStep, drumCopySpan } from "./arrangement-edit";
import type { MidiNote, Track } from "./types";

const base: Track = {
  id: "t",
  name: "T",
  kind: "drum",
  color: "red",
  volume: 1,
  pan: 0,
  muted: false,
  solo: false,
  armed: false,
  frozen: false,
  hidden: false,
  input: "Internal",
  bus: "drums",
  steps: 16,
};
const snare = (region: [number, number]): Track => ({
  ...base,
  id: "snare",
  patternRegion: region,
  pads: [
    {
      id: "s",
      name: "SNARE",
      kind: "snare",
      volume: 1,
      pan: 0,
      pitch: 0,
      decay: 0.5,
      muted: false,
      solo: false,
      steps: Array.from({ length: 16 }, (_, i) => (i === 4 || i === 12 ? 1 : 0)),
    },
  ],
});
const note = (step: number, length = 2): MidiNote => ({
  id: `n${step}`,
  pitch: 36,
  step,
  length,
  velocity: 0.9,
});

describe("bassline fills only the song's bars", () => {
  it("an 8-bar song gets 8 bars of bass in a 16-bar timeline", () => {
    expect(songContentBars([snare([0, 128])], 16, 0.1, 16)).toBe(8);
    const fit = fitBassline([note(0), note(8)], 64, 8, 16, 16);
    expect(Math.max(...fit.notes!.map((n) => n.step))).toBeLessThan(128);
    expect(fit.notes).toHaveLength(4); // a 4-bar phrase played twice
    expect(fit.cuts).toEqual([128]);
  });
  it("fills the whole song when the timeline is empty", () => {
    expect(songContentBars([], 16, 0.1, 16)).toBe(0);
    expect(fitBassline([note(0)], 64, 16, 16, 16).cuts).toEqual([]);
  });
  it("never runs past the song end", () => {
    expect(
      fitBassline([note(0)], 64, 32, 16, 16).notes!.every((n) => n.step + n.length <= 256),
    ).toBe(true);
  });
});

describe("a beat one silent step past a bar line copies as whole bars", () => {
  it("copies a 4-bar + 1 step snare as 4 bars and pastes it on bar 5", () => {
    const t = snare([0, 65]);
    expect(drumCopySpan(t, [0, 256])).toEqual([0, 64]);
    expect(pasteEndStep(t, 0.1, 256)).toBe(64);
  });
});
