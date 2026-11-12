/**
 * Vocal Tune: real-time pitch correction in an AudioWorklet. The detector (YIN), the scale
 * snapping and the delay-line shifter are plain self-contained functions so the same tested code
 * runs in the worklet (via toString) and in unit tests; the Tuner device reuses detectPitch.
 */

export const VOCAL_TUNE_PROCESSOR = "synclab-vocal-tune";
export const TUNE_SCALES = ["Chromatic", "Major", "Minor", "Major Pentatonic", "Minor Pentatonic", "Blues", "Harmonic Minor"] as const;
export const NOTE_NAMES = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"] as const;

/** YIN fundamental estimate in Hz, or 0 when the buffer holds no clear single pitch. */
export function detectPitch(buf: ArrayLike<number>, sr: number, minHz: number, maxHz: number): number {
  var n = buf.length;
  var rms = 0;
  for (var i = 0; i < n; i++) rms += buf[i]! * buf[i]!;
  rms = Math.sqrt(rms / Math.max(1, n));
  if (rms < 0.003) return 0;
  var tauMin = Math.max(2, Math.floor(sr / maxHz));
  var tauMax = Math.min(Math.floor(sr / minHz), Math.floor(n / 2) - 2);
  if (tauMax <= tauMin + 2) return 0;
  var W = n - tauMax - 2;
  var cm = new Float32Array(tauMax + 2);
  cm[0] = 1;
  var run = 0;
  for (var tau = 1; tau <= tauMax + 1; tau++) {
    var s = 0;
    for (var j = 0; j < W; j++) { var df = buf[j]! - buf[j + tau]!; s += df * df; }
    run += s;
    cm[tau] = run > 0 ? (s * tau) / run : 1;
  }
  var best = -1;
  for (var t = tauMin; t <= tauMax; t++) {
    if (cm[t]! < 0.15) { while (t + 1 <= tauMax && cm[t + 1]! < cm[t]!) t++; best = t; break; }
  }
  if (best < 0) {
    var lo = 1;
    for (var u = tauMin; u <= tauMax; u++) if (cm[u]! < lo) { lo = cm[u]!; best = u; }
    if (best < 0 || lo > 0.3) return 0;
  }
  var a = cm[best - 1]!, b = cm[best]!, c = cm[best + 1]!;
  var den = a - 2 * b + c;
  var shift = den !== 0 ? (a - c) / (2 * den) : 0;
  if (shift > 1 || shift < -1) shift = 0;
  return sr / (best + shift);
}

/** Nearest note (MIDI) allowed by key + scale; stays on the current note until clearly left. */
export function nearestScaleNote(m: number, key: number, scale: number, current: number): number {
  var masks = [[0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11], [0, 2, 4, 5, 7, 9, 11], [0, 2, 3, 5, 7, 8, 10], [0, 2, 4, 7, 9], [0, 3, 5, 7, 10], [0, 3, 5, 6, 7, 10], [0, 2, 3, 5, 7, 8, 11]];
  var mask = masks[Math.round(scale)] || masks[0]!;
  var k = Math.round(key);
  if (current >= 0 && Math.abs(m - current) < 0.62) {
    var pcc = (((current - k) % 12) + 12) % 12;
    if (mask.indexOf(pcc) >= 0) return current;
  }
  var bestN = Math.round(m), bestD = 99;
  for (var n = Math.floor(m) - 6; n <= Math.ceil(m) + 6; n++) {
    var pc = (((n - k) % 12) + 12) % 12;
    if (mask.indexOf(pc) < 0) continue;
    var d = Math.abs(n - m);
    if (d < bestD) { bestD = d; bestN = n; }
  }
  return bestN;
}

export interface TuneParams { key: number; scale: number; speed: number; amount: number; humanize: number; transpose: number; fine: number; output: number }
export interface TuneReading { hz: number; note: number; target: number; cents: number }
export interface TuneCore {
  set: (id: string, value: number) => void;
  process: (input: Float32Array[], output: Float32Array[]) => void;
  reading: () => TuneReading;
}

/** Detection + correction + two-tap shifter for one insert. `detect`/`nearest` are passed in so the worklet copy has no outside references. */
export function createTuneCore(sr: number, detect: typeof detectPitch, nearest: typeof nearestScaleNote, init: Partial<TuneParams>): TuneCore {
  var p: TuneParams & { [id: string]: number } = { key: 0, scale: 1, speed: 40, amount: 1, humanize: 0.3, transpose: 0, fine: 0, output: 0 };
  for (var id in init) { var v = (init as Record<string, number>)[id]; if (typeof v === "number") p[id] = v; }
  var D = Math.max(1, Math.round(sr / 11025));
  var dsr = sr / D;
  var A = 512;
  var ring = new Float32Array(A), frame = new Float32Array(A);
  var ri = 0, acc = 0, accN = 0, since = 0, filled = 0;
  var HOP = 256;
  var SIZE = 8192, MASK = SIZE - 1;
  var bufL = new Float32Array(SIZE), bufR = new Float32Array(SIZE);
  var wi = 0;
  var GW = Math.round(sr * 0.03);
  var ph = 0;
  var cents = p.transpose! * 100, desired = cents;
  var target = -1, heard = 0, held = 0, heldSec = 0;
  function analyse() {
    if (filled < A) return;
    for (var i = 0; i < A; i++) frame[i] = ring[(ri + i) % A]!;
    var f = detect(frame, dsr, 70, 1000);
    var hop = HOP / sr;
    if (f > 0) {
      var m = 69 + 12 * Math.log2(f / 440) - p.fine! / 100;
      heard = f;
      var t = nearest(m, p.key!, p.scale!, target);
      if (t !== target) { target = t; heldSec = 0; } else heldSec += hop;
      held = m;
      desired = ((t - m) * p.amount! + p.transpose!) * 100;
    } else {
      heard = 0; heldSec = 0;
      desired = p.transpose! * 100;
    }
  }
  function read(buf: Float32Array, d: number) {
    var pos = wi - d;
    var i0 = Math.floor(pos);
    var fr = pos - i0;
    var a = buf[i0 & MASK]!, b = buf[(i0 + 1) & MASK]!;
    return a + (b - a) * fr;
  }
  return {
    set: function (id: string, value: number) { p[id] = value; },
    reading: function () { return { hz: heard, note: heard > 0 ? held : -1, target: heard > 0 ? target : -1, cents: cents }; },
    process: function (input: Float32Array[], output: Float32Array[]) {
      var outL = output[0];
      if (!outL) return;
      var outR = output[1] || outL;
      var inL = input[0], inR = input[1] || input[0];
      var n = outL.length;
      var tau = (p.speed! + (heldSec > 0.15 ? p.humanize! * 250 : 0)) / 1000;
      var k = tau <= 0.0005 ? 1 : 1 - Math.exp(-(n / sr) / tau);
      cents += (desired - cents) * k;
      var ratio = Math.pow(2, cents / 1200);
      var step = (1 - ratio) / GW;
      var g = Math.pow(10, p.output! / 20);
      for (var i = 0; i < n; i++) {
        var xl = inL ? inL[i]! : 0, xr = inR ? inR[i]! : xl;
        acc += (xl + xr) * 0.5; accN++;
        if (accN >= D) { ring[ri] = acc / accN; ri = (ri + 1) % A; acc = 0; accN = 0; if (filled < A) filled++; }
        if (++since >= HOP) { since = 0; analyse(); }
        bufL[wi] = xl; bufR[wi] = xr;
        ph += step;
        if (ph >= 1) ph -= 1; else if (ph < 0) ph += 1;
        var ph2 = ph + 0.5; if (ph2 >= 1) ph2 -= 1;
        var d1 = 1 + ph * GW, d2 = 1 + ph2 * GW;
        var s1 = Math.sin(Math.PI * ph); var w1 = s1 * s1, w2 = 1 - w1;
        outL[i] = (read(bufL, d1) * w1 + read(bufL, d2) * w2) * g;
        if (outR !== outL) outR[i] = (read(bufR, d1) * w1 + read(bufR, d2) * w2) * g;
        wi = (wi + 1) & MASK;
      }
    },
  };
}

/** Worklet module source built from the tested functions above. */
export function vocalTuneWorkletSource(): string {
  return `const detect = (${detectPitch.toString()});
const nearest = (${nearestScaleNote.toString()});
const createTuneCore = (${createTuneCore.toString()});
class SynclabVocalTune extends AudioWorkletProcessor {
  constructor(options) {
    super();
    const o = (options && options.processorOptions) || {};
    this.core = createTuneCore(sampleRate, detect, nearest, o.params || {});
    this.alive = true; this.report = !!o.report; this.count = 0;
    this.port.onmessage = (e) => { const m = e.data || {}; if (m.type === "stop") this.alive = false; else if (m.type === "set") this.core.set(m.id, m.value); };
  }
  process(inputs, outputs) {
    if (!this.alive) return false;
    this.core.process(inputs[0] || [], outputs[0] || []);
    if (this.report && ++this.count % 16 === 0) this.port.postMessage(this.core.reading());
    return true;
  }
}
registerProcessor("${VOCAL_TUNE_PROCESSOR}", SynclabVocalTune);`;
}

const loaded = new WeakMap<BaseAudioContext, Promise<void>>();
const ready = new WeakSet<BaseAudioContext>();
export const vocalTuneReady = (ctx: BaseAudioContext) => ready.has(ctx);
/** Loads the worklet once per context; resolves immediately when it is already there. */
export function ensureVocalTune(ctx: BaseAudioContext): Promise<void> {
  if (ready.has(ctx)) return Promise.resolve();
  let p = loaded.get(ctx);
  if (!p) {
    if (!ctx.audioWorklet || typeof Blob === "undefined") return Promise.reject(new Error("This browser cannot run Vocal Tune."));
    const url = URL.createObjectURL(new Blob([vocalTuneWorkletSource()], { type: "application/javascript" }));
    p = ctx.audioWorklet.addModule(url).then(() => { ready.add(ctx); }).finally(() => URL.revokeObjectURL(url));
    loaded.set(ctx, p);
  }
  return p;
}

/** Latest correction readings from live Vocal Tune inserts, keyed by plugin id. */
export const tuneReadings = new Map<string, TuneReading>();

export function noteLabel(midi: number) {
  if (midi < 0 || !Number.isFinite(midi)) return "—";
  const n = Math.round(midi);
  return `${NOTE_NAMES[((n % 12) + 12) % 12]}${Math.floor(n / 12) - 1}`;
}
