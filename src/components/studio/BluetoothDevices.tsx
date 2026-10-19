import { useEffect, useState } from "react";
import { Bluetooth } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { bluetoothMidiSupported, connectBluetoothMidi, disconnectBluetoothMidi, looksBluetooth } from "@/lib/synclab/bluetooth";

type Dev = { id: string; label: string };

/** Bluetooth headphones/speakers/mics (paired in the OS) plus direct Bluetooth MIDI. */
export function BluetoothDevices({
  inputs, outputs, onUseInput, onUseOutput, onRescan, midiInputs, onMidiChanged,
}: {
  inputs: Dev[]; outputs: Dev[];
  onUseInput: (label: string) => void; onUseOutput: (label: string) => void; onRescan: () => void;
  midiInputs: { id: string; name: string }[];
  onMidiChanged: (selectId?: string) => void;
}) {
  const [busy, setBusy] = useState(false);
  const btIn = inputs.filter((d) => looksBluetooth(d.label));
  const btOut = outputs.filter((d) => looksBluetooth(d.label));
  const audioInputs = btIn.length ? btIn : inputs;
  const audioOutputs = btOut.length ? btOut : outputs;
  const btMidi = midiInputs.filter((m) => m.id.startsWith("ble:") || /bluetooth|\bble\b/i.test(m.name));

  useEffect(() => {
    const f = () => onMidiChanged();
    window.addEventListener("synclab:bluetooth-midi", f);
    return () => window.removeEventListener("synclab:bluetooth-midi", f);
  }, [onMidiChanged]);

  const pairMidi = async () => {
    setBusy(true);
    try {
      const d = await connectBluetoothMidi();
      onMidiChanged(d.id);
      toast.success(`${d.name} connected`, { description: "Play it to hear the selected instrument." });
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      if (!(e instanceof Error && e.name === "NotFoundError") && !/cancel/i.test(msg)) toast.error("Couldn't connect Bluetooth MIDI", { description: msg });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="mb-4 rounded-md border border-border bg-surface p-3">
      <div className="mb-2 flex items-center gap-2 text-sm font-semibold"><Bluetooth className="size-4 text-primary" /> Bluetooth devices</div>
      <p className="mb-3 text-xs text-muted-foreground">
        Nearby scanning connects Bluetooth LE MIDI only. Pair headphones, speakers and headset mics in your computer or phone's Bluetooth settings first, then rescan audio. Bluetooth audio adds recording delay.
      </p>
      <div className="grid gap-3 sm:grid-cols-3">
        <div>
          <div className="mb-1 font-mono text-[11px] uppercase tracking-widest text-muted-foreground">Headphones / speakers</div>
          {!btOut.length && outputs.length > 0 && <p className="mb-2 text-xs text-muted-foreground">Available audio outputs — browsers don't identify which use Bluetooth.</p>}
          {audioOutputs.length ? audioOutputs.map((d) => (
            <Button key={d.id} size="sm" variant="secondary" className="mb-1 w-full justify-start truncate" onClick={() => onUseOutput(d.label)}>Play through {d.label}</Button>
          )) : <p className="text-xs text-muted-foreground">No audio outputs reported. Pair and select your device in system sound settings, then rescan audio.</p>}
        </div>
        <div>
          <div className="mb-1 font-mono text-[11px] uppercase tracking-widest text-muted-foreground">Microphones</div>
          {!btIn.length && inputs.length > 0 && <p className="mb-2 text-xs text-muted-foreground">Available audio inputs — browsers don't identify which use Bluetooth.</p>}
          {audioInputs.length ? audioInputs.map((d) => (
            <Button key={d.id} size="sm" variant="secondary" className="mb-1 w-full justify-start truncate" onClick={() => onUseInput(d.label)}>Record from {d.label}</Button>
          )) : <p className="text-xs text-muted-foreground">No audio inputs reported. Pair your device in system settings, allow microphone access, then rescan audio.</p>}
        </div>
        <div>
          <div className="mb-1 font-mono text-[11px] uppercase tracking-widest text-muted-foreground">MIDI keyboards</div>
          {btMidi.map((m) => (
            <div key={m.id} className="mb-1 flex items-center justify-between gap-1 text-xs">
              <span className="truncate">{m.name}</span>
              {m.id.startsWith("ble:") && <Button size="sm" variant="ghost" onClick={() => disconnectBluetoothMidi(m.id)}>Disconnect</Button>}
            </div>
          ))}
          <Button size="sm" variant="secondary" className="w-full" disabled={busy || !bluetoothMidiSupported()} onClick={() => void pairMidi()}>
            {busy ? "Connecting…" : "Find nearby Bluetooth MIDI"}
          </Button>
          {!bluetoothMidiSupported() && <p className="mt-1 text-[11px] text-muted-foreground">Nearby scanning is unavailable in this browser, including iPhone and iPad. Use Chrome or Edge on a computer or Android. On Mac, you can also pair MIDI in Audio MIDI Setup → Bluetooth.</p>}
        </div>
      </div>
      <Button size="sm" variant="outline" className="mt-3" onClick={onRescan}>Rescan Bluetooth audio</Button>
    </div>
  );
}
