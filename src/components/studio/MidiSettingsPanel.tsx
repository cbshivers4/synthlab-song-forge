import { useEffect, useState } from "react";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import { Usb, RefreshCw } from "lucide-react";
import { useStudio } from "@/lib/synclab/store";
import {
  CONTROLLERS,
  chosenControllerId,
  setChosenControllerId,
} from "@/lib/synclab/controller-profiles";
import {
  midiSupported,
  midiUnsupportedMessage,
  midiInputEnabled,
  toggleMidiInput,
} from "@/lib/synclab/midi";
import { ControllerLibrary, DevicePicture } from "./ControllerLibrary";
import { useSurfaceEvent } from "@/lib/synclab/surface-monitor";

/** Live readout of the last thing a controller sent, so you can tell whether it reaches the app. */
function LastControllerMessage() {
  const event = useSurfaceEvent();
  return (
    <div
      role="status"
      aria-live="polite"
      className="border border-border bg-surface px-3 py-3 text-sm"
    >
      <div className="text-xs font-semibold">Last message from your controller</div>
      {event ? (
        <div className="mt-1 space-y-0.5">
          <div className="break-words font-medium">
            {event.port}
            {event.mode ? <span className="text-muted-foreground"> · {event.mode}</span> : null}
          </div>
          <div className="font-mono text-xs text-muted-foreground">{event.raw}</div>
          <div className="text-xs text-primary">→ {event.action}</div>
        </div>
      ) : (
        <p className="mt-1 text-xs text-muted-foreground">
          Nothing received yet. Move a fader or press a button — if nothing shows up here, the
          controller isn't reaching the app: check the cable, that its input is enabled below, and
          that you're using Chrome or Edge.
        </p>
      )}
    </div>
  );
}

export function MidiSettingsPanel({ onDetect }: { onDetect: () => void }) {
  const { midiInputs, midiOutputs, midiInputId, setMidiInput } = useStudio();
  const [profileId, setProfileId] = useState("auto");
  const [supported, setSupported] = useState(false);
  useEffect(() => {
    setSupported(midiSupported());
    const refresh = () => setProfileId(chosenControllerId());
    refresh();
    window.addEventListener("synclab:controller-profile", refresh);
    return () => window.removeEventListener("synclab:controller-profile", refresh);
  }, []);
  const profile = CONTROLLERS.find((p) => p.id === profileId);
  const choose = (id: string) => {
    setChosenControllerId(id);
    setProfileId(id);
    window.dispatchEvent(new Event("synclab:controller-profile"));
  };

  return (
    <section aria-label="MIDI keyboards and control surfaces" className="space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="text-base font-semibold">Remote keyboards and control surfaces</h3>
          <p className="mt-1 text-xs text-muted-foreground">
            {profileId === "auto"
              ? "Automatic profile detection"
              : profileId === "off"
                ? "Factory mapping off — MIDI Learn remains available"
                : `Selected profile: ${profile?.maker ?? ""} ${profile?.model ?? "Unknown"}`}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            variant="secondary"
            onClick={() => {
              choose("auto");
              onDetect();
            }}
          >
            <RefreshCw className="size-4" />
            Auto-detect surfaces
          </Button>
          <ControllerLibrary trigger={<Button variant="outline">Choose profile manually</Button>} />
        </div>
      </div>
      <div className="overflow-hidden border border-border bg-surface">
        <div className="grid grid-cols-[minmax(0,1fr)_110px] gap-2 bg-surface-2 px-3 py-2 text-xs font-semibold">
          <span>MIDI keyboard / controller</span>
          <span className="text-right">Status</span>
        </div>
        <div className="max-h-64 overflow-y-auto">
          {midiInputs.map((port) => {
            const detected = CONTROLLERS.find((p) => p.port.test(port.name));
            return (
              <div
                key={port.id}
                className="grid grid-cols-[minmax(0,1fr)_110px] items-center gap-2 border-t border-border px-3 py-3"
              >
                <div className="flex min-w-0 items-center gap-3">
                  {detected ? (
                    <DevicePicture look={detected.look} className="w-24 shrink-0" />
                  ) : (
                    <Usb className="size-8 shrink-0 text-muted-foreground" />
                  )}
                  <div className="min-w-0">
                    <div className="break-words text-sm font-medium">{port.name}</div>
                    <div className="text-xs text-muted-foreground">
                      {detected ? `${detected.maker} · ${detected.model}` : "Generic MIDI input"}
                    </div>
                  </div>
                </div>
                <span className="text-right text-xs text-primary">Input reported</span>
              </div>
            );
          })}
          {!midiInputs.length && (
            <div className="px-3 py-5 text-sm text-muted-foreground">
              No connected MIDI inputs reported.
            </div>
          )}
        </div>
      </div>
      <LastControllerMessage />
      {!supported && (
        <p role="status" className="text-sm text-muted-foreground">
          {midiUnsupportedMessage()}
        </p>
      )}
      <div className="flex flex-wrap gap-2">
        <ControllerLibrary
          trigger={
            <Button variant="outline" size="sm">
              Edit controller profile
            </Button>
          }
        />
        <Button
          variant="outline"
          size="sm"
          disabled={profileId === "auto" || profileId === "off"}
          onClick={() => choose("auto")}
        >
          Remove manual profile
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={() => choose(profileId === "off" ? "auto" : "off")}
        >
          {profileId === "off" ? "Enable factory mapping" : "Disable factory mapping"}
        </Button>
      </div>
      <div>
        <h4 className="mb-2 text-sm font-semibold">Available controller profiles</h4>
        <div className="grid gap-2 sm:grid-cols-2">
          {CONTROLLERS.filter((p) =>
            ["korg-nanokontrol-studio", "korg-nanokey-studio"].includes(p.id),
          ).map((p) => (
            <Button
              key={p.id}
              variant="outline"
              aria-pressed={profileId === p.id}
              onClick={() => choose(p.id)}
              className={`h-auto min-h-24 justify-start gap-3 whitespace-normal p-3 text-left ${profileId === p.id ? "border-primary bg-primary/10" : ""}`}
            >
              <DevicePicture look={p.look} className="!h-auto !w-24 shrink-0" />
              <span className="min-w-0">
                <span className="block text-sm">
                  {p.maker} {p.model}
                </span>
                <span className="block text-xs text-muted-foreground">
                  {p.map ? "Factory mixer mapping" : "MIDI Learn"} · Profile only, not a connection
                </span>
              </span>
            </Button>
          ))}
        </div>
      </div>
      <div>
        <h4 className="mb-2 text-sm font-semibold">Easy MIDI inputs / Master keyboard input</h4>
        <div className="border border-border bg-surface">
          <div className="grid grid-cols-[minmax(0,1fr)_80px] bg-surface-2 px-3 py-2 text-xs font-semibold">
            <span>Input port</span>
            <span className="text-right">Enabled</span>
          </div>
          <label className="flex min-h-11 cursor-pointer items-center justify-between gap-3 border-t border-border px-3 py-2 text-sm">
            <span>All devices</span>
            <Checkbox
              aria-label="Use All devices"
              checked={midiInputId === "all"}
              onCheckedChange={(checked) => setMidiInput(checked === true ? "all" : null)}
            />
          </label>
          {midiInputs.map((port) => (
            <label
              key={port.id}
              className="flex min-h-11 cursor-pointer items-center justify-between gap-3 border-t border-border px-3 py-2 text-sm"
            >
              <span className="min-w-0 break-words">{port.name}</span>
              <Checkbox
                checked={midiInputEnabled(midiInputId, port.id)}
                onCheckedChange={(checked) =>
                  setMidiInput(toggleMidiInput(midiInputId, port.id, checked === true, midiInputs))
                }
                aria-label={`Use ${port.name}`}
              />
            </label>
          ))}
          <Button variant="ghost" size="sm" onClick={() => setMidiInput(null)}>
            Disable all inputs
          </Button>
        </div>
        <p className="mt-2 text-xs text-muted-foreground">
          Standard — notes play the armed / selected instrument. Independent master-keyboard
          targeting is not available.
        </p>
      </div>
      <div>
        <h4 className="mb-2 text-sm font-semibold">MIDI outputs</h4>
        <div className="overflow-hidden border border-border bg-surface">
          <div className="grid grid-cols-[minmax(0,1fr)_130px] gap-2 bg-surface-2 px-3 py-2 text-xs font-semibold">
            <span>Output port</span>
            <span className="text-right">Status</span>
          </div>
          <div className="max-h-48 overflow-y-auto">
            {midiOutputs.map((port) => (
              <div
                key={port.id}
                className="grid grid-cols-[minmax(0,1fr)_130px] items-center gap-2 border-t border-border px-3 py-3"
              >
                <div className="flex min-w-0 items-center gap-3">
                  <Usb className="size-6 shrink-0 text-muted-foreground" />
                  <span className="min-w-0 break-words text-sm font-medium">{port.name}</span>
                </div>
                <span className="text-right text-xs text-primary">Output reported</span>
              </div>
            ))}
            {!midiOutputs.length && (
              <div className="px-3 py-5 text-sm text-muted-foreground">
                No connected MIDI outputs reported.
              </div>
            )}
          </div>
        </div>
        <p className="mt-2 text-xs text-muted-foreground">
          SYNCLAB receives MIDI from controllers but does not send notes or clock out to hardware
          yet — outputs are listed so you can confirm the device is connected.
        </p>
      </div>
    </section>
  );
}
