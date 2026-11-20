import { describe, expect, it } from "vitest";
import {
  frameAt,
  frameIndexAt,
  loadsUsed,
  pushFrame,
  type DeckFrame,
  type MixFrame,
} from "./dj-moves";

const deck = (over: Partial<DeckFrame> = {}): DeckFrame => ({
  load: 1,
  name: "Song",
  playing: false,
  pos: 0,
  pitch: 0,
  gain: 1,
  eq: { high: 0.5, mid: 0.5, low: 0.5 },
  filter: 0.5,
  fader: 0.85,
  loop: null,
  phones: false,
  rpm: 33,
  ...over,
});
const frame = (
  t: number,
  A: Partial<DeckFrame> = {},
  B: Partial<DeckFrame> = {},
  crossfader = 0,
): MixFrame => ({
  t,
  A: deck(A),
  B: deck({ load: 2, name: "Other", ...B }),
  crossfader,
  master: 0.9,
});

describe("DJ move replay", () => {
  it("skips repeated snapshots while both decks sit stopped and unchanged", () => {
    const frames: MixFrame[] = [];
    pushFrame(frames, frame(0));
    pushFrame(frames, frame(0.05));
    pushFrame(frames, frame(0.1, { fader: 0.5 }));
    expect(frames.map((f) => f.t)).toEqual([0, 0.1]);
  });

  it("keeps every snapshot while a deck plays", () => {
    const frames: MixFrame[] = [];
    pushFrame(frames, frame(0, { playing: true, pos: 10 }));
    pushFrame(frames, frame(0.05, { playing: true, pos: 10.05 }));
    expect(frames).toHaveLength(2);
  });

  it("glides the play position between two playing snapshots", () => {
    const frames = [frame(0, { playing: true, pos: 10 }), frame(1, { playing: true, pos: 11 })];
    expect(frameAt(frames, 0.5)!.A.pos).toBeCloseTo(10.5, 5);
  });

  it("holds a scratch/seek jump until the next snapshot instead of sliding through it", () => {
    const frames = [frame(0, { playing: true, pos: 30 }), frame(0.05, { playing: true, pos: 5 })];
    expect(frameAt(frames, 0.025)!.A.pos).toBe(30);
    expect(frameAt(frames, 0.05)!.A.pos).toBe(5);
  });

  it("shows the crossfader moving and a record change at the right time", () => {
    const frames = [frame(0, {}, {}, -1), frame(2, { load: 3, name: "Next" }, {}, 1)];
    expect(frameAt(frames, 1)!.crossfader).toBeCloseTo(0, 5);
    expect(frameAt(frames, 1)!.A.name).toBe("Song");
    expect(frameAt(frames, 2.5)!.A.name).toBe("Next");
    expect([...loadsUsed(frames)].sort()).toEqual([1, 2, 3]);
  });

  it("finds the snapshot before a time by binary search", () => {
    const frames = [frame(0, { fader: 0.1 }), frame(1, { fader: 0.2 }), frame(2, { fader: 0.3 })];
    expect(frameIndexAt(frames, -1)).toBe(-1);
    expect(frameIndexAt(frames, 1.5)).toBe(1);
    expect(frameAt(frames, 1.5)!.A.fader).toBe(0.2);
  });

  it("speeds the replayed record up with pitch after the last snapshot", () => {
    const frames = [frame(0, { playing: true, pos: 0, pitch: 0.1 })];
    expect(frameAt(frames, 2)!.A.pos).toBeCloseTo(2.2, 5);
  });
});
