/**
 * Pure DJ helpers (tested): tempo detection, beat grid, sync maths, crossfader curve and the
 * three-band waveform the decks draw (lows red, mids green, highs blue, Serato-style).
 */

export interface BpmResult {
  bpm: number;
  firstBeat: number;
  confidence: number;
}

/** Onset strength per frame (positive energy change), from a mono signal. */
export function onsetEnvelope(mono: Float32Array, sampleRate: number, hop = 512) {
  const frames = Math.floor(mono.length / hop);
  const env = new Float32Array(frames);
  // a gentle low-pass favours kicks and bass, which carry the beat in most dance music
  let lp = 0;
  const a = Math.exp((-2 * Math.PI * 180) / sampleRate);
  let prev = 0;
  for (let f = 0; f < frames; f++) {
    let e = 0;
    const base = f * hop;
    for (let i = 0; i < hop; i++) {
      const x = mono[base + i] ?? 0;
      lp = a * lp + (1 - a) * x;
      e += lp * lp + 0.25 * x * x;
    }
    e = Math.sqrt(e / hop);
    env[f] = Math.max(0, e - prev);
    prev = e;
  }
  return { env, fps: sampleRate / hop };
}

/** Tempo and first downbeat estimate. Tempo is folded into 70–180 BPM. */
export function detectBpm(mono: Float32Array, sampleRate: number, min = 70, max = 180): BpmResult {
  const { env, fps } = onsetEnvelope(mono, sampleRate);
  if (env.length < fps * 4) return { bpm: 120, firstBeat: 0, confidence: 0 };
  // remove the local mean so steady noise does not pull the autocorrelation
  let mean = 0;
  for (const v of env) mean += v;
  mean /= env.length;
  const x = env.map((v) => v - mean);
  const lagMin = Math.floor((60 / max) * fps),
    lagMax = Math.ceil((60 / min) * fps);
  let best = 0,
    bestLag = lagMin,
    total = 0;
  const scores: number[] = [];
  for (let lag = lagMin; lag <= lagMax; lag++) {
    let s = 0;
    for (let i = 0; i + lag < x.length; i++) s += x[i]! * x[i + lag]!;
    // also reward the double lag, which separates a tempo from its half/double
    for (let i = 0; i + 2 * lag < x.length; i++) s += 0.5 * x[i]! * x[i + 2 * lag]!;
    scores.push(s);
    total += Math.max(0, s);
    if (s > best) {
      best = s;
      bestLag = lag;
    }
  }
  // parabolic refinement around the best lag for a fractional tempo
  const k = bestLag - lagMin;
  const y0 = scores[k - 1] ?? best,
    y1 = best,
    y2 = scores[k + 1] ?? best;
  const denom = y0 - 2 * y1 + y2;
  const shift = denom !== 0 ? Math.max(-0.5, Math.min(0.5, (0.5 * (y0 - y2)) / denom)) : 0;
  let rough = (60 * fps) / (bestLag + shift);
  while (rough < min) rough *= 2;
  while (rough > max) rough /= 2;
  // Fine pass: the tempo (in 0.05 BPM steps) and phase whose beat grid lands on the most onset energy.
  const at = (t: number) => {
    const i = Math.floor(t),
      f = t - i;
    return (env[i] ?? 0) * (1 - f) + (env[i + 1] ?? 0) * f;
  };
  const comb = (b: number) => {
    const period = (60 / b) * fps;
    let bestP = 0,
      bestS = -Infinity;
    const phases = Math.ceil(period * 2);
    for (let k = 0; k < phases; k++) {
      const p = (k / phases) * period;
      let sum = 0;
      for (let t = p; t < env.length - 1; t += period) sum += at(t);
      if (sum > bestS) {
        bestS = sum;
        bestP = p;
      }
    }
    return { score: bestS, phase: bestP };
  };
  let bpm = rough,
    phase = 0,
    top = -Infinity;
  for (let b = rough - 3; b <= rough + 3; b += 0.05) {
    if (b < min * 0.95 || b > max * 1.05) continue;
    const r = comb(b);
    if (r.score > top) {
      top = r.score;
      bpm = b;
      phase = r.phase;
    }
  }
  bpm = Math.round(bpm * 10) / 10;
  const confidence = total > 0 ? Math.min(1, (best / total) * scores.length * 0.08) : 0;
  // the energy jump shows up in the frame after the hit starts
  return { bpm, firstBeat: Math.max(0, (phase - 0.5) / fps), confidence };
}

/** Playback rate that makes a deck at `bpm` play at `targetBpm`, limited to the pitch range. */
export function syncRate(bpm: number, targetBpm: number, range = 0.16) {
  if (!(bpm > 0) || !(targetBpm > 0)) return 1;
  // match half/double tempos to the nearest musically sensible ratio
  let target = targetBpm;
  while (target / bpm > 1.5) target /= 2;
  while (bpm / target > 1.5) target *= 2;
  return Math.max(1 - range, Math.min(1 + range, target / bpm));
}

/** Beat phase 0..1 at a track position. */
export function beatPhase(pos: number, firstBeat: number, bpm: number) {
  const beat = 60 / Math.max(1, bpm);
  const p = ((pos - firstBeat) / beat) % 1;
  return p < 0 ? p + 1 : p;
}

/** Track-time shift that lines this deck's beats up with the other deck (smallest move). */
export function phaseShift(pos: number, firstBeat: number, bpm: number, otherPhase: number) {
  let d = otherPhase - beatPhase(pos, firstBeat, bpm);
  if (d > 0.5) d -= 1;
  if (d < -0.5) d += 1;
  return d * (60 / Math.max(1, bpm));
}

/** Nearest beat at or before `pos` (track seconds). */
export function snapToBeat(pos: number, firstBeat: number, bpm: number) {
  const beat = 60 / Math.max(1, bpm);
  return firstBeat + Math.floor((pos - firstBeat) / beat + 1e-6) * beat;
}

/** Equal-power crossfader: x -1 (deck A) … 1 (deck B). */
export function crossfade(x: number): [number, number] {
  const t = (Math.max(-1, Math.min(1, x)) + 1) / 2;
  return [Math.cos((t * Math.PI) / 2), Math.sin((t * Math.PI) / 2)];
}

/** EQ knob 0..1 → dB: 0 = kill (-40 dB), 0.5 = flat, 1 = +6 dB. */
export function eqDb(v: number) {
  const x = Math.max(0, Math.min(1, v));
  return x >= 0.5 ? (x - 0.5) * 12 : x <= 0.02 ? -40 : -26 * (1 - x / 0.5) ** 1.5;
}

/** Filter knob 0..1: below centre a low-pass sweeps down, above it a high-pass sweeps up. */
export function filterFor(v: number): { type: "lowpass" | "highpass" | "off"; freq: number } {
  const x = Math.max(0, Math.min(1, v));
  if (Math.abs(x - 0.5) < 0.03) return { type: "off", freq: 0 };
  if (x < 0.5) return { type: "lowpass", freq: 120 * Math.pow(20000 / 120, x / 0.47) };
  return { type: "highpass", freq: 30 * Math.pow(8000 / 30, (x - 0.53) / 0.47) };
}

/** The controls that decide whether a playing deck reaches the speakers. */
export interface DeckLevels {
  deck: "A" | "B";
  gain: number;
  fader: number;
  filter: number;
  eq: { high: number; mid: number; low: number };
  crossfader: number;
  master: number;
}
/** Which mixer control is keeping a playing deck silent at the speakers (plain words), or null when sound can get through. */
export function djSilenceReason(c: DeckLevels): string | null {
  const other = c.deck === "A" ? "B" : "A";
  if (c.gain < 0.05) return `Deck ${c.deck}'s GAIN knob is turned all the way down.`;
  if (c.fader < 0.05) return `Deck ${c.deck}'s volume fader is all the way down.`;
  const [a, b] = crossfade(c.crossfader);
  if ((c.deck === "A" ? a : b) < 0.05)
    return `The crossfader is all the way over to deck ${other}.`;
  if (c.master < 0.05) return "The MASTER knob is turned all the way down.";
  if (c.eq.high <= 0.02 && c.eq.mid <= 0.02 && c.eq.low <= 0.02)
    return `All three of deck ${c.deck}'s EQ knobs (HI, MID, LOW) are turned all the way down.`;
  const f = filterFor(c.filter);
  if ((f.type === "lowpass" && f.freq < 150) || (f.type === "highpass" && f.freq > 6000))
    return `Deck ${c.deck}'s FILT knob is turned all the way to one side.`;
  return null;
}

export interface BandWave {
  peak: Float32Array;
  low: Float32Array;
  mid: Float32Array;
  high: Float32Array;
  perSecond: number;
}

/** Three-band levels per column, `perSecond` columns per second of audio. */
export function bandWave(channels: Float32Array[], sampleRate: number, perSecond = 120): BandWave {
  const len = channels[0]?.length ?? 0;
  const hop = Math.max(1, Math.round(sampleRate / perSecond));
  const cols = Math.ceil(len / hop);
  const peak = new Float32Array(cols),
    low = new Float32Array(cols),
    mid = new Float32Array(cols),
    high = new Float32Array(cols);
  const aL = Math.exp((-2 * Math.PI * 220) / sampleRate),
    aH = Math.exp((-2 * Math.PI * 2500) / sampleRate);
  let l = 0,
    h = 0;
  for (let c = 0; c < cols; c++) {
    let p = 0,
      el = 0,
      em = 0,
      eh = 0;
    const end = Math.min(len, (c + 1) * hop);
    for (let i = c * hop; i < end; i++) {
      let x = 0;
      for (const ch of channels) x += ch[i] ?? 0;
      x /= channels.length || 1;
      l = aL * l + (1 - aL) * x;
      h = aH * h + (1 - aH) * x;
      const hi = x - h,
        md = h - l;
      p = Math.max(p, Math.abs(x));
      el += l * l;
      em += md * md;
      eh += hi * hi;
    }
    const n = Math.max(1, end - c * hop);
    peak[c] = p;
    low[c] = Math.sqrt(el / n);
    mid[c] = Math.sqrt(em / n);
    high[c] = Math.sqrt(eh / n);
  }
  return { peak, low, mid, high, perSecond: sampleRate / hop };
}

/** Time readout m:ss.t */
export function clock(sec: number) {
  const s = Math.max(0, sec);
  const m = Math.floor(s / 60);
  return `${m}:${String(Math.floor(s % 60)).padStart(2, "0")}.${Math.floor((s * 10) % 10)}`;
}

/** WAV file (16-bit stereo) straight from interleaved PCM chunks, so long mixes never need a float copy. */
export function wavFromPcm16(chunks: Int16Array[], sampleRate: number): Blob {
  const samples = chunks.reduce((n, c) => n + c.length, 0);
  const header = new ArrayBuffer(44);
  const v = new DataView(header);
  const w = (o: number, s: string) => {
    for (let i = 0; i < s.length; i++) v.setUint8(o + i, s.charCodeAt(i));
  };
  w(0, "RIFF");
  v.setUint32(4, 36 + samples * 2, true);
  w(8, "WAVE");
  w(12, "fmt ");
  v.setUint32(16, 16, true);
  v.setUint16(20, 1, true);
  v.setUint16(22, 2, true);
  v.setUint32(24, sampleRate, true);
  v.setUint32(28, sampleRate * 4, true);
  v.setUint16(32, 4, true);
  v.setUint16(34, 16, true);
  w(36, "data");
  v.setUint32(40, samples * 2, true);
  return new Blob([header, ...(chunks as unknown as BlobPart[])], { type: "audio/wav" });
}

/** Headphone MIXING knob 0 (only the cued decks) … 1 (only the master), equal power: [cue gain, master gain]. */
export function phonesBlend(mix: number): [number, number] {
  const t = Math.max(0, Math.min(1, mix));
  return [Math.cos((t * Math.PI) / 2), Math.sin((t * Math.PI) / 2)];
}

/** 45 RPM plays a 33⅓ record 1.35× faster (tempo and key together, like the real thing). */
export function speedFactor(rpm: 33 | 45) {
  return rpm === 45 ? 45 / (100 / 3) : 1;
}

/**
 * Where the headphone (cue) signal goes:
 *  - "off": nothing; the speakers play the master only
 *  - "split": one output carries both — left ear = headphone mix, right ear = master (MONO SPLIT)
 *  - "device": the headphone mix plays on a second output device, the master stays on the speakers
 * A device can only be used when the browser can choose outputs and one is picked.
 */
export type PhonesMode = "off" | "split" | "device";
export function phonesRoute(
  mode: PhonesMode,
  canPickDevice: boolean,
  deviceId: string | null,
): PhonesMode {
  if (mode === "device") return canPickDevice && deviceId ? "device" : "off";
  return mode;
}

/** 33⅓ RPM: the record turns 200° for every second of the track. */
export const DEG_PER_SEC = (100 / 3 / 60) * 360;

/** Smallest signed difference between two angles in degrees (−180…180), so crossing ±180° doesn't jump. */
export function angleDelta(from: number, to: number) {
  let d = (to - from) % 360;
  if (d > 180) d -= 360;
  if (d < -180) d += 360;
  return d;
}

/**
 * Grabbing the record or the waveform: slow moves follow your finger exactly, fast flicks travel
 * further (up to 12×) so you can wind a whole track back to the start in a couple of spins/swipes.
 * `speed` is how fast you moved in seconds-of-track per second; `natural` is the speed (also in
 * seconds-of-track per second) above which the boost starts.
 */
export function scrubBoost(speed: number, natural = 3) {
  return Math.min(12, Math.max(1, Math.abs(speed) / natural));
}

/**
 * Scratch speed from how fast the hand moves the record (track-seconds per second, any sign):
 * 0 below a slow crawl (the record is being held still, so it's silent), capped at 4× so
 * quick flicks sound like a fast wind rather than a squeal.
 */
export function scratchRate(velocity: number) {
  const s = Math.abs(velocity);
  if (!Number.isFinite(s) || s < 0.03) return 0;
  return Math.min(4, s);
}

/**
 * Tone arm placed by hand: the arm swings from the pivot, so its angle says where the needle sits.
 * `pointerDeg` is the screen angle from the pivot to the finger (atan2, y down); the arm hangs
 * straight down at rotation 0, `start` is its angle over the record's outer edge (track start) and
 * `sweep` how far it swings to the label (track end). Returns 0…1 through the track.
 */
export function armFraction(pointerDeg: number, start: number, sweep: number) {
  const rot = angleDelta(0, pointerDeg - 90);
  if (!(sweep > 0)) return 0;
  return Math.max(0, Math.min(1, (rot - start) / sweep));
}

/** New play position after a grab move of `delta` seconds (already in track time), kept inside the track. */
export function scrubTo(pos: number, delta: number, dt: number, duration: number) {
  const boost = dt > 0 ? scrubBoost(delta / dt) : 1;
  return Math.max(0, Math.min(Math.max(0, duration - 0.01), pos + delta * boost));
}
