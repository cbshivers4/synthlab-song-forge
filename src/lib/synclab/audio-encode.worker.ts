/// <reference lib="webworker" />
/** Encodes a tape/cassette/CD recording to a file off the main thread, so long mixes never freeze the page. */
import { Mp3Encoder } from "@breezystack/lamejs";
import { encodeAiff, encodeFlac, encodeWavDepth } from "./export-formats";
import type { EncodeFormat } from "./audio-encode";

interface Job {
  left: Float32Array;
  right: Float32Array;
  sampleRate: number;
  format: EncodeFormat;
  kbps: number;
}

const toPcm16 = (f: Float32Array) => {
  const out = new Int16Array(f.length);
  for (let i = 0; i < f.length; i++) {
    const s = Math.max(-1, Math.min(1, f[i] ?? 0));
    out[i] = s < 0 ? s * 0x8000 : s * 0x7fff;
  }
  return out;
};

self.onmessage = (e: MessageEvent<Job>) => {
  try {
    const { left, right, sampleRate, format, kbps } = e.data;
    const cap = { left, right, sampleRate };
    let blob: Blob;
    if (format === "mp3") {
      const enc = new Mp3Encoder(2, sampleRate, kbps);
      const l = toPcm16(left),
        r = toPcm16(right);
      const block = 1152;
      const parts: Uint8Array[] = [];
      let last = 0;
      for (let i = 0; i < l.length; i += block) {
        const out = enc.encodeBuffer(l.subarray(i, i + block), r.subarray(i, i + block));
        if (out.length) parts.push(new Uint8Array(out));
        const p = i / l.length;
        if (p - last > 0.02) {
          last = p;
          self.postMessage({ type: "progress", p });
        }
      }
      const end = enc.flush();
      if (end.length) parts.push(new Uint8Array(end));
      blob = new Blob(parts as BlobPart[], { type: "audio/mpeg" });
    } else if (format === "flac") blob = encodeFlac(cap, 24);
    else if (format === "aiff") blob = encodeAiff(cap, 24);
    else blob = encodeWavDepth(cap, format === "wav16" ? 16 : format === "wav32" ? 32 : 24);
    self.postMessage({ type: "done", blob });
  } catch (error) {
    self.postMessage({
      type: "error",
      message: error instanceof Error ? error.message : "Could not encode the file.",
    });
  }
};
