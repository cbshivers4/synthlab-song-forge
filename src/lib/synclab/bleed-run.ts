/** Runs bleed cleanup in a background worker so the studio keeps playing. */
import { cleanBleedInPlace, type BleedStrength } from "./bleed-cleanup";
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
      setTimeout(() => resolve(cleanBleedInPlace(stems, strength, rivals, onProgress)), 20),
    );
  const w = worker;
  return new Promise((resolve, reject) => {
    w.onmessage = (
      e: MessageEvent<{ type: string; p?: number; out?: StereoPcm[]; message?: string }>,
    ) => {
      if (e.data.type === "progress") onProgress?.(e.data.p ?? 0);
      else if (e.data.type === "done" && e.data.out) {
        w.terminate();
        resolve(e.data.out);
      } else {
        w.terminate();
        reject(new Error(e.data.message ?? "Bleed cleanup failed"));
      }
    };
    w.onerror = (e) => {
      w.terminate();
      reject(new Error(e.message || "Bleed cleanup failed"));
    };
    // Handed over, not copied: a long song's parts would otherwise exist twice and can run a phone
    // out of memory. The given arrays are unusable afterwards; on failure the caller decodes again.
    const transfer = new Set<ArrayBufferLike>();
    for (const s of stems) transfer.add(s.left.buffer).add(s.right.buffer);
    w.postMessage(
      { stems, rivals: rivals.map((s) => ({ left: s.left, right: s.right })), strength },
      [...transfer] as Transferable[],
    );
  });
}
