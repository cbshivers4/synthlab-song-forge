/** Shared set of currently-sounding MIDI notes so on-screen keyboards can light up
 *  for any input source: MIDI controllers, typing keys, on-screen taps. */
const active = new Set<number>();
const listeners = new Set<() => void>();
const timers = new Map<number, ReturnType<typeof setTimeout>>();

function emit() {
  listeners.forEach((fn) => fn());
}

export function keyDown(midi: number) {
  active.add(midi);
  const old = timers.get(midi);
  if (old) clearTimeout(old);
  // Safety: sources without note-off (on-screen taps, typing keys) auto-release.
  timers.set(
    midi,
    setTimeout(() => keyUp(midi), 1500),
  );
  emit();
}

export function keyUp(midi: number) {
  const old = timers.get(midi);
  if (old) clearTimeout(old);
  timers.delete(midi);
  if (active.delete(midi)) emit();
}

export function subscribeKeys(fn: () => void): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

export function keysSnapshot(): number[] {
  return Array.from(active);
}
