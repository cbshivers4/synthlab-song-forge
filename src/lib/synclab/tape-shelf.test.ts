import { describe, expect, it } from "vitest";
import {
  REEL_TYPES,
  chunkRanges,
  cassetteSideSeconds,
  discLengths,
  discTrackCount,
  fitToReel,
  markDirty,
  markSaved,
  needsSave,
  newCassette,
  newDisc,
  newReel,
  reelSeconds,
  reelTapeSeconds,
  reelTypeFor,
  releaseAudio,
  savedCassette,
  savedDisc,
  savedReel,
  seedReels,
  toSaved,
  withAudio,
  type Cassette,
} from "./tape-media-model";

const seconds = (s: number, sampleRate = 100) => ({
  left: new Float32Array(Math.round(s * sampleRate)).fill(0.25),
  right: new Float32Array(Math.round(s * sampleRate)).fill(-0.25),
  sampleRate,
});
let n = 0;
const id = () => `t${n++}`;

describe("reel tapes", () => {
  it("offers ten reel types in 5, 7 and 10½ inch sizes", () => {
    expect(REEL_TYPES).toHaveLength(10);
    expect(new Set(REEL_TYPES.map((t) => t.size))).toEqual(new Set([5, 7, 10]));
    expect(seedReels(id)).toHaveLength(10);
  });
  it("a reel holds its printed minutes", () => {
    expect(reelSeconds("studio-10")).toBe(33 * 60);
    expect(reelSeconds("long-10")).toBe(96 * 60);
  });
  it("picks the shortest reel that holds a recording", () => {
    expect(reelTypeFor(10 * 60)).toBe("green-5");
    expect(reelTypeFor(40 * 60)).toBe("smoke-7");
    expect(reelTypeFor(200 * 60)).toBe("long-10");
  });
  it("cuts what doesn't fit on a reel and says how much", () => {
    const { capture, cutSeconds } = fitToReel(seconds(15 * 60 + 30), "green-5");
    expect(capture.left.length).toBe(15 * 60 * 100);
    expect(cutSeconds).toBeCloseTo(30);
  });
});

describe("saving to the account", () => {
  it("splits a reel, cassette and CD into stored parts", () => {
    const reel = { ...newReel("blue-7", "Session 1", "r1"), capture: seconds(4) };
    expect(toSaved("reel", reel, 1).meta.parts).toEqual([{ key: "tape", seconds: 4 }]);
    const c: Cassette = {
      ...newCassette("chrome-60", "Mix", "c1"),
      sides: { A: seconds(2), B: null },
    };
    const saved = toSaved("cassette", c, 1);
    expect(saved.meta.parts.map((p) => [p.key, p.seconds])).toEqual([
      ["A", 2],
      ["B", 0],
    ]);
    expect(saved.audio.map(([k]) => k)).toEqual(["A"]);
    const d = {
      ...newDisc("gold-80", "Live", "d1"),
      tracks: [{ id: "x", title: "Intro", capture: seconds(3) }],
    };
    expect(toSaved("cd", d, 1).meta.parts).toEqual([{ key: "x", seconds: 3, title: "Intro" }]);
  });
  it("a saved item shows its lengths before its audio is downloaded", () => {
    const meta = toSaved(
      "cassette",
      { ...newCassette("chrome-60", "Mix", "c2"), sides: { A: seconds(5), B: seconds(1) } },
      7,
    ).meta;
    const shelf = savedCassette(meta);
    expect(shelf.sides.A).toBeNull();
    expect(cassetteSideSeconds(shelf, "A")).toBe(5);
    expect(cassetteSideSeconds(shelf, "B")).toBe(1);
    const dmeta = toSaved(
      "cd",
      {
        ...newDisc("gold-80", "Live", "d2"),
        tracks: [
          { id: "a", title: "One", capture: seconds(2) },
          { id: "b", title: "Two", capture: seconds(3) },
        ],
      },
      7,
    ).meta;
    const disc = savedDisc(dmeta);
    expect(discTrackCount(disc)).toBe(2);
    expect(discLengths(disc)).toEqual([2, 3]);
  });
  it("downloaded audio fills the item and is let go again on eject when unchanged", () => {
    const meta = toSaved(
      "reel",
      { ...newReel("studio-10", "Take", "r2"), capture: seconds(6) },
      3,
    ).meta;
    const loaded = withAudio(savedReel(meta), new Map([["tape", seconds(6)]]));
    expect(reelTapeSeconds(loaded)).toBe(6);
    expect(loaded.store?.loaded).toBe(true);
    const released = releaseAudio(loaded);
    expect(released.capture).toBeNull();
    expect(reelTapeSeconds(released)).toBe(6);
  });
  it("changed items keep their audio and need saving again", () => {
    const meta = toSaved(
      "reel",
      { ...newReel("studio-10", "Take", "r3"), capture: seconds(2) },
      3,
    ).meta;
    const loaded = withAudio(savedReel(meta), new Map([["tape", seconds(2)]]));
    expect(needsSave(loaded)).toBe(false);
    const changed = markDirty({ ...loaded, capture: seconds(9) });
    expect(needsSave(changed)).toBe(true);
    expect(releaseAudio(changed).capture).not.toBeNull();
    expect(needsSave(markSaved(changed, meta))).toBe(false);
  });
  it("never-saved items always offer Save", () => {
    expect(needsSave(newReel("studio-10", "", "r4"))).toBe(true);
  });
  it("uploads long recordings in five-minute files", () => {
    expect(chunkRanges(44100 * 60 * 12, 44100)).toEqual([
      [0, 44100 * 300],
      [44100 * 300, 44100 * 600],
      [44100 * 600, 44100 * 720],
    ]);
    expect(chunkRanges(0, 44100)).toEqual([]);
  });
});
