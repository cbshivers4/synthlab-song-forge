/**
 * Note repeat (MPC-style roll): while a pad is held it retriggers at a musical rate.
 * With the song playing the hits land exactly on the song's grid; stopped, they run at the tempo.
 */
import { activeSongClock, type SongClock } from "./song-clock";

/** Rate options in 16th-note steps per hit. */
export const NOTE_REPEAT_RATES = [
  { label: "1/4", steps: 4 },
  { label: "1/8", steps: 2 },
  { label: "1/8T", steps: 4 / 3 },
  { label: "1/16", steps: 1 },
  { label: "1/16T", steps: 2 / 3 },
  { label: "1/32", steps: 0.5 },
] as const;

/** First repeat time: the next grid line of the song (or right now when the song is stopped). */
export function firstRepeatTime(now: number, rateSteps: number, clock: SongClock | null): number {
  if (!clock) return now + 0.005;
  const pos = clock.step + (now + 0.005 - clock.time) / clock.dur;
  const next = Math.ceil(pos / rateSteps - 1e-6) * rateSteps;
  return clock.time + (next - clock.step) * clock.dur;
}

/** Song step a hit at audio time `t` lands on (rounded to whole steps for the step grid). */
export function stepAtTime(t: number, clock: SongClock): number {
  return Math.round(clock.step + (t - clock.time) / clock.dur);
}

/** Runs a held-pad roll. Returns stop(). `hit(time, step|null)` is called just ahead of each hit's time. */
export function startNoteRepeat(
  ctx: BaseAudioContext,
  rateSteps: number,
  stepSeconds: number,
  hit: (time: number, step: number | null) => void,
): () => void {
  const interval = rateSteps * stepSeconds;
  let t = firstRepeatTime(ctx.currentTime, rateSteps, activeSongClock(ctx.currentTime));
  const pump = () => {
    while (t < ctx.currentTime + 0.05) {
      const clock = activeSongClock(ctx.currentTime);
      hit(t, clock ? stepAtTime(t, clock) : null);
      t += interval;
    }
  };
  pump();
  const timer = window.setInterval(pump, 10);
  return () => window.clearInterval(timer);
}
