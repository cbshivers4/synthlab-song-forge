import { clipSeconds, type Track } from './types';
import { songSteps, stepSeconds } from './timebase';
import { regionAt } from './note-cuts';

/** Only an explicitly selected audio clip is an editing target. */
export function selectedClip(track: Track | null | undefined) {
  return track?.clips?.find((clip) => clip.id === track.activeClipId);
}

export function selectedPartBounds(track: Track | null | undefined, bpm: number, bars: number): [number, number] | null {
  if (!track) return null;
  const clip = selectedClip(track);
  if (clip) return [clip.start ?? 0, (clip.start ?? 0) + clipSeconds(clip) / stepSeconds(bpm)];
  if (track.activeRegion == null) return null;
  const region = regionAt(track.cuts, songSteps(bars), track.activeRegion);
  if (track.patternRegion) return [Math.max(region[0], track.patternRegion[0]), Math.min(region[1], track.patternRegion[1])];
  const notes = track.notes ?? [];
  if (notes.length && notes.every((note) => note.recordedEnd != null)) {
    return [Math.max(region[0], Math.min(...notes.map((note) => note.step))), Math.min(region[1], Math.max(...notes.map((note) => note.recordedEnd ?? songSteps(bars))))];
  }
  return region;
}