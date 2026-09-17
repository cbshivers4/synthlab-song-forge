import { useSyncExternalStore } from "react";

/**
 * Shared clipping state for the whole studio.
 * Any meter (timeline header, mixer strip, master) reports its raw peak here so
 * a clip lights up in every view at once and can be reset from any of them.
 */

const CLIP_AT = 0.985;

const clipped = new Set<string>();
const subs = new Set<() => void>();
let version = 0;

function emit() {
  version += 1;
  for (const fn of subs) fn();
}

function subscribe(fn: () => void) {
  subs.add(fn);
  return () => {
    subs.delete(fn);
  };
}

/** Feed a raw 0..1 peak for a channel id ("master" for the main output). */
export function reportLevel(id: string, level: number) {
  if (level >= CLIP_AT && !clipped.has(id)) {
    clipped.add(id);
    emit();
  }
}

export function clearClip(id: string) {
  if (clipped.delete(id)) emit();
}

export function clearAllClips() {
  if (clipped.size) {
    clipped.clear();
    emit();
  }
}

export function anyClipped() {
  return clipped.size > 0;
}

/** Reactive: is this channel currently flagged as clipping? */
export function useClipped(id: string) {
  return useSyncExternalStore(
    subscribe,
    () => clipped.has(id),
    () => false
  );
}

/** Reactive: count of clipping channels (for a global warning). */
export function useClipCount() {
  return useSyncExternalStore(
    subscribe,
    () => {
      void version;
      return clipped.size;
    },
    () => 0
  );
}

export { CLIP_AT };
