import { describe, expect, it } from "vitest";
import { findCoverArt } from "./cover-art";

const JPEG = [0xff, 0xd8, 0xff, 0xe0, 1, 2, 3, 4, 5, 6, 7, 8];
const PNG = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 9, 9, 9, 9];
const bytes = (s: string) => [...s].map((c) => c.charCodeAt(0));
const be32 = (n: number) => [(n >>> 24) & 255, (n >>> 16) & 255, (n >>> 8) & 255, n & 255];
const safe = (n: number) => [(n >> 21) & 127, (n >> 14) & 127, (n >> 7) & 127, n & 127];

function id3v3(frames: number[][]) {
  const body = frames.flat();
  return Uint8Array.from([...bytes("ID3"), 3, 0, 0, ...safe(body.length), ...body, 0xff, 0xfb, 0, 0]);
}
const apic = (type: number, img: number[]) => {
  const data = [0, ...bytes("image/jpeg"), 0, type, ...bytes("cover"), 0, ...img];
  return [...bytes("APIC"), ...be32(data.length), 0, 0, ...data];
};

describe("record label picture from music files", () => {
  it("reads the front cover from an MP3 (ID3v2.3 APIC)", () => {
    const art = findCoverArt(id3v3([[...bytes("TIT2"), ...be32(3), 0, 0, 0, 65, 66], apic(0, PNG), apic(3, JPEG)]));
    expect(art?.mime).toBe("image/jpeg");
    expect([...art!.data]).toEqual(JPEG);
  });

  it("reads a FLAC PICTURE block", () => {
    const mime = bytes("image/png");
    const pic = [...be32(3), ...be32(mime.length), ...mime, ...be32(0), ...be32(1), ...be32(1), ...be32(24), ...be32(0), ...be32(PNG.length), ...PNG];
    const info = Array(34).fill(0);
    const file = Uint8Array.from([...bytes("fLaC"), 0x00, 0, 0, 34, ...info, 0x86, (pic.length >> 16) & 255, (pic.length >> 8) & 255, pic.length & 255, ...pic]);
    const art = findCoverArt(file);
    expect(art?.mime).toBe("image/png");
    expect([...art!.data]).toEqual(PNG);
  });

  it("reads an M4A cover (moov/udta/meta/ilst/covr)", () => {
    const box = (name: string, content: number[]) => [...be32(content.length + 8), ...bytes(name), ...content];
    const data = box("data", [...be32(13), ...be32(0), ...JPEG]);
    const meta = box("meta", [0, 0, 0, 0, ...box("ilst", box("covr", data))]);
    const file = Uint8Array.from([...box("ftyp", bytes("M4A isom")), ...box("moov", box("udta", meta))]);
    const art = findCoverArt(file);
    expect(art?.mime).toBe("image/jpeg");
    expect([...art!.data]).toEqual(JPEG);
  });

  it("returns nothing for files without a picture", () => {
    expect(findCoverArt(id3v3([[...bytes("TIT2"), ...be32(3), 0, 0, 0, 65, 66]]))).toBeNull();
    expect(findCoverArt(Uint8Array.from([...bytes("RIFF"), 0, 0, 0, 0, ...bytes("WAVEfmt ")]))).toBeNull();
  });
});
