import { expect, it } from "vitest";
import { pitchShift } from "./voice-convert";
it("shifts 220Hz up an octave", () => {
  const sr = 44100, x = new Float32Array(sr);
  for (let i = 0; i < sr; i++) x[i] = Math.sin(2*Math.PI*220*i/sr);
  const y = pitchShift(x, 12);
  let zc = 0; for (let i = 5000; i < 35000; i++) if ((y[i]! >= 0) !== (y[i-1]! >= 0)) zc++;
  const hz = zc / 2 / (30000/sr);
  expect(y.length).toBe(x.length);
  expect(Math.abs(hz - 440)).toBeLessThan(25);
});
