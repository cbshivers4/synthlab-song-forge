import { describe, expect, it } from "vitest";
import { cropPadPeaks, distributePadChops, padChopRanges, stretchPadPcm } from "./pad-chops";
import { wsolaStretch } from "./stretch";
import type { SavedPad } from "./pad-session";

const source: SavedPad = {
  name: "Sample",
  url: "blob:sample",
  duration: 8,
  peaks: [0, 1, 2, 3, 4, 5, 6, 7],
  start: 0.25,
  end: 0.75,
  gain: 0.6,
  pitch: 3,
  reverse: true,
  loop: false,
  oneShot: false,
  attack: 0.01,
  release: 0.2,
  choke: 2,
  steps: [1, 0],
  slices: [0.25, 0.5],
};

describe("pad sample chopping", () => {
  it("short chopped samples retain nonzero audio when stretched", () => {
    const audio = Float32Array.from({ length: 960 }, (_, i) => Math.sin(i / 8));
    const result = stretchPadPcm(audio, 0.5);
    expect(result.length).toBe(1920);
    expect(result.some((v) => Math.abs(v) > 0.5)).toBe(true);
  });
  it("chops only the trimmed pad region", () => {
    expect(padChopRanges(source)).toEqual([
      { start: 0.25, end: 0.5 },
      { start: 0.5, end: 0.75 },
    ]);
  });
  it("adds chosen chops to other pads without changing the source", () => {
    const result = distributePadChops({ 0: source }, 0, [1, 0], 16);
    expect(result[0]).toBe(source);
    expect(result[16]).toMatchObject({ start: 0.25, end: 0.5, gain: 0.6, pitch: 3, choke: 2 });
    expect(result[17]).toMatchObject({ start: 0.5, end: 0.75 });
    expect(result[16]?.steps).toEqual(Array(16).fill(0));
  });
  it("cannot overwrite the source or overflow the pad banks", () => {
    expect(() => distributePadChops({ 0: source }, 0, [0, 1], 0)).toThrow("source");
    expect(() => distributePadChops({ 0: source }, 0, [0, 1], 63)).toThrow("Not enough");
  });
  it("draws the audio belonging to each chopped pad", () => {
    expect(cropPadPeaks(source)).toEqual([2, 3, 4, 5]);
  });
  it("stretches two seconds to four without halving the tone frequency", () => {
    const rate = 24000;
    const tone = Float32Array.from({ length: rate * 2 }, (_, i) =>
      Math.sin((2 * Math.PI * 440 * i) / rate),
    );
    const stretched = wsolaStretch(tone, 0.5);
    expect(stretched.length).toBe(rate * 4);
    let crossings = 0;
    for (let i = rate + 1; i < rate * 2; i++)
      if ((stretched[i - 1] ?? 0) <= 0 && (stretched[i] ?? 0) > 0) crossings++;
    expect(crossings).toBeGreaterThan(420);
    expect(crossings).toBeLessThan(460);
  });
});
