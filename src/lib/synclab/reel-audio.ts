import type { Capture } from "./bounce";

/** Tape speed is repitch, not pitch-preserving time stretch. */
export const tapeDuration = (capture: Capture, speed: number) => capture.left.length / capture.sampleRate / speed;
export const clampTapePosition = (position: number, duration: number) => Math.max(0, Math.min(duration, Number.isFinite(position) ? position : 0));
export function joinTapeChunks(chunks: Float32Array[]) {
  const result = new Float32Array(chunks.reduce((length, chunk) => length + chunk.length, 0));
  let offset = 0;
  for (const chunk of chunks) { result.set(chunk, offset); offset += chunk.length; }
  return result;
}
export function tapeCurve(drive: number): Float32Array<ArrayBuffer> {
  const curve = new Float32Array(2048);
  const amount = Math.max(0, drive) * 5;
  for (let i = 0; i < curve.length; i++) {
    const x = i * 2 / (curve.length - 1) - 1;
    curve[i] = amount < 0.001 ? x : Math.tanh(x * (1 + amount)) / Math.tanh(1 + amount);
  }
  return curve;
}