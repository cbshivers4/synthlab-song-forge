/**
 * Where a generated bassline goes on the timeline: only as far as the song's music reaches,
 * so an 8-bar beat gets an 8-bar bassline instead of one that keeps going to the song end.
 */
import type { MidiNote, Track } from "./types";
import { pasteEndStep } from "./arrangement-edit";
import { unrollNotes } from "./note-cuts";

/** Bars of music already on the timeline (other channels), rounded to the nearest bar; 0 when it is empty. */
export function songContentBars(tracks: Track[], barSteps: number, stepDuration: number, songBars: number, skipIds: string[] = []): number {
  let end = 0;
  const songEnd = Math.max(1, songBars) * barSteps;
  for (const t of tracks) {
    if (skipIds.includes(t.id) || t.name.startsWith("PREVIEW · ")) continue;
    // Each channel counts as long as its own beat/pattern (what you built), not the repeats the
    // timeline draws after it, so an older looping bassline doesn't make a new one fill the song.
    end = Math.max(end, Math.min(songEnd, pasteEndStep(t, stepDuration)));
  }
  // A beat that pokes a step or two past a bar line still counts as ending on that line.
  return end > 0 ? Math.max(1, Math.round(end / Math.max(1, barSteps))) : 0;
}

/**
 * Write a repeating bass phrase out across `fillBars`, then stop. The channel keeps the song's
 * length and a cut mark at the end of the fill, so playback and the timeline both end there.
 */
export function fitBassline(notes: MidiNote[], phraseSteps: number, fillBars: number, songBars: number, barSteps: number): Pick<Track, "steps" | "notes" | "cuts"> {
  const song = Math.max(1, songBars) * barSteps;
  const fill = Math.min(song, Math.max(1, fillBars) * barSteps);
  const written = unrollNotes(notes, Math.max(1, phraseSteps), fill)
    .filter((n) => n.step < fill - 0.001)
    .map((n) => ({ ...n, length: Math.min(n.length, fill - n.step) }));
  return { steps: song, notes: written, cuts: fill < song ? [fill] : [] };
}
