import type { EnvelopeParams } from "./types";

/** Re-schedule only the remaining portion of a note; an edit never adds a note. */
export function envelopePoints(
  env: EnvelopeParams,
  duration: number,
  age: number,
): [number, number][] {
  const attack = Math.max(0.001, env.attack);
  const decay = Math.max(0.001, env.decay);
  const releaseAt = Math.max(duration, attack + decay);
  const end = releaseAt + Math.max(0.02, env.release);
  const points: [number, number][] = [
    [0, 0],
    [attack, 1],
    [attack + decay, env.sustain],
    [releaseAt, env.sustain],
    [end, 0],
  ];
  const elapsed = Math.max(0, age);
  if (elapsed >= end) return [[elapsed, 0]];
  let value = 0;
  for (let i = 1; i < points.length; i++) {
    const before = points[i - 1];
    const after = points[i];
    if (!before || !after || elapsed > after[0]) continue;
    const fraction = (elapsed - before[0]) / Math.max(0.000001, after[0] - before[0]);
    value = before[1] + (after[1] - before[1]) * fraction;
    break;
  }
  return [[elapsed, value], ...points.filter(([time]) => time > elapsed)];
}
