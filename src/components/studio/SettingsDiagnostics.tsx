import { useEffect, useRef, useState } from "react";
import { Activity, AudioLines, CheckCircle2, Mic, RefreshCw, Usb, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { getEngine } from "@/lib/synclab/audio-engine";
import { borrowActiveMic, getPreferredInput, getOutputDevice, micUnavailableReason, outputRoutingHint } from "@/lib/synclab/mic";
import { midiSupported, midiUnsupportedMessage } from "@/lib/synclab/midi";
import { accessFailure, prepareReloadCheck, probeMicrophone, readReloadCheck, type CheckResult } from "@/lib/synclab/settings-diagnostics";

type Kind = "microphone" | "midi" | "devices" | "audio";
const titles: Record<Kind, string> = { microphone: "Microphone access", midi: "MIDI access", devices: "Audio devices", audio: "Audio playback access" };
const icons = { microphone: Mic, midi: Usb, devices: AudioLines, audio: Activity };

export function SettingsDiagnostics() {
  const [results, setResults] = useState<Partial<Record<Kind, CheckResult>>>({});
  const [busy, setBusy] = useState<Kind | null>(null);
  const running = useRef(false);
  const [reloadResult, setReloadResult] = useState<CheckResult | null>(null);
  const [confirmReload, setConfirmReload] = useState(false);
  useEffect(() => { setReloadResult(readReloadCheck()); }, []);

  async function check(kind: Kind) {
    if (running.current) return;
    running.current = true;
    setBusy(kind);
    let result: CheckResult;
    try {
      if (kind === "microphone") {
        const blocked = micUnavailableReason();
        const active = borrowActiveMic();
        if (blocked) result = { status: "blocked", detail: blocked };
        else if (active) result = { status: "passed", detail: "Studio input is already active. Existing capture was left untouched." };
        else {
          const id = getPreferredInput();
          result = await probeMicrophone(() => navigator.mediaDevices.getUserMedia({ audio: id ? { deviceId: { exact: id } } : true }));
        }
      } else if (kind === "midi") {
        if (!midiSupported()) result = { status: "attention", detail: midiUnsupportedMessage() };
        else {
          // Inspect real ports without assigning handlers or adding virtual inputs.
          const access = await navigator.requestMIDIAccess({ sysex: false });
          const ports = Array.from(access.inputs.values()).filter(port => port.state === "connected");
          result = ports.length ? { status: "passed", detail: `MIDI permission granted. ${ports.length} input(s): ${ports.map(port => port.name || "Unnamed controller").join(", ")}. Note delivery and MIDI Learn require a controller test.` } : { status: "attention", detail: "MIDI permission granted, but no connected inputs were reported. Connect a USB controller and retry." };
        }
      } else if (kind === "devices") {
        if (!navigator.mediaDevices?.enumerateDevices) result = { status: "attention", detail: "Device listing is not supported in this browser." };
        else {
          const devices = (await navigator.mediaDevices.enumerateDevices()).filter(d => d.kind === "audioinput" || d.kind === "audiooutput");
          const ins = devices.filter(d => d.kind === "audioinput");
          const outs = devices.filter(d => d.kind === "audiooutput");
          const selected = [getPreferredInput(), getOutputDevice()].filter(Boolean);
          const missing = selected.some(id => !devices.some(d => d.deviceId === id));
          const hidden = devices.some(d => !d.label);
          result = { status: !devices.length || hidden || missing ? "attention" : "passed", detail: `${ins.length} input(s), ${outs.length} output(s) reported. ${devices.map(d => d.label || "Name hidden until permission is allowed").join(", ") || "Allow microphone access, connect a device, and retry."}${missing ? " Saved device not reported; check your Audio selection." : ""} ${getEngine().canPickOutput ? "Output selection supported." : outputRoutingHint()} Listing does not verify audible output or latency.` };
        }
      } else {
        const engine = getEngine();
        const context = engine.init();
        await context.resume();
        result = { status: context.state === "running" ? "passed" : "attention", detail: `Audio is ${context.state} at ${context.sampleRate} Hz. No test tone was played; speaker sound and round-trip latency are not verified.` };
      }
    } catch (error) { result = accessFailure(error); }
    setResults(previous => ({ ...previous, [kind]: result }));
    running.current = false;
    setBusy(null);
  }

  return <section aria-label="Settings diagnostics" className="space-y-4">
    <h3 className="text-base font-semibold">Settings diagnostics</h3>
    <div className="border-b border-border pb-4">
      <h4 className="text-sm font-medium">Preferences after reload</h4>
      <div className="mt-2" role="status"><Result result={reloadResult} /></div>
      {confirmReload ? <div className="mt-3 space-y-3">
        <p className="text-sm text-muted-foreground">Save your song with File → Save first. Reload stops playback and discards unsaved song changes. Only settings are checked; your song is not saved automatically.</p>
        <div className="flex flex-wrap gap-2">
          <Button variant="secondary" disabled={busy !== null} onClick={() => {
            try { prepareReloadCheck(); window.location.reload(); }
            catch { setReloadResult({ status: "blocked", detail: "Browser storage is blocked. Reload cancelled; your song remains open." }); setConfirmReload(false); }
          }}><RefreshCw className="size-4" />Reload and verify</Button>
          <Button variant="outline" onClick={() => setConfirmReload(false)}>Cancel</Button>
        </div>
      </div> : <Button className="mt-3" variant="secondary" onClick={() => setConfirmReload(true)}><RefreshCw className="size-4" />Check after reload</Button>}
    </div>
    {(Object.keys(titles) as Kind[]).map(kind => {
      const Icon = icons[kind];
      return <div key={kind} className="grid gap-3 border-b border-border pb-4 sm:grid-cols-[minmax(0,1fr)_auto]">
        <div className="min-w-0"><h4 className="flex items-center gap-2 text-sm font-medium"><Icon className="size-4 shrink-0" />{titles[kind]}</h4><div className="mt-2 break-words" role="status"><Result result={results[kind] ?? null} /></div></div>
        <Button variant="outline" className="self-start" disabled={busy !== null} onClick={() => void check(kind)} aria-label={`Check ${titles[kind].toLowerCase()}`}>{busy === kind ? "Checking…" : "Check access"}</Button>
      </div>;
    })}
  </section>;
}

function Result({ result }: { result: CheckResult | null }) {
  if (!result) return <p className="text-sm text-muted-foreground">Not checked</p>;
  const Icon = result.status === "passed" ? CheckCircle2 : AlertTriangle;
  return <div className="flex items-start gap-2 text-sm"><Icon className={`mt-0.5 size-4 shrink-0 ${result.status === "blocked" ? "text-destructive" : "text-primary"}`} /><p><strong>{result.status === "passed" ? "Passed" : result.status === "blocked" ? "Blocked" : "Needs attention"}</strong><span className="block text-muted-foreground">{result.detail}</span></p></div>;
}