/**
 * Recorded mute/solo button presses. Each event says "from this step on, the button is on/off".
 * Before the first event the first event's state holds; after the last, the last one's.
 */
export interface SwitchEvent {
  step: number;
  on: boolean;
}

export function switchStateAt(events: SwitchEvent[] | undefined, step: number): boolean | undefined {
  if (!events?.length) return undefined;
  let state = events[0]!.on;
  for (const e of events) {
    if (e.step > step) break;
    state = e.on;
  }
  return state;
}

/**
 * One recorded step of a take, with replace semantics: anything already recorded in (from, to]
 * is overwritten by the live button state. `baseline` is the button state when the take began and
 * `takeStart` the step it began at, so the very first recorded press also keeps the earlier state.
 * Returns null when nothing changes, so callers can skip a state update.
 */
export function writeSwitchStep(
  events: SwitchEvent[] | undefined,
  from: number,
  to: number,
  live: boolean,
  baseline: boolean,
  takeStart: number,
): SwitchEvent[] | null {
  const list = events ?? [];
  if (!list.length) {
    if (live === baseline) return null;
    return takeStart < to ? [{ step: takeStart, on: baseline }, { step: to, on: live }] : [{ step: to, on: live }];
  }
  const kept = list.filter((e) => e.step <= from || e.step > to);
  const removed = kept.length !== list.length;
  const implied = switchStateAt(kept.filter((e) => e.step <= to), to) ?? kept[0]?.on;
  if (implied === live && !removed) return null;
  const next = implied === live ? kept : [...kept, { step: to, on: live }];
  next.sort((a, b) => a.step - b.step);
  // Drop events that repeat the state before them; they change nothing.
  return next.filter((e, i) => i === 0 || e.on !== next[i - 1]!.on);
}
