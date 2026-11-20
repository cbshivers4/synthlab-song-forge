import { describe, expect, it } from "vitest";
import {
  applyChopSound,
  createNoteRepeater,
  normalizePadSound,
  padTune,
  reconcileChopSounds,
  repeatInterval,
  repeatOffset,
  swungStepTime,
  velocityCutoff,
  velocityLevel,
} from "./mpc-pad";

describe("Note Repeat timing", () => {
  it("1/16 at 120 BPM repeats every 125 ms", () => {
    expect(repeatInterval("1/16", 120)).toBeCloseTo(0.125);
  });
  it("1/8T at 120 BPM repeats every third of a beat", () => {
    expect(repeatInterval("1/8T", 120)).toBeCloseTo(0.5 / 3);
  });
  it("50% swing is straight", () => {
    expect([0, 1, 2, 3].map((k) => repeatOffset(k, 0.125, 50))).toEqual([0, 0.125, 0.25, 0.375]);
  });
  it("66% swing pushes every second hit later, first hits stay on the grid", () => {
    expect(repeatOffset(1, 0.125, 66)).toBeCloseTo(0.165);
    expect(repeatOffset(2, 0.125, 66)).toBeCloseTo(0.25);
    expect(repeatOffset(3, 0.125, 66)).toBeCloseTo(0.415);
  });
  it("never queues more than one repeat ahead, even with a long look-ahead", () => {
    let now = 0;
    const hits: number[] = [];
    const r = createNoteRepeater({
      now: () => now,
      bpm: () => 120,
      settings: () => ({ on: true, rate: "1/32", swing: 50 }),
      fire: (_id, when) => hits.push(when),
      lookAhead: 1,
    });
    r.press("a");
    now = 0.01;
    r.press("b");
    expect(hits.filter((t) => t > 0.02)).toEqual([]);
    r.releaseAll();
  });
  it("swing is limited to 50–75%", () => {
    expect(repeatOffset(1, 0.1, 90)).toBeCloseTo(0.15);
    expect(repeatOffset(1, 0.1, 20)).toBeCloseTo(0.1);
  });
  it("pattern swing delays odd steps only", () => {
    expect(swungStepTime(0, 0.125, 75)).toBe(0);
    expect(swungStepTime(1, 0.125, 75)).toBeCloseTo(0.1875);
  });
});

describe("Note Repeat runtime", () => {
  it("fires immediately, then at the rate while held, and stops on release", () => {
    let now = 10;
    const hits: number[] = [];
    const r = createNoteRepeater({
      now: () => now,
      bpm: () => 120,
      settings: () => ({ on: true, rate: "1/16", swing: 50 }),
      fire: (_id, when) => hits.push(Number(when.toFixed(3))),
      lookAhead: 0.1,
    });
    r.press("pad:0");
    expect(hits).toEqual([10]);
    now = 10.3;
    // trigger a pump by pressing another pad
    r.press("pad:1");
    // only the hit due now is queued; the next one waits until it is close
    expect(hits.filter((t) => t !== 10.3)).toEqual([10, 10.25]);
    r.releaseAll();
    expect(r.isHeld("pad:0")).toBe(false);
  });
});

describe("pad sound", () => {
  it("velocity sensitivity 0 plays every hit at full level", () => {
    expect(velocityLevel(0.2, 0)).toBe(1);
  });
  it("velocity sensitivity 100% follows velocity", () => {
    expect(velocityLevel(0.25, 1)).toBeCloseTo(0.25);
  });
  it("velocity opens the filter by the set octaves", () => {
    expect(velocityCutoff(1000, 1, 2)).toBe(4000);
    expect(velocityCutoff(1000, 0, 2)).toBe(1000);
    expect(velocityCutoff(15000, 1, 4)).toBe(20000);
  });
  it("fine tune adds cents to coarse tune", () => {
    expect(padTune({ pitch: 3, fine: -50 })).toBeCloseTo(2.5);
  });
  it("old pads without the new settings get the defaults", () => {
    const p = normalizePadSound({ gain: 1.5, pitch: 2 });
    expect(p.pan).toBe(0);
    expect(p.oneShot).toBe(true);
    expect(p.velSens).toBe(1);
  });
  it("out-of-range saved values are clamped", () => {
    expect(normalizePadSound({ pan: 5, choke: 40 }).pan).toBe(1);
    expect(normalizePadSound({ pan: 5, choke: 40 }).choke).toBe(8);
  });
});

describe("Sampler chop edits", () => {
  const base = { gain: 1, pitch: 2, reverse: false, fine: 10, pan: 0 };
  it("chop tune adds to the sample tune and level multiplies", () => {
    expect(applyChopSound(base, { pitch: 5, gain: 0.5, fine: -20, pan: -1 })).toMatchObject({
      pitch: 7,
      fine: -10,
      gain: 0.5,
      pan: -1,
    });
  });
  it("a muted chop makes no sound", () => {
    expect(applyChopSound(base, { mute: true })).toBeNull();
  });
  it("moving markers keeps edits by chop number", () => {
    expect(reconcileChopSounds([0, 0.5], [0, 0.6], { 1: { pitch: 3 } })).toEqual({
      1: { pitch: 3 },
    });
  });
  it("adding a chop keeps edits on chops whose start is still there", () => {
    expect(reconcileChopSounds([0, 0.5], [0, 0.25, 0.5], { 1: { mute: true } })).toEqual({
      2: { mute: true },
    });
  });
  it("re-chopping drops edits whose chop is gone", () => {
    expect(reconcileChopSounds([0, 0.5], [0, 0.3, 0.7], { 1: { mute: true } })).toEqual({});
  });
});
