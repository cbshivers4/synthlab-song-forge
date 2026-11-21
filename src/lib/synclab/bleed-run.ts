/** Runs bleed cleanup in a background worker so the studio keeps playing. */
import { cleanBleed, type BleedStrength } from "./bleed-cleanup";
import type { StereoPcm } from "./stem-separation";

export function cleanBleedInBackground(
  stems: StereoPcm[],
  strength: BleedStrength,
  rivals: StereoPcm[] = [],
  onProgress?: (fraction: number) => void,
): Promise<StereoPcm[]> {
  if (strength === "off") return Promise.resolve(stems);
  let worker: Worker | null = null;
  try {
    worker = new Worker(new URL("./bleed-cleanup.worker.ts", import.meta.url), { type: "module" });
  } catch {
    worker = null;
  }
  if (!worker)
    return new Promise((resolve) =>
      setTimeout(() => resolve(cleanBleed(stems, strength, rivals, onProgress)), 20),
    );
  const w = worker;
  return new Promise((resolve, reject) => {
    w.onmessage = (
      e: MessageEvent<{ type: string; p?: number; out?: StereoPcm[]; message?: string }>,
    ) => {
      if (e.data.type === "progress") onProgress?.(e.data.p ?? 0);
      else if (e.data.type === "done") {
        w.terminate();
        resolve(e.data.out ?? stems);
      } else {
        w.terminate();
        reject(new Error(e.data.message ?? "Bleed cleanup failed"));
      }
    };
    w.onerror = (e) => {
      w.terminate();
      reject(new Error(e.message || "Bleed cleanup failed"));
    };
    // Copies go to the worker so the originals stay playable if cleanup fails.
    w.postMessage({
      stems: stems.map((s) => ({ left: s.left.slice(), right: s.right.slice() })),
      rivals: rivals.map((s) => ({ left: s.left.slice(), right: s.right.slice() })),
      strength,
    });
  });
}
