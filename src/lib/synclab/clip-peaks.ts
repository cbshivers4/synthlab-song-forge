import type { AudioClip } from "./types";

/** Older razor cuts stored peaks already cropped to the piece (ids end in -a/-b + timestamp). */
const LEGACY_SPLIT = /-[ab]\d{12,}$/;

/** Source-file seconds the clip's stored peaks cover. */
export function peaksSpanOf(
  clip: Pick<AudioClip, "id" | "duration" | "offset" | "length" | "peaksSpan">,
): [number, number] {
  if (clip.peaksSpan) return clip.peaksSpan;
  const offset = clip.offset ?? 0;
  if (LEGACY_SPLIT.test(clip.id))
    return [offset, offset + (clip.length ?? Math.max(0, clip.duration - offset))];
  return [0, clip.duration];
}

/**
 * Peaks for the part of the file the clip actually plays ([offset, offset + length]),
 * so the drawn waveform lines up with what is heard (a trimmed lead-in is not drawn).
 * Parts of the window outside the stored peaks are drawn as silence.
 */
export function visibleClipPeaks(
  clip: Pick<
    AudioClip,
    "id" | "peaks" | "duration" | "offset" | "length" | "reverse" | "peaksSpan"
  >,
): number[] {
  const peaks = clip.peaks;
  if (peaks.length === 0) return peaks;
  const [s0, s1] = peaksSpanOf(clip);
  const span = Math.max(1e-6, s1 - s0);
  const perSec = peaks.length / span;
  const from = clip.offset ?? 0;
  const to = from + Math.max(0, clip.length ?? clip.duration - from);
  const a = (from - s0) * perSec;
  const b = (to - s0) * perSec;
  const out: number[] = [];
  const lead = Math.max(0, Math.round(-a));
  for (let i = 0; i < lead; i++) out.push(0);
  const lo = Math.max(0, Math.floor(a));
  const hi = Math.min(peaks.length, Math.max(lo + 1, Math.ceil(b)));
  for (let i = lo; i < hi; i++) out.push(peaks[i] ?? 0);
  const tail = Math.max(0, Math.round(b - peaks.length));
  for (let i = 0; i < tail; i++) out.push(0);
  if (out.length < 2) out.push(out[0] ?? 0);
  return clip.reverse ? out.reverse() : out;
}
