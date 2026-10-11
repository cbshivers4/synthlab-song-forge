import { describe, expect, it } from "vitest";
import { separateSpectral } from "./stem-separation";

const SR = 22050;
const energy = (x: Float32Array, a = 0, b = x.length) => { let s = 0; for (let i = a; i < b; i++) s += x[i]! * x[i]!; return s; };

function mix() {
  const n = SR * 3;
  const L = new Float32Array(n), R = new Float32Array(n);
  const vocal = new Float32Array(n), drums = new Float32Array(n), bass = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const t = i / SR;
    vocal[i] = 0.3 * Math.sin(2 * Math.PI * 440 * t) + 0.1 * Math.sin(2 * Math.PI * 880 * t);
    bass[i] = 0.3 * Math.sin(2 * Math.PI * 55 * t);
  }
  let seed = 1;
  const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647) * 2 - 1;
  for (let hit = 0; hit < n; hit += Math.round(SR * 0.25)) for (let k = 0; k < 600 && hit + k < n; k++) drums[hit + k] = 0.6 * rnd() * Math.exp(-k / 120);
  for (let i = 0; i < n; i++) {
    L[i] = vocal[i]! + bass[i]! * 0.9 + drums[i]! * 0.8;
    R[i] = vocal[i]! + bass[i]! * 0.5 + drums[i]! * 0.4;
  }
  return { L, R, vocal, drums, bass, n };
}

describe("spectral stem separation", () => {
  it("rebuilds the original when all parts are summed", () => {
    const { L, R, n } = mix();
    const out = separateSpectral(L, R, SR, ["vocals", "drums", "bass", "music"]);
    let err = 0;
    for (let i = 0; i < n; i++) err += (out.vocals!.left[i]! + out.drums!.left[i]! + out.bass!.left[i]! + out.music!.left[i]! - L[i]!) ** 2;
    expect(err / energy(L)).toBeLessThan(1e-6);
  });

  it("puts centre tones in vocals, low tones in bass and hits in drums", () => {
    const { L, R, n } = mix();
    const out = separateSpectral(L, R, SR, ["vocals", "drums", "bass"]);
    // Between hits the drum stem should be quiet and the vocal stem carries the 440 Hz tone.
    const a = Math.round(SR * 1.1), b = Math.round(SR * 1.2);
    expect(energy(out.vocals!.left, a, b)).toBeGreaterThan(energy(out.drums!.left, a, b) * 5);
    expect(energy(out.bass!.left)).toBeGreaterThan(energy(out.vocals!.left) * 0.3);
    // During a hit, drums dominate.
    const h = Math.round(SR * 0.25 * 4);
    expect(energy(out.drums!.left, h, h + 400)).toBeGreaterThan(energy(out.drums!.left, a, a + 400) * 20);
    expect(out.vocals!.left.length).toBe(n);
  });
});
