/**
 * Favorite preset keys on each synth's face (this device only, never part of a project).
 * Every synth model keeps its own row of keys, because each model shows its own preset list.
 * The pure helpers below are tested; the store just persists them and notifies subscribers.
 */
import { useSyncExternalStore } from "react";

export const FAVORITE_SLOTS = 8;
/** One synth's keys: a preset name per key, or null for an empty key. */
export type FavoriteSlots = (string | null)[];
type FavoriteMap = Record<string, FavoriteSlots>;

const KEY = "synclab.presetFavorites";
const EMPTY: FavoriteSlots = Array.from({ length: FAVORITE_SLOTS }, () => null);

/** Always exactly FAVORITE_SLOTS entries; anything that is not a non-empty name becomes empty. */
export function normalizeSlots(raw: unknown): FavoriteSlots {
  const list = Array.isArray(raw) ? raw : [];
  return Array.from({ length: FAVORITE_SLOTS }, (_, i) => {
    const v = list[i];
    return typeof v === "string" && v.trim() ? v : null;
  });
}
/** Put a preset on one key, replacing whatever was there. Out-of-range keys change nothing. */
export function assignSlot(slots: FavoriteSlots, index: number, preset: string): FavoriteSlots {
  if (index < 0 || index >= FAVORITE_SLOTS || !preset.trim()) return slots;
  return slots.map((v, i) => (i === index ? preset : v));
}
export function clearSlot(slots: FavoriteSlots, index: number): FavoriteSlots {
  return slots.map((v, i) => (i === index ? null : v));
}
/** First empty key, or -1 when all keys are taken. */
export function firstEmptySlot(slots: FavoriteSlots): number {
  return slots.findIndex((v) => v === null);
}

let cached: FavoriteMap | null = null;
const subs = new Set<() => void>();
function read(): FavoriteMap {
  if (cached) return cached;
  try {
    const parsed = JSON.parse(localStorage.getItem(KEY) || "{}") as Record<string, unknown>;
    cached = Object.fromEntries(Object.entries(parsed).map(([k, v]) => [k, normalizeSlots(v)]));
  } catch {
    cached = {};
  }
  return cached;
}
export function favoriteSlots(model: string): FavoriteSlots {
  return read()[model] ?? EMPTY;
}
export function setFavoriteSlots(model: string, slots: FavoriteSlots) {
  cached = { ...read(), [model]: normalizeSlots(slots) };
  try {
    localStorage.setItem(KEY, JSON.stringify(cached));
  } catch {
    /* storage blocked */
  }
  for (const fn of subs) fn();
}
const subscribe = (fn: () => void) => {
  subs.add(fn);
  return () => {
    subs.delete(fn);
  };
};
/** Server render and first paint show empty keys, then this device's saved favorites. */
export function useFavoriteSlots(model: string): FavoriteSlots {
  return useSyncExternalStore(
    subscribe,
    () => favoriteSlots(model),
    () => EMPTY,
  );
}
