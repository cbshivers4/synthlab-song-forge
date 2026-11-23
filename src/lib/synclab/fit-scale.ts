/**
 * Largest scale (minScale…1) at which content fits a box without scrolling.
 * `measure(scale)` lays the content out at width / scale and returns its natural size,
 * so a smaller scale also gives the content more room across (rows reflow and get shorter).
 */
export function fitScale(
  width: number,
  height: number,
  measure: (scale: number) => { width: number; height: number },
  minScale = 0.55,
): number {
  const fits = (scale: number) => {
    const size = measure(scale);
    return size.height * scale <= height + 0.5 && size.width <= width / scale + 1;
  };
  if (fits(1)) return 1;
  if (!fits(minScale)) return minScale;
  let lo = minScale;
  let hi = 1;
  for (let i = 0; i < 8; i++) {
    const mid = (lo + hi) / 2;
    if (fits(mid)) lo = mid;
    else hi = mid;
  }
  return Math.floor(lo * 1000) / 1000;
}
