import { cleanBleedInPlace, type BleedStrength } from "./bleed-cleanup";
import type { StereoPcm } from "./stem-separation";

type Job = { stems: StereoPcm[]; rivals: StereoPcm[]; strength: BleedStrength };
const scope = self as unknown as {
  onmessage: ((e: MessageEvent<Job>) => void) | null;
  postMessage: (message: unknown, transfer?: Transferable[]) => void;
};

scope.onmessage = (e) => {
  try {
    const { stems, rivals, strength } = e.data;
    // The parts arrive transferred (not copied) and are cleaned in place, so only one copy exists.
    const out = cleanBleedInPlace(stems, strength, rivals, (p) =>
      scope.postMessage({ type: "progress", p }),
    );
    const transfer: Transferable[] = [];
    for (const s of out) transfer.push(s.left.buffer, s.right.buffer);
    scope.postMessage({ type: "done", out }, transfer);
  } catch (err) {
    scope.postMessage({
      type: "error",
      message: err instanceof Error ? err.message : "Bleed cleanup failed",
    });
  }
};
