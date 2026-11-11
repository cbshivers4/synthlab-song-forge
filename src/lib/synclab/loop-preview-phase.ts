import type { SongClock } from "./song-clock";

/**
 * Where (seconds into the loop) a looped preview should be at audio time `when`.
 * - Song playing: on the song's grid, so bar 1 of the pattern lands on the song's bar lines.
 * - Otherwise, replacing a running preview: the same fraction of the way through the loop,
 *   so pressing Generate again keeps the groove going instead of jumping back to the start.
 * - Otherwise: from the top.
 */
export function loopPreviewOffset({ when, loopSec, loopSteps, song, previous }: {
  when: number; loopSec: number; loopSteps: number;
  song: SongClock | null;
  previous: { startedAt: number; loopSec: number } | null;
}): number {
  if (!(loopSec > 0)) return 0;
  const wrap = (x: number, m: number) => ((x % m) + m) % m;
  if (song && song.dur > 0 && loopSteps > 0) {
    const pos = song.step + (when - song.time) / song.dur;
    return (wrap(pos, loopSteps) / loopSteps) * loopSec;
  }
  if (previous && previous.loopSec > 0) {
    const frac = wrap(when - previous.startedAt, previous.loopSec) / previous.loopSec;
    return frac * loopSec;
  }
  return 0;
}
