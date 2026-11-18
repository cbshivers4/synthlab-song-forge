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
  const notes = track.notes ?? [];
  const recordedOnly = notes.length > 0 && notes.every((note) => note.recordedEnd != null) && !track.patternRegion;
  // The part is exactly the block the timeline draws, wherever the loop markers are: narrowing a
  // song-long block to the loop left its later bars behind as a block that Delete could never reach.
  void loop;
  const region: [number, number] = raw;
  if (region[1] <= region[0]) return null;
  if (track.patternRegion) return [Math.max(region[0], track.patternRegion[0]), Math.min(region[1], track.patternRegion[1])];
  if (recordedOnly) {
    return [Math.max(region[0], Math.min(...notes.map((note) => note.step))), Math.min(region[1], Math.max(...notes.map((note) => note.recordedEnd ?? songSteps(bars))))];
  }
  return region;
}

/** Material-only deletion: expand repeats before erasing so sibling bars survive. */
export function deleteSelectedPart(track: Track | null | undefined, bpm: number, bars: number, loop?: [number, number]): Partial<Track> | null {
  if (!track) return null;
  const clip = selectedClip(track);
  // a recorded waveform block takes the notes/hits it was made from with it
  if (clip) return removeTakeAndMaterial(track, clip.id, bpm, bars);
  const part = selectedPartBounds(track, bpm, bars, loop);
  if (!part) return null;
  return eraseMaterial(track, part, bars);
}

/**
 * Notes and drum hits inside [part) are erased; repeating material is expanded first so other bars survive.
 * `whole` (a recorded take): every note that starts in the block goes entirely, including a ring-out past
 * its end, and edges tolerate the sub-step offset a take can start or end at, so no sliver is left behind.
 */
function eraseMaterial(track: Track, part: [number, number], bars: number, whole = false): Partial<Track> {
  const total = songSteps(bars);
  const expanded = unrollNotes(track.notes ?? [], track.steps || total, total);
  const from = whole ? Math.max(0, part[0] - 0.05) : part[0];
  const notes = whole
    ? cutNotesAt(expanded, from).notes.filter((n) => n.step < from - 0.001 || n.step >= part[1] - 0.001)
    : deleteRegion(cutNotesAt(cutNotesAt(expanded, part[0]).notes, part[1]).notes, part);
  const hitIn = (i: number) => whole ? i > part[0] - 0.5 && i < part[1] - 0.001 : i >= part[0] && i < part[1];
  return {
    notes, steps: total, activeRegion: undefined,
    ...(track.pads ? { pads: track.pads.map(pad => {
      const length = Math.max(1, pad.steps.length);
      const repeat = (values: number[] | undefined) => values ? Array.from({ length: total }, (_, i) => values[i % length] ?? 0) : undefined;
      return { ...pad, steps: Array.from({ length: total }, (_, i) => hitIn(i) ? 0 : pad.steps[i % length] ?? 0), probability: repeat(pad.probability), stepPitch: repeat(pad.stepPitch), stepDecay: repeat(pad.stepDecay), flam: repeat(pad.flam), retrig: repeat(pad.retrig), glitch: repeat(pad.glitch) };
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
  return { ...base, ...eraseMaterial(track, part, bars, true), ...(clips.length ? {} : { printedAudio: false }) };
}

/**
 * Cut on a channel never removes the channel itself (only an explicit Delete track does).
 * With a selected part the clipboard holds just that part's material and only that part is
 * erased; otherwise every clip, note and drum hit goes to the clipboard and the channel is
 * left empty, keeping its instrument, sound, effects and mixer settings.
 */
export function cutTrackMaterial(track: Track, bpm: number, bars: number, loop?: [number, number], boxed?: [number, number]): { clipboard: Track; patch: Partial<Track>; span?: [number, number] } {
  const clone = structuredCloneSafe(track);
  const clip = selectedClip(track);
  // A selection box names the blocks to cut; otherwise the selected part (or the whole channel).
  const boxPart: [number, number] | null = boxed && track.patternRegion
    ? [Math.max(boxed[0], track.patternRegion[0]), Math.min(boxed[1], track.patternRegion[1])]
    : boxed ?? null;
  const part = clip ? null : boxPart && boxPart[1] > boxPart[0] ? boxPart : selectedPartBounds(track, bpm, bars, loop);
  if (part) {
    const total = songSteps(bars);
    const expanded = unrollNotes(track.notes ?? [], track.steps || total, total);
    const split = cutNotesAt(cutNotesAt(expanded, part[0]).notes, part[1]).notes;
    const inside = split.filter((note) => note.step >= part[0] && note.step < part[1]);
    const hasHits = !!track.pads?.some((pad) => pad.steps.some((v) => v > 0));
    const clipboard: Track = {
      // Cut marks inside the part come along, so its separate blocks paste back as separate blocks.
      ...clone, clips: [], activeClipId: undefined, cuts: track.cuts?.filter((c) => c > part[0] && c < part[1]), activeRegion: undefined, printedAudio: false,
      notes: inside.map((note) => ({ ...note, recordedEnd: note.recordedEnd != null ? Math.min(note.recordedEnd, part[1]) : part[1] })),
      steps: Math.max(1, Math.ceil(part[1] - part[0])),
      ...(hasHits ? { patternRegion: part } : {}),
    };
    return { clipboard, patch: eraseMaterial(track, part, bars), span: part };
  }
  return {
    clipboard: clone,
    patch: {
      clips: [],
      notes: track.notes ? [] : track.notes,
      pads: track.pads?.map((pad) => ({ ...pad, steps: pad.steps.map(() => 0) })),
      drumPatterns: track.drumPatterns?.map((pattern) => pattern.map((pad) => ({ ...pad, steps: pad.steps.map(() => 0) }))),
      activeClipId: undefined, cuts: undefined, activeRegion: undefined, printedAudio: false, recording: false,
    },
  };
}

function structuredCloneSafe(t: Track): Track {
  try { return structuredClone(t); } catch { return JSON.parse(JSON.stringify(t)) as Track; }
}
