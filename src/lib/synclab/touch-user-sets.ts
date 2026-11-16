import type { TouchLoops } from './touch-synth';

/** A loop set the user saved from the Touch Synth: the five parts plus their sounds, kit, key, scale and length. */
export interface TouchUserSet {
  id: string; name: string; savedAt: number;
  root: number; scale: string; bars: number; bpm: number;
  kit?: string; sounds: Record<string, string>; loops: TouchLoops;
}

const KEY = 'synclab.touch-sets.v1';
const EVENT = 'synclab:touch-sets';

/** Saved sets live on this device (like device-only preferences); the current set is also stored inside the song. */
export function readTouchSets(): TouchUserSet[] {
  try {
    const raw = JSON.parse(localStorage.getItem(KEY) || '[]') as unknown;
    return Array.isArray(raw) ? raw.filter((s): s is TouchUserSet => !!s && typeof s === 'object' && typeof (s as TouchUserSet).id === 'string' && typeof (s as TouchUserSet).name === 'string') : [];
  } catch { return []; }
}

function write(sets: TouchUserSet[]) {
  try { localStorage.setItem(KEY, JSON.stringify(sets)); } catch { /* storage blocked or full */ }
  if (typeof window !== 'undefined') window.dispatchEvent(new Event(EVENT));
}

/** Saving under a name that already exists replaces that set. */
export function saveTouchSet(set: Omit<TouchUserSet, 'id' | 'savedAt'>): TouchUserSet {
  const sets = readTouchSets();
  const name = set.name.trim().slice(0, 60) || 'My set';
  const existing = sets.find((s) => s.name.toLowerCase() === name.toLowerCase());
  const saved: TouchUserSet = { ...structuredClone(set), name, id: existing?.id ?? `ts-${Date.now().toString(36)}`, savedAt: Date.now() };
  write([saved, ...sets.filter((s) => s.id !== saved.id)]);
  return saved;
}

export function deleteTouchSet(id: string) { write(readTouchSets().filter((s) => s.id !== id)); }

export function onTouchSetsChange(cb: () => void) {
  window.addEventListener(EVENT, cb);
  window.addEventListener('storage', cb);
  return () => { window.removeEventListener(EVENT, cb); window.removeEventListener('storage', cb); };
}
