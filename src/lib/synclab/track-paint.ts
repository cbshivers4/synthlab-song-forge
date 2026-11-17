/** Channel highlighting by dragging the mouse down the track-name column: pure range math, testable without a browser. */

/** Channels from the anchor to the row under the pointer, in the order the rows are shown, both ends included. */
export function paintTrackRange(ids: string[], anchorId: string, overId: string): string[] {
  const a = ids.indexOf(anchorId);
  const b = ids.indexOf(overId);
  if (a < 0 || b < 0) return [];
  return ids.slice(Math.min(a, b), Math.max(a, b) + 1);
}

/** What the highlight becomes: the painted run on its own, or added to channels already picked. */
export function mergePaintSelection(existing: string[], painted: string[], add: boolean): string[] {
  if (!add) return painted;
  return [...new Set([...existing, ...painted])];
}
