import { separateSpectral, type SpectralStem } from "./stem-separation";

type Job = { left: Float32Array; right: Float32Array; sampleRate: number; ids: SpectralStem[] };
const scope = self as unknown as {
  onmessage: ((e: MessageEvent<Job>) => void) | null;
  postMessage: (message: unknown, transfer?: Transferable[]) => void;
};

scope.onmessage = (e) => {
  try {
    const { left, right, sampleRate, ids } = e.data;
    const out = separateSpectral(left, right, sampleRate, ids, (p) =>
      scope.postMessage({ type: "progress", p }),
    );
    const transfer: Transferable[] = [];
    for (const s of Object.values(out)) if (s) transfer.push(s.left.buffer, s.right.buffer);
    scope.postMessage({ type: "done", out }, transfer);
  } catch (err) {
    scope.postMessage({
      type: "error",
      message: err instanceof Error ? err.message : "Separation failed",
    });
  }
};
