import type { ModuleType } from "./modular";

export const MODULAR_SCOPE_TYPES: readonly ModuleType[] = [
  "vco",
  "sub",
  "vcf",
  "fold",
  "drive",
  "delay",
  "comb",
  "output",
];
const taps = new Map<string, Set<AnalyserNode>>();
export const modularScopeId = (trackId: string, moduleId: string) => `${trackId}:${moduleId}`;

/** Branch-only analyser: never connects back into the audible rack. */
export function attachModularScope(
  ctx: BaseAudioContext,
  id: string,
  source: AudioNode,
): () => void {
  const analyser = ctx.createAnalyser();
  analyser.fftSize = 512;
  source.connect(analyser);
  const voices = taps.get(id) ?? new Set<AnalyserNode>();
  voices.add(analyser);
  taps.set(id, voices);
  return () => {
    try {
      source.disconnect(analyser);
    } catch {
      /* source already ended */
    }
    analyser.disconnect();
    voices.delete(analyser);
    if (!voices.size) taps.delete(id);
  };
}

export function readModularScope(id: string): Float32Array | null {
  const voices = taps.get(id);
  if (!voices?.size) return null;
  const sum = new Float32Array(512),
    data = new Float32Array(512);
  for (const analyser of voices) {
    analyser.getFloatTimeDomainData(data);
    for (let i = 0; i < sum.length; i++) sum[i] = (sum[i] ?? 0) + (data[i] ?? 0);
  }
  return sum;
}
