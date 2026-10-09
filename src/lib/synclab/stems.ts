/**
 * Simple stem separation using stereo mid/side maths and filters — not AI.
 * Results are approximations; centre-panned vocals and wide mixes work best.
 */
export type StemId = "vocal" | "instrumental" | "bass" | "mids" | "highs";

export const STEMS: { id: StemId; label: string; hint: string }[] = [
  { id: "vocal", label: "Vocal focus", hint: "Centre of the mix, 150 Hz–7 kHz. Keeps other centred parts too." },
  { id: "instrumental", label: "Vocal remove", hint: "Cancels the centre (karaoke style), keeps the bass. Needs a stereo file." },
  { id: "bass", label: "Bass", hint: "Everything below about 160 Hz — kick and bass." },
  { id: "mids", label: "Mids", hint: "160 Hz–5 kHz — chords, guitars, keys, vocals." },
  { id: "highs", label: "Highs", hint: "Above 5 kHz — hi-hats, cymbals, air." },
];

type F = { type: BiquadFilterType; freq: number }[];

async function filtered(left: Float32Array, right: Float32Array, sr: number, filters: F) {
  const ctx = new OfflineAudioContext(2, left.length, sr);
  const b = ctx.createBuffer(2, left.length, sr);
  b.copyToChannel(left as Float32Array<ArrayBuffer>, 0);
  b.copyToChannel(right as Float32Array<ArrayBuffer>, 1);
  const src = ctx.createBufferSource();
  src.buffer = b;
  let node: AudioNode = src;
  for (const f of filters) {
    // two cascaded biquads give a steeper 24 dB/oct slope
    for (let k = 0; k < 2; k++) {
      const q = ctx.createBiquadFilter();
      q.type = f.type;
      q.frequency.value = f.freq;
      node.connect(q);
      node = q;
    }
  }
  node.connect(ctx.destination);
  src.start();
  const out = await ctx.startRendering();
  return { left: out.getChannelData(0), right: out.getChannelData(1) };
}

export function isStereo(buf: AudioBuffer) {
  if (buf.numberOfChannels < 2) return false;
  const l = buf.getChannelData(0);
  const r = buf.getChannelData(1);
  let diff = 0;
  let sum = 0;
  for (let i = 0; i < l.length; i += 64) { diff += Math.abs(l[i]! - r[i]!); sum += Math.abs(l[i]!); }
  return diff > sum * 0.02;
}

export async function separateStem(buf: AudioBuffer, id: StemId) {
  const sr = buf.sampleRate;
  const L = buf.getChannelData(0);
  const R = buf.numberOfChannels > 1 ? buf.getChannelData(1) : L;
  const n = L.length;
  if (id === "bass") return filtered(L, R, sr, [{ type: "lowpass", freq: 160 }]);
  if (id === "mids") return filtered(L, R, sr, [{ type: "highpass", freq: 160 }, { type: "lowpass", freq: 5000 }]);
  if (id === "highs") return filtered(L, R, sr, [{ type: "highpass", freq: 5000 }]);
  const mid = new Float32Array(n);
  const side = new Float32Array(n);
  for (let i = 0; i < n; i++) { mid[i] = (L[i]! + R[i]!) / 2; side[i] = (L[i]! - R[i]!) / 2; }
  if (id === "vocal") {
    const v = await filtered(mid, mid, sr, [{ type: "highpass", freq: 150 }, { type: "lowpass", freq: 7000 }]);
    return v;
  }
  // instrumental: side signal (centre cancelled) + mono bass from the mid
  const low = await filtered(mid, mid, sr, [{ type: "lowpass", freq: 140 }]);
  const left = new Float32Array(n);
  const right = new Float32Array(n);
  for (let i = 0; i < n; i++) { left[i] = side[i]! + low.left[i]!; right[i] = -side[i]! + low.left[i]!; }
  return { left, right };
}

export function peaksOf(data: Float32Array, points = 160) {
  const size = Math.max(1, Math.floor(data.length / points));
  const out: number[] = [];
  for (let b = 0; b < points; b++) {
    let p = 0;
    for (let i = b * size; i < Math.min(data.length, (b + 1) * size); i++) p = Math.max(p, Math.abs(data[i]!));
    out.push(p);
  }
  return out;
}
