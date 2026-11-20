/** One loop pass of a continuous recording, as a clip window into the recorded file. */
export interface LoopPass {
  /** timeline step where the pass sits */
  start: number;
  /** seconds into the recorded file */
  offset: number;
  /** seconds of audio in the pass */
  length: number;
}

/**
 * Cuts one continuous recording made while the loop cycled into one window per pass. The
 * recording is never stopped between passes, so no audio is lost at the loop start.
 * `start`/`offset` are where the first pass begins (it may begin mid-loop).
 */
export function splitLoopPasses({
  start,
  offset,
  duration,
  lo,
  hi,
  stepDur,
}: {
  start: number;
  offset: number;
  duration: number;
  lo: number;
  hi: number;
  stepDur: number;
}): LoopPass[] {
  const passSec = Math.max(0.001, (hi - lo) * stepDur);
  const out: LoopPass[] = [];
  const firstLen = Math.max(0, (hi - Math.max(lo, start)) * stepDur);
  let at = offset;
  const push = (s: number, len: number) => {
    const length = Math.min(len, duration - at);
    if (length >= 0.05) out.push({ start: s, offset: at, length });
    at += len;
  };
  push(Math.max(lo, start), firstLen);
  while (at < duration - 0.05) push(lo, passSec);
  return out;
}

/**
 * Which pass is shown on the track: the newest, unless it's a short tail you stopped early in,
 * then the last full pass. The others stay as takes to choose from.
 */
export function shownPassIndex(
  passes: LoopPass[],
  lo: number,
  hi: number,
  stepDur: number,
): number {
  if (passes.length < 2) return passes.length - 1;
  const passSec = (hi - lo) * stepDur;
  const last = passes[passes.length - 1]!;
  return last.length < passSec * 0.5 ? passes.length - 2 : passes.length - 1;
}
