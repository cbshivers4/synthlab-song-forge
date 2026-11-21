/**
 * Spectral stem separation (on-device DSP, not AI).
 *
 * 1. STFT both channels (2048-point Hann, 75% overlap; L and R packed in one FFT).
 * 2. Harmonic / percussive split by median filtering the magnitude spectrogram
 *    across time (sustained → harmonic) and across frequency (broadband hits →
 *    percussive), turned into soft Wiener masks.
 * 3. Vocals = harmonic energy that is identical in L and R (centre panned) inside
 *    the voice band. Bass = remaining harmonic energy below ~200 Hz.
 *    Drums = percussive energy. Music = everything that is left.
 * The masks sum to one, so Vocals + Drums + Bass + Music rebuilds the original.
 */
export type SpectralStem = "vocals" | "drums" | "bass" | "music" | "instrumental";
export type StereoPcm = { left: Float32Array; right: Float32Array };

const N = 2048;
const HOP = N / 4;
const BINS = N / 2 + 1;
const TK = 31; // time kernel (frames) for the harmonic median
const FK = 17; // frequency kernel (bins) for the percussive median
const NORM = 1.5; // sum of hann² at 75% overlap

export function makeFft(n: number) {
  const levels = Math.round(Math.log2(n));
  const rev = new Uint32Array(n);
  for (let i = 0; i < n; i++) {
    let r = 0;
    for (let b = 0; b < levels; b++) r |= ((i >> b) & 1) << (levels - 1 - b);
    rev[i] = r;
  }
  const cos = new Float64Array(n / 2);
  const sin = new Float64Array(n / 2);
  for (let i = 0; i < n / 2; i++) {
    cos[i] = Math.cos((2 * Math.PI * i) / n);
    sin[i] = -Math.sin((2 * Math.PI * i) / n);
  }
  return (re: Float64Array, im: Float64Array) => {
    for (let i = 0; i < n; i++) {
      const j = rev[i]!;
      if (j > i) {
        let t = re[i]!;
        re[i] = re[j]!;
        re[j] = t;
        t = im[i]!;
        im[i] = im[j]!;
        im[j] = t;
      }
    }
    for (let size = 2; size <= n; size <<= 1) {
      const half = size >> 1;
      const step = n / size;
      for (let s = 0; s < n; s += size) {
        for (let k = 0; k < half; k++) {
          const wr = cos[k * step]!,
            wi = sin[k * step]!;
          const a = s + k,
            b = a + half;
          const xr = re[b]! * wr - im[b]! * wi;
          const xi = re[b]! * wi + im[b]! * wr;
          re[b] = re[a]! - xr;
          im[b] = im[a]! - xi;
          re[a] = re[a]! + xr;
          im[a] = im[a]! + xi;
        }
      }
    }
  };
}

function median(buf: Float32Array, count: number) {
  for (let i = 1; i < count; i++) {
    const v = buf[i]!;
    let j = i - 1;
    while (j >= 0 && buf[j]! > v) {
      buf[j + 1] = buf[j]!;
      j--;
    }
    buf[j + 1] = v;
  }
  return count ? buf[count >> 1]! : 0;
}

const smooth = (a: number, b: number, x: number) => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};

export function separateSpectral(
  leftIn: Float32Array,
  rightIn: Float32Array,
  sampleRate: number,
  wanted: SpectralStem[],
  onProgress?: (fraction: number) => void,
): Partial<Record<SpectralStem, StereoPcm>> {
  const len = leftIn.length;
  const want = new Set(wanted);
  const needMusic = want.has("music");
  const needV = want.has("vocals") || want.has("instrumental") || needMusic;
  const needD = want.has("drums") || needMusic;
  const needB = want.has("bass") || needMusic;
  const padLen = len + 2 * N;
  const alloc = (on: boolean) =>
    on ? { left: new Float32Array(padLen), right: new Float32Array(padLen) } : null;
  const outV = alloc(needV),
    outD = alloc(needD),
    outB = alloc(needB);

  const fft = makeFft(N);
  const win = new Float64Array(N);
  for (let i = 0; i < N; i++) win[i] = 0.5 - 0.5 * Math.cos((2 * Math.PI * i) / N);
  const frames = Math.ceil((len + N) / HOP) + 1;
  const half = TK >> 1;

  // Ring buffers of spectra and magnitudes for the time-median window.
  const ring = Array.from({ length: TK }, () => ({
    lr: new Float32Array(BINS),
    li: new Float32Array(BINS),
    rr: new Float32Array(BINS),
    ri: new Float32Array(BINS),
    mag: new Float32Array(BINS),
  }));
  const re = new Float64Array(N),
    im = new Float64Array(N);
  const scratch = new Float32Array(Math.max(TK, FK));
  const band = new Float32Array(BINS),
    low = new Float32Array(BINS);
  for (let b = 0; b < BINS; b++) {
    const f = (b * sampleRate) / N;
    band[b] = smooth(90, 180, f) * (1 - smooth(7000, 11000, f));
    low[b] = 1 - smooth(160, 260, f);
  }
  const sample = (ch: Float32Array, p: number) => (p >= N && p < N + len ? ch[p - N]! : 0);

  const analyse = (k: number) => {
    const slot = ring[k % TK]!;
    const off = k * HOP;
    for (let i = 0; i < N; i++) {
      re[i] = sample(leftIn, off + i) * win[i]!;
      im[i] = sample(rightIn, off + i) * win[i]!;
    }
    fft(re, im);
    for (let b = 0; b < BINS; b++) {
      const m = (N - b) % N;
      const zr = re[b]!,
        zi = im[b]!,
        wr = re[m]!,
        wi = im[m]!;
      const lr = (zr + wr) / 2,
        li = (zi - wi) / 2,
        rr = (zi + wi) / 2,
        ri = (wr - zr) / 2;
      slot.lr[b] = lr;
      slot.li[b] = li;
      slot.rr[b] = rr;
      slot.ri[b] = ri;
      slot.mag[b] = (Math.hypot(lr, li) + Math.hypot(rr, ri)) / 2;
    }
  };

  const synth = (out: StereoPcm, k: number, mask: Float32Array, slot: (typeof ring)[number]) => {
    for (let b = 0; b < BINS; b++) {
      const g = mask[b]!;
      const ar = slot.lr[b]! * g,
        ai = slot.li[b]! * g,
        br = slot.rr[b]! * g,
        bi = slot.ri[b]! * g;
      // C = A + iB, conjugated for an inverse via the forward FFT.
      re[b] = ar - bi;
      im[b] = -(ai + br);
      if (b > 0 && b < N / 2) {
        const m = N - b;
        re[m] = ar + bi;
        im[m] = -(-ai + br);
      }
    }
    fft(re, im);
    const off = k * HOP;
    for (let i = 0; i < N; i++) {
      const w = win[i]! / (N * NORM);
      out.left[off + i] = out.left[off + i]! + re[i]! * w;
      out.right[off + i] = out.right[off + i]! - im[i]! * w;
    }
  };

  const mV = new Float32Array(BINS),
    mD = new Float32Array(BINS),
    mB = new Float32Array(BINS);
  for (let k = 0; k < Math.min(frames, half + 1); k++) analyse(k);
  for (let t = 0; t < frames; t++) {
    const ahead = t + half + 1;
    // The frame being processed must stay in the ring, so analyse ahead after reading it.
    const slot = ring[t % TK]!;
    for (let b = 0; b < BINS; b++) {
      let c = 0;
      for (let j = Math.max(0, t - half); j <= Math.min(frames - 1, t + half); j++)
        scratch[c++] = ring[j % TK]!.mag[b]!;
      const h = median(scratch, c);
      c = 0;
      for (let j = Math.max(0, b - (FK >> 1)); j <= Math.min(BINS - 1, b + (FK >> 1)); j++)
        scratch[c++] = slot.mag[j]!;
      const p = median(scratch, c);
      // Power 4 instead of 2 sharpens the soft masks, so sustained and percussive
      // energy bleed far less into each other.
      const h2 = h * h * h * h,
        p2 = p * p * p * p;
      const perc = p2 / (h2 + p2 + 1e-12);
      const harm = 1 - perc;
      const dr = slot.lr[b]! - slot.rr[b]!,
        di = slot.li[b]! - slot.ri[b]!;
      const sum = Math.hypot(slot.lr[b]!, slot.li[b]!) + Math.hypot(slot.rr[b]!, slot.ri[b]!);
      const centre = sum > 1e-9 ? Math.max(0, 1 - Math.hypot(dr, di) / sum) : 0;
      const cv = centre ** 12 * band[b]!;
      mV[b] = harm * cv;
      mB[b] = harm * (1 - cv) * low[b]!;
      mD[b] = perc;
    }
    if (outV) synth(outV, t, mV, slot);
    if (outD) synth(outD, t, mD, slot);
    if (outB) synth(outB, t, mB, slot);
    if (ahead < frames) analyse(ahead);
    if (onProgress && t % 256 === 0) onProgress(t / frames);
  }

  const cut = (s: StereoPcm | null) =>
    s ? { left: s.left.slice(N, N + len), right: s.right.slice(N, N + len) } : null;
  const v = cut(outV),
    d = cut(outD),
    bass = cut(outB);
  const result: Partial<Record<SpectralStem, StereoPcm>> = {};
  if (v && want.has("vocals")) result.vocals = v;
  if (d && want.has("drums")) result.drums = d;
  if (bass && want.has("bass")) result.bass = bass;
  if (v && want.has("instrumental")) {
    const l = new Float32Array(len),
      r = new Float32Array(len);
    for (let i = 0; i < len; i++) {
      l[i] = leftIn[i]! - v.left[i]!;
      r[i] = rightIn[i]! - v.right[i]!;
    }
    result.instrumental = { left: l, right: r };
  }
  if (needMusic && v && d && bass) {
    const l = new Float32Array(len),
      r = new Float32Array(len);
    for (let i = 0; i < len; i++) {
      l[i] = leftIn[i]! - v.left[i]! - d.left[i]! - bass.left[i]!;
      r[i] = rightIn[i]! - v.right[i]! - d.right[i]! - bass.right[i]!;
    }
    result.music = { left: l, right: r };
  }
  onProgress?.(1);
  return result;
}
