import { useEffect, useSyncExternalStore } from "react";
import { CassetteTape, Disc3, DiscAlbum } from "lucide-react";
import { getReelRecorder } from "@/lib/synclab/reel-recorder";
import { getTapeMedia, useTapeMedia, type Medium } from "@/lib/synclab/tape-media";
import { ReelRecorder } from "./ReelRecorder";
import { CassetteDeck } from "./CassetteDeck";
import { CdBurner } from "./CdBurner";
import "./tape-cd.css";

const MACHINES: { id: Medium; label: string; icon: typeof Disc3 }[] = [
  { id: "reel", label: "Reel-to-reel", icon: Disc3 },
  { id: "cassette", label: "Cassette deck", icon: CassetteTape },
  { id: "cd", label: "CD burner", icon: DiscAlbum },
];

/**
 * Tape & CD Recorder: the reel-to-reel, a cassette deck and a CD burner share one tape engine,
 * so only one machine records or plays at a time and every take is real audio.
 */
export function TapeCdRecorder() {
  const media = useTapeMedia();
  const recorder = getReelRecorder();
  const tape = useSyncExternalStore(recorder.subscribe, recorder.getSnapshot, recorder.getSnapshot);
  // Leaving the recorder releases the input (keeping every tape, cassette and disc).
  useEffect(
    () => () => {
      void recorder.release();
    },
    [recorder],
  );
  // Song-master source: meters read the post-master taps while the machine is idle.
  useEffect(() => {
    recorder.setMasterMetering(tape.source === "song");
    return () => recorder.setMasterMetering(false);
  }, [recorder, tape.source]);
  const busy = tape.busy || !!media.burn;
  return (
    <div className="media-decks mx-auto flex w-full max-w-[900px] flex-col gap-3">
      <div
        role="tablist"
        aria-label="Recording machine"
        className="media-tabs grid grid-cols-3 gap-1 rounded-md border border-border bg-card p-1"
      >
        {MACHINES.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            type="button"
            role="tab"
            aria-selected={media.medium === id}
            disabled={busy && media.medium !== id}
            onClick={() => void getTapeMedia().setMedium(id)}
            className="media-tab flex min-h-11 items-center justify-center gap-2 rounded px-2 text-xs font-semibold uppercase tracking-wider"
          >
            <Icon className="size-4 shrink-0" />
            <span className="truncate">{label}</span>
          </button>
        ))}
      </div>
      {media.medium === "reel" && <ReelRecorder />}
      {media.medium === "cassette" && <CassetteDeck />}
      {media.medium === "cd" && <CdBurner />}
    </div>
  );
}
