import { describe, expect, it } from "vitest";
import { centerOneSided } from "./one-sided-audio";

const buf = (l: number[], r: number[]) => {
  const ch = [Float32Array.from(l), Float32Array.from(r)];
  return { numberOfChannels: 2, getChannelData: (c: number) => ch[c]!, ch };
};

describe("one-sided interface recordings", () => {
  it("copies a left-only recording to the right so both speakers play it", () => {
    const b = buf([0, 0.5, -0.3], [0, 0, 0]);
    expect(centerOneSided(b)).toBe("left");
    expect(Array.from(b.ch[1]!)).toEqual(Array.from(b.ch[0]!));
  });

  it("copies a right-only recording to the left", () => {
    const b = buf([0, 0, 0], [0.2, -0.4, 0]);
    expect(centerOneSided(b)).toBe("right");
    expect(Array.from(b.ch[0]!)).toEqual(Array.from(b.ch[1]!));
  });

  it("leaves real stereo untouched", () => {
    const b = buf([0.5, 0, 0], [0, 0.05, 0]);
    expect(centerOneSided(b)).toBeNull();
    expect(Array.from(b.ch[1]!)).toEqual([0, Math.fround(0.05), 0]);
  });

  it("leaves silence and mono buffers alone", () => {
    expect(centerOneSided(buf([0, 0], [0, 0]))).toBeNull();
    expect(centerOneSided({ numberOfChannels: 1, getChannelData: () => new Float32Array(2) })).toBeNull();
  });
});
