import type { Capture } from "./bounce";

/**
 * Browser mastering chain.
 *
 * Everything here runs offline on the finished stereo bounce: loudness is
 * measured with the ITU-R BS.1770-4 gated algorithm, the chain is rendered in
 * an OfflineAudioContext and the final ceiling is held by a look-ahead
 * brickwall limiter with 4x oversampled true-peak detection.
 *
 * Honest limits: this is real DSP, not a trained "AI mastering" model. It
 * cannot fix a bad mix — it shapes tone, glues dynamics and hits a loudness
 * target accurately.
 */

export interface MasterSettings {
  /** target integrated loudness in LUFS (streaming ≈ -14) */
  targetLufs: number;
  /** true-peak ceiling in dBTP (streaming ≈ -1) */
  ceilingDb: number;
  /** low shelf gain in dB at 90 Hz */
  bass: number;
  /** presence shelf gain in dB at 6 kHz */
  air: number;
  /** stereo width, 1 = unchanged, 0 = mono, 2 = extra wide */
  width: number;
  /** multiband glue amount, 0..1 */
  glue: number;
  /** analogue-style drive, 0..1 */
  drive: number;
  /** high-pass rumble filter in Hz (0 = off) */
  highpass: number;
  /** keep the low end mono below this frequency (0 = off) */
  monoBass: number;
  /** add TPDF dither for 16-bit delivery */
  dither: boolean;

  /* ---- advanced devices (each off by default, so the quick controls sound the same) ---- */
  /** Mastering EQ: low shelf, two bells, high shelf */
  eqOn: boolean;
  eqLowFreq: number;
  eqLowGain: number;
  eqLmFreq: number;
  eqLmGain: number;
  eqLmQ: number;
  eqHmFreq: number;
  eqHmGain: number;
  eqHmQ: number;
  eqHighFreq: number;
  eqHighGain: number;
  /** Multiband dynamics: replaces the Glue knob while on */
  mbOn: boolean;
  mbLowX: number;
  mbHighX: number;
  mbLowThr: number;
  mbLowRatio: number;
  mbLowGain: number;
  mbMidThr: number;
  mbMidRatio: number;
  mbMidGain: number;
  mbHighThr: number;
  mbHighRatio: number;
  mbHighGain: number;
  /** ms */
  mbAttack: number;
  /** ms */
  mbRelease: number;
  /** Stereo imager: width per band (1 = unchanged), multiplies the Width knob */
  imgOn: boolean;
  imgLowX: number;
  imgHighX: number;
  imgLow: number;
  imgMid: number;
  imgHigh: number;
  /** Harmonic exciter: saturated top end blended in parallel */
  excOn: boolean;
  excFreq: number;
  excAmount: number;
  excMix: number;
  /** Maximizer (final true-peak limiter) timing, ms */
  limLookahead: number;
  limRelease: number;
}

export const MASTER_DEFAULTS: MasterSettings = {
  targetLufs: -14,
  ceilingDb: -1,
  bass: 0,
  air: 0,
  width: 1,
  glue: 0.5,
  drive: 0.15,
  highpass: 28,
  monoBass: 120,
  dither: false,
  eqOn: false,
  eqLowFreq: 100,
  eqLowGain: 0,
  eqLmFreq: 400,
  eqLmGain: 0,
  eqLmQ: 1,
  eqHmFreq: 3000,
  eqHmGain: 0,
  eqHmQ: 1,
  eqHighFreq: 12000,
  eqHighGain: 0,
  mbOn: false,
  mbLowX: 200,
  mbHighX: 3000,
  mbLowThr: -20,
  mbLowRatio: 2.5,
  mbLowGain: 0,
  mbMidThr: -18,
  mbMidRatio: 2,
  mbMidGain: 0,
  mbHighThr: -22,
  mbHighRatio: 2,
  mbHighGain: 0,
  mbAttack: 12,
  mbRelease: 180,
  imgOn: false,
  imgLowX: 250,
  imgHighX: 4000,
  imgLow: 1,
  imgMid: 1,
  imgHigh: 1,
  excOn: false,
  excFreq: 5000,
  excAmount: 0.4,
  excMix: 0.2,
  limLookahead: 2,
  limRelease: 60,
};

export interface MasterPreset {
  id: string;
  name: string;
  note: string;
  settings: MasterSettings;
}

export const MASTER_PRESETS: MasterPreset[] = [
  {
    id: "streaming",
    name: "Streaming",
    note: "-14 LUFS, -1 dBTP — Spotify, Apple Music, YouTube.",
    settings: { ...MASTER_DEFAULTS },
  },
  {
    id: "loud",
    name: "Loud & Modern",
    note: "-9 LUFS, hard and forward for club systems and playlists.",
    settings: { ...MASTER_DEFAULTS, targetLufs: -9, ceilingDb: -0.8, glue: 0.65, drive: 0.3, air: 1.5 },
  },
  {
    id: "detroit",
    name: "Detroit Techno",
    note: "-8 LUFS, tight mono low end, wide hats and pads.",
    settings: { ...MASTER_DEFAULTS, targetLufs: -8, ceilingDb: -0.8, bass: 1.5, air: 1, width: 1.2, glue: 0.7, drive: 0.35, monoBass: 140 },
  },
  {
    id: "hiphop",
    name: "Hip-Hop / Trap",
    note: "-9 LUFS with weight under 100 Hz and crisp top.",
    settings: { ...MASTER_DEFAULTS, targetLufs: -9, bass: 2.5, air: 2, glue: 0.55, drive: 0.25, monoBass: 150 },
  },
  {
    id: "vocal",
    name: "Vocal Forward",
    note: "-12 LUFS, gentle glue so the voice keeps its dynamics.",
    settings: { ...MASTER_DEFAULTS, targetLufs: -12, air: 2, glue: 0.3, drive: 0.1 },
  },
  {
    id: "club",
    name: "Club / DJ WAV",
    note: "-7 LUFS, -0.3 dBTP, maximum energy for a DJ set.",
    settings: { ...MASTER_DEFAULTS, targetLufs: -7, ceilingDb: -0.3, glue: 0.75, drive: 0.4, bass: 1, monoBass: 160 },
  },
  {
    id: "transparent",
    name: "Transparent",
    note: "-16 LUFS, almost no colour — just level and a safety ceiling.",
    settings: { ...MASTER_DEFAULTS, targetLufs: -16, glue: 0.15, drive: 0, bass: 0, air: 0 },
  },
];

export interface LoudnessReport {
  /** integrated loudness, LUFS */
  lufs: number;
  /** loudest short-term 3 s window, LUFS */
  shortTerm: number;
  /** sample peak, dBFS */
  peakDb: number;
  /** 4x oversampled true peak, dBTP */
  truePeakDb: number;
  /** loudness range (LRA), LU */
  lra: number;
  /** peak-to-loudness ratio, dB — a rough "how squashed is it" reading */
  plr: number;
}

const db = (x: number) => 20 * Math.log10(Math.max(x, 1e-9));

function makeOffline(length: number, sampleRate: number, channels = 2) {
  const Ctor =
    (globalThis as unknown as { OfflineAudioContext?: typeof OfflineAudioContext; webkitOfflineAudioContext?: typeof OfflineAudioContext })
      .OfflineAudioContext ??
    (globalThis as unknown as { webkitOfflineAudioContext?: typeof OfflineAudioContext }).webkitOfflineAudioContext;
  if (!Ctor) throw new Error("This browser cannot render audio offline, so mastering is unavailable here.");
  return new Ctor(channels, Math.max(1, Math.floor(length)), sampleRate);
}

function bufferFrom(cap: Capture, ctx: BaseAudioContext) {
  const buf = ctx.createBuffer(2, cap.left.length, cap.sampleRate);
  buf.getChannelData(0).set(cap.left);
  buf.getChannelData(1).set(cap.right.length === cap.left.length ? cap.right : cap.left);
  return buf;
}

function captureFrom(buf: AudioBuffer): Capture {
  return {
    left: new Float32Array(buf.getChannelData(0)),
    right: new Float32Array(buf.getChannelData(buf.numberOfChannels > 1 ? 1 : 0)),
    sampleRate: buf.sampleRate,
  };
}

/* ------------------------------ measurement ------------------------------ */

/** K-weighting pre-filter from BS.1770 (rendered offline so the browser does the biquads). */
async function kWeighted(cap: Capture): Promise<Capture> {
  const ctx = makeOffline(cap.left.length, cap.sampleRate);
  const src = ctx.createBufferSource();
  src.buffer = bufferFrom(cap, ctx);
  const shelf = ctx.createBiquadFilter();
  shelf.type = "highshelf";
  shelf.frequency.value = 1681;
  shelf.Q.value = 0.7071;
  shelf.gain.value = 3.999;
  const hp = ctx.createBiquadFilter();
  hp.type = "highpass";
  hp.frequency.value = 38;
  hp.Q.value = 0.5;
  src.connect(shelf).connect(hp).connect(ctx.destination);
  src.start();
  return captureFrom(await ctx.startRendering());
}

function blockLoudness(k: Capture, blockSeconds: number, hopSeconds: number) {
  const sr = k.sampleRate;
  const block = Math.max(1, Math.round(blockSeconds * sr));
  const hop = Math.max(1, Math.round(hopSeconds * sr));
  const out: number[] = [];
  for (let start = 0; start + block <= k.left.length; start += hop) {
    let sl = 0;
    let sr2 = 0;
    for (let i = start; i < start + block; i++) {
      const l = k.left[i] ?? 0;
      const r = k.right[i] ?? 0;
      sl += l * l;
      sr2 += r * r;
    }
    const mean = sl / block + sr2 / block;
    out.push(-0.691 + 10 * Math.log10(Math.max(mean, 1e-12)));
  }
  return out;
}

/** Energy mean of the blocks above a threshold, back in LUFS. */
function gatedMean(blocks: number[], threshold: number) {
  const kept = blocks.filter((b) => b > threshold);
  if (kept.length === 0) return Number.NEGATIVE_INFINITY;
  const energy = kept.reduce((a, b) => a + Math.pow(10, (b + 0.691) / 10), 0) / kept.length;
  return -0.691 + 10 * Math.log10(Math.max(energy, 1e-12));
}

/** 4x oversampled true-peak estimate using cubic interpolation. */
export function truePeak(cap: Capture) {
  let peak = 0;
  const chans = [cap.left, cap.right];
  for (const ch of chans) {
    for (let i = 0; i < ch.length; i++) {
      const p0 = ch[i - 1] ?? ch[i] ?? 0;
      const p1 = ch[i] ?? 0;
      const p2 = ch[i + 1] ?? p1;
      const p3 = ch[i + 2] ?? p2;
      peak = Math.max(peak, Math.abs(p1));
      for (let s = 1; s < 4; s++) {
        const t = s / 4;
        const a = p1;
        const b = 0.5 * (p2 - p0);
        const c = p0 - 2.5 * p1 + 2 * p2 - 0.5 * p3;
        const d = 0.5 * (p3 - p0) + 1.5 * (p1 - p2);
        peak = Math.max(peak, Math.abs(a + b * t + c * t * t + d * t * t * t));
      }
    }
  }
  return peak;
}

/** Full BS.1770-4 style loudness report for a finished bounce. */
export async function measure(cap: Capture): Promise<LoudnessReport> {
  const k = await kWeighted(cap);
  const momentary = blockLoudness(k, 0.4, 0.1);
  const short = blockLoudness(k, 3, 1);
  const abs = gatedMean(momentary, -70);
  const lufs = Number.isFinite(abs) ? gatedMean(momentary, abs - 10) : Number.NEGATIVE_INFINITY;

  // loudness range from the 10th–95th percentile of gated short-term blocks
  const shortGated = short.filter((b) => b > -70 && (!Number.isFinite(abs) || b > abs - 20)).sort((a, b) => a - b);
  const pick = (p: number) => shortGated[Math.min(shortGated.length - 1, Math.max(0, Math.round(p * (shortGated.length - 1))))] ?? 0;
  const lra = shortGated.length > 1 ? pick(0.95) - pick(0.1) : 0;

  let peak = 0;
  for (let i = 0; i < cap.left.length; i++) peak = Math.max(peak, Math.abs(cap.left[i] ?? 0), Math.abs(cap.right[i] ?? 0));
  const tp = truePeak(cap);
  const shortMax = short.length ? Math.max(...short) : Number.NEGATIVE_INFINITY;

  return {
    lufs,
    shortTerm: shortMax,
    peakDb: db(peak),
    truePeakDb: db(tp),
    lra,
    plr: Number.isFinite(lufs) ? db(tp) - lufs : 0,
  };
}

/* -------------------------------- chain --------------------------------- */

function driveCurve(amount: number) {
  const n = 1024;
  const curve = new Float32Array(n);
  const k = 1 + amount * 18;
  for (let i = 0; i < n; i++) {
    const x = (i / (n - 1)) * 2 - 1;
    curve[i] = Math.tanh(k * x) / Math.tanh(k);
  }
  return curve;
}

/** Look-ahead brickwall limiter with true-peak aware gain reduction. */
export function brickwall(
  cap: Capture,
  ceiling: number,
  lookaheadMs = 2,
  releaseMs = 60,
  stats?: { minGain: number },
): Capture {
  const sr = cap.sampleRate;
  const look = Math.max(1, Math.round((lookaheadMs / 1000) * sr));
  const rel = Math.max(1, Math.round((releaseMs / 1000) * sr));
  const n = cap.left.length;
  const outL = new Float32Array(n);
  const outR = new Float32Array(n);

  // required gain per sample so nothing exceeds the ceiling
  const need = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const m = Math.max(Math.abs(cap.left[i] ?? 0), Math.abs(cap.right[i] ?? 0));
    need[i] = m > ceiling ? ceiling / m : 1;
  }
  // smooth: take the minimum over the look-ahead window, then release slowly
  let gain = 1;
  const relCoef = Math.exp(-1 / rel);
  for (let i = 0; i < n; i++) {
    let target = 1;
    const end = Math.min(n, i + look);
    for (let j = i; j < end; j++) {
      const n2 = need[j] ?? 1;
      if (n2 < target) target = n2;
    }
    gain = target < gain ? target : target + (gain - target) * relCoef;
    if (stats && gain < stats.minGain) stats.minGain = gain;
    const idx = i - look < 0 ? 0 : i - look;
    outL[i] = (cap.left[idx] ?? 0) * gain;
    outR[i] = (cap.right[idx] ?? 0) * gain;
  }
  // hard safety clip for anything the smoother let slip
  for (let i = 0; i < n; i++) {
    outL[i] = Math.max(-ceiling, Math.min(ceiling, outL[i] ?? 0));
    outR[i] = Math.max(-ceiling, Math.min(ceiling, outR[i] ?? 0));
  }
  return { left: outL, right: outR, sampleRate: sr };
}

function applyGain(cap: Capture, g: number): Capture {
  const l = new Float32Array(cap.left.length);
  const r = new Float32Array(cap.right.length);
  for (let i = 0; i < l.length; i++) {
    l[i] = (cap.left[i] ?? 0) * g;
    r[i] = (cap.right[i] ?? 0) * g;
  }
  return { left: l, right: r, sampleRate: cap.sampleRate };
}

function ditherInPlace(cap: Capture) {
  const q = 1 / 32768;
  for (let i = 0; i < cap.left.length; i++) {
    const n = (Math.random() - Math.random()) * q * 0.5;
    cap.left[i] = (cap.left[i] ?? 0) + n;
    cap.right[i] = (cap.right[i] ?? 0) + n;
  }
}

/** Butterworth section; two in a row make a Linkwitz-Riley crossover. */
function lr(ctx: BaseAudioContext, type: BiquadFilterType, freq: number) {
  const f = ctx.createBiquadFilter();
  f.type = type;
  f.frequency.value = freq;
  f.Q.value = Math.SQRT1_2;
  return f;
}

/** Tone shaping, mono bass, width, glue compression and drive, rendered offline. */
async function renderChain(cap: Capture, s: MasterSettings): Promise<Capture> {
  const ctx = makeOffline(cap.left.length, cap.sampleRate);
  const src = ctx.createBufferSource();
  src.buffer = bufferFrom(cap, ctx);

  let node: AudioNode = src;
  const chain = (next: AudioNode) => {
    node.connect(next);
    node = next;
    return next;
  };

  if (s.highpass > 0) {
    const hp = ctx.createBiquadFilter();
    hp.type = "highpass";
    hp.frequency.value = s.highpass;
    hp.Q.value = 0.7;
    chain(hp);
  }
  if (s.bass !== 0) {
    const low = ctx.createBiquadFilter();
    low.type = "lowshelf";
    low.frequency.value = 90;
    low.gain.value = s.bass;
    chain(low);
  }
  if (s.air !== 0) {
    const high = ctx.createBiquadFilter();
    high.type = "highshelf";
    high.frequency.value = 6000;
    high.gain.value = s.air;
    chain(high);
  }

  // Mastering EQ device
  if (s.eqOn) {
    const bands: Array<{ type: BiquadFilterType; f: number; g: number; q?: number }> = [
      { type: "lowshelf", f: s.eqLowFreq, g: s.eqLowGain },
      { type: "peaking", f: s.eqLmFreq, g: s.eqLmGain, q: s.eqLmQ },
      { type: "peaking", f: s.eqHmFreq, g: s.eqHmGain, q: s.eqHmQ },
      { type: "highshelf", f: s.eqHighFreq, g: s.eqHighGain },
    ];
    for (const b of bands) {
      if (b.g === 0) continue;
      const f = ctx.createBiquadFilter();
      f.type = b.type;
      f.frequency.value = b.f;
      f.gain.value = b.g;
      if (b.q) f.Q.value = b.q;
      chain(f);
    }
  }

  // stereo width with a mono-bass guard: side signal is width-scaled and
  // high-passed so the low end stays centred and translates on any system.
  if (s.width !== 1 || s.monoBass > 0 || s.imgOn) {
    const splitter = ctx.createChannelSplitter(2);
    const merger = ctx.createChannelMerger(2);
    node.connect(splitter);

    const mid = ctx.createGain();
    const side = ctx.createGain();
    mid.gain.value = 0.5;
    side.gain.value = 0.5;
    const invert = ctx.createGain();
    invert.gain.value = -1;

    splitter.connect(mid, 0);
    splitter.connect(mid, 1);
    splitter.connect(side, 0);
    splitter.connect(invert, 1);
    invert.connect(side);

    let sideOut: AudioNode = side;
    if (s.monoBass > 0) {
      const hp = ctx.createBiquadFilter();
      hp.type = "highpass";
      hp.frequency.value = s.monoBass;
      hp.Q.value = 0.7;
      side.connect(hp);
      sideOut = hp;
    }
    // stereo imager: widen or narrow lows, mids and highs separately
    if (s.imgOn) {
      const sum = ctx.createGain();
      const bandsIn: Array<{ filters: BiquadFilterNode[]; width: number }> = [
        { filters: [lr(ctx, "lowpass", s.imgLowX), lr(ctx, "lowpass", s.imgLowX)], width: s.imgLow },
        {
          filters: [lr(ctx, "highpass", s.imgLowX), lr(ctx, "highpass", s.imgLowX), lr(ctx, "lowpass", s.imgHighX), lr(ctx, "lowpass", s.imgHighX)],
          width: s.imgMid,
        },
        { filters: [lr(ctx, "highpass", s.imgHighX), lr(ctx, "highpass", s.imgHighX)], width: s.imgHigh },
      ];
      for (const band of bandsIn) {
        let head: AudioNode = sideOut;
        for (const f of band.filters) {
          head.connect(f);
          head = f;
        }
        const g = ctx.createGain();
        g.gain.value = Math.max(0, band.width);
        head.connect(g).connect(sum);
      }
      sideOut = sum;
    }
    const widthGain = ctx.createGain();
    widthGain.gain.value = Math.max(0, s.width);
    sideOut.connect(widthGain);

    const invertBack = ctx.createGain();
    invertBack.gain.value = -1;
    widthGain.connect(invertBack);

    mid.connect(merger, 0, 0);
    widthGain.connect(merger, 0, 0);
    mid.connect(merger, 0, 1);
    invertBack.connect(merger, 0, 1);
    node = merger;
  }

  // three-band glue compression — the Multiband device takes over its settings while on
  if (s.mbOn) {
    const sum = ctx.createGain();
    const bands = [
      { filters: [lr(ctx, "lowpass", s.mbLowX), lr(ctx, "lowpass", s.mbLowX)], thr: s.mbLowThr, ratio: s.mbLowRatio, gain: s.mbLowGain },
      {
        filters: [lr(ctx, "highpass", s.mbLowX), lr(ctx, "highpass", s.mbLowX), lr(ctx, "lowpass", s.mbHighX), lr(ctx, "lowpass", s.mbHighX)],
        thr: s.mbMidThr,
        ratio: s.mbMidRatio,
        gain: s.mbMidGain,
      },
      { filters: [lr(ctx, "highpass", s.mbHighX), lr(ctx, "highpass", s.mbHighX)], thr: s.mbHighThr, ratio: s.mbHighRatio, gain: s.mbHighGain },
    ];
    for (const band of bands) {
      let head: AudioNode = node;
      for (const f of band.filters) {
        head.connect(f);
        head = f;
      }
      const comp = ctx.createDynamicsCompressor();
      comp.threshold.value = band.thr;
      comp.knee.value = 8;
      comp.ratio.value = Math.max(1, band.ratio);
      comp.attack.value = Math.max(0.001, s.mbAttack / 1000);
      comp.release.value = Math.max(0.01, s.mbRelease / 1000);
      const makeup = ctx.createGain();
      makeup.gain.value = Math.pow(10, band.gain / 20);
      head.connect(comp).connect(makeup).connect(sum);
    }
    node = sum;
  } else if (s.glue > 0) {
    const sum = ctx.createGain();
    const bands: Array<{ filters: BiquadFilterNode[]; ratio: number; threshold: number }> = [];
    const mk = (type: BiquadFilterType, freq: number) => {
      const f = ctx.createBiquadFilter();
      f.type = type;
      f.frequency.value = freq;
      f.Q.value = 0.7071;
      return f;
    };
    bands.push({ filters: [mk("lowpass", 200), mk("lowpass", 200)], ratio: 2 + s.glue * 2, threshold: -18 - s.glue * 6 });
    bands.push({ filters: [mk("highpass", 200), mk("lowpass", 3000)], ratio: 1.8 + s.glue * 2, threshold: -16 - s.glue * 6 });
    bands.push({ filters: [mk("highpass", 3000), mk("highpass", 3000)], ratio: 1.6 + s.glue * 1.5, threshold: -20 - s.glue * 5 });
    for (const band of bands) {
      let head: AudioNode = node;
      for (const f of band.filters) {
        head.connect(f);
        head = f;
      }
      const comp = ctx.createDynamicsCompressor();
      comp.threshold.value = band.threshold;
      comp.knee.value = 12;
      comp.ratio.value = band.ratio;
      comp.attack.value = 0.012;
      comp.release.value = 0.18;
      const makeup = ctx.createGain();
      makeup.gain.value = 1 + s.glue * 0.35;
      head.connect(comp).connect(makeup).connect(sum);
    }
    node = sum;
  }

  // harmonic exciter: saturate only the top end and blend it back in parallel
  if (s.excOn && s.excMix > 0) {
    const sum = ctx.createGain();
    node.connect(sum);
    const hp1 = lr(ctx, "highpass", s.excFreq);
    const shaper = ctx.createWaveShaper();
    shaper.curve = driveCurve(Math.max(0.05, s.excAmount));
    shaper.oversample = "4x";
    const hp2 = lr(ctx, "highpass", s.excFreq);
    const wet = ctx.createGain();
    wet.gain.value = s.excMix;
    node.connect(hp1).connect(shaper).connect(hp2).connect(wet).connect(sum);
    node = sum;
  }

  if (s.drive > 0) {
    const shaper = ctx.createWaveShaper();
    shaper.curve = driveCurve(s.drive);
    shaper.oversample = "4x";
    const trim = ctx.createGain();
    trim.gain.value = 1 - s.drive * 0.25;
    chain(shaper);
    chain(trim);
  }

  node.connect(ctx.destination);
  src.start();
  return captureFrom(await ctx.startRendering());
}

export interface MasterResult {
  audio: Capture;
  before: LoudnessReport;
  after: LoudnessReport;
  /** gain the loudness match applied, in dB */
  matchDb: number;
  /** deepest gain reduction the maximizer applied, in dB (0 = never touched) */
  reductionDb: number;
}

/** Run the full mastering pass and report the loudness before and after. */
export async function master(
  cap: Capture,
  input: MasterSettings,
  onProgress?: (stage: string, pct: number) => void,
): Promise<MasterResult> {
  const settings: MasterSettings = { ...MASTER_DEFAULTS, ...input };
  const look = settings.limLookahead;
  const rel = settings.limRelease;
  let stats = { minGain: 1 };
  onProgress?.("Measuring your mix", 0.05);
  const before = await measure(cap);

  onProgress?.("Shaping tone and dynamics", 0.3);
  const shaped = await renderChain(cap, settings);

  onProgress?.("Matching loudness", 0.6);
  const shapedReport = await measure(shaped);
  const ceiling = Math.pow(10, settings.ceilingDb / 20);
  let matchDb = 0;
  let levelled = shaped;
  if (Number.isFinite(shapedReport.lufs)) {
    matchDb = settings.targetLufs - shapedReport.lufs;
    // limiter does the last few dB of the push, so don't ask it for more than 12 dB
    matchDb = Math.max(-24, Math.min(24, matchDb));
    levelled = applyGain(shaped, Math.pow(10, matchDb / 20));
  }

  onProgress?.("Holding the peak ceiling", 0.8);
  const limited = brickwall(levelled, ceiling, look, rel, stats);
  if (settings.dither) ditherInPlace(limited);

  onProgress?.("Checking the result", 0.92);
  let final = limited;
  let after = await measure(final);
  // limiting eats a little loudness — one correction pass lands on the target
  if (Number.isFinite(after.lufs) && Math.abs(after.lufs - settings.targetLufs) > 0.4) {
    const trim = Math.max(-6, Math.min(6, settings.targetLufs - after.lufs));
    const retryStats = { minGain: 1 };
    const retried = brickwall(applyGain(levelled, Math.pow(10, (matchDb + trim) / 20)), ceiling, look, rel, retryStats);
    if (settings.dither) ditherInPlace(retried);
    const check = await measure(retried);
    if (Math.abs(check.lufs - settings.targetLufs) < Math.abs(after.lufs - settings.targetLufs)) {
      final = retried;
      after = check;
      matchDb += trim;
      stats = retryStats;
    }
  }
  onProgress?.("Done", 1);
  return { audio: final, before, after, matchDb, reductionDb: -db(stats.minGain) };
}
