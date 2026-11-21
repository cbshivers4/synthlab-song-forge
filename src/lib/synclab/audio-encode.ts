/** Runs file encoding (MP3/WAV/FLAC/AIFF) in a background worker so long recordings never freeze the page. */
import type { Capture } from "./bounce";

export type EncodeFormat = "wav16" | "wav24" | "wav32" | "mp3" | "flac" | "aiff";

export function encodeInBackground(
  capture: Capture,
  format: EncodeFormat,
  kbps = 320,
  onProgress?: (fraction: number) => void,
): Promise<Blob> {
  let worker: Worker;
  try {
    worker = new Worker(new URL("./audio-encode.worker.ts", import.meta.url), { type: "module" });
  } catch {
    return Promise.reject(new Error("This browser can't encode files in the background."));
  }
  return new Promise((resolve, reject) => {
    worker.onmessage = (
      e: MessageEvent<{ type: string; p?: number; blob?: Blob; message?: string }>,
    ) => {
      if (e.data.type === "progress") onProgress?.(e.data.p ?? 0);
      else if (e.data.type === "done" && e.data.blob) {
        worker.terminate();
        onProgress?.(1);
        resolve(e.data.blob);
      } else {
        worker.terminate();
        reject(new Error(e.data.message ?? "Could not encode the file."));
      }
    };
    worker.onerror = (e) => {
      worker.terminate();
      reject(new Error(e.message || "Could not encode the file."));
    };
    // Copies, so the tape in the machine stays playable.
    worker.postMessage({
      left: capture.left,
      right: capture.right.length ? capture.right : capture.left,
      sampleRate: capture.sampleRate,
      format,
      kbps,
    });
  });
}
