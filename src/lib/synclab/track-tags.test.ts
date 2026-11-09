import { describe, expect, it } from "vitest";
import { id3Size, mp4Tags, readTrackTags, splitArtistTitle, tagBpm } from "./track-tags";

const enc = (s: string) => Array.from(new TextEncoder().encode(s));
const be32 = (n: number) => [(n >>> 24) & 255, (n >>> 16) & 255, (n >>> 8) & 255, n & 255];
const le32 = (n: number) => [n & 255, (n >>> 8) & 255, (n >>> 16) & 255, (n >>> 24) & 255];
const syncsafe = (n: number) => [(n >> 21) & 127, (n >> 14) & 127, (n >> 7) & 127, n & 127];

function id3v23(frames: [string, string][]) {
  const body = frames.flatMap(([id, text]) => { const data = [3, ...enc(text)]; return [...enc(id), ...be32(data.length), 0, 0, ...data]; });
  return Uint8Array.from([...enc("ID3"), 3, 0, 0, ...syncsafe(body.length), ...body, 0xff, 0xfb]);
}
const box = (name: string, content: number[]) => [...be32(8 + content.length), ...Array.from(name, (c) => c.charCodeAt(0)), ...content];

describe("track tags", () => {
  it("reads title, artist and BPM from an MP3 ID3v2 tag", () => {
    const tag = id3v23([["TIT2", "Strings of Life"], ["TPE1", "Rhythim Is Rhythim"], ["TBPM", "124"]]);
    expect(id3Size(tag)).toBe(tag.length - 2);
    expect(readTrackTags(tag)).toEqual({ title: "Strings of Life", artist: "Rhythim Is Rhythim", bpm: 124 });
  });

  it("falls back to the ID3v1 tag at the end of the file", () => {
    const tail = new Uint8Array(128);
    tail.set(enc("TAG"), 0); tail.set(enc("Clear"), 3); tail.set(enc("Cybotron"), 33);
    expect(readTrackTags(Uint8Array.from([0xff, 0xfb, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0]), tail)).toEqual({ title: "Clear", artist: "Cybotron", bpm: null });
  });

  it("reads FLAC Vorbis comments", () => {
    const entries = ["TITLE=Big Fun", "ARTIST=Inner City", "BPM=120"].map(enc);
    const block = [...le32(0), ...le32(entries.length), ...entries.flatMap((e) => [...le32(e.length), ...e])];
    const bytes = Uint8Array.from([...enc("fLaC"), 0x84, (block.length >> 16) & 255, (block.length >> 8) & 255, block.length & 255, ...block]);
    expect(readTrackTags(bytes)).toEqual({ title: "Big Fun", artist: "Inner City", bpm: 120 });
  });

  it("reads MP4 / M4A ilst atoms", () => {
    const data = (payload: number[], type: number) => box("data", [...be32(type), 0, 0, 0, 0, ...payload]);
    const ilst = box("ilst", [...box("\u00a9nam", data(enc("No UFOs"), 1)), ...box("\u00a9ART", data(enc("Model 500"), 1)), ...box("tmpo", data([0, 130], 21))]);
    const moov = Uint8Array.from(box("moov", box("udta", box("meta", [0, 0, 0, 0, ...ilst]))).map((b) => b & 255));
    expect(mp4Tags(moov)).toEqual({ title: "No UFOs", artist: "Model 500", bpm: 130 });
  });

  it("ignores impossible tempos", () => {
    expect(tagBpm("128 BPM")).toBe(128);
    expect(tagBpm("0")).toBeNull();
    expect(tagBpm("900")).toBeNull();
  });

  it("splits 'Artist - Title' file names, but not track numbers", () => {
    expect(splitArtistTitle("Juan Atkins - Techno City")).toEqual({ artist: "Juan Atkins", title: "Techno City" });
    expect(splitArtistTitle("01 - Intro")).toEqual({ artist: null, title: "01 - Intro" });
    expect(splitArtistTitle("Untitled jam")).toEqual({ artist: null, title: "Untitled jam" });
  });
});
