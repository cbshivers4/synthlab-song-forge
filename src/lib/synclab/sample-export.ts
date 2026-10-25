import { getEngine } from "./audio-engine";
import { canShareFile, downloadBlob, encodeWav, shareFile, type Capture } from "./bounce";

/** Copies a time range of a decoded buffer into a stereo capture (mono is duplicated). */
export function captureFromBuffer(buf: AudioBuffer, startSec = 0, endSec = buf.duration, reverse = false): Capture | null {
  const a = Math.max(0, Math.floor(Math.min(startSec, endSec) * buf.sampleRate));
  const b = Math.min(buf.length, Math.ceil(Math.max(startSec, endSec) * buf.sampleRate));
  if (b - a < 2) return null;
  const left = buf.getChannelData(0).slice(a, b);
  const right = (buf.numberOfChannels > 1 ? buf.getChannelData(1) : buf.getChannelData(0)).slice(a, b);
  if (reverse) { left.reverse(); right.reverse(); }
  return { left, right, sampleRate: buf.sampleRate };
}

/** Decodes a sample URL and trims it to its start/end fractions (0..1). */
export async function captureFromUrl(url: string, start = 0, end = 1, reverse = false): Promise<Capture | null> {
  const ctx = getEngine().init();
  const res = await fetch(url);
  if (!res.ok) throw new Error("The sample could not be read.");
  const buf = await ctx.decodeAudioData(await res.arrayBuffer());
  return captureFromBuffer(buf, start * buf.duration, end * buf.duration, reverse);
}

export const safeFileName = (name: string) => `${(name.replace(/\.[^.]+$/, "").replace(/[^\w\- ]+/g, "").trim() || "SYNCLAB sample").slice(0, 60)}.wav`;

/** Phones/tablets open the share sheet (Save to Files / Photos etc.); computers download a WAV. */
export async function saveCaptureToDevice(cap: Capture, name: string) {
  const blob = encodeWav(cap, 2);
  const filename = safeFileName(name);
  const file = new File([blob], filename, { type: "audio/wav" });
  if (canShareFile(file)) {
    try { await shareFile(file, filename); return "shared" as const; }
    catch (e) { if ((e as Error)?.name === "AbortError") return "cancelled" as const; }
  }
  downloadBlob(blob, filename);
  return "downloaded" as const;
}
