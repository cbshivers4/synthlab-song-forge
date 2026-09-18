import { useCallback, useEffect, useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useStudio } from "@/lib/synclab/store";
import { midiSupported } from "@/lib/synclab/midi";
import { openMic, openInOwnTab, listAudioDevices, getPreferredInput, setPreferredInput, onDeviceChange } from "@/lib/synclab/mic";

const KEY = "synclab.devicesetup.done";

export function DeviceSetup() {
  const { midiInputs, enableMidi } = useStudio();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [asked, setAsked] = useState(false);
  const [inputs, setInputs] = useState<{ id: string; label: string }[]>([]);
  const [outputs, setOutputs] = useState<{ id: string; label: string }[]>([]);
  const [chosen, setChosen] = useState<string | null>(null);
  const [micError, setMicError] = useState<string | null>(null);

  const listDevices = useCallback(async () => {
    const all = await listAudioDevices();
    const ins = all.filter((d) => d.kind === "audioinput").map((d) => ({ id: d.id, label: d.label }));
    const outs = all.filter((d) => d.kind === "audiooutput").map((d) => ({ id: d.id, label: d.label }));
    setInputs(ins);
    setOutputs(outs);
    setChosen(getPreferredInput());
    return { ins, outs };
  }, []);

  useEffect(() => onDeviceChange(() => void listDevices()), [listDevices]);

  // Ask only when the gear is not already connected and allowed.
  useEffect(() => {
    let cancelled = false;
    const check = async () => {
      let done = false;
      try {
        done = localStorage.getItem(KEY) === "1";
      } catch {
        /* storage blocked */
      }
      if (done) return;

      let granted = false;
      try {
        const perm = await navigator.permissions?.query({ name: "microphone" as PermissionName });
        granted = perm?.state === "granted";
      } catch {
        granted = false;
      }
      const { ins } = await listDevices();
      if (cancelled) return;

      if (granted && ins.length && ins.some((d) => d.label)) {
        // Devices are already allowed and visible — connect quietly, never ask.
        enableMidi();
        try {
          localStorage.setItem(KEY, "1");
        } catch {
          /* storage blocked */
        }
        return;
      }
      setOpen(true);
    };
    void check();
    return () => {
      cancelled = true;
    };
  }, [enableMidi, listDevices]);

  const close = () => {
    try {
      localStorage.setItem(KEY, "1");
    } catch {
      /* ignore */
    }
    setOpen(false);
  };

  const connect = async () => {
    setBusy(true);
    setMicError(null);
    try {
      const res = await openMic();
      if ("error" in res) setMicError(res.error);
      else res.stream.getTracks().forEach((t) => t.stop());
      await listDevices();
      enableMidi();
    } finally {
      setAsked(true);
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => (v ? setOpen(true) : close())}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Connect your gear</DialogTitle>
          <DialogDescription>
            SYNCLAB needs permission to use your audio interface and MIDI controllers. Your browser will ask
            once — choose Allow so devices like a Volt 1 and your keyboards show up by name. Once everything is
            connected you will not be asked again; you can check your gear any time in Settings.
          </DialogDescription>
        </DialogHeader>

        {micError && (
          <div className="space-y-2 rounded-lg border border-destructive/50 bg-destructive/10 p-3 text-xs text-destructive">
            <div>{micError}</div>
            <Button size="sm" variant="secondary" onClick={openInOwnTab}>
              Open SYNCLAB in its own tab
            </Button>
          </div>
        )}

        {asked && (
          <div className="space-y-3 rounded-lg border border-border bg-surface p-3 font-mono text-xs">
            <div>
              <div className="label-xs mb-1">Audio inputs — tap the one to record from</div>
              {inputs.length ? (
                <div className="space-y-1">
                  <button
                    type="button"
                    onClick={() => {
                      setPreferredInput(null);
                      setChosen(null);
                    }}
                    className={`w-full rounded border px-2 py-2 text-left ${chosen === null ? "border-primary text-primary" : "border-border text-muted-foreground"}`}
                  >
                    System default input
                  </button>
                  {inputs.map((d) => (
                    <button
                      key={d.id}
                      type="button"
                      onClick={() => {
                        setPreferredInput(d.id);
                        setChosen(d.id);
                      }}
                      className={`w-full rounded border px-2 py-2 text-left ${chosen === d.id ? "border-primary text-primary" : "border-border text-muted-foreground"}`}
                    >
                      {d.label}
                    </button>
                  ))}
                </div>
              ) : (
                <div className="text-muted-foreground">
                  None found. Allow microphone access, plug in the interface, then press Connect again.
                </div>
              )}
            </div>
            <div>
              <div className="label-xs mb-1">Audio outputs</div>
              {outputs.length ? (
                outputs.map((d) => <div key={d.id} className="text-primary">{d.label}</div>)
              ) : (
                <div className="text-muted-foreground">None found.</div>
              )}
            </div>
            <div>
              <div className="label-xs mb-1">MIDI controllers</div>
              {midiInputs.length ? (
                midiInputs.map((m) => <div key={m.id} className="text-primary">{m.name}</div>)
              ) : (
                <div className="text-muted-foreground">
                  {midiSupported()
                    ? "None found. Connect the controller, then press Connect again."
                    : "This browser cannot see MIDI hardware — use Chrome or Edge."}
                </div>
              )}
            </div>
          </div>
        )}

        <p className="text-xs text-muted-foreground">
          Playback always uses the output your computer is set to. You can re-run this any time from Settings.
        </p>

        <div className="flex justify-end gap-2">
          <Button variant="ghost" size="sm" onClick={close}>
            Skip for now
          </Button>
          <Button size="sm" disabled={busy} onClick={() => void connect()}>
            {busy ? "Connecting…" : asked ? "Connect again" : "Connect devices"}
          </Button>
          {asked && (
            <Button size="sm" variant="secondary" onClick={close}>
              Done
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
