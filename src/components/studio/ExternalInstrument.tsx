/**
 * External MIDI instrument controls for one track: choose the MIDI output and
 * channel a hardware synth / drum machine / other app listens on, pick its
 * program, send a test note and add an audio track for its sound to come back on.
 */
import { useEffect, useState, useSyncExternalStore } from "react";
import { Cable } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useStudio } from "@/lib/synclab/store";
import type { Track } from "@/lib/synclab/types";
import {
  getOutputAccess,
  getRoutes,
  listOutputs,
  midiOutSupported,
  onRoutesChange,
  routeStatus,
  sendTestNote,
  setRoute,
} from "@/lib/synclab/external-midi";

let version = 0;
const subscribe = (fn: () => void) =>
  onRoutesChange(() => {
    version += 1;
    fn();
  });
const snapshot = () => version;

/** Re-renders whenever routes or connected MIDI outputs change. */
export function useExternalMidi() {
  useSyncExternalStore(subscribe, snapshot, snapshot);
  return { routes: getRoutes(), outputs: listOutputs() };
}

const isAppleMobile = () =>
  typeof navigator !== "undefined" &&
  (/iPhone|iPad|iPod/.test(navigator.userAgent) ||
    (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1));

export function midiUnavailableMessage() {
  return isAppleMobile()
    ? "Safari on iPhone and iPad has no MIDI. Open SYNCLAB in the free MIDIWeb Browser app, or use Chrome/Edge on a computer or the SYNCLAB desktop app."
    : "This browser has no MIDI. Use Chrome or Edge, or the SYNCLAB desktop app.";
}

export async function findMidiOutputs() {
  const a = await getOutputAccess();
  if (!a) {
    toast.error("MIDI isn't available", { description: midiUnavailableMessage() });
    return false;
  }
  if (!listOutputs().length) {
    toast.message("No MIDI outputs found", {
      description:
        "Connect your instrument by USB or through a MIDI interface, switch it on, then try again.",
    });
  }
  return true;
}

export function ExternalInstrument({
  track,
  compact = false,
}: {
  track: Track;
  compact?: boolean;
}) {
  const { addTrack } = useStudio();
  const { routes, outputs } = useExternalMidi();
  const [asked, setAsked] = useState(false);
  const r = routes[track.id];
  const status = routeStatus(track.id);
  const supported = midiOutSupported();

  // A routed track asks for MIDI access by itself so its output list is ready.
  useEffect(() => {
    if (r && supported) void getOutputAccess();
  }, [r, supported]);

  const find = async () => {
    setAsked(true);
    await findMidiOutputs();
  };
  const chooseOutput = (v: string) => {
    if (v === "synclab") {
      setRoute(track.id, null);
      return;
    }
    setRoute(track.id, { portId: v, channel: r?.channel ?? 1, program: r?.program ?? null });
    toast.success(
      `${track.name} now plays ${outputs.find((o) => o.id === v)?.name ?? "the instrument"}`,
      {
        description:
          "Its notes, your keyboard and recordings play the external instrument instead of SYNCLAB's sound.",
      },
    );
  };
  const addReturn = () => {
    addTrack("audio", `${track.name} AUDIO`.slice(0, 24));
    toast.success("Audio return track added", {
      description:
        "Plug the instrument's audio out into your audio interface, pick that input, then press record to capture its sound.",
    });
  };

  const portOptions =
    r && !outputs.some((o) => o.id === r.portId)
      ? [
          ...outputs,
          {
            id: r.portId,
            name: `${r.portName ?? "Saved output"} (not connected)`,
            connected: false,
          },
        ]
      : outputs;

  return (
    <section
      className="ext-instrument space-y-2 rounded-md border border-border bg-surface/50 p-3"
      aria-label="External MIDI instrument"
    >
      <h3 className="flex items-center gap-2 text-sm font-semibold">
        <Cable className="size-4 text-primary" /> External MIDI instrument
        {status === "connected" && (
          <span className="rounded bg-primary/20 px-1.5 py-0.5 font-mono text-[10px] text-primary">
            CONNECTED
          </span>
        )}
        {status === "missing" && (
          <span className="rounded bg-destructive/20 px-1.5 py-0.5 font-mono text-[10px] text-destructive">
            NOT CONNECTED
          </span>
        )}
      </h3>
      {!compact && (
        <p className="text-xs text-muted-foreground">
          Play a hardware synth, drum machine or another music app from this track. Its sound comes
          back through your audio interface.
        </p>
      )}
      {!supported ? (
        <p className="text-xs text-muted-foreground">{midiUnavailableMessage()}</p>
      ) : outputs.length === 0 && !r ? (
        <div className="space-y-1">
          <Button size="sm" variant="secondary" className="h-10" onClick={() => void find()}>
            Find MIDI outputs
          </Button>
          {asked && (
            <p className="text-xs text-muted-foreground">
              No outputs yet — connect the instrument (USB or MIDI interface) and switch it on.
            </p>
          )}
        </div>
      ) : (
        <div className="space-y-2">
          <label className="block space-y-1">
            <span className="label-xs">Plays</span>
            <Select value={r?.portId ?? "synclab"} onValueChange={chooseOutput}>
              <SelectTrigger className="h-11" aria-label={`MIDI output for ${track.name}`}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="synclab">SYNCLAB sound (built in)</SelectItem>
                {portOptions.map((o) => (
                  <SelectItem key={o.id} value={o.id}>
                    {o.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </label>
          {r && (
            <>
              <div className="grid grid-cols-2 gap-2">
                <label className="space-y-1">
                  <span className="label-xs">Send on channel</span>
                  <Select
                    value={String(r.channel)}
                    onValueChange={(v) => setRoute(track.id, { ...r, channel: Number(v) })}
                  >
                    <SelectTrigger className="h-11" aria-label="External MIDI channel">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {Array.from({ length: 16 }, (_, i) => (
                        <SelectItem key={i} value={String(i + 1)}>
                          Channel {i + 1}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </label>
                <label className="space-y-1">
                  <span className="label-xs">Program</span>
                  <Select
                    value={r.program == null ? "none" : String(r.program)}
                    onValueChange={(v) =>
                      setRoute(track.id, { ...r, program: v === "none" ? null : Number(v) })
                    }
                  >
                    <SelectTrigger className="h-11" aria-label="External program number">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">Don't change</SelectItem>
                      {Array.from({ length: 128 }, (_, i) => (
                        <SelectItem key={i} value={String(i + 1)}>
                          Program {i + 1}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </label>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button
                  size="sm"
                  variant="secondary"
                  className="h-10"
                  disabled={status !== "connected"}
                  onClick={() => {
                    if (!sendTestNote(r.portId, r.channel))
                      toast.error("That output isn't connected");
                  }}
                >
                  Test note
                </Button>
                <Button size="sm" variant="outline" className="h-10" onClick={addReturn}>
                  Add audio return track
                </Button>
              </div>
              <p className="text-[11px] text-muted-foreground">
                {status === "missing"
                  ? "Plug the instrument back in and switch it on — this track stays silent until it is reachable."
                  : "Mute, solo and Stop control the instrument too. Song exports include its sound once you record it onto an audio track."}
              </p>
            </>
          )}
        </div>
      )}
    </section>
  );
}
