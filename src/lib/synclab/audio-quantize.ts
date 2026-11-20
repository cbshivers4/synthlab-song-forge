/** Pure helpers that line an audio clip up with the song's beat grid. */

/** Seconds of the first strong hit between `from` and `to` (source seconds), or null. */
export function firstTransient(
  samples: Float32Array,
  sampleRate: number,
  from: number,
  to: number,
): number | null {
  const a = Math.max(0, Math.floor(from * sampleRate));
  const b = Math.min(samples.length, Math.ceil(to * sampleRate));
  if (b - a < 16) return null;
  let peak = 0;
  for (let i = a; i < b; i++) peak = Math.max(peak, Math.abs(samples[i] ?? 0));
  if (peak < 1e-4) return null;
  const threshold = peak * 0.3;
  for (let i = a; i < b; i++) {
    if (Math.abs(samples[i] ?? 0) >= threshold) {
      // step back to where the hit starts rising (≤5 ms) so the attack isn't clipped
      const back = Math.max(a, i - Math.round(sampleRate * 0.005));
      let s = i;
      while (s > back && Math.abs(samples[s - 1] ?? 0) > peak * 0.02) s--;
      return s / sampleRate;
    }
  }
  return null;
}

/** Nearest grid position in steps (1 step = 1/16 note). */
export function snapSteps(start: number, grid: number): number {
  const g = Math.max(0.25, grid);
  return Math.max(0, Math.round(start / g) * g);
}

/** Speed that makes `lengthSec` (at `rate`) last a whole number of bars. */
export function fitSpeedToBars(
  lengthSec: number,
  rate: number,
  speed: number,
  bpm: number,
  beatsPerBar = 4,
) {
  const barSec = (60 / Math.max(20, bpm)) * beatsPerBar;
  const onTimeline = lengthSec / rate;
  const bars = Math.max(1, Math.round(onTimeline / barSec));
  const needRate = lengthSec / (bars * barSec);
  const nextSpeed = speed * (needRate / rate);
  return { bars, speed: Math.max(0.25, Math.min(4, nextSpeed)) };
}

/**
 * Beat lines as positions inside the trimmed clip (source seconds from `offset`),
 * for a clip placed at `startSteps` on the song.
 */
export function beatLines(
  startSteps: number,
  lengthSec: number,
  rate: number,
  bpm: number,
  beatsPerBar = 4,
) {
  const beat = 60 / Math.max(20, bpm);
  const startSec = startSteps * (beat / 4);
  const onTimeline = lengthSec / rate;
  const out: { at: number; bar: boolean }[] = [];
  let k = Math.ceil(startSec / beat - 1e-6);
  for (let i = 0; i < 2000; i++, k++) {
    const t = k * beat - startSec;
    if (t > onTimeline + 1e-6) break;
    out.push({ at: t * rate, bar: k % beatsPerBar === 0 });
  }
  return out;
}
