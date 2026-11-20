/**
 * Piano engine: struck-string and electric-piano notes rendered as PCM from a physical-style
 * model (inharmonic partials, two-stage string decay, detuned unison strings, hammer noise, tine and
 * reed pickups), cached per model / zone / velocity layer and played back through the normal synth
 * voice (filter, amp envelope, effects), so a piano preset sounds like a piano rather than an
 * oscillator. Zones are every 3 semitones; the voice repitches within a zone like a multisample.
 * Rendering is pure maths (no audio API) so live playback and offline exports use identical audio.
 */

export type PianoModel =
  "grand" | "bright" | "felt" | "upright" | "honky" | "tine" | "reed" | "toy";

export interface PianoEngine {
  model: PianoModel;
  /** 0..1.5 level of the piano layer inside the voice */
  level: number;
}

export const PIANO_MODELS: { id: PianoModel; label: string; short: string }[] = [
  { id: "grand", label: "Concert Grand", short: "GRAND" },
  { id: "bright", label: "Bright Grand", short: "BRIGHT" },
  { id: "felt", label: "Felt Piano", short: "FELT" },
  { id: "upright", label: "Upright", short: "UPRIGHT" },
  { id: "honky", label: "Honky-Tonk", short: "HONKY" },
  { id: "tine", label: "Tine Electric Piano", short: "TINE EP" },
  { id: "reed", label: "Reed Electric Piano", short: "REED EP" },
  { id: "toy", label: "Toy Piano", short: "TOY" },
];

/** Rendering rate: partials stay below ~13 kHz, so 32 kHz keeps quality at a fraction of the cost. */
export const PIANO_RATE = 32000;
const ZONE = 3;
const LOW = 21;
const HIGH = 108;

export const pianoZone = (midi: number): number => {
  const m = Math.min(HIGH, Math.max(LOW, Math.round(midi)));
  return Math.min(HIGH, LOW + Math.round((m - LOW) / ZONE) * ZONE);
};
/** Velocity layer: 0 soft, 1 medium, 2 hard — harder notes are brighter, not just louder. */
export const pianoLayer = (velocity: number): 0 | 1 | 2 =>
  velocity < 0.42 ? 0 : velocity < 0.78 ? 1 : 2;

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

function rng(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

interface StringCfg {
  detune: number; // cents between unison strings
  B: number; // inharmonicity at middle C
  slope: [number, number, number]; // spectral slope per layer
  hammerHz: [number, number, number]; // hammer felt brightness per layer
  strike: number; // strike point (fraction of string length)
  prompt: number; // prompt-sound decay scale
  after: number; // aftersound decay scale
  noise: number; // hammer noise level
  thump: number; // low key/soundboard thump level
  maxLen: number;
}

const STRINGS: Record<"grand" | "bright" | "felt" | "upright" | "honky", StringCfg> = {
  grand: {
    detune: 0.9,
    B: 1.3e-4,
    slope: [1.9, 1.45, 1.1],
    hammerHz: [850, 1700, 3400],
    strike: 1 / 7.3,
    prompt: 1,
    after: 1,
    noise: 0.05,
    thump: 0.04,
    maxLen: 5,
  },
  bright: {
    detune: 1.1,
    B: 1.4e-4,
    slope: [1.6, 1.2, 0.9],
    hammerHz: [1500, 3000, 6000],
    strike: 1 / 8.1,
    prompt: 0.9,
    after: 0.9,
    noise: 0.07,
    thump: 0.03,
    maxLen: 4.5,
  },
  felt: {
    detune: 0.7,
    B: 1.2e-4,
    slope: [2.6, 2.2, 1.9],
    hammerHz: [380, 650, 1100],
    strike: 1 / 7,
    prompt: 0.9,
    after: 0.75,
    noise: 0.025,
    thump: 0.08,
    maxLen: 4,
  },
  upright: {
    detune: 1.8,
    B: 2.2e-4,
    slope: [2, 1.55, 1.2],
    hammerHz: [800, 1500, 2900],
    strike: 1 / 6.4,
    prompt: 0.75,
    after: 0.6,
    noise: 0.06,
    thump: 0.06,
    maxLen: 3.6,
  },
  honky: {
    detune: 11,
    B: 2e-4,
    slope: [1.7, 1.3, 1],
    hammerHz: [1200, 2400, 4600],
    strike: 1 / 7.6,
    prompt: 0.8,
    after: 0.65,
    noise: 0.07,
    thump: 0.04,
    maxLen: 3.6,
  },
};

/** Render one sinusoid with two-stage exponential decay into `out`, via a rotating phasor (no Math.sin per sample). */
function addPartial(
  out: Float32Array,
  sr: number,
  freq: number,
  amp: number,
  phase: number,
  tauP: number,
  tauA: number,
  wP: number,
  endSec: number,
) {
  if (freq >= sr * 0.47 || amp < 1e-6) return;
  const end = Math.min(out.length, Math.ceil(endSec * sr));
  const w = (2 * Math.PI * freq) / sr;
  const cw = Math.cos(w),
    sw = Math.sin(w);
  let c = Math.cos(phase),
    s = Math.sin(phase);
  let eP = amp * wP,
    eA = amp * (1 - wP);
  const dP = Math.exp(-1 / (tauP * sr)),
    dA = Math.exp(-1 / (tauA * sr));
  for (let i = 0; i < end; i++) {
    out[i]! += s * (eP + eA);
    const nc = c * cw - s * sw;
    s = s * cw + c * sw;
    c = nc;
    eP *= dP;
    eA *= dA;
  }
}

function renderStrings(
  cfg: StringCfg,
  root: number,
  layer: 0 | 1 | 2,
  sr: number,
  seed: number,
): Float32Array {
  const rand = rng(seed);
  const f0 = 440 * 2 ** ((root - 69) / 12);
  const k = (root - LOW) / (HIGH - LOW);
  const s = clamp((262 / f0) ** 0.55, 0.12, 3);
  const tauP = 0.38 * s * cfg.prompt;
  const tauA = 2.3 * s * cfg.after;
  const len = Math.round(sr * clamp(2.4 * tauA, 1.2, cfg.maxLen));
  const out = new Float32Array(len);
  const strings = root < 33 ? 1 : root < 50 ? 2 : 3;
  const dets =
    strings === 1
      ? [0]
      : strings === 2
        ? [-cfg.detune / 2, cfg.detune / 2]
        : [-cfg.detune / 2, cfg.detune * 0.08, cfg.detune / 2];
  const B = clamp(cfg.B * 2 ** ((root - 60) / 13), 3e-5, 0.02);
  const p = cfg.slope[layer];
  const fc = cfg.hammerHz[layer] * (1 + 1.4 * k);
  const maxF = Math.min(sr * 0.45, 13000);
  const lenSec = len / sr;
  for (let n = 1; n <= 64; n++) {
    const fn = n * f0 * Math.sqrt(1 + B * n * n);
    if (fn > maxF) break;
    let a = Math.abs(Math.sin(Math.PI * n * cfg.strike)) / n ** p / (1 + (fn / fc) ** 2);
    a *= 1 - Math.exp(-fn / 140); // weak bass fundamentals, like a real soundboard
    if (a < 2e-5) continue;
    const damp = 1 + (fn / 1900) ** 1.45;
    const tp = tauP / damp;
    const ta = tauA / damp ** 1.2;
    const endSec = Math.min(lenSec, ta * Math.log(Math.max(1.0001, a / 1e-5)) + 0.05);
    // only the lower partials need separate detuned strings; above that the beating is inaudible
    const copies = n <= 10 ? dets : [0];
    for (const d of copies) {
      const f = fn * 2 ** ((d + (rand() - 0.5) * 0.25) / 1200);
      addPartial(
        out,
        sr,
        f,
        (a / copies.length) * (0.9 + rand() * 0.2),
        rand() * Math.PI * 2,
        tp,
        ta,
        0.62,
        endSec,
      );
    }
  }
  // hammer noise (felt hitting the string) and a low key thump
  const nTau = [0.007, 0.0045, 0.003][layer]!;
  const nCut = clamp(fc * 1.3, 500, 9000);
  const alpha = 1 - Math.exp((-2 * Math.PI * nCut) / sr);
  const noiseLvl = cfg.noise * [0.6, 1, 1.5][layer]!;
  let lp = 0;
  const nEnd = Math.min(len, Math.ceil(nTau * 8 * sr));
  for (let i = 0; i < nEnd; i++) {
    lp += alpha * (rand() * 2 - 1 - lp);
    out[i]! += lp * noiseLvl * Math.exp(-i / (nTau * sr));
  }
  const thumpF = 55 + 40 * k;
  const tEnd = Math.min(len, Math.ceil(0.25 * sr));
  for (let i = 0; i < tEnd; i++)
    out[i]! +=
      Math.sin((2 * Math.PI * thumpF * i) / sr) *
      cfg.thump *
      Math.exp(-i / (0.035 * sr)) *
      (0.5 + layer * 0.25);
  return out;
}

function renderTine(root: number, layer: 0 | 1 | 2, sr: number, seed: number): Float32Array {
  const rand = rng(seed);
  const f0 = 440 * 2 ** ((root - 69) / 12);
  const tau = clamp(1.7 * (262 / f0) ** 0.5, 0.35, 3.4);
  const len = Math.round(sr * clamp(2.6 * tau, 1, 4.5));
  const out = new Float32Array(len);
  const I0 = [0.35, 0.95, 1.9][layer]!;
  const bark = [0.06, 0.16, 0.34][layer]!;
  const bell = [0.04, 0.09, 0.16][layer]!;
  const w = (2 * Math.PI * f0) / sr;
  const bellF = f0 * 6.8;
  const wb = (2 * Math.PI * bellF) / sr;
  let dc = 0;
  for (let i = 0; i < len; i++) {
    const t = i / sr;
    const I = I0 * Math.exp(-t / 0.11) + 0.1;
    const ph = w * i;
    let y = Math.sin(ph + I * Math.sin(ph));
    y += y * y * bark; // pickup asymmetry → the "bark" of a hard-hit tine
    if (bellF < sr * 0.45) y += Math.sin(wb * i) * bell * Math.exp(-t / 0.05);
    const env =
      (0.5 * Math.exp(-t / (tau * 0.22)) + 0.5 * Math.exp(-t / tau)) * Math.min(1, t / 0.0012);
    dc += (y - dc) * 0.004;
    out[i] = (y - dc) * env;
  }
  const nEnd = Math.min(len, Math.ceil(0.02 * sr));
  for (let i = 0; i < nEnd; i++) out[i]! += (rand() * 2 - 1) * 0.02 * Math.exp(-i / (0.003 * sr));
  return out;
}

function renderReed(root: number, layer: 0 | 1 | 2, sr: number): Float32Array {
  const f0 = 440 * 2 ** ((root - 69) / 12);
  const tau = clamp(1.15 * (262 / f0) ** 0.5, 0.3, 2.4);
  const len = Math.round(sr * clamp(2.6 * tau, 0.9, 3.5));
  const out = new Float32Array(len);
  const k0 = [1.2, 2.1, 3.6][layer]!;
  const w = (2 * Math.PI * f0) / sr;
  // keep the folded harmonics below Nyquist on high notes
  const kMax = clamp((sr * 0.4) / f0 / 6, 1, 4);
  let dc = 0;
  for (let i = 0; i < len; i++) {
    const t = i / sr;
    const kk = Math.min(kMax, 1 + (k0 - 1) * Math.exp(-t / 0.16));
    const x = Math.sin(w * i + 0.25 * Math.sin(2 * w * i) * Math.exp(-t / 0.3));
    let y = Math.tanh(kk * x + 0.18) / Math.tanh(kk);
    const env =
      (0.45 * Math.exp(-t / (tau * 0.3)) + 0.55 * Math.exp(-t / tau)) * Math.min(1, t / 0.002);
    dc += (y - dc) * 0.004;
    y -= dc;
    out[i] = y * env;
  }
  return out;
}

function renderToy(root: number, layer: 0 | 1 | 2, sr: number, seed: number): Float32Array {
  const rand = rng(seed);
  const f0 = 440 * 2 ** ((root - 69) / 12);
  const tau = clamp(0.9 * (523 / f0) ** 0.4, 0.2, 1.6);
  const len = Math.round(sr * clamp(3 * tau, 0.6, 3));
  const out = new Float32Array(len);
  const ratios = [1, 2.76, 5.4, 8.93, 13.34];
  const amps = [1, 0.55, 0.3, 0.16, 0.08];
  const bright = [0.5, 0.8, 1.1][layer]!;
  ratios.forEach((r, i) => {
    const a = (amps[i] ?? 0) * (i === 0 ? 1 : bright ** i);
    const t = tau / (1 + 0.8 * i);
    addPartial(out, sr, f0 * r, a, rand() * Math.PI * 2, t * 0.4, t, 0.3, len / sr);
  });
  const nEnd = Math.min(len, Math.ceil(0.01 * sr));
  for (let i = 0; i < nEnd; i++)
    out[i]! += (rand() * 2 - 1) * 0.12 * bright * Math.exp(-i / (0.0015 * sr));
  return out;
}

/** Render one piano zone (pure). Normalised so every zone and model plays at the same body level. */
export function renderPianoNote(
  model: PianoModel,
  root: number,
  layer: 0 | 1 | 2,
  sr = PIANO_RATE,
): Float32Array {
  const seed = root * 31 + layer * 7 + model.length * 1009;
  const data =
    model === "tine"
      ? renderTine(root, layer, sr, seed)
      : model === "reed"
        ? renderReed(root, layer, sr)
        : model === "toy"
          ? renderToy(root, layer, sr, seed)
          : renderStrings(STRINGS[model] ?? STRINGS.grand, root, layer, sr, seed);
  // body loudness over the first 0.3 s → fixed target, peak kept below full scale
  const win = Math.min(data.length, Math.round(sr * 0.3));
  let sum = 0;
  let peak = 0;
  for (let i = 0; i < data.length; i++) {
    const v = Math.abs(data[i]!);
    if (i < win) sum += v * v;
    if (v > peak) peak = v;
  }
  const rms = Math.sqrt(sum / Math.max(1, win));
  const gain = Math.min(0.2 / Math.max(1e-6, rms), 0.9 / Math.max(1e-6, peak));
  // fade the very end so a long-held key never clicks off
  const fade = Math.min(data.length, Math.round(sr * 0.6));
  for (let i = 0; i < data.length; i++) {
    const fromEnd = data.length - i;
    data[i]! *= gain * (fromEnd < fade ? fromEnd / fade : 1);
  }
  return data;
}

const pcm = new Map<string, Float32Array>();
const buffers = new WeakMap<BaseAudioContext, Map<string, AudioBuffer>>();
const keyOf = (model: PianoModel, root: number, layer: number) => `${model}:${root}:${layer}`;

export function pianoPcm(model: PianoModel, root: number, layer: 0 | 1 | 2): Float32Array {
  const key = keyOf(model, root, layer);
  let d = pcm.get(key);
  if (!d) {
    d = renderPianoNote(model, root, layer);
    pcm.set(key, d);
  }
  return d;
}

export function pianoBuffer(
  ctx: BaseAudioContext,
  model: PianoModel,
  midi: number,
  velocity: number,
): { buffer: AudioBuffer; root: number } {
  const root = pianoZone(midi);
  const layer = pianoLayer(velocity);
  const key = keyOf(model, root, layer);
  let map = buffers.get(ctx);
  if (!map) {
    map = new Map();
    buffers.set(ctx, map);
  }
  let buffer = map.get(key);
  if (!buffer) {
    const d = pianoPcm(model, root, layer);
    buffer = ctx.createBuffer(1, d.length, PIANO_RATE);
    buffer.copyToChannel(d as Float32Array<ArrayBuffer>, 0);
    map.set(key, buffer);
  }
  return { buffer, root };
}

const warming = new Set<PianoModel>();
/** Render the common zones in the background (one at a time while idle) so first presses don't stall. */
export function warmPiano(model: PianoModel) {
  if (warming.has(model) || typeof setTimeout === "undefined") return;
  warming.add(model);
  const queue: [number, 0 | 1 | 2][] = [];
  for (const layer of [1, 2, 0] as const)
    for (let r = 48; r <= 84; r += ZONE) queue.push([pianoZone(r), layer]);
  for (const layer of [1, 2, 0] as const)
    for (let r = 27; r <= 105; r += ZONE) if (r < 48 || r > 84) queue.push([pianoZone(r), layer]);
  const idle = (fn: () => void) => {
    const ric = (
      globalThis as { requestIdleCallback?: (cb: () => void, o?: { timeout: number }) => void }
    ).requestIdleCallback;
    if (ric) ric(fn, { timeout: 400 });
    else setTimeout(fn, 40);
  };
  const next = () => {
    const job = queue.shift();
    if (!job) return;
    pianoPcm(model, job[0], job[1]);
    idle(next);
  };
  idle(next);
}
