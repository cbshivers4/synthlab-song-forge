/**
 * Voice conversion by DSP effects (pitch shift, tone shaping, robot, radio).
 * Not AI voice cloning — it changes how your own voice sounds.
 */
import { wsolaStretch } from "./stretch";

export type VoicePreset = "deep" | "higher" | "chipmunk" | "monster" | "robot" | "radio" | "custom";

export const VOICE_PRESETS: { id: VoicePreset; label: string; hint: string; semis: number }[] = [
  { id: "deep", label: "Deeper", hint: "Down 5 semitones with extra low warmth.", semis: -5 },
  { id: "higher", label: "Higher", hint: "Up 4 semitones, slightly brighter.", semis: 4 },
  { id: "chipmunk", label: "Chipmunk", hint: "Up an octave — cartoon voice.", semis: 12 },
  { id: "monster", label: "Monster", hint: "Down 9 semitones with grit.", semis: -9 },
  { id: "robot", label: "Robot", hint: "Metallic ring-mod and comb resonance.", semis: 0 },
  { id: "radio", label: "Radio / Phone", hint: "Thin, band-limited and slightly crunchy.", semis: 0 },
  { id: "custom", label: "Custom pitch", hint: "Pick your own semitone shift.", semis: 0 },
];

export function pitchShift(x: Float32Array, semis: number): Float32Array {
  if (!semis) return x.slice();
  const k = Math.pow(2, semis / 12);
  const long = wsolaStretch(x, 1 / k); // same pitch, k times longer
  const out = new Float32Array(x.length);
  for (let i = 0; i < out.length; i++) {
    const p = i * k;
    const a = Math.floor(p);
    const f = p - a;
    out[i] = (long[a] ?? 0) * (1 - f) + (long[a + 1] ?? 0) * f;
  }
  return out;
}

async function shape(x: Float32Array, sr: number, preset: VoicePreset) {
  const ctx = new OfflineAudioContext(1, x.length, sr);
  const b = ctx.createBuffer(1, x.length, sr);
  b.copyToChannel(x as Float32Array<ArrayBuffer>, 0);
  const src = ctx.createBufferSource();
  src.buffer = b;
  const chain: AudioNode[] = [];
  const bq = (type: BiquadFilterType, freq: number, gain = 0, Q = 0.7) => {
    const f = ctx.createBiquadFilter();
    f.type = type; f.frequency.value = freq; f.gain.value = gain; f.Q.value = Q;
    chain.push(f);
  };
  const drive = (amt: number) => {
    const s = ctx.createWaveShaper();
    const c = new Float32Array(1024);
    for (let i = 0; i < c.length; i++) { const v = (i / 511.5) - 1; c[i] = Math.tanh(v * amt) / Math.tanh(amt); }
    s.curve = c;
    chain.push(s);
  };
  if (preset === "deep") bq("lowshelf", 220, 4);
  if (preset === "higher") bq("highshelf", 3000, 3);
  if (preset === "monster") { bq("lowshelf", 150, 6); drive(4); }
  if (preset === "radio") { bq("highpass", 400, 0, 1); bq("lowpass", 3200, 0, 1); drive(3); }
  let node: AudioNode = src;
  for (const n of chain) { node.connect(n); node = n; }
  node.connect(ctx.destination);
  src.start();
  return (await ctx.startRendering()).getChannelData(0);
}

function robot(x: Float32Array, sr: number) {
  const out = new Float32Array(x.length);
  const delay = Math.round(sr / 110); // comb at 110 Hz
  for (let i = 0; i < x.length; i++) {
    const ring = x[i]! * Math.sin((2 * Math.PI * 50 * i) / sr);
    out[i] = 0.6 * ring + 0.4 * x[i]! + 0.5 * (out[i - delay] ?? 0);
  }
  let peak = 0;
  for (const v of out) peak = Math.max(peak, Math.abs(v));
  if (peak > 0.98) for (let i = 0; i < out.length; i++) out[i]! /= peak / 0.98;
  return out;
}

export async function convertVoice(buf: AudioBuffer, preset: VoicePreset, customSemis = 0) {
  const sr = buf.sampleRate;
  const L = buf.getChannelData(0);
  const R = buf.numberOfChannels > 1 ? buf.getChannelData(1) : L;
  const mono = new Float32Array(L.length);
  for (let i = 0; i < mono.length; i++) mono[i] = (L[i]! + R[i]!) / 2;
  const semis = preset === "custom" ? customSemis : VOICE_PRESETS.find((p) => p.id === preset)!.semis;
  let y = pitchShift(mono, semis);
  y = preset === "robot" ? robot(y, sr) : await shape(y, sr, preset);
  return y;
}
