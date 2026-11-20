import type { Track } from "./types";

/** The razor must edit the same representation that the arrangement displays. */
export function timelineUsesWaveform(
  track: Pick<Track, "kind" | "clips" | "printedAudio" | "clipView">,
): boolean {
  if (!track.clips?.length) return false;
  if (track.clipView === "wave") return true;
  if (track.clipView === "notes") {
    return !(
      track.kind === "instrument" ||
      track.kind === "midi" ||
      track.kind === "sampler" ||
      track.kind === "drum"
    );
  }
  if (
    track.kind === "instrument" ||
    track.kind === "midi" ||
    track.kind === "sampler" ||
    track.kind === "drum"
  ) {
    return !!track.printedAudio;
  }
  return true;
}
