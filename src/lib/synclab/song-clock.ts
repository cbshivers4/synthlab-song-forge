/**
 * The song scheduler's latest step and its audio-clock time, so tools outside the timeline
 * (Live Looper) can line up with the song's bars while it plays.
 */
export interface SongClock { step: number; time: number; dur: number }
let clock: SongClock | null = null;

export function setSongClock(next: SongClock) {
  clock = next;
}

/** The song clock while the song is actually playing (the scheduler keeps it fresh every step). */
export function activeSongClock(now: number): SongClock | null {
  if (!clock || !(clock.dur > 0)) return null;
  return now - clock.time < clock.dur * 2 + 0.25 ? clock : null;
}

/** Audio-clock time of the first song bar line at or after `after`. */
export function nextSongBarTime(c: SongClock, after: number, stepsPerBar: number): number {
  const posAt = c.step + (after - c.time) / c.dur;
  const bar = Math.ceil(posAt / stepsPerBar - 1e-6) * stepsPerBar;
  return c.time + (bar - c.step) * c.dur;
}
