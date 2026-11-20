import { uid } from "./presets";
import { clipRate, type AudioClip } from "./types";

/* Take-region helpers moved out of store.tsx unchanged; store.tsx re-exports them. */

/** Preserve the untouched portions of an older take when a new recording covers only part of it. */
/** Snaps where a finished take lands to the edit grid (defaults to the nearest step). */
export function snapRecStart(step: number, snap?: number): number {
  const g = snap && snap > 0 ? snap : 1;
  return Math.max(0, Math.round(step / g) * g);
}

export function replaceTakeRegion(
  clips: AudioClip[],
  start: number,
  end: number,
  stepDur: number,
): AudioClip[] {
  return clips.flatMap((clip) => {
    const from = clip.start ?? 0;
    const rate = clipRate(clip);
    const length = clip.length ?? clip.duration;
    const until = from + length / rate / stepDur;
    if (until <= start || from >= end) return [clip];
    const left = Math.max(0, Math.min(start, until) - from) * stepDur * rate;
    const right = Math.max(0, until - Math.max(end, from)) * stepDur * rate;
    const pieces: AudioClip[] = [];
    if (left > 0.01)
      pieces.push({
        ...clip,
        id: uid(),
        length: left,
        offset: (clip.offset ?? 0) + (clip.reverse ? length - left : 0),
        fadeOut: Math.min(clip.fadeOut ?? 0.01, left / rate / 2),
      });
    if (right > 0.01)
      pieces.push({
        ...clip,
        id: uid(),
        start: until - right / rate / stepDur,
        length: right,
        offset: (clip.offset ?? 0) + (clip.reverse ? 0 : length - right),
        fadeIn: Math.min(clip.fadeIn ?? 0.004, right / rate / 2),
      });
    return pieces;
  });
}

/** Older takes a new recording covers — kept on the new clip so the user can comp between them. */
export function coveredTakes(
  clips: AudioClip[],
  start: number,
  end: number,
  stepDur: number,
): AudioClip[] {
  const hit = clips.filter((c) => {
    const from = c.start ?? 0;
    const until = from + (c.length ?? c.duration) / clipRate(c) / stepDur;
    return until > start && from < end;
  });
  return [
    ...hit.map((c) => ({ ...c, alts: undefined })),
    ...hit.flatMap((c) => c.alts ?? []),
  ].slice(0, 12);
}
