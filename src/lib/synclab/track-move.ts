import type { Track } from './types';
import { uid } from './presets';

/**
 * Reorder a track by dropping it onto another track's slot (or the end of the
 * list). The moved track takes the target position and the rest shift over.
 */
export function moveTrackToIndexIn(tracks: Track[], id: string, index: number): Track[] {
  const from = tracks.findIndex((t) => t.id === id);
  if (from < 0 || index < 0 || index >= tracks.length || from === index) return tracks;
  const next = [...tracks];
  const [moved] = next.splice(from, 1);
  next.splice(index, 0, moved!);
  return next;
}

/**
 * Move a track's material — recordings, notes, drum patterns, automation — to a
 * brand-new channel at the end of the list, the way Add Track creates one. The
 * original channel keeps its place, name and sound but is emptied of material.
 */
export function moveTrackToNewIn(tracks: Track[], id: string): { tracks: Track[]; movedId: string | null } {
  const i = tracks.findIndex((t) => t.id === id);
  if (i < 0) return { tracks, movedId: null };
  const src = tracks[i]!;
  const moved: Track = { ...(structuredClone(src) as Track), id: uid(), name: `${src.name} NEW` };
  if (moved.pads) moved.pads = moved.pads.map((p) => ({ ...p, id: uid() }));
  if (moved.notes) moved.notes = moved.notes.map((n) => ({ ...n, id: uid() }));
  const emptied: Track = {
    ...src,
    clips: [],
    activeClipId: undefined,
    notes: src.notes ? [] : undefined,
    cuts: undefined,
    activeRegion: undefined,
    patternRegion: undefined,
    printedAudio: false,
    recording: false,
    pads: src.pads?.map((p) => ({ ...p, steps: p.steps.map(() => 0) })),
    drumPatterns: src.drumPatterns?.map((pat) => pat.map((p) => ({ ...p, steps: p.steps.map(() => 0) }))),
    bendLane: undefined,
    modLane: undefined,
    automation: undefined,
  };
  const next = [...tracks];
  next[i] = emptied;
  return { tracks: [...next, moved], movedId: moved.id };
}
