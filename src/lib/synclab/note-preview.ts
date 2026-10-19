import type { SynthPatch, Track } from "./types";

/** A preset audition uses its explicit patch even before React commits the track edit. */
export function previewTrack(track: Track, patch?: SynthPatch): Track {
  return patch ? { ...track, patch } : track;
}