import { useSyncExternalStore } from "react";

/**
 * The moving playhead, kept outside the studio's shared state so a playback step only
 * re-renders the few things that show the position (counters, playhead lines, step lights),
 * not every screen that reads the studio.
 */
let current = 0;
const listeners = new Set<() => void>();

export function getPlayStep(): number {
  return current;
}

export function setPlayStep(step: number) {
  if (!Number.isFinite(step) || step === current) return;
  current = step;
  for (const listener of listeners) listener();
}

export function subscribePlayStep(listener: () => void) {
  listeners.add(listener);
  return () => void listeners.delete(listener);
}

/** Live playhead position for display; re-renders the caller on every step. */
export function usePlayStep(): number {
  return useSyncExternalStore(subscribePlayStep, getPlayStep, getPlayStep);
}
