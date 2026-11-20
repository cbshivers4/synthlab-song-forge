/** Snap in original video seconds; stretching does not move source cuts. */
export function snapVideoTime(time: number, bpm: number, division: number): number {
  if (division <= 0 || bpm <= 0) return time;
  const interval = 240 / bpm / division;
  return Math.round(time / interval) * interval;
}
/** Keep pad order stable and prevent empty or overlapping chop ranges. */
export function moveVideoChop(
  chops: number[],
  index: number,
  time: number,
  duration: number,
): number[] {
  if (index < 0 || index >= chops.length) return chops;
  const low = index === 0 ? 0 : (chops[index - 1] ?? 0) + 0.01;
  const high = (chops[index + 1] ?? duration) - 0.01;
  return chops.map((value, i) => (i === index ? Math.max(low, Math.min(high, time)) : value));
}
