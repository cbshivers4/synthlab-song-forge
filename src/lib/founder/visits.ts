/**
 * Time spent in the app: the browser reports the seconds it was actually on screen in short
 * beats, and the server adds them to one visit. These helpers are shared by both sides.
 */

/** How often an open, visible app reports its time. */
export const BEAT_MS = 60_000;
/** Most seconds one report may add (a beat is a minute; this absorbs late timers, never days). */
export const MAX_BEAT_SECONDS = 120;
/** A visit that ended this recently is picked up again (a page reload is not a new visit). */
export const VISIT_RESUME_MS = 2 * 60_000;
/** A visit that hasn't reported for this long is treated as finished (phone locked, app killed). */
export const VISIT_STALE_MS = 5 * 60_000;
/** The founder is told someone left only after this long, so a reload doesn't count as leaving. */
export const LEFT_CONFIRM_MS = 90_000;

export function clampBeat(seconds: number): number {
  if (!Number.isFinite(seconds) || seconds <= 0) return 0;
  return Math.min(MAX_BEAT_SECONDS, Math.round(seconds));
}

/** Whether a new page load should continue the account's latest visit instead of starting one. */
export function resumesVisit(
  latest: { ended_at: string | null; last_seen_at: string } | null,
  now = Date.now(),
): boolean {
  if (!latest?.ended_at) return false;
  return now - new Date(latest.ended_at).getTime() <= VISIT_RESUME_MS;
}

/** "45 sec", "12 min", "1 h 05 min" */
export function formatDuration(seconds: number): string {
  const s = Math.max(0, Math.round(seconds));
  if (s < 60) return `${s} sec`;
  const m = Math.round(s / 60);
  if (m < 60) return `${m} min`;
  const h = Math.floor(m / 60);
  return `${h} h ${String(m % 60).padStart(2, "0")} min`;
}

/** Still in the app: has reported recently and hasn't left. */
export function isVisitLive(
  v: { ended_at: string | null; last_seen_at: string },
  now = Date.now(),
): boolean {
  return !v.ended_at && now - new Date(v.last_seen_at).getTime() < VISIT_STALE_MS;
}
