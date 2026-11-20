/**
 * Desktop workspace layout preferences (this device only, never part of a project):
 * whether an open editor shares the screen with the timeline, and how tall the timeline is then;
 * whether the mixer docks under the timeline (Studio Pro style) and how tall that docked mixer is.
 */
import { useSyncExternalStore } from "react";

export interface WorkspacePrefs {
  split: boolean;
  timelineHeight: number;
  mixerDock: boolean;
  mixerHeight: number;
}
const KEY = "synclab.workspace";
/** mixerHeight 0 = not dragged yet: the docked mixer takes a little under half the screen. */
const DEFAULTS: WorkspacePrefs = {
  split: false,
  timelineHeight: 300,
  mixerDock: true,
  mixerHeight: 0,
};
let cached: WorkspacePrefs | null = null;
const subs = new Set<() => void>();

/** Docked mixer: never shorter than one compact strip, never so tall the timeline disappears. */
export const clampMixerHeight = (px: number, viewport: number) =>
  Math.round(Math.max(240, Math.min(viewport * 0.78, px)));
export const DEFAULT_MIXER_SHARE = 0.38;
export const clampTimelineHeight = (px: number, viewport: number) =>
  Math.round(Math.max(140, Math.min(viewport * 0.7, px)));

export function workspacePrefs(): WorkspacePrefs {
  if (cached) return cached;
  try {
    cached = {
      ...DEFAULTS,
      ...(JSON.parse(localStorage.getItem(KEY) || "{}") as Partial<WorkspacePrefs>),
    };
  } catch {
    cached = { ...DEFAULTS };
  }
  return cached;
}
export function setWorkspacePrefs(patch: Partial<WorkspacePrefs>) {
  cached = { ...workspacePrefs(), ...patch };
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
/** Server render and first paint use the defaults, then the saved layout. */
export function useWorkspacePrefs(): WorkspacePrefs {
  return useSyncExternalStore(subscribe, workspacePrefs, () => DEFAULTS);
}
