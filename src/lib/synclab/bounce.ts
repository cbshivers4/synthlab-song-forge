import { Mp3Encoder } from "@breezystack/lamejs";
import { retainMediaInBackground } from "./media-library";

export interface Capture {
  left: Float32Array;
  right: Float32Array;
  sampleRate: number;
}

const toPcm16 = (f: Float32Array) => {
  const out = new Int16Array(f.length);
  for (let i = 0; i < f.length; i++) {
    const s = Math.max(-1, Math.min(1, f[i] ?? 0));
    out[i] = s < 0 ? s * 0x8000 : s * 0x7fff;
  }
  return out;
};

/** Peak level of the capture, 0..1. */
export function peakOf(cap: Capture) {
  let p = 0;
  for (let i = 0; i < cap.left.length; i++) {
    p = Math.max(p, Math.abs(cap.left[i] ?? 0), Math.abs(cap.right[i] ?? 0));
  }
  return p;
}

/** Scale the whole bounce so the loudest peak sits just under 0 dBFS. */
export function normalize(cap: Capture, target = 0.98): Capture {
  const peak = peakOf(cap);
  if (peak <= 0 || peak >= target) return cap;
  const g = target / peak;
  const l = new Float32Array(cap.left.length);
  const r = new Float32Array(cap.right.length);
  for (let i = 0; i < l.length; i++) {
    l[i] = (cap.left[i] ?? 0) * g;
    r[i] = (cap.right[i] ?? 0) * g;
  }
  return { left: l, right: r, sampleRate: cap.sampleRate };
}

/** 16-bit WAV; mono averages left/right without changing the original capture. */
export function encodeWav(cap: Capture, channels: 1 | 2 = 2): Blob {
  const frames = Math.min(cap.left.length, cap.right.length);
  const mono = channels === 1 ? Float32Array.from({ length: frames }, (_, i) => ((cap.left[i] ?? 0) + (cap.right[i] ?? 0)) / 2) : cap.left;
  const l = toPcm16(mono);
  const r = toPcm16(cap.right);
  const blockAlign = channels * 2;
  const dataBytes = frames * blockAlign;
  const buf = new ArrayBuffer(44 + dataBytes);
  const view = new DataView(buf);
  const str = (off: number, s: string) => {
    for (let i = 0; i < s.length; i++) view.setUint8(off + i, s.charCodeAt(i));
  };
  str(0, "RIFF");
  view.setUint32(4, 36 + dataBytes, true);
  str(8, "WAVE");
  str(12, "fmt ");
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, channels, true);
  view.setUint32(24, cap.sampleRate, true);
  view.setUint32(28, cap.sampleRate * blockAlign, true);
  view.setUint16(32, blockAlign, true);
  view.setUint16(34, 16, true);
  str(36, "data");
  view.setUint32(40, dataBytes, true);
  let o = 44;
  for (let i = 0; i < frames; i++) {
    view.setInt16(o, l[i] ?? 0, true);
    if (channels === 2) view.setInt16(o + 2, r[i] ?? 0, true);
    o += blockAlign;
  }
  return new Blob([buf], { type: "audio/wav" });
}

/** Stereo MP3 at the given bitrate (kbps). */
export function encodeMp3(cap: Capture, kbps = 320): Blob {
  const enc = new Mp3Encoder(2, cap.sampleRate, kbps);
  const l = toPcm16(cap.left);
  const r = toPcm16(cap.right);
  const block = 1152;
  const parts: Uint8Array[] = [];
  for (let i = 0; i < l.length; i += block) {
    const chunk = enc.encodeBuffer(l.subarray(i, i + block), r.subarray(i, i + block));
    if (chunk.length > 0) parts.push(new Uint8Array(chunk));
  }
  const end = enc.flush();
  if (end.length > 0) parts.push(new Uint8Array(end));
  return new Blob(parts as BlobPart[], { type: "audio/mpeg" });
}

export function downloadBlob(blob: Blob, filename: string) {
  retainMediaInBackground(blob, filename, "Exports");
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 20_000);
}

/** True when the browser can share an audio file (mostly phones/tablets). */
export function canShareFile(file: File) {
  const nav = navigator as Navigator & { canShare?: (d: ShareData) => boolean };
  return typeof nav.share === "function" && typeof nav.canShare === "function" && nav.canShare({ files: [file] });
}

export async function shareFile(file: File, title: string) {
  await navigator.share({ files: [file], title, text: `${title} — made in SYNCLAB` });
}
