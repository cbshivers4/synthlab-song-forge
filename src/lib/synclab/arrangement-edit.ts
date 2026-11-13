import type { AudioClip, MidiNote, Track } from './types';
import { clipRate, clipSeconds } from './types';
import { uid } from './presets';
import { unrollNotes } from './note-cuts';
import { stepsPerBar } from './timebase';

/** A clicked destination is independent of the moving transport playhead. */
export function timelinePasteStep(playhead: number, destination?: number): number {
  return Math.max(0, destination ?? playhead);
}

const hasHits = (t: Track) => !!t.pads?.some(p => p.steps.some(v => v > 0));

/** The part of a drum pattern that actually plays: its pattern region, else the whole pattern. */
function drumSpan(t: Track): [number, number] {
  const len = Math.max(1, t.pads?.[0]?.steps.length ?? t.steps);
  return t.patternRegion ? [Math.max(0, t.patternRegion[0]), Math.max(t.patternRegion[0], t.patternRegion[1])] : [0, len];
}

export interface PasteOptions {
  /** Left edge of the copied part (not its first note), so pasted notes keep their place in the bar. */
  origin?: number;
  /** Length of the copied part in steps. */
  length?: number;
  /**
   * The song end the timeline shows before the paste. Repeating material already on the target is
   * kept exactly as it looked up to there, so a paste further out never shifts or re-tiles it.
   */
  shownEnd?: number;
}

/** Paste material, not channel settings; even the source channel is a valid target. */
export function pasteTrackContent(target: Track, source: Track, at: number, stepDuration: number, opts: PasteOptions = {}): Track {
  const drumSource = hasHits(source);
  const [srcA, srcB] = drumSpan(source);
  const first = Math.min(...(source.clips ?? []).map(c => c.start ?? 0), ...(source.notes ?? []).map(n => n.step), ...(drumSource ? [srcA] : []));
  const origin = opts.origin ?? (Number.isFinite(first) ? first : 0);
  const shift = Math.max(0, at) - origin;
  const clips = (source.clips ?? []).map(c => ({ ...structuredClone(c), id: uid(), start: (c.start ?? 0) + shift }));
  const sourceLength = opts.length ?? (drumSource ? srcB - srcA : source.steps);
  const end = Math.max(at + sourceLength, ...clips.map(c => (c.start ?? 0) + clipSeconds(c) / stepDuration), ...(source.notes ?? []).map(n => n.step + shift + n.length));
  const notes = (source.notes ?? []).map(n => ({ ...n, id: uid(), step: n.step + shift, recordedEnd: n.recordedEnd !== undefined ? n.recordedEnd + shift : end }));
  let steps = Math.max(target.steps, Math.ceil(end));
  // A repeating synth pattern loops every `steps`. Growing that length would make it repeat at a new,
  // off-bar spot (bars 2-4 go quiet, bar 6 replays bar 1), so it is first written out as it was
  // shown, and the loop length stays a whole number of bars.
  let kept = target.notes ?? [];
  if (notes.length && kept.some(n => n.recordedEnd == null)) {
    const shown = Math.max(target.steps, opts.shownEnd ?? target.steps);
    const spb = stepsPerBar();
    steps = Math.ceil(Math.max(steps, shown) / spb) * spb;
    if (steps !== target.steps) kept = unrollNotes(kept, target.steps, shown);
  }
  const start = Math.max(0, Math.round(at));
  // A pattern region hides and silences hits outside it, so pasted drums must widen it;
  // hits it already hid are inaudible and invisible, so they are cleared rather than revealed.
  const region = target.patternRegion;
  // A looping beat is kept as far as the timeline showed it; past that the bars before the paste stay empty.
  const shownDrums = region ? undefined : opts.shownEnd;
  const pads = target.pads?.map((pad, i) => {
    const values = Array.from({ length: steps }, (_, s) =>
      (region && (s < region[0] || s >= region[1])) || (shownDrums != null && s >= Math.max(shownDrums, pad.steps.length))
        ? 0 : pad.steps[s % Math.max(1, pad.steps.length)] ?? 0);
    const src = source.pads?.[i]?.steps ?? [];
    // The timeline tiles a short pattern across its part, so copy the tiled hits: the copy is as long as the part you see.
    for (let s = srcA; s < srcB; s++) { const v = src[s % Math.max(1, src.length)] ?? 0; if (v > 0) values[start + s - srcA] = v; }
    return { ...pad, steps: values };
  });
  const pastedDrums = !!pads && drumSource;
  const patternRegion: [number, number] | undefined = pastedDrums
    ? [region ? Math.min(region[0], start) : 0, Math.max(region?.[1] ?? shownDrums ?? 0, start + sourceLength)]
    : target.patternRegion;
  // Like a pasted synth take, a pasted beat is its own part: cut marks at both edges separate it.
  const cuts = pastedDrums ? [...new Set([...(target.cuts ?? []), start, start + sourceLength])].sort((a, b) => a - b) : target.cuts;
  return { ...target, steps, notes: [...kept, ...notes], clips: [...(target.clips ?? []), ...clips], pads, patternRegion, cuts,
    activeClipId: clips[0]?.id ?? target.activeClipId,
    ...(clips.length && ['instrument', 'midi', 'drum', 'sampler'].includes(target.kind) ? { printedAudio: true } : {}) };
}

/**
 * What a copy of a note channel takes: the part you see (or the selected part between cut marks).
 * A repeating pattern is written out across that part, so the copy is as long as what the timeline
 * draws and keeps each note's place in the bar. Returns null when every note is already a recorded
 * (absolute) take, which copies as-is.
 */
export function noteCopy(track: Track, shown: [number, number]): { notes: MidiNote[]; span: [number, number] } | null {
  const notes = track.notes ?? [];
  if (!notes.some(n => n.recordedEnd == null)) return null;
  const span = drumCopySpan(track, shown);
  const inside = unrollNotes(notes, track.steps || span[1], span[1])
    .filter(n => n.step >= span[0] - 0.001 && n.step < span[1] - 0.001)
    .map(n => ({ ...n, length: Math.min(n.length, span[1] - n.step), recordedEnd: n.recordedEnd ?? span[1] }));
  return { notes: inside, span };
}

/**
 * Where a track's material ends. A drum pattern with a region ends there; one without
 * loops across the timeline, so pass `shownEnd` (the end the timeline draws it to).
 */
export function materialEnd(track: Track, stepDuration: number, shownEnd?: number): number {
  // A printed drum track shows and plays its audio clips, so its end is the last clip, not the looping pattern.
  const printed = !!track.printedAudio && !!track.clips?.length;
  const drums = track.kind === 'drum' && hasHits(track) && !printed;
  const base = drums ? (track.patternRegion?.[1] ?? shownEnd ?? track.steps) : printed ? 0 : track.steps;
  return Math.max(base, ...(track.notes ?? []).map(n => n.step + n.length), ...(track.clips ?? []).map(c => (c.start ?? 0) + clipSeconds(c) / stepDuration));
}

/** Reveal source audio when available; beyond the source end, stretch the selected audio. */
export function rightEdgeEdit(clip: AudioClip, deltaSeconds: number, barSeconds: number, fine: boolean, alwaysStretch = false) {
  const current = clipSeconds(clip);
  const raw = current + deltaSeconds;
  const seconds = Math.max(0.05, fine ? raw : Math.max(barSeconds, Math.round(raw / barSeconds) * barSeconds));
  const available = (clip.duration - (clip.offset ?? 0)) / clipRate(clip);
  // Drum blocks stretch their audio to whatever length the block is dragged to.
  if (alwaysStretch) return { seconds, length: clip.length ?? clip.duration, stretch: Math.abs(seconds - current) > 0.001 ? seconds / current : null };
  return { seconds, length: Math.min(clip.duration - (clip.offset ?? 0), seconds * clipRate(clip)), stretch: seconds > available + 0.001 ? seconds / current : null };
}
/**
 * Move one drum part [a, b) so it starts at `to`, like dragging a synth take.
 * Hits outside the part stay; the moved hits replace whatever was at the destination.
 */
export function moveDrumPart(track: Track, a: number, b: number, to: number): Partial<Track> {
  const len = Math.max(1, Math.round(b - a));
  const from = Math.round(a);
  const dest = Math.max(0, Math.round(to));
  const region = track.patternRegion;
  const padLen = Math.max(1, track.pads?.[0]?.steps.length ?? track.steps);
  const steps = Math.max(track.steps, padLen, dest + len);
  const pads = track.pads?.map(pad => {
    const plen = Math.max(1, pad.steps.length);
    const values = Array.from({ length: steps }, (_, s) => region && (s < region[0] || s >= region[1]) ? 0 : pad.steps[s % plen] ?? 0);
    const part = values.slice(from, from + len);
    for (let s = from; s < from + len; s++) values[s] = 0;
    for (let i = 0; i < len; i++) values[dest + i] = part[i] ?? 0;
    return { ...pad, steps: values };
  });
  const lo = Math.min(region?.[0] ?? 0, dest), hi = Math.max(region?.[1] ?? padLen, dest + len);
  const cuts = [...new Set([...(track.cuts ?? []).filter(c => c <= dest || c >= dest + len), from, from + len, dest, dest + len])].sort((x, y) => x - y);
  return { pads, steps, cuts, patternRegion: [lo, hi], activeRegion: dest };
}

/** The part of a drum track a copy should take: the selected part between cut marks, else what the timeline shows. */
export function drumCopySpan(track: Track, shown: [number, number]): [number, number] {
  const bounds = track.patternRegion ?? shown;
  const cuts = (track.cuts ?? []).filter(c => c > bounds[0] && c < bounds[1]).sort((a, b) => a - b);
  const edges = [bounds[0], ...cuts, bounds[1]];
  const at = track.activeRegion;
  if (at != null && cuts.length) {
    for (let i = 0; i < edges.length - 1; i++) if (at >= edges[i]! - 0.001 && at < edges[i + 1]! - 0.001) return [edges[i]!, edges[i + 1]!];
  }
  return bounds;
}

/**
 * Stretch one drum part [a, b) to `newLength` steps, like stretching audio: every hit keeps its
 * relative position in the part. Hits outside the part stay where they are.
 */
export function stretchDrumPart(track: Track, a: number, b: number, newLength: number): Partial<Track> {
  const from = Math.round(a);
  const len = Math.max(1, Math.round(b - a));
  const next = Math.max(1, Math.round(newLength));
  const region = track.patternRegion;
  const padLen = Math.max(1, track.pads?.[0]?.steps.length ?? track.steps);
  const steps = Math.max(track.steps, padLen, from + next, from + len);
  const factor = next / len;
  const pads = track.pads?.map(pad => {
    const plen = Math.max(1, pad.steps.length);
    const values = Array.from({ length: steps }, (_, s) => region && (s < region[0] || s >= region[1]) ? 0 : pad.steps[s % plen] ?? 0);
    const part = values.slice(from, from + len);
    for (let s = from; s < from + Math.max(len, next); s++) values[s] = 0;
    part.forEach((v, i) => {
      if (v <= 0) return;
      const to = from + Math.min(next - 1, Math.round(i * factor));
      values[to] = Math.max(values[to] ?? 0, v);
    });
    return { ...pad, steps: values };
  });
  const lo = Math.min(region?.[0] ?? 0, from), hi = Math.max(region?.[1] ?? padLen, from + next);
  const cuts = [...new Set([...(track.cuts ?? []).filter(c => c <= from || c >= from + Math.max(len, next)), from, from + next])].sort((x, y) => x - y);
  return { pads, steps, cuts, patternRegion: [lo, hi], activeRegion: from };
}

/**
 * Trim or extend one drum part [a, b) to [newA, newB): hits inside the new edges stay where they
 * are, hits trimmed off are removed (Undo brings them back). It never grows into a neighbouring part.
 */
export function trimDrumPart(track: Track, a: number, b: number, newA: number, newB: number): Partial<Track> {
  const from = Math.max(0, Math.round(Math.min(newA, b - 1)));
  const to = Math.max(from + 1, Math.round(newB));
  const lo0 = Math.round(a), hi0 = Math.round(b);
  const region = track.patternRegion;
  const padLen = Math.max(1, track.pads?.[0]?.steps.length ?? track.steps);
  const steps = Math.max(track.steps, padLen, to, hi0);
  const pads = track.pads?.map(pad => {
    const plen = Math.max(1, pad.steps.length);
    const values = Array.from({ length: steps }, (_, s) => region && (s < region[0] || s >= region[1]) ? 0 : pad.steps[s % plen] ?? 0);
    for (let s = lo0; s < hi0; s++) if (s < from || s >= to) values[s] = 0;
    return { ...pad, steps: values };
  });
  const lo = Math.min(region?.[0] ?? 0, from), hi = Math.max(region?.[1] ?? padLen, to);
  const keep = [lo0, hi0].filter(c => c < from || c > to);
  const cuts = [...new Set([...(track.cuts ?? []).filter(c => c <= from || c >= to), ...keep, from, to])].sort((x, y) => x - y);
  return { pads, steps, cuts, patternRegion: [lo, hi], activeRegion: from };
}

/** Free steps around drum part [a, b): from the nearest part with hits on the left to the nearest on the right. */
export function drumPartRoom(track: Track, parts: [number, number][], a: number, b: number, total: number): [number, number] {
  let lo = 0, hi = total;
  for (const [x, y] of parts) {
    if (x === a && y === b) continue;
    if (!track.pads?.some(p => p.steps.slice(Math.floor(x), Math.ceil(y)).some(v => v > 0))) continue;
    if (y <= a) lo = Math.max(lo, y);
    if (x >= b) hi = Math.min(hi, x);
  }
  return [lo, hi];
}
