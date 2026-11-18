// "What did my controller just send?" — a tiny external store the MIDI settings page reads, so a
// user can see whether their mixer surface reaches the app at all and what each control did.
// Updates are throttled so moving a fader never floods React.
import { useSyncExternalStore } from "react";

export type SurfaceEvent = {
  port: string;
  /** Raw message, e.g. "CC 2 = 87 · ch 1" or "Pitch bend · ch 1". */
  raw: string;
  /** What the app did with it, e.g. "Track 1 volume" or "Not used". */
  action: string;
  /** "Assignable (CC)" or "DAW mode (Mackie Control)" for known surfaces. */
  mode?: string;
  at: number;
};

let latest: SurfaceEvent | null = null;
let pending: SurfaceEvent | null = null;
let timer: ReturnType<typeof setTimeout> | null = null;
const listeners = new Set<() => void>();

export function noteSurfaceEvent(event: Omit<SurfaceEvent, "at">) {
  pending = { ...event, at: Date.now() };
  if (timer) return;
  timer = setTimeout(() => {
    timer = null;
    latest = pending;
    listeners.forEach((l) => l());
  }, 100);
}

export function describeRaw(status: number, d1: number, d2: number): string {
  const cmd = status & 0xf0;
  const ch = (status & 0x0f) + 1;
  if (cmd === 0xb0) return `CC ${d1} = ${d2} · ch ${ch}`;
  if (cmd === 0xe0) return `Pitch bend ${(d2 << 7) | d1} · ch ${ch}`;
  if (cmd === 0x90) return d2 > 0 ? `Note ${d1} on · ch ${ch}` : `Note ${d1} off · ch ${ch}`;
  if (cmd === 0x80) return `Note ${d1} off · ch ${ch}`;
  return `Status ${status.toString(16)} · ${d1} · ${d2}`;
}

const subscribe = (l: () => void) => { listeners.add(l); return () => { listeners.delete(l); }; };
export const useSurfaceEvent = () => useSyncExternalStore(subscribe, () => latest, () => null);
