import type { PluginInstance, Track } from "./types";

/**
 * Why a Live Drummer / Live Keys channel can't be heard, or sounds distorted, read straight from
 * the channel's own settings (fader, mute, bypass, solo, inserted effects). The panels show these
 * with a one-press fix, because the cause usually sits on another screen (the mixer or effects rack).
 */

/** Fader level a new Live Drummer channel starts at (≈ −8 dB): leaves headroom so its kits don't clip the master. */
export const DRUMMER_CHANNEL_VOLUME = 0.4;
/** Fader level a new Live Keys channel starts at (the normal channel default). */
export const KEYS_CHANNEL_VOLUME = 0.8;

/** Effects that add drive / distortion on purpose (pedals, amps, drive and crush units). */
export const DRIVE_KINDS: readonly string[] = [
  "drive",
  "bitcrusher",
  "overdrive",
  "fuzz",
  "amp",
  "leadamp",
  "bassamp",
  "mustang",
  "distmatrix",
  "demolition",
];

export type SilentReason = "fader" | "muted" | "bypassed" | "solo";

export interface LiveChannelCheck {
  /** reasons the channel makes no sound, in the order to fix them */
  silent: SilentReason[];
  /** active (not bypassed) effects on the channel that distort it */
  drive: PluginInstance[];
}

export function checkLiveChannel(track: Track, tracks: Track[]): LiveChannelCheck {
  const silent: SilentReason[] = [];
  if (!(track.volume > 0.001)) silent.push("fader");
  if (track.muted) silent.push("muted");
  if (track.deviceBypassed) silent.push("bypassed");
  if (!track.solo && tracks.some((t) => t.id !== track.id && t.solo)) silent.push("solo");
  const drive = (track.plugins ?? []).filter((p) => !p.bypass && DRIVE_KINDS.includes(p.kind));
  return { silent, drive };
}

/** The channel settings that make it audible again (for "fader": the given level). */
export function audiblePatch(reasons: SilentReason[], volume: number): Partial<Track> {
  const patch: Partial<Track> = {};
  if (reasons.includes("fader")) patch.volume = volume;
  if (reasons.includes("muted")) patch.muted = false;
  if (reasons.includes("bypassed")) patch.deviceBypassed = false;
  return patch;
}

/** The channel's effects with every distorting one switched to bypass (others untouched). */
export function bypassDrive(plugins: PluginInstance[]): PluginInstance[] {
  return plugins.map((p) =>
    !p.bypass && DRIVE_KINDS.includes(p.kind) ? { ...p, bypass: true } : p,
  );
}

/** "Fuzz Pedal, Overdrive Pedal and Lead Guitar Amp" */
export function listNames(names: string[]): string {
  if (names.length <= 1) return names[0] ?? "";
  return `${names.slice(0, -1).join(", ")} and ${names[names.length - 1]}`;
}

/**
 * The other band part a Preview also starts (Live Keys for the drummer, Live Drummer for the keys),
 * when it will be heard, with any distorting effects on its channel — so a guitar-like sound from the
 * keys' pedals isn't mistaken for the drummer (and vice versa).
 */
export function checkBandPartner(
  partner: Track | null | undefined,
  tracks: Track[],
): { track: Track; drive: PluginInstance[] } | null {
  if (!partner) return null;
  const { silent, drive } = checkLiveChannel(partner, tracks);
  if (silent.length) return null;
  return { track: partner, drive };
}
