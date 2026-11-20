import { describe, expect, it } from "vitest";
import {
  cdCanAdd,
  cdCueSheet,
  cdRemainingSeconds,
  cdTimecode,
  cdTrackFileName,
  cdTrackFrames,
  padForCd,
} from "./cd-audio";
import { crc32, zipStore } from "./zip-store";
import { punchTape } from "./reel-audio";
import {
  CASSETTE_TYPES,
  addDiscTrack,
  moveDiscTrack,
  newDisc,
  seedCassettes,
  sideSeconds,
} from "./tape-media-model";

const cap = (values: number[], sampleRate = 10) => ({
  left: Float32Array.from(values),
  right: Float32Array.from(values.map((v) => -v)),
  sampleRate,
});
const seconds = (s: number, sampleRate = 100) => ({
  left: new Float32Array(Math.round(s * sampleRate)),
  right: new Float32Array(Math.round(s * sampleRate)),
  sampleRate,
});

describe("cassettes", () => {
  it("a C60 side holds 30 minutes and a C90 side 45", () => {
    expect(sideSeconds("normal-60")).toBe(30 * 60);
    expect(sideSeconds("normal-90")).toBe(45 * 60);
    expect(sideSeconds("metal-46")).toBe(23 * 60);
  });
  it("the shelf starts with one blank cassette of every type", () => {
    let n = 0;
    const shelf = seedCassettes(() => `c${n++}`);
    expect(shelf).toHaveLength(CASSETTE_TYPES.length);
    expect(shelf.every((c) => !c.sides.A && !c.sides.B)).toBe(true);
  });
});

describe("recording over a tape", () => {
  it("replaces only the part under the new take and keeps the rest", () => {
    const out = punchTape(cap([1, 1, 1, 1, 1]), cap([9, 9]), 1);
    expect(Array.from(out.left)).toEqual([1, 9, 9, 1, 1]);
  });
  it("recording past the end makes the tape longer", () => {
    const out = punchTape(cap([1, 1]), cap([9, 9]), 1);
    expect(Array.from(out.left)).toEqual([1, 9, 9]);
  });
  it("a different sample rate replaces the tape", () => {
    const take = cap([9], 20);
    expect(punchTape(cap([1, 1]), take, 1)).toBe(take);
  });
});

describe("audio CD rules", () => {
  it("pads tracks to whole 588-frame sectors and at least 4 seconds", () => {
    expect(cdTrackFrames(1)).toBe(176_400);
    expect(cdTrackFrames(10.001) % 588).toBe(0);
    expect(padForCd(new Float32Array(10), new Float32Array(10)).left.length).toBe(176_400);
  });
  it("an 80-minute disc fits 80 minutes and refuses more", () => {
    expect(cdRemainingSeconds([], 80)).toBe(4800);
    expect(cdCanAdd([], 80, 79 * 60).ok).toBe(true);
    expect(cdCanAdd([60 * 60], 80, 25 * 60).ok).toBe(false);
  });
  it("holds at most 99 tracks", () => {
    expect(cdCanAdd(Array(99).fill(5), 80, 5).ok).toBe(false);
  });
  it("timecodes use 75 frames per second", () => {
    expect(cdTimecode(2)).toBe("00:02:00");
    expect(cdTimecode(61.5)).toBe("01:01:38");
  });
  it("CUE sheet numbers the tracks and names their files", () => {
    const cue = cdCueSheet({
      title: "Live",
      artist: "Me",
      tracks: [{ title: "One" }, { title: "Two" }],
    });
    expect(cue).toContain('FILE "01 - One.wav" WAVE');
    expect(cue).toContain("TRACK 02 AUDIO");
    expect(cue).toContain("PREGAP 00:02:00");
    expect(cdTrackFileName(0, 'a/b:"c"')).toBe("01 - a-b--c-.wav");
    expect(cdTrackFileName(1, "Café · Side A")).toBe("02 - Cafe - Side A.wav");
  });
  it("adding a track the disc can't hold leaves the disc unchanged", () => {
    const disc = newDisc("red-74", "Mix", "d");
    const first = addDiscTrack(disc, { id: "t1", title: "Long", capture: seconds(70 * 60) });
    expect(first.error).toBeNull();
    const second = addDiscTrack(first.disc, {
      id: "t2",
      title: "Too long",
      capture: seconds(10 * 60),
    });
    expect(second.error).not.toBeNull();
    expect(second.disc.tracks).toHaveLength(1);
  });
  it("moves tracks up and down the running order", () => {
    let disc = newDisc("silver-80", "Mix", "d");
    for (const id of ["a", "b", "c"])
      disc = addDiscTrack(disc, { id, title: id, capture: seconds(5) }).disc;
    expect(moveDiscTrack(disc, "c", -2).tracks.map((t) => t.id)).toEqual(["c", "a", "b"]);
  });
});

describe("zip", () => {
  it("crc32 matches the standard check value", () => {
    expect(crc32(new TextEncoder().encode("123456789"))).toBe(0xcbf43926);
  });
  it("writes local headers, a central directory and the end record", () => {
    const zip = zipStore([{ name: "a.txt", data: new TextEncoder().encode("hi") }]);
    const view = new DataView(zip.buffer);
    expect(view.getUint32(0, true)).toBe(0x04034b50);
    expect(view.getUint32(zip.length - 22, true)).toBe(0x06054b50);
    expect(view.getUint16(zip.length - 12, true)).toBe(1);
  });
});
