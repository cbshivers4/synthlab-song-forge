import { describe, expect, it } from "vitest";
import { chainPosition, chainedPads } from "./drum-chain";
import type { Track } from "./types";

const bar = 16;
const kickOn = (every: number) => Array.from({ length: 16 }, (_, i) => (i % every === 0 ? 1 : 0));
const track = {
  steps: 16,
  activeDrumPattern: 0,
  activeDrumSequence: 0,
  pads: [{ id: "k", steps: kickOn(4) }],
  drumSequences: [[undefined, { steps: 16, hits: { k: { steps: kickOn(8) } } }]],
  drumChain: {
    on: true,
    items: [
      { slot: 0, bars: 2 },
      { slot: 1, bars: 1 },
    ],
  },
} as unknown as Track;

describe("drum pattern chain", () => {
  it("plays pattern 1 for two bars, then pattern 2 for one bar, then repeats", () => {
    expect(chainPosition(track.drumChain!.items, 0, bar)!.item.slot).toBe(0);
    expect(chainPosition(track.drumChain!.items, 31, bar)!.item.slot).toBe(0);
    expect(chainPosition(track.drumChain!.items, 32, bar)!.item.slot).toBe(1);
    expect(chainPosition(track.drumChain!.items, 48, bar)!.item.slot).toBe(0); // 3-bar cycle repeats
  });
  it("the pattern on screen plays its current pads; other patterns play their saved hits", () => {
    const a = chainedPads(track, 4, bar)!;
    expect(a.pads[0]!.steps[a.s]).toBe(1); // pattern 1: kick every beat
    const b = chainedPads(track, 36, bar)!; // bar 3, beat 2 → pattern 2: kick only on 1 and 3
    expect(b.slot).toBe(1);
    expect(b.pads[0]!.steps[b.s]).toBe(0);
    expect(chainedPads(track, 40, bar)!.pads[0]!.steps[8]).toBe(1);
  });
  it("switched off or empty, the track plays its pads as usual", () => {
    expect(
      chainedPads({ ...track, drumChain: { on: false, items: track.drumChain!.items } }, 0, bar),
    ).toBeNull();
    expect(chainedPads({ ...track, drumChain: { on: true, items: [] } }, 0, bar)).toBeNull();
  });
  it("an unused pattern slot in the chain plays silence", () => {
    const silent = chainedPads(
      { ...track, drumChain: { on: true, items: [{ slot: 5, bars: 1 }] } },
      0,
      bar,
    )!;
    expect(silent.pads).toHaveLength(0);
  });
});
