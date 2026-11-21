import { describe, expect, it } from "vitest";
import { cassetteType, cassetteTypeFor, dubToCassette, sideSeconds } from "./tape-media-model";

const SR = 100; // tiny rate keeps the arrays small
const mix = (seconds: number) => {
  const left = new Float32Array(seconds * SR).map((_, i) => i);
  return { left, right: left.slice(), sampleRate: SR };
};

describe("dubbing a DJ mix onto a cassette", () => {
  it("picks the shortest cassette that holds the whole mix", () => {
    expect(cassetteType(cassetteTypeFor(40 * 60)).minutes).toBe(46);
    expect(cassetteType(cassetteTypeFor(50 * 60)).minutes).toBe(60);
    expect(cassetteType(cassetteTypeFor(100 * 60)).minutes).toBe(120);
  });

  it("fills side A first and carries the rest onto side B without losing a sample", () => {
    const typeId = cassetteTypeFor(40 * 60); // C46: 23 min a side
    const m = mix(40 * 60);
    const { a, b, cutSeconds } = dubToCassette(m, typeId);
    expect(a.left.length).toBe(sideSeconds(typeId) * SR);
    expect(b?.left.length).toBe(m.left.length - a.left.length);
    expect(b?.left[0]).toBe(m.left[a.left.length]);
    expect(cutSeconds).toBe(0);
  });

  it("keeps a short mix on side A only", () => {
    const { a, b } = dubToCassette(mix(60), cassetteTypeFor(60));
    expect(a.left.length).toBe(60 * SR);
    expect(b).toBeNull();
  });

  it("says how much is cut when the mix is longer than both sides", () => {
    const typeId = "metal-46";
    expect(dubToCassette(mix(50 * 60), typeId).cutSeconds).toBe(4 * 60);
  });
});
