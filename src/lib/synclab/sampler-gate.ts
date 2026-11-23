/**
 * Key release for the Sampler, Pad Sampler and Video Sampler: new sounds start in Gate mode
 * (the sound stops when you let go of the key, pad or MIDI note); One-shot plays to the end.
 * Older saved sounds keep the mode they were saved with.
 */
import { multiPitchVoiceKeys } from "./multi-pitch";
import type { SamplerState } from "./types";

/** Longest a held Gate note may sound; letting go of the key normally ends it much sooner. */
export const GATE_HOLD_SECONDS = 30;
/** Recorded Gate notes start this short; letting go gives them the length you held the key. */
export const GATE_RECORD_BASE_SECONDS = 0.05;
/** Saved video kits carry this so older kits (saved before Gate was the default) stay One-shot. */
export const KEY_RELEASE_VERSION = 1;

/** True when letting go of the key stops the sound (Gate mode, or a looping sound). */
export function stopsOnRelease(s: { oneShot?: boolean | undefined; loop?: boolean | undefined } | null | undefined) {
  return !!s && (s.oneShot === false || !!s.loop);
}

/** Voice keys a hand-played Sampler note uses, so its key release stops exactly that note. */
export function liveSampleVoiceKeys(
  s: Pick<SamplerState, "rootNote" | "slices" | "chopChoke" | "multiPitch"> | undefined,
  midi: number,
): string[] {
  if (!s) return [];
  if (s.multiPitch && s.multiPitch.mode !== "off") return multiPitchVoiceKeys(`mp-${midi}`);
  const chops = s.slices ?? [];
  const idx = midi - s.rootNote;
  if (chops.length > 0 && idx >= 0 && idx < chops.length)
    return [s.chopChoke ? `chop-choke-${s.chopChoke}` : `chop-${idx}`];
  return [`note-${midi}`];
}

/**
 * Video kit chop sounds as loaded: kits saved before Gate became the default keep One-shot for
 * every chop that never chose a mode; newer kits use what was saved.
 */
export function loadedVideoChopSounds<T extends { oneShot?: boolean | undefined }>(
  sounds: (T | null)[] | undefined,
  chopCount: number,
  keyRelease: number | undefined,
): (T | Partial<T> | null)[] {
  const list = sounds ?? [];
  if ((keyRelease ?? 0) >= KEY_RELEASE_VERSION) return list;
  return Array.from({ length: Math.max(chopCount, list.length) }, (_, i) => {
    const sound = list[i];
    if (sound && sound.oneShot !== undefined) return sound;
    return { ...(sound ?? {}), oneShot: true } as Partial<T>;
  });
}
