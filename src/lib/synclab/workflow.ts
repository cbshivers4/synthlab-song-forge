import { clipSeconds, type Track } from './types';
import { songSteps, stepSeconds } from './timebase';
import { regionAt, unrollNotes, cutNotesAt, deleteRegion } from './note-cuts';

/** Only an explicitly selected audio clip is an editing target. */
export function selectedClip(track: Track | null | undefined) {
  return track?.clips?.find((clip) => clip.id === track.activeClipId);
}

export function selectedPartBounds(track: Track | null | undefined, bpm: number, bars: number, loop?: [number, number]): [number, number] | null {
  if (!track) return null;
  const clip = selectedClip(track);
  if (clip) return [clip.start ?? 0, (clip.start ?? 0) + clipSeconds(clip) / stepSeconds(bpm)];
  if (track.activeRegion == null) return null;
  const raw = regionAt(track.cuts, songSteps(bars), track.activeRegion);
  const region: [number, number] = loop ? [Math.max(raw[0], loop[0]), Math.min(raw[1], loop[1])] : raw;
  if (region[1] <= region[0]) return null;
  if (track.patternRegion) return [Math.max(region[0], track.patternRegion[0]), Math.min(region[1], track.patternRegion[1])];
  const notes = track.notes ?? [];
  if (notes.length && notes.every((note) => note.recordedEnd != null)) {
    return [Math.max(region[0], Math.min(...notes.map((note) => note.step))), Math.min(region[1], Math.max(...notes.map((note) => note.recordedEnd ?? songSteps(bars))))];
  }
  return region;
}

/** Material-only deletion: expand repeats before erasing so sibling bars survive. */
export function deleteSelectedPart(track: Track | null | undefined, bpm: number, bars: number, loop?: [number, number]): Partial<Track> | null {
  if (!track) return null;
  const clip = selectedClip(track);
  if (clip) return { clips: track.clips?.filter(c => c.id !== clip.id), activeClipId: undefined };
  const part = selectedPartBounds(track, bpm, bars, loop);
  if (!part) return null;
  const total = songSteps(bars);
  const expanded = unrollNotes(track.notes ?? [], track.steps || total, total);
  const split = cutNotesAt(cutNotesAt(expanded, part[0]).notes, part[1]).notes;
  return {
    notes: deleteRegion(split, part), steps: total, activeRegion: undefined,
    ...(track.pads ? { pads: track.pads.map(pad => {
      const length = Math.max(1, pad.steps.length);
      const repeat = (values: number[] | undefined) => values ? Array.from({ length: total }, (_, i) => values[i % length] ?? 0) : undefined;
      return { ...pad, steps: Array.from({ length: total }, (_, i) => i >= part[0] && i < part[1] ? 0 : pad.steps[i % length] ?? 0), probability: repeat(pad.probability), stepPitch: repeat(pad.stepPitch), stepDecay: repeat(pad.stepDecay), flam: repeat(pad.flam), retrig: repeat(pad.retrig), glitch: repeat(pad.glitch) };
    }) } : {}),
  };
}