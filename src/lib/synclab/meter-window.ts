/**
 * Level meters are read on a timer (20 fps). The analyser window must cover at
 * least the time since the previous read, or a short drum hit (a snare crack
 * lasts a few milliseconds) can fall between two reads and never show — the
 * meter and clip light would then stay out of the red even when it clips.
 */
export const METER_POLL_MS = 50;

/** Smallest analyser size (power of two, Web Audio max 32768) covering `slack` poll intervals. */
export function meterWindowSize(sampleRate: number, pollMs = METER_POLL_MS, slack = 2): number {
  const needed = (sampleRate * pollMs * slack) / 1000;
  let size = 32;
  while (size < needed && size < 32768) size *= 2;
  return size;
}
