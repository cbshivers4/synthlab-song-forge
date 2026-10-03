/**
 * Drum hits written live during the current recording pass. While recording,
 * the scheduler skips these so a hit you just played is not voiced a second
 * time by the playback engine; you already heard it when you played it.
 * Cleared when recording stops.
 */
const hits = new Set<string>();
const key = (trackId: string, padId: string, step: number) => `${trackId}:${padId}:${step}`;

export function markLiveHit(trackId: string, padId: string, step: number) {
  hits.add(key(trackId, padId, step));
}
export function isLiveHit(trackId: string, padId: string, step: number) {
  return hits.size > 0 && hits.has(key(trackId, padId, step));
}
export function clearLiveHits() {
  hits.clear();
}
