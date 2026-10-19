import type { Capture } from "./bounce";

/** Tape speed is repitch, not pitch-preserving time stretch. */
export const tapeDuration = (capture: Capture, speed: number) => capture.left.length / capture.sampleRate / speed;
export const clampTapePosition = (position: number, duration: number) => Math.max(0, Math.min(duration, Number.isFinite(position) ? position : 0));
/** Finished recordings define tape length in either deck view. */
export function reelTapeProgress({ tapePosition, tapeDuration, timelinePosition, timelineDuration, master, recording, tapeMoving }: { tapePosition: number; tapeDuration: number; timelinePosition: number; timelineDuration: number; master: boolean; recording: boolean; tapeMoving: boolean }) {
  const position = !master || tapeMoving || recording ? tapePosition : timelinePosition;
  const duration = recording ? timelineDuration : tapeDuration > 0 ? tapeDuration : master ? timelineDuration : 0;
  return duration > 0 ? clampTapePosition(position, duration) / duration : 0;
}
/** Tape occupies annular area; conserve its length between reels. */
export const reelTapeRadius = (fill: number) => Math.sqrt(37 ** 2 + Math.max(0, Math.min(1, fill)) * (90 ** 2 - 37 ** 2));
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