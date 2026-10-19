import type { Track } from './types';
import { uid } from './presets';
import { clipSeconds } from './types';
import { deleteRegion } from './note-cuts';

/**
 * Reorder a track by dropping it onto another track's slot (or the end of the
 * list). The moved track takes the target position and the rest shift over.
 */
export function moveTrackToIndexIn(tracks: Track[], id: string, index: number): Track[] {
  const from = tracks.findIndex((t) => t.id === id);
  if (from < 0 || index < 0 || index >= tracks.length || from === index) return tracks;
  const next = [...tracks];
  const [moved] = next.splice(from, 1);
  if (!moved) return tracks;
  next.splice(index, 0, moved);
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
  const src = tracks[i];
  if (!src) return { tracks, movedId: null };
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

/** Move only the dragged recording, clearing its original note/hit region. */
export function moveClipToNewIn(tracks: Track[], trackId: string, clipId: string, sourceStart: number, stepDuration: number): { tracks: Track[]; movedId: string | null } {
  const src = tracks.find((track) => track.id === trackId);
  const clip = src?.clips?.find((item) => item.id === clipId);
  if (!src || !clip || stepDuration <= 0) return { tracks, movedId: null };
  const end = sourceStart + clipSeconds(clip) / stepDuration;
  const leftClips = (src.clips ?? []).filter((item) => item.id !== clipId);
  const emptied: Track = {
    ...src, clips: leftClips, activeClipId: undefined,
    notes: src.notes ? deleteRegion(src.notes, [sourceStart, end]) : undefined,
    pads: src.pads?.map((pad) => ({ ...pad, steps: pad.steps.map((value, i) => {
      const length = Math.max(1, pad.steps.length);
      const first = i + Math.max(0, Math.ceil((sourceStart - i) / length)) * length;
      return first < end ? 0 : value;
    }) })),
    printedAudio: leftClips.length > 0 ? src.printedAudio : false,
  };
  const moved: Track = {
    ...src, id: uid(), name: clip.name, kind: 'audio', folderId: undefined,
    clips: [clip], activeClipId: clip.id, notes: [], pads: undefined,
    drumPatterns: undefined, cuts: undefined, activeRegion: undefined,
    patternRegion: undefined, printedAudio: false, recording: false, armed: false,
    patch: undefined, sampler: undefined, bendLane: undefined, modLane: undefined,
    automation: undefined, plugins: src.plugins?.map((plugin) => ({ ...structuredClone(plugin), id: uid() })),
  };
  return { tracks: [...tracks.map((track) => track.id === trackId ? emptied : track), moved], movedId: moved.id };
}
