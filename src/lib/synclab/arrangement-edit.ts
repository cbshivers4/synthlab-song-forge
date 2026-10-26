import type { AudioClip, Track } from './types';
import { clipRate, clipSeconds } from './types';
import { uid } from './presets';

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

/** Paste material, not channel settings; even the source channel is a valid target. */
export function pasteTrackContent(target: Track, source: Track, at: number, stepDuration: number): Track {
  const drumSource = hasHits(source);
  const [srcA, srcB] = drumSpan(source);
  const origin = Math.min(...(source.clips ?? []).map(c => c.start ?? 0), ...(source.notes ?? []).map(n => n.step), ...(drumSource ? [srcA] : []));
  const shift = Math.max(0, at) - (Number.isFinite(origin) ? origin : 0);
  const clips = (source.clips ?? []).map(c => ({ ...structuredClone(c), id: uid(), start: (c.start ?? 0) + shift }));
  const sourceLength = drumSource ? srcB - srcA : source.steps;
  const end = Math.max(at + sourceLength, ...clips.map(c => (c.start ?? 0) + clipSeconds(c) / stepDuration), ...(source.notes ?? []).map(n => n.step + shift + n.length));
  const notes = (source.notes ?? []).map(n => ({ ...n, id: uid(), step: n.step + shift, recordedEnd: n.recordedEnd !== undefined ? n.recordedEnd + shift : end }));
  const steps = Math.max(target.steps, Math.ceil(end));
  const start = Math.max(0, Math.round(at));
  // A pattern region hides and silences hits outside it, so pasted drums must widen it;
  // hits it already hid are inaudible and invisible, so they are cleared rather than revealed.
  const region = target.patternRegion;
  const pads = target.pads?.map((pad, i) => {
    const values = Array.from({ length: steps }, (_, s) =>
      region && (s < region[0] || s >= region[1]) ? 0 : pad.steps[s % Math.max(1, pad.steps.length)] ?? 0);
    const src = source.pads?.[i]?.steps ?? [];
    for (let s = srcA; s < srcB; s++) { const v = src[s] ?? 0; if (v > 0) values[start + s - srcA] = v; }
    return { ...pad, steps: values };
  });
  const pastedDrums = !!pads && drumSource;
  const patternRegion: [number, number] | undefined = pastedDrums
    ? [region ? Math.min(region[0], start) : 0, Math.max(region?.[1] ?? 0, start + sourceLength)]
    : target.patternRegion;
  return { ...target, steps, notes: [...(target.notes ?? []), ...notes], clips: [...(target.clips ?? []), ...clips], pads, patternRegion,
    activeClipId: clips[0]?.id ?? target.activeClipId,
    ...(clips.length && ['instrument', 'midi', 'drum', 'sampler'].includes(target.kind) ? { printedAudio: true } : {}) };
}

/**
 * Where a track's material ends. A drum pattern with a region ends there; one without
 * loops across the timeline, so pass `shownEnd` (the end the timeline draws it to).
 */
export function materialEnd(track: Track, stepDuration: number, shownEnd?: number): number {
  const drums = track.kind === 'drum' && hasHits(track);
  const base = drums ? (track.patternRegion?.[1] ?? shownEnd ?? track.steps) : track.steps;
  return Math.max(base, ...(track.notes ?? []).map(n => n.step + n.length), ...(track.clips ?? []).map(c => (c.start ?? 0) + clipSeconds(c) / stepDuration));
}

/** Reveal source audio when available; beyond the source end, stretch the selected audio. */
export function rightEdgeEdit(clip: AudioClip, deltaSeconds: number, barSeconds: number, fine: boolean) {
  const current = clipSeconds(clip);
  const raw = current + deltaSeconds;
  const seconds = Math.max(0.05, fine ? raw : Math.max(barSeconds, Math.round(raw / barSeconds) * barSeconds));
  const available = (clip.duration - (clip.offset ?? 0)) / clipRate(clip);
  return { seconds, length: Math.min(clip.duration - (clip.offset ?? 0), seconds * clipRate(clip)), stretch: seconds > available + 0.001 ? seconds / current : null };
}