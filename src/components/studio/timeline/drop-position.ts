/** Step under a horizontal fraction of the lane, snapped to the grid (grid 0 = off). */
export function snapDropStep(fraction: number, totalSteps: number, grid: number): number {
  const raw = Math.max(0, Math.min(1, fraction)) * totalSteps;
  const snapped = grid > 0 ? Math.round(raw / grid) * grid : raw;
  return Math.max(0, Math.min(Math.max(0, totalSteps - (grid > 0 ? grid : 0)), snapped));
}

/** Arrangement zoom after one Ctrl/Cmd-wheel notch (or pinch step): 1×–8×, in 0.25 steps. */
export function zoomAround(zoom: number, deltaY: number): number {
  const factor = deltaY < 0 ? 1.15 : 1 / 1.15;
  const next = Math.round(zoom * factor * 4) / 4;
  const moved = next === zoom ? zoom + (deltaY < 0 ? 0.25 : -0.25) : next;
  return Math.max(1, Math.min(8, moved));
}
