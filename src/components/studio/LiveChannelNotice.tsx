import { AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useStudio } from "@/lib/synclab/store";
import {
  audiblePatch,
  bypassDrive,
  checkBandPartner,
  checkLiveChannel,
  listNames,
  type SilentReason,
} from "@/lib/synclab/live-channel-check";
import type { Track } from "@/lib/synclab/types";
import { getDrummer } from "@/lib/synclab/drummer-player";
import { getKeysPlayer } from "@/lib/synclab/keyboardist-player";

/** The channel the other band player is on (Preview starts both), as that player follows it. */
function bandPartner(part: "drummer" | "keys", tracks: Track[]): Track | null {
  if (part === "drummer") {
    const id = getKeysPlayer().trackId;
    return tracks.find((t) => t.keyboardist && t.id === id) ?? tracks.find((t) => t.keyboardist) ?? null;
  }
  const id = getDrummer().trackId;
  return tracks.find((t) => t.drummer && t.id === id) ?? tracks.find((t) => t.drummer) ?? null;
}

const REASON_TEXT: Record<SilentReason, string> = {
  fader: "its fader is all the way down",
  muted: "it is muted",
  bypassed: "it is switched off (Bypass)",
  solo: "another channel is soloed",
};

/**
 * Shown on the Live Drummer / Live Keys panel when the player's own channel can't be heard or
 * has distortion effects on it, with a button that fixes exactly that on the channel.
 */
export function LiveChannelNotice({
  track,
  part,
  volume,
}: {
  track: Track;
  part: "drummer" | "keys";
  /** fader level "Turn it up" sets */
  volume: number;
}) {
  const { tracks, updateTrack } = useStudio();
  const { silent, drive } = checkLiveChannel(track, tracks);
  const partner = checkBandPartner(bandPartner(part, tracks), tracks);
  const partnerDrive = partner?.drive ?? [];
  if (!silent.length && !drive.length && !partnerDrive.length) return null;
  const who = part === "drummer" ? "the drummer" : "the keys";
  const other = part === "drummer" ? "the Live Keys" : "the Live Drummer";
  const clearSolo = () => {
    for (const t of tracks) if (t.solo && t.id !== track.id) updateTrack(t.id, { solo: false });
  };
  return (
    <div
      role="status"
      className="flex flex-col gap-2 rounded-md border border-amber/60 bg-amber/10 p-2.5 text-sm"
    >
      {silent.length > 0 && (
        <div className="flex flex-wrap items-center gap-2">
          <AlertTriangle className="size-4 shrink-0 text-amber" />
          <span className="min-w-0 flex-1">
            You won't hear {who}: on the channel <b>{track.name}</b>{" "}
            {listNames(silent.map((r) => REASON_TEXT[r]))}.
            {partner && ` Preview will only play ${other}.`}
          </span>
          {silent.some((r) => r !== "solo") && (
            <Button size="sm" onClick={() => updateTrack(track.id, audiblePatch(silent, volume))}>
              {silent.includes("fader") ? "Turn it up" : "Turn it on"}
            </Button>
          )}
          {silent.includes("solo") && (
            <Button size="sm" variant="outline" onClick={clearSolo}>
              Clear solo
            </Button>
          )}
        </div>
      )}
      {drive.length > 0 && (
        <div className="flex flex-wrap items-center gap-2">
          <AlertTriangle className="size-4 shrink-0 text-amber" />
          <span className="min-w-0 flex-1">
            {listNames(drive.map((p) => p.name))} {drive.length === 1 ? "is" : "are"} on this
            channel and distort {who}.
          </span>
          <Button
            size="sm"
            variant="outline"
            onClick={() => updateTrack(track.id, { plugins: bypassDrive(track.plugins ?? []) })}
          >
            Bypass {drive.length === 1 ? "it" : "them"}
          </Button>
        </div>
      )}
      {partner && partnerDrive.length > 0 && (
        <div className="flex flex-wrap items-center gap-2">
          <AlertTriangle className="size-4 shrink-0 text-amber" />
          <span className="min-w-0 flex-1">
            Preview also plays {other} on <b>{partner.track.name}</b>, which goes through{" "}
            {listNames(partnerDrive.map((p) => p.name))}
            {part === "drummer"
              ? " — that's the guitar-like sound you hear, not the drums."
              : ", so the drums sound distorted."}
          </span>
          <Button
            size="sm"
            variant="outline"
            onClick={() =>
              updateTrack(partner.track.id, { plugins: bypassDrive(partner.track.plugins ?? []) })
            }
          >
            Bypass {partnerDrive.length === 1 ? "it" : "them"}
          </Button>
        </div>
      )}
    </div>
  );
}
