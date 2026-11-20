/**
 * Slider value for a finger on the sideways phone canvas (body rotated 90° clockwise).
 * A layout point (x, y) appears on screen at (screenWidth - y, x), so the slider's
 * layout box is recovered from its screen rect and the finger mapped back the same way.
 */
export function sidewaysSliderValue(o: {
  rect: { left: number; top: number; right: number; bottom: number };
  clientX: number;
  clientY: number;
  screenWidth: number;
  min: number;
  max: number;
  step: number;
  vertical: boolean;
  inverted?: boolean;
}): number {
  const { rect, clientX, clientY, screenWidth: W } = o;
  // Layout-space box and finger.
  const left = rect.top;
  const width = rect.bottom - rect.top;
  const top = W - rect.right;
  const height = rect.right - rect.left;
  const x = clientY;
  const y = W - clientX;
  let frac = o.vertical ? 1 - (y - top) / Math.max(1, height) : (x - left) / Math.max(1, width);
  if (o.inverted) frac = 1 - frac;
  frac = Math.min(1, Math.max(0, frac));
  const raw = o.min + frac * (o.max - o.min);
  const step = o.step > 0 ? o.step : 1;
  const snapped = Math.round((raw - o.min) / step) * step + o.min;
  const decimals = (String(step).split(".")[1] ?? "").length;
  return Math.min(o.max, Math.max(o.min, Number(snapped.toFixed(decimals))));
}
