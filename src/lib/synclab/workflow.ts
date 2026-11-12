import { clipSeconds, type AudioClip, type Track } from './types';
import { songSteps, stepSeconds } from './timebase';
import { regionAt, unrollNotes, cutNotesAt, deleteRegion } from './note-cuts';
import { timelineUsesWaveform } from './timeline-content';

/**
 * Only an explicitly selected audio clip that the lane is showing is an editing target. A channel
 * showing its notes/drum parts can still hold an older recorded take; tapping a note block must
 * never delete that hidden take instead of the block.
 */
export function selectedClip(track: Track | null | undefined) {
  if (!track || !timelineUsesWaveform(track)) return undefined;
  return track.clips?.find((clip) => clip.id === track.activeClipId);
}

/** A copy of the clip placed so it starts exactly where the original ends (no rounding gap). */
export function clipCopyAfter<C extends AudioClip>(clip: C, stepDur: number, newId: string): C {
  return { ...clip, id: newId, name: `${clip.name} COPY`, start: (clip.start ?? 0) + clipSeconds(clip) / stepDur };
}

export function selectedPartBounds(track: Track | null | undefined, bpm: number, bars: number, loop?: [number, number]): [number, number] | null {
  if (!track) return null;
  const clip = selectedClip(track);
  if (clip) return [clip.start ?? 0, (clip.start ?? 0) + clipSeconds(clip) / stepSeconds(bpm)];
  if (track.activeRegion == null) return null;
  const raw = regionAt(track.cuts, songSteps(bars), track.activeRegion);
  // A cut block is exactly what the timeline draws, so it is deleted whole wherever the loop is;
  // only an uncut, song-long pattern is narrowed to the loop so other bars survive.
  const region: [number, number] = loop && !track.cuts?.length ? [Math.max(raw[0], loop[0]), Math.min(raw[1], loop[1])] : raw;
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
  return eraseMaterial(track, part, bars);
}

/** Notes and drum hits inside [part) are erased; repeating material is expanded first so other bars survive. */
function eraseMaterial(track: Track, part: [number, number], bars: number): Partial<Track> {
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
/**
 * Deleting a recorded take (waveform block) on an instrument, drum or sampler channel also erases the
 * notes/hits it was recorded from inside the block's span, so nothing is left hiding underneath.
 * Audio-only channels just lose the clip.
 */
export function removeTakeAndMaterial(track: Track, clipId: string, bpm: number, bars: number): Partial<Track> {
  const clip = track.clips?.find((c) => c.id === clipId);
  const clips = (track.clips ?? []).filter((c) => c.id !== clipId);
  const base: Partial<Track> = { clips, activeClipId: track.activeClipId === clipId ? undefined : track.activeClipId };
  const noteKind = track.kind === 'instrument' || track.kind === 'midi' || track.kind === 'drum' || track.kind === 'sampler';
  if (!clip || !noteKind || !timelineUsesWaveform(track)) return base;
  const from = clip.start ?? 0;
  const part: [number, number] = [from, from + clipSeconds(clip) / stepSeconds(bpm)];
  return { ...base, ...eraseMaterial(track, part, bars), ...(clips.length ? {} : { printedAudio: false }) };
}
