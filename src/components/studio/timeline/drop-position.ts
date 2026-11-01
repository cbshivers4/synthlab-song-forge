/** Step under a horizontal fraction of the lane, snapped to the grid (grid 0 = off). */
export function snapDropStep(fraction: number, totalSteps: number, grid: number): number {
  const raw = Math.max(0, Math.min(1, fraction)) * totalSteps;
  const snapped = grid > 0 ? Math.round(raw / grid) * grid : raw;
  return Math.max(0, Math.min(Math.max(0, totalSteps - (grid > 0 ? grid : 0)), snapped));
}

