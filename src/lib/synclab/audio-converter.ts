import { encodeMp3, encodeWav, type Capture } from "./bounce";
import { browserMime, encodeAiff, encodeFlac, resample } from "./export-formats";

export type ConversionFormat = "wav" | "mp3" | "aiff" | "flac" | "m4a" | "ogg" | "opus";
export const CONVERSION_FORMATS: { id: ConversionFormat; label: string }[] = [
  { id: "wav", label: "WAV" }, { id: "mp3", label: "MP3" }, { id: "m4a", label: "M4A / AAC" },
  { id: "aiff", label: "AIFF" }, { id: "flac", label: "FLAC" }, { id: "ogg", label: "Ogg" }, { id: "opus", label: "Opus" },
];

export function conversionSupported(format: ConversionFormat): boolean {
  return !["m4a", "ogg", "opus"].includes(format) || Boolean(browserMime(format as "m4a" | "ogg" | "opus"));
}

export function conversionFilename(name: string, format: ConversionFormat, mime: string): string {
  const base = name.replace(/\.[^.]+$/, "").replace(/[^\w\-. ]+/g, "").trim() || "SYNCLAB audio";
  const ext = format === "opus" && mime.includes("webm") ? "webm" : format;
  return `${base}-converted.${ext}`;
}

/** Isolated, silent device encoder; cancellation always releases its context. */
async function encodeDevice(cap: Capture, mime: string, kbps: number, signal: AbortSignal): Promise<Blob> {
  const ctx = new AudioContext({ sampleRate: cap.sampleRate });
  let rec: MediaRecorder | undefined;
  let src: AudioBufferSourceNode | undefined;
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    if (signal.aborted) throw new DOMException("Cancelled", "AbortError");
    await ctx.resume();
    const buffer = ctx.createBuffer(2, cap.left.length, cap.sampleRate);
    buffer.copyToChannel(cap.left as Float32Array<ArrayBuffer>, 0);
    buffer.copyToChannel(cap.right as Float32Array<ArrayBuffer>, 1);
    src = ctx.createBufferSource(); src.buffer = buffer;
    const dest = ctx.createMediaStreamDestination(); src.connect(dest);
    rec = new MediaRecorder(dest.stream, { mimeType: mime, audioBitsPerSecond: kbps * 1000 });
    const recorder = rec;
    const chunks: Blob[] = [];
    await new Promise<void>((resolve, reject) => {
      const abort = () => { if (recorder.state !== "inactive") recorder.stop(); reject(new DOMException("Cancelled", "AbortError")); };
      signal.addEventListener("abort", abort, { once: true });
      recorder.ondataavailable = e => { if (e.data.size) chunks.push(e.data); };
      recorder.onerror = () => { signal.removeEventListener("abort", abort); reject(new Error("Your device could not encode this format.")); };
      recorder.onstop = () => { signal.removeEventListener("abort", abort); resolve(); };
      if (!src) { reject(new Error("Audio source unavailable")); return; }
      src.onended = () => { timer = setTimeout(() => { if (recorder.state !== "inactive") recorder.stop(); }, 100); };
      recorder.start(); src.start();
      if (signal.aborted) abort();
    });
    if (signal.aborted) throw new DOMException("Cancelled", "AbortError");
    return new Blob(chunks, { type: recorder.mimeType.split(";")[0] ?? mime });
  } finally {
    if (timer) clearTimeout(timer);
    try { src?.stop(); } catch { /* ended */ }
    if (rec && rec.state !== "inactive") rec.stop();
    src?.disconnect();
    await ctx.close();
  }
}

export async function convertAudio(cap: Capture, format: ConversionFormat, rate: number, kbps: number, mono: boolean, signal: AbortSignal): Promise<Blob> {
  if (!conversionSupported(format)) throw new Error("This output format is unavailable on your device.");
  if (!cap.left.length) throw new Error("The file contains no audio.");
  const audio = await resample(cap, rate);
  if (signal.aborted) throw new DOMException("Cancelled", "AbortError");
  switch (format) {
    case "wav": return encodeWav(audio, mono ? 1 : 2);
    case "mp3": return encodeMp3(audio, kbps);
    case "aiff": return encodeAiff(audio, 24);
    case "flac": return encodeFlac(audio, 24);
    default: {
      const mime = browserMime(format);
      if (!mime) throw new Error("This output format is unavailable on your device.");
      return encodeDevice(audio, mime, kbps, signal);
    }
  }
}