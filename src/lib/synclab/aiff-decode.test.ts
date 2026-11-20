import { describe, expect, it } from "vitest";
import { isAiff, parseAiff } from "./aiff-decode";
import { encodeAiff } from "./export-formats";

const capture = () => {
  const n = 441;
  const left = new Float32Array(n),
    right = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    left[i] = Math.sin(i / 7) * 0.8;
    right[i] = Math.cos(i / 5) * -0.5;
  }
  return { left, right, sampleRate: 44100 };
};

function aifc(
  comp: string,
  bytesPerSample: number,
  write: (v: DataView, off: number, x: number) => void,
  samples: number[],
  rate = 48000,
) {
  const data = samples.length * bytesPerSample;
  const buf = new ArrayBuffer(12 + 8 + 24 + 8 + 8 + data);
  const v = new DataView(buf);
  const str = (o: number, s: string) =>
    [...s].forEach((c, i) => v.setUint8(o + i, c.charCodeAt(0)));
  str(0, "FORM");
  v.setUint32(4, buf.byteLength - 8);
  str(8, "AIFC");
  str(12, "COMM");
  v.setUint32(16, 24);
  v.setInt16(20, 1);
  v.setUint32(22, samples.length);
  v.setInt16(26, bytesPerSample * 8);
  // 48000 as 80-bit extended: exponent 16383+15, mantissa 48000/32768
  v.setUint16(28, 16383 + 15);
  v.setUint32(30, Math.round((48000 / 32768) * 2 ** 31));
  v.setUint32(34, 0);
  str(38, comp);
  v.setUint8(42, 0);
  v.setUint8(43, 0);
  str(44, "SSND");
  v.setUint32(48, 8 + data);
  v.setUint32(52, 0);
  v.setUint32(56, 0);
  samples.forEach((x, i) => write(v, 60 + i * bytesPerSample, x));
  expect(rate).toBe(48000);
  return buf;
}

describe("AIFF reader (Chrome/Edge/Firefox can't decode AIFF themselves)", () => {
  it("reads 16- and 24-bit stereo AIFF with the right rate and samples", async () => {
    for (const bits of [16, 24] as const) {
      const cap = capture();
      const bytes = await encodeAiff(cap, bits).arrayBuffer();
      expect(isAiff(bytes)).toBe(true);
      const pcm = parseAiff(bytes);
      expect(pcm.sampleRate).toBe(44100);
      expect(pcm.channels.length).toBe(2);
      expect(pcm.channels[0]!.length).toBe(441);
      const tol = bits === 16 ? 1e-4 : 1e-6;
      for (let i = 0; i < 441; i += 37) {
        expect(Math.abs(pcm.channels[0]![i]! - cap.left[i]!)).toBeLessThan(tol);
        expect(Math.abs(pcm.channels[1]![i]! - cap.right[i]!)).toBeLessThan(tol);
      }
    }
  });

  it("reads little-endian (sowt) and float (fl32) AIFF-C at 48 kHz", () => {
    const s = [0.5, -0.25, 0];
    const sowt = parseAiff(
      aifc("sowt", 2, (v, o, x) => v.setInt16(o, Math.round(x * 32768), true), s),
    );
    expect(sowt.sampleRate).toBe(48000);
    expect(Array.from(sowt.channels[0]!)).toEqual([0.5, -0.25, 0]);
    const fl = parseAiff(aifc("fl32", 4, (v, o, x) => v.setFloat32(o, x), s));
    expect(Array.from(fl.channels[0]!)).toEqual([0.5, -0.25, 0]);
  });

  it("explains unsupported AIFF-C compression instead of failing silently", () => {
    expect(() => parseAiff(aifc("ima4", 2, () => {}, [0, 0]))).toThrow(/ima4/);
  });

  it("leaves non-AIFF files to the browser", async () => {
    expect(isAiff(new TextEncoder().encode("RIFF....WAVE").buffer)).toBe(false);
  });
});
