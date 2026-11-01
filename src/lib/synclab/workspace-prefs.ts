/**
 * Desktop workspace layout preferences (this device only, never part of a project):
 * whether an open editor shares the screen with the timeline, and how tall the timeline is then.
 */
import { useSyncExternalStore } from "react";

export interface WorkspacePrefs { split: boolean; timelineHeight: number }
const KEY = "synclab.workspace";
const DEFAULTS: WorkspacePrefs = { split: false, timelineHeight: 300 };
let cached: WorkspacePrefs | null = null;
const subs = new Set<() => void>();

export const clampTimelineHeight = (px: number, viewport: number) => Math.round(Math.max(140, Math.min(viewport * 0.7, px)));

export function workspacePrefs(): WorkspacePrefs {
  if (cached) return cached;
  try { cached = { ...DEFAULTS, ...(JSON.parse(localStorage.getItem(KEY) || "{}") as Partial<WorkspacePrefs>) }; }
  catch { cached = { ...DEFAULTS }; }
  return cached;
}
export function setWorkspacePrefs(patch: Partial<WorkspacePrefs>) {
  cached = { ...workspacePrefs(), ...patch };
  try { localStorage.setItem(KEY, JSON.stringify(cached)); } catch { /* storage blocked */ }
  for (const fn of subs) fn();
}
const subscribe = (fn: () => void) => { subs.add(fn); return () => { subs.delete(fn); }; };
/** Server render and first paint use the defaults, then the saved layout. */
export function useWorkspacePrefs(): WorkspacePrefs {
  return useSyncExternalStore(subscribe, workspacePrefs, () => DEFAULTS);
}
