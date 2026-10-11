/**
 * Stem separation on the device using spectral masking (see stem-separation.ts) — not AI.
 * Expect some bleed; stereo mixes with centre-panned vocals separate best.
 */
import { separateSpectral, type SpectralStem, type StereoPcm } from "./stem-separation";

export type StemId = SpectralStem;

export const STEMS: { id: StemId; label: string; hint: string }[] = [
  { id: "vocals", label: "Vocals", hint: "Sustained, centre-panned sound in the voice range. Needs a stereo file." },
  { id: "drums", label: "Drums", hint: "Hits and transients — kick, snare, hats, percussion." },
  { id: "bass", label: "Bass", hint: "Sustained low notes below about 200 Hz (kick goes to Drums)." },
  { id: "music", label: "Music", hint: "Everything else — chords, keys, guitars, synths, pads." },
  { id: "instrumental", label: "Instrumental (no vocals)", hint: "The whole song with the Vocals part taken out." },
];

export const MAX_STEM_SECONDS = 6 * 60;

export function isStereo(buf: AudioBuffer) {
  if (buf.numberOfChannels < 2) return false;
  const l = buf.getChannelData(0);
  const r = buf.getChannelData(1);
  let diff = 0;
  let sum = 0;
  for (let i = 0; i < l.length; i += 64) { diff += Math.abs(l[i]! - r[i]!); sum += Math.abs(l[i]!); }
  return diff > sum * 0.02;
}

/** Runs the separation in a background worker so the studio keeps playing. */
export function separateStems(buf: AudioBuffer, ids: StemId[], onProgress?: (fraction: number) => void): Promise<Partial<Record<StemId, StereoPcm>>> {
  const left = buf.getChannelData(0).slice();
  const right = (buf.numberOfChannels > 1 ? buf.getChannelData(1) : buf.getChannelData(0)).slice();
  const sampleRate = buf.sampleRate;
  let worker: Worker | null = null;
  try {
    worker = new Worker(new URL("./stem-separation.worker.ts", import.meta.url), { type: "module" });
  } catch {
    worker = null;
  }
  if (!worker) return new Promise((resolve) => setTimeout(() => resolve(separateSpectral(left, right, sampleRate, ids, onProgress)), 20));
  const w = worker;
  return new Promise((resolve, reject) => {
    w.onmessage = (e: MessageEvent<{ type: string; p?: number; out?: Partial<Record<StemId, StereoPcm>>; message?: string }>) => {
      if (e.data.type === "progress") onProgress?.(e.data.p ?? 0);
      else if (e.data.type === "done") { w.terminate(); resolve(e.data.out ?? {}); }
      else { w.terminate(); reject(new Error(e.data.message ?? "Separation failed")); }
    };
    w.onerror = (e) => { w.terminate(); reject(new Error(e.message || "Separation failed")); };
    w.postMessage({ left, right, sampleRate, ids }, [left.buffer, right.buffer]);
  });
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
