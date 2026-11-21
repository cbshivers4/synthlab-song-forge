/**
 * Bleed cleanup for AI stems (on-device DSP).
 *
 * Every part that came out of one song is compared moment by moment and frequency by
 * frequency (2048-point STFT, 75% overlap). Where another part is clearly louder, that
 * sound most likely belongs to the other part, so it is turned down here. This is a
 * sharpened Wiener mask: power 2 is the classic filter ("light"), power 4 is "strong" —
 * less bleed, but quiet tails and reverb can thin out. It can't create sound that the
 * separator never pulled out, and it can't guarantee zero bleed.
 */
import { makeFft, type StereoPcm } from "./stem-separation";

export type BleedStrength = "off" | "light" | "strong";

const N = 2048;
const HOP = N / 4;
const NORM = 1.5; // sum of periodic-hann² at 75% overlap

/** Mask sharpness and the lowest level a part is ever turned down to. */
export const BLEED_SETTINGS: Record<
  Exclude<BleedStrength, "off">,
  { power: number; floor: number }
> = {
  light: { power: 2, floor: 0.1 },
  strong: { power: 4, floor: 0 },
};

/**
 * Cleans `stems` against each other. `rivals` take part in deciding who owns each sound
 * but are not returned (for example the leftover of a drum kit after the pieces were taken out).
 * Returns new arrays; the inputs are left as they were.
 */
export function cleanBleed(
  stems: StereoPcm[],
  strength: BleedStrength,
  rivals: StereoPcm[] = [],
  onProgress?: (fraction: number) => void,
): StereoPcm[] {
  if (strength === "off" || stems.length + rivals.length < 2) return stems;
  const len = Math.max(...[...stems, ...rivals].map((s) => s.left.length));
  const copies = stems.map((s) => {
    const left = new Float32Array(len);
    const right = new Float32Array(len);
    left.set(s.left);
    right.set(s.right.subarray(0, len));
    return { left, right };
  });
  return cleanBleedInPlace(copies, strength, rivals, onProgress);
}

/**
 * Same cleanup, written straight back into each stem's own arrays, so a long song needs no
 * second copy of every part (phones run out of memory otherwise). Safe because each frame only
 * reads samples at or after its start, and finished samples are written behind that point.
 */
export function cleanBleedInPlace(
  stems: StereoPcm[],
  strength: BleedStrength,
  rivals: StereoPcm[] = [],
  onProgress?: (fraction: number) => void,
): StereoPcm[] {
  if (strength === "off" || stems.length + rivals.length < 2) return stems;
  const { power, floor } = BLEED_SETTINGS[strength];
  const half = power / 2; // masks are built from power (magnitude²)
  const all = [...stems, ...rivals];
  const len = Math.max(...all.map((s) => s.left.length));
  const fft = makeFft(N);
  const win = new Float64Array(N);
  for (let n = 0; n < N; n++) win[n] = 0.5 - 0.5 * Math.cos((2 * Math.PI * n) / N);
  const re = all.map(() => new Float64Array(N));
  const im = all.map(() => new Float64Array(N));
  const pow = all.map(() => new Float64Array(N / 2 + 1));
  const total = new Float64Array(N / 2 + 1);
  // Overlap-add accumulators: index n holds output sample (frame start + n).
  const accL = stems.map(() => new Float64Array(N));
  const accR = stems.map(() => new Float64Array(N));
  const frames = Math.ceil((len + N) / HOP);
  for (let f = 0; f < frames; f++) {
    const start = f * HOP - (N - HOP);
    total.fill(0);
    for (let s = 0; s < all.length; s++) {
      const src = all[s]!;
      const r = re[s]!,
        i = im[s]!;
      for (let n = 0; n < N; n++) {
        const t = start + n;
        const inside = t >= 0 && t < src.left.length;
        r[n] = inside ? src.left[t]! * win[n]! : 0;
        i[n] = inside ? src.right[t]! * win[n]! : 0;
      }
      fft(r, i);
      // L and R share one FFT; |L|² + |R|² at bin k = (|X_k|² + |X_(N-k)|²) / 2.
      const p = pow[s]!;
      for (let k = 0; k <= N / 2; k++) {
        const j = (N - k) % N;
        const e = (r[k]! * r[k]! + i[k]! * i[k]! + r[j]! * r[j]! + i[j]! * i[j]!) / 2;
        const v = half === 1 ? e : Math.pow(e, half);
        p[k] = v;
        total[k] = total[k]! + v;
      }
    }
    for (let s = 0; s < stems.length; s++) {
      const r = re[s]!,
        i = im[s]!,
        p = pow[s]!;
      for (let k = 0; k <= N / 2; k++) {
        const t = total[k]!;
        const m = t > 1e-20 ? Math.max(floor, p[k]! / t) : 1;
        const j = (N - k) % N;
        r[k] = r[k]! * m;
        i[k] = -i[k]! * m; // conjugate for the inverse transform
        if (j !== k) {
          r[j] = r[j]! * m;
          i[j] = -i[j]! * m;
        }
      }
      fft(r, i); // ifft(X) = conj(fft(conj X)) / N
      const aL = accL[s]!,
        aR = accR[s]!;
      for (let n = 0; n < N; n++) {
        const w = win[n]! / (N * NORM);
        aL[n] = aL[n]! + r[n]! * w;
        aR[n] = aR[n]! - i[n]! * w;
      }
      // The first HOP samples are final now (the next frame starts after them): write them back.
      const o = stems[s]!;
      for (let n = 0; n < HOP; n++) {
        const t = start + n;
        if (t >= 0 && t < o.left.length) o.left[t] = aL[n]!;
        if (t >= 0 && t < o.right.length) o.right[t] = aR[n]!;
      }
      aL.copyWithin(0, HOP);
      aR.copyWithin(0, HOP);
      aL.fill(0, N - HOP);
      aR.fill(0, N - HOP);
    }
    if (onProgress && f % 256 === 0) onProgress(f / frames);
  }
  onProgress?.(1);
  return stems;
}

/** Time-domain leftover: whole − sum of parts (what the parts didn't take). */
export function leftover(whole: StereoPcm, parts: StereoPcm[]): StereoPcm {
  const left = whole.left.slice();
  const right = whole.right.slice();
  for (const p of parts)
    for (let t = 0; t < Math.min(left.length, p.left.length); t++) {
      left[t] = left[t]! - p.left[t]!;
      right[t] = right[t]! - p.right[t]!;
    }
  return { left, right };
}
