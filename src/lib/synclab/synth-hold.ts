import { useSyncExternalStore } from "react";
import type { Track } from "./types";

/**
 * HOLD (latch) for synth channels: while it is on, notes you play keep sounding after you
 * let go of the key, like a held sustain pedal, until HOLD is switched off, the same key is
 * played again, or Stop is pressed. Session-only, per channel — never stored in the song.
 */
export const HELD_NOTE_SECONDS = 600;

const holding = new Set<string>();
/** Raw played pitches (before octave/MIDI effects) still latched per channel. */
const latched = new Map<string, Set<number>>();
const listeners = new Set<() => void>();
type ReleaseHandler = (trackId: string, pitches: number[]) => void;
const releaseHandlers = new Set<ReleaseHandler>();

const emit = () => {
  for (const fn of listeners) fn();
};

/** Only synth channels hold notes; samplers, drums and audio channels do not. */
export function canHold(track: Pick<Track, "kind" | "patch"> | null | undefined): boolean {
  return !!track && !!track.patch && (track.kind === "instrument" || track.kind === "midi");
}

export function isHoldOn(trackId: string): boolean {
  return holding.has(trackId);
}

export function holdApplies(
  track: Pick<Track, "kind" | "patch" | "id"> | null | undefined,
): boolean {
  return !!track && canHold(track) && holding.has(track.id);
}

/** How long a hand-played note sounds: until released when HOLD is on, otherwise `base`. */
export function liveNoteSeconds(
  track: Pick<Track, "kind" | "patch" | "id"> | null | undefined,
  base: number,
): number {
  return holdApplies(track) ? HELD_NOTE_SECONDS : base;
}

export function latchPitch(trackId: string, pitch: number) {
  const set = latched.get(trackId) ?? new Set<number>();
  set.add(pitch);
  latched.set(trackId, set);
}

export function latchedPitches(trackId: string): number[] {
  return [...(latched.get(trackId) ?? [])];
}

/** Lets go of every latched note (one channel, or all when no ID is given) without changing HOLD. */
export function releaseLatched(trackId?: string) {
  const ids = trackId ? [trackId] : [...latched.keys()];
  for (const id of ids) {
    const pitches = latchedPitches(id);
    latched.delete(id);
    for (const fn of releaseHandlers) fn(id, pitches);
  }
}

export function setHold(trackId: string, on: boolean) {
  if (on === holding.has(trackId)) return;
  if (on) holding.add(trackId);
  else {
    holding.delete(trackId);
    releaseLatched(trackId);
  }
  emit();
}

export function toggleHold(trackId: string) {
  setHold(trackId, !holding.has(trackId));
}

/** Called with the channel and its latched pitches whenever held notes are let go. */
export function onHoldRelease(fn: ReleaseHandler): () => void {
  releaseHandlers.add(fn);
  return () => {
    releaseHandlers.delete(fn);
  };
}

export function subscribeHold(fn: () => void): () => void {
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
}

export function useSynthHold(trackId: string | null | undefined): boolean {
  return useSyncExternalStore(
    subscribeHold,
    () => (trackId ? holding.has(trackId) : false),
    () => false,
  );
}

/** Test helper: forget every hold and latch. */
export function resetSynthHold() {
  holding.clear();
  latched.clear();
  emit();
}
