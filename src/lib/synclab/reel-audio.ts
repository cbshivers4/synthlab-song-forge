import type { Capture } from "./bounce";

/** Tape speed is repitch, not pitch-preserving time stretch. */
export const tapeDuration = (capture: Capture, speed: number) =>
  capture.left.length / capture.sampleRate / speed;
export const clampTapePosition = (position: number, duration: number) =>
  Math.max(0, Math.min(duration, Number.isFinite(position) ? position : 0));
/** Finished recordings define tape length in either deck view. */
export function reelTapeProgress({
  tapePosition,
  tapeDuration,
  timelinePosition,
  timelineDuration,
  master,
  recording,
  tapeMoving,
}: {
  tapePosition: number;
  tapeDuration: number;
  timelinePosition: number;
  timelineDuration: number;
  master: boolean;
  recording: boolean;
  tapeMoving: boolean;
}) {
  const position = !master || tapeMoving || recording ? tapePosition : timelinePosition;
  const duration = recording
    ? timelineDuration
    : tapeDuration > 0
      ? tapeDuration
      : master
        ? timelineDuration
        : 0;
  return duration > 0 ? clampTapePosition(position, duration) / duration : 0;
}
/** Tape occupies annular area; conserve its length between reels. */
export const reelTapeRadius = (fill: number) =>
  Math.sqrt(37 ** 2 + Math.max(0, Math.min(1, fill)) * (90 ** 2 - 37 ** 2));
export function joinTapeChunks(chunks: Float32Array[]) {
  const result = new Float32Array(chunks.reduce((length, chunk) => length + chunk.length, 0));
  let offset = 0;
  for (const chunk of chunks) {
    result.set(chunk, offset);
    offset += chunk.length;
  }
  return result;
}
export function tapeCurve(drive: number): Float32Array<ArrayBuffer> {
  const curve = new Float32Array(2048);
  const amount = Math.max(0, drive) * 5;
  for (let i = 0; i < curve.length; i++) {
    const x = (i * 2) / (curve.length - 1) - 1;
    curve[i] = amount < 0.001 ? x : Math.tanh(x * (1 + amount)) / Math.tanh(1 + amount);
  }
  return curve;
}
/** Default reel for microphone/line takes: a 30-minute reel, so the reels fill honestly while you record. */
export const INPUT_REEL_SECONDS = 30 * 60;

/** How much tape the reels hold while recording: the song length for song-master takes, else a 30-minute reel. */
export function recordingReelSeconds(
  source: "input" | "song",
  songSeconds: number,
  position: number,
) {
  const capacity = source === "song" && songSeconds > 0 ? songSeconds : INPUT_REEL_SECONDS;
  return Math.max(capacity, position + 1);
}

/**
 * Reel rotation in degrees from the real tape position. Tape runs past the heads at a constant
 * speed, so each reel turns by (tape wound) ÷ (its current radius): the nearly empty reel spins
 * fast, the full one slowly, both stop with the tape and turn backwards when rewinding.
 * With tape thickness h, the turns on a reel are (radius − hub) ÷ h.
 */
export function reelAngles(fillTakeUp: number, totalSeconds: number) {
  const hub = reelTapeRadius(0),
    full = reelTapeRadius(1);
  const turnsFull = Math.max(12, totalSeconds * 0.5);
  const h = (full - hub) / turnsFull;
  const supplyR = reelTapeRadius(1 - fillTakeUp),
    takeR = reelTapeRadius(fillTakeUp);
  return {
    supply: (((full - supplyR) / h) * 360) % 360,
    takeUp: (((takeR - hub) / h) * 360) % 360,
  };
}

/**
 * Records a take over a tape from startFrame, like a real deck: the take replaces what was
 * under it, anything after the take stays, and recording past the end makes the tape longer.
 * Different sample rates can't be lined up, so the take then replaces the tape.
 */
export function punchTape(old: Capture | null, take: Capture, startFrame: number): Capture {
  const start = Math.max(0, Math.floor(startFrame));
  if (
    !old ||
    old.sampleRate !== take.sampleRate ||
    (start === 0 && old.left.length <= take.left.length)
  )
    return take;
  const length = Math.max(old.left.length, start + take.left.length);
  const left = new Float32Array(length);
  const right = new Float32Array(length);
  left.set(old.left);
  right.set(old.right.length ? old.right : old.left);
  left.set(take.left, start);
  right.set(take.right, start);
  return { left, right, sampleRate: take.sampleRate };
}
