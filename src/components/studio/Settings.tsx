import { getInputLatencyMs, setInputLatencyMs } from "@/lib/synclab/latency";
import { stepsPerBar } from "@/lib/synclab/timebase";
import { useEffect, useRef, useState } from "react";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useStudio } from "@/lib/synclab/store";
import { getEngine } from "@/lib/synclab/audio-engine";
import { toast } from "sonner";
import {
  openMic,
  openInOwnTab,
  micUnavailableReason,
  listAudioDevices,
  getPreferredInput,
  setPreferredInput,
  onDeviceChange,
} from "@/lib/synclab/mic";
import { midiSupported, midiUnsupportedMessage, toggleMidiInput } from "@/lib/synclab/midi";
import { getInputChannel, getInputGainDb, outputRoutingHint, setInputChannel, setInputGainDb, setOutputDevice, type InputChannel } from "@/lib/synclab/mic";
import { useIsAppleMobile } from "@/hooks/use-is-apple-mobile";
import { openExport } from "@/components/studio/ExportDialog";
import { DesktopPanel } from "@/components/studio/DesktopPanel";
import { PluginManager } from "@/components/studio/PluginManager";
import { AudioInterfaceCard } from "@/components/studio/AudioInterfaceCard";
import { BluetoothDevices } from "@/components/studio/BluetoothDevices";
import { replayMobileTour, saveMobileAccessibility, useMobileAccessibility } from "@/lib/synclab/mobile-accessibility";
import { useIsMobile } from "@/hooks/use-mobile";
import { MidiSettingsPanel } from "./MidiSettingsPanel";
import { LibraryPanel } from "./LibraryPanel";
import { useApp } from "@/lib/synclab/app-state";
import { usePlan } from "@/lib/synclab/plan";
import { qwertyEnabled, setQwertyEnabled, qwertyOctave, setQwertyOctave } from "@/lib/synclab/qwerty";
import { notifyPreferencesChanged } from "@/lib/synclab/preferences";
import { Bluetooth, Mic } from "lucide-react";
import { SettingsDiagnostics } from "./SettingsDiagnostics";
import { KeyboardShortcuts } from "./KeyboardShortcuts";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { useServerFn } from "@tanstack/react-start";
import { deleteMyAccount } from "@/utils/account.functions";
import { supabase } from "@/integrations/supabase/client";

export function requestBluetoothSettings() {
  sessionStorage.setItem("synclab.settings.bluetooth", "open");
  window.dispatchEvent(new Event("synclab:bluetooth-settings"));
}

type Prefs = {
  sampleRate: string;
  bufferSize: string;
  bitDepth: string;
  inputDevice: string;
  outputDevice: string;
  latency: number;
  recFormat: string;
  recMode: string;
  takeLanes: boolean;
  autoQuantizeRec: boolean;
  countInBars: string;
  clickSound: string;
  clickLevel: number;
  clickWhilePlaying: boolean;
  timeSig: string;
  key: string;
  snap: string;
  gridQuantize: string;
  scaleLock: boolean;
  midiInput: string;
  midiThru: boolean;
  velocityCurve: string;
  pitchBendRange: number;
  masterLimiter: boolean;
  masterCeiling: number;
  headroom: number;
  panLaw: string;
  exportFormat: string;
  exportRate: string;
  exportTail: number;
  normalizeExport: boolean;
  waveformDetail: string;
  showTooltips: boolean;
  reduceMotion: boolean;
};

const DEFAULTS: Prefs = {
  sampleRate: "48000",
  bufferSize: "256",
  bitDepth: "24",
  inputDevice: "System default",
  outputDevice: "System default",
  latency: 12,
  recFormat: "WAV",
  recMode: "Replace",
  takeLanes: true,
  autoQuantizeRec: false,
  countInBars: "1",
  clickSound: "Detroit Rim",
  clickLevel: 0.6,
  clickWhilePlaying: false,
  timeSig: "4/4",
  key: "A minor",
  snap: "Grid",
  gridQuantize: "1/16",
  scaleLock: true,
  midiInput: "All devices",
  midiThru: true,
  velocityCurve: "Linear",
  pitchBendRange: 2,
  masterLimiter: true,
  masterCeiling: -1,
  headroom: -6,
  panLaw: "-3 dB",
  exportFormat: "WAV 24-bit",
  exportRate: "48 kHz",
  exportTail: 2,
  normalizeExport: false,
  waveformDetail: "High",
  showTooltips: true,
  reduceMotion: false,
};

const KEY = "synclab.prefs";

function punchLabel(step: number | null | undefined) {
  if (step == null) return "Off";
  const spb = stepsPerBar();
  return `Bar ${Math.floor(step / spb) + 1}, beat ${Math.floor((step % spb) / 4) + 1}`;
}

function Row({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div className="settings-row grid grid-cols-1 sm:grid-cols-[minmax(0,1fr)_auto] items-center gap-3 border-b border-border/60 py-2.5 last:border-0">
      <div className="min-w-0">
        <div className="text-sm">{label}</div>
        {hint && <div className="text-xs text-muted-foreground">{hint}</div>}
      </div>
      <div className="flex min-w-0 flex-wrap items-center gap-2">{children}</div>
    </div>
  );
}

function Pick({
  value,
  options,
  onChange,
  width = "w-40",
}: {
  value: string;
  options: string[];
  onChange: (v: string) => void;
  width?: string;
}) {
  return (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger className={`${width} h-8 font-mono text-xs`}>
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {options.map((o) => (
          <SelectItem key={o} value={o} className="font-mono text-xs">
            {o}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

function Num({
  value,
  min,
  max,
  step = 1,
  unit,
  onChange,
}: {
  value: number;
  min: number;
  max: number;
  step?: number;
  unit?: string;
  onChange: (v: number) => void;
}) {
  return (
    <div className="flex items-center gap-2">
      <Slider className="w-32" value={[value]} min={min} max={max} step={step} onValueChange={([v = 0]) => onChange(v)} />
      <span className="w-16 text-right font-mono text-xs text-primary">
        {value}
        {unit ? ` ${unit}` : ""}
      </span>
    </div>
  );
}

function LatencyOffset() {
  const [ms, setMs] = useState(10);
  useEffect(() => setMs(getInputLatencyMs()), []);
  return (
    <label className="flex items-center gap-2 text-xs">
      <input type="range" min={0} max={300} step={1} value={ms} aria-label="Mic recording offset in milliseconds" onChange={(e) => { const v = Number(e.target.value); setMs(v); setInputLatencyMs(v); }} className="w-32 accent-primary" />
      <span className="w-12 text-right text-primary">{ms} ms</span>
    </label>
  );
}

export function Settings() {
  const isMobile = useIsMobile();
  const [activeTab, setActiveTab] = useState("audio");
  const { transport, setTransport, midiInputs, midiInputId, enableMidi, setMidiInput, setPanel } = useStudio();
  const { setStage, setSignedIn } = useApp();
  const deleteAccountFn = useServerFn(deleteMyAccount);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleteText, setDeleteText] = useState("");
  const [deleting, setDeleting] = useState(false);

  const handleDeleteAccount = async () => {
    if (deleting || deleteText !== "DELETE") return;
    setDeleting(true);
    try {
      await deleteAccountFn({});
      await supabase.auth.signOut();
      setSignedIn(false);
      setDeleteOpen(false);
      setStage("welcome");
      toast.success("Your account has been deleted", { description: "Your projects, files and subscription record were removed." });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not delete your account. Try again.");
      setDeleting(false);
    }
  };
  const { email, tier, openUpgrade } = usePlan();
  const [typing, setTyping] = useState(true);
  const [octave, setOctave] = useState(4);
  useEffect(() => {
    const sync = () => { setTyping(qwertyEnabled()); setOctave(qwertyOctave()); };
    sync(); window.addEventListener("synclab:qwerty", sync);
    return () => window.removeEventListener("synclab:qwerty", sync);
  }, []);
  const [p, setP] = useState<Prefs>(DEFAULTS);
  const apple = useIsAppleMobile();
  const [inChan, setInChan] = useState<InputChannel>("stereo");
  const [inGain, setInGain] = useState(0);
  useEffect(() => { setInChan(getInputChannel()); setInGain(getInputGainDb()); }, []);
  const [inputs, setInputs] = useState<{ id: string; label: string }[]>([]);
  const [outputs, setOutputs] = useState<{ id: string; label: string }[]>([]);
  const [scanning, setScanning] = useState(false);
  const mobilePrefs = useMobileAccessibility();
  const [hapticsAvailable, setHapticsAvailable] = useState(false);
  useEffect(() => { setHapticsAvailable(typeof navigator !== "undefined" && typeof navigator.vibrate === "function"); }, []);
  const midiRef = useRef(midiInputs);
  midiRef.current = midiInputs;
  useEffect(() => { if (isMobile) setActiveTab((tab) => tab === "shortcuts" ? tab : "mobile"); }, [isMobile]);
  useEffect(() => {
    const open = () => setActiveTab("shortcuts");
    if (sessionStorage.getItem("synclab.settings.shortcuts") === "open") {
      sessionStorage.removeItem("synclab.settings.shortcuts");
      open();
    }
    window.addEventListener("synclab:shortcuts-settings", open);
    return () => window.removeEventListener("synclab:shortcuts-settings", open);
  }, []);
  useEffect(() => {
    const open = () => {
      if (sessionStorage.getItem("synclab.settings.bluetooth") !== "open") return;
      sessionStorage.removeItem("synclab.settings.bluetooth");
      setActiveTab("audio");
    };
    open();
    window.addEventListener("synclab:bluetooth-settings", open);
    return () => window.removeEventListener("synclab:bluetooth-settings", open);
  }, []);

  const scanDevices = async (askPermission: boolean) => {
    if (typeof navigator === "undefined" || !navigator.mediaDevices?.enumerateDevices) return;
    const blocked = micUnavailableReason();
    if (askPermission && blocked) {
      toast.error("Microphone not available", {
        description: blocked,
        duration: 9000,
        action: { label: "Open in tab", onClick: openInOwnTab },
      });
      return;
    }
    setScanning(true);
    try {
      if (askPermission) {
        const res = await openMic();
        if ("error" in res) {
          toast.error("Could not open your microphone", {
            description: res.error,
            duration: 9000,
            ...(res.canOpenTab ? { action: { label: "Open in tab", onClick: openInOwnTab } } : {}),
          });
          setScanning(false);
          return;
        }
        res.stream.getTracks().forEach((t) => t.stop());
      }
      const list = await listAudioDevices();
      const ins = list.filter((d) => d.kind === "audioinput").map((d) => ({ id: d.id, label: d.label }));
      const outs = list.filter((d) => d.kind === "audiooutput").map((d) => ({ id: d.id, label: d.label }));
      setInputs(ins);
      setOutputs(outs);
      const chosen = getPreferredInput();
      const match = chosen ? ins.find((d) => d.id === chosen) : undefined;
      if (match) set("inputDevice", match.label);
      else if (chosen && ins.length) {
        // The saved interface is gone — fall back so recording keeps working.
        setPreferredInput(null);
        set("inputDevice", "System default");
      }
      if (askPermission)
        toast.success(`${ins.length} audio input${ins.length === 1 ? "" : "s"} found`, {
          description: ins.map((d) => d.label).join(" · ") || "No inputs reported by the browser.",
        });
    } catch {
      toast.error("Could not read your audio devices", {
        description: "Allow microphone access in the browser so interfaces can be listed by name.",
      });
    } finally {
      setScanning(false);
    }
  };

  const scanMidi = () => {
    if (!midiSupported()) {
      toast.error("This browser cannot see MIDI hardware", {
        description: midiUnsupportedMessage(),
      });
      return;
    }
    enableMidi();
    window.setTimeout(() => {
      const found = midiRef.current;
      if (found.length)
        toast.success(`${found.length} MIDI controller${found.length === 1 ? "" : "s"} found`, {
          description: found.map((m) => m.name).join(" · "),
        });
      else
        toast.error("No MIDI controllers found", {
          description: "Connect the controller by USB, then press Scan again.",
        });
    }, 900);
  };

  useEffect(() => {
    try {
      const raw = localStorage.getItem(KEY);
      if (raw) setP({ ...DEFAULTS, ...(JSON.parse(raw) as Partial<Prefs>) });
    } catch {
      /* ignore */
    }
    void scanDevices(false);
    const off = onDeviceChange(() => void scanDevices(false));
    return off;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const set = <K extends keyof Prefs>(k: K, v: Prefs[K]) => {
    setP((prev) => {
      const next = { ...prev, [k]: v };
      try {
        localStorage.setItem(KEY, JSON.stringify(next));
        notifyPreferencesChanged();
      } catch {
        /* ignore */
      }
      return next;
    });
  };

  return (
    <Tabs value={activeTab} onValueChange={setActiveTab} className="grid min-w-0 w-full grid-cols-1 gap-x-4 overflow-x-hidden sm:grid-cols-[148px_minmax(0,1fr)] [&>[role=tabpanel]]:min-w-0 sm:[&>[role=tabpanel]]:col-start-2 sm:[&>[role=tabpanel]]:row-start-2">
      <div className="col-span-full mb-2 flex flex-wrap gap-2">
        {<Button variant="secondary" className="h-12 gap-2 whitespace-nowrap" disabled={scanning} onClick={() => { setActiveTab("audio"); void scanDevices(true); }}><Mic className="size-4" /> {scanning ? "Connecting…" : "Enable microphone"}</Button>}
        <Button variant="outline" className="gap-2" onClick={() => setActiveTab("audio")}><Bluetooth className="size-4" /> Bluetooth devices</Button>
        <Button variant="outline" onClick={() => setActiveTab("diagnostics")}>Diagnostics</Button>
        <Button variant="outline" onClick={() => setActiveTab("shortcuts")}>Keyboard shortcuts</Button>
      </div>
      <TabsList className="flex h-auto max-w-full flex-nowrap justify-start gap-1 overflow-x-auto rounded-none bg-surface sm:col-start-1 sm:row-start-2 sm:flex-col sm:items-stretch sm:self-start sm:overflow-x-hidden">
        {(isMobile ? ["mobile", "general", "shortcuts", "browsing", "audio", "midi", "sync", "controls", "folders", "account", "recording", "metronome", "timing", "timeline", "mixing", "export", "desktop", "diagnostics"] : ["general", "shortcuts", "browsing", "audio", "midi", "sync", "controls", "folders", "account", "recording", "metronome", "timing", "timeline", "mixing", "export", "desktop", "mobile", "diagnostics"]).map((t) => (
          <TabsTrigger key={t} value={t} className="min-h-9 justify-start rounded-none px-3 text-xs sm:w-full">
            {t === "shortcuts" ? "Keyboard shortcuts" : t === "mobile" && isMobile ? "Phone features" : t === "general" ? "User interface" : t === "controls" ? "Other controls" : t}
          </TabsTrigger>
        ))}
      </TabsList>

      <TabsContent value="diagnostics" className="mt-4">
        <SettingsDiagnostics />
      </TabsContent>
      <TabsContent value="shortcuts" className="mt-4"><KeyboardShortcuts /></TabsContent>

      <TabsContent value="audio" className="mt-4">
        <BluetoothDevices
          inputs={inputs}
          outputs={outputs}
          midiInputs={midiInputs}
          onRescan={() => void scanDevices(true)}
          onMidiChanged={(id) => {
            (enableMidi as (o?: { quiet?: boolean }) => void)({ quiet: true });
            if (id) setMidiInput(toggleMidiInput(midiInputId, id, true, midiInputs));
          }}
          onUseInput={(label) => {
            const match = inputs.find((d) => d.label === label);
            set("inputDevice", label);
            setPreferredInput(match?.id ?? null);
            toast.success(`Input set to ${label}`, { description: "Re-arm your track to use it." });
          }}
          onUseOutput={(label) => {
            const match = outputs.find((d) => d.label === label);
            void getEngine()
              .setOutputDevice(match?.id ?? null)
              .then(() => {
                set("outputDevice", label);
                setOutputDevice(match?.id ?? null);
                toast.success(`Output set to ${label}`);
              })
              .catch((e: unknown) => toast.error("Couldn't change output", { description: e instanceof Error ? e.message : "This browser plays through your system output — pick the Bluetooth device in system sound settings." }));
          }}
        />
        <div className="mb-4">
          <AudioInterfaceCard
            inputs={inputs}
            outputs={outputs}
            inputDevice={p.inputDevice}
            channel={inChan}
            sampleRate={getEngine().sampleRate}
            scanning={scanning}
          />
        </div>
        <Row
          label="Input device"
          hint={
            inputs.length
              ? "Recording, sampling and Hum to Beat all use this input"
              : "Press Detect devices to list your audio interface (Volt 1, etc.)"
          }
        >
          <Pick
            value={p.inputDevice}
            options={["System default", ...inputs.map((d) => d.label)]}
            onChange={(v) => {
              set("inputDevice", v);
              const match = inputs.find((d) => d.label === v);
              setPreferredInput(v === "System default" || !match ? null : match.id);
              toast.success(v === "System default" ? "Using the system input" : `Input set to ${v}`);
            }}
          />
        </Row>
        <Row label="Input channel" hint="Pick input 1 or 2 of your interface, or record both as stereo">
          <Pick
            value={inChan === "in1" ? "Input 1 (mono)" : inChan === "in2" ? "Input 2 (mono)" : "Stereo (1+2)"}
            options={["Input 1 (mono)", "Input 2 (mono)", "Stereo (1+2)"]}
            onChange={(v) => {
              const c = v.startsWith("Input 1") ? "in1" : v.startsWith("Input 2") ? "in2" : "stereo";
              setInChan(c);
              setInputChannel(c);
              toast.success("Input channel saved", { description: "Disarm and re-arm the track to apply it." });
            }}
          />
        </Row>
        <Row label="Input gain" hint={`${inGain > 0 ? "+" : ""}${inGain} dB — applied before the meter and the recording`}>
          <Slider
            className="w-40"
            value={[inGain]}
            min={-24}
            max={24}
            step={1}
            onValueChange={([v = 0]) => {
              setInGain(v);
              setInputGainDb(v);
              getEngine().setInputGain(v);
            }}
          />
        </Row>
        <Row label="Input meter" hint="Arm an audio track to open the input">
          <InputMeter />
        </Row>
        <Row
          label="Output device"
          hint={
            !getEngine().canPickOutput || apple
              ? outputRoutingHint(apple)
              : outputs.length
                ? "Speakers, headphones or interface outputs — all playback moves here"
                : "Press Detect devices to list outputs"
          }
        >
          <Pick
            value={p.outputDevice}
            options={["System default", ...outputs.map((d) => d.label)]}
            onChange={(v) => {
              const match = outputs.find((d) => d.label === v);
              const id = v === "System default" || !match ? null : match.id;
              void getEngine()
                .setOutputDevice(id)
                .then(() => {
                  set("outputDevice", v);
                  setOutputDevice(id);
                  toast.success(`Output set to ${v}`);
                })
                .catch((e: unknown) => toast.error("Couldn't change output", { description: e instanceof Error ? e.message : undefined }));
            }}
          />
        </Row>
        <Row
          label="Detect hardware"
          hint="Browsers only reveal device names after you allow microphone access"
        >
          <Button size="sm" variant="secondary" disabled={scanning} onClick={() => void scanDevices(true)}>
            {scanning ? "Scanning…" : "Detect devices"}
          </Button>
        </Row>
        <Row label="Sample rate" hint="Set by your device and browser">
          <span className="font-mono text-sm text-primary">{getEngine().sampleRate} Hz</span>
        </Row>
        <Row label="Input monitoring" hint="Hear yourself while recording">
          <Switch
            checked={Boolean(transport.monitor)}
            onCheckedChange={(v) => {
              setTransport({ monitor: v });
              getEngine().setMonitoring(v);
            }}
          />
        </Row>
        <Row label="Audio buffer" hint="Managed by the browser and operating system; no ASIO/Core Audio buffer control is available."><span className="text-xs text-muted-foreground">Automatic</span></Row>
        <Row label="Output latency" hint="Device-reported estimate; round-trip recording latency is not measured."><span className="text-xs text-primary">{getEngine().ctx ? `${Math.round(((getEngine().ctx?.baseLatency ?? 0) + (getEngine().ctx?.outputLatency ?? 0)) * 1000)} ms` : "Start playback to measure"}</span></Row>
        <Row label="Mic recording offset" hint="Shifts new mic takes earlier to cancel your interface/mic delay. Raise it if vocals land behind the beat."><LatencyOffset /></Row>
        <Row label="Master tuning / background audio" hint="Global tuning is not implemented. Phones and browsers may suspend background playback."><span className="text-xs text-muted-foreground">Not available</span></Row>
      </TabsContent>

      <TabsContent value="recording" className="mt-4">
        <Row label="Audio record" hint="Records only the armed track's selected input — never other tracks, previews or browser audio">
          <span className="font-mono text-xs text-muted-foreground">ARM + REC</span>
        </Row>
        <Row label="Resample / bounce" hint="Render tracks or the master to a file">
          <Button size="sm" variant="secondary" onClick={openExport}>Open export</Button>
        </Row>
        <Row label="Replace overlapping takes">
          <Switch checked={Boolean(transport.replace)} onCheckedChange={(v) => setTransport({ replace: v })} />
        </Row>
        <Row label="Loop recording">
          <Switch checked={Boolean(transport.loop)} onCheckedChange={(v) => setTransport({ loop: v })} />
        </Row>
        <Row label="Overdub">
          <Switch checked={Boolean(transport.overdub)} onCheckedChange={(v) => setTransport({ overdub: v })} />
        </Row>
        <Row label="Punch in" hint="Recording starts at this position">
          <div className="flex items-center gap-2">
            <span className="font-mono text-xs text-primary">{punchLabel(transport.punchIn)}</span>
            <Button size="sm" variant="secondary" onClick={() => setTransport({ punchIn: transport.step })}>Set at playhead</Button>
            <Button size="sm" variant="ghost" disabled={transport.punchIn == null} onClick={() => setTransport({ punchIn: null, punchOut: null })}>Clear</Button>
          </div>
        </Row>
        <Row label="Punch out" hint="Recording stops at this position">
          <div className="flex items-center gap-2">
            <span className="font-mono text-xs text-primary">{punchLabel(transport.punchOut)}</span>
            <Button size="sm" variant="secondary" onClick={() => setTransport({ punchOut: transport.step })}>Set at playhead</Button>
            <Button size="sm" variant="ghost" disabled={transport.punchOut == null} onClick={() => setTransport({ punchOut: null })}>Clear</Button>
          </div>
        </Row>
      </TabsContent>

      <TabsContent value="metronome" className="mt-4">
        <Row label="Metronome">
          <Switch checked={transport.metronome} onCheckedChange={(v) => setTransport({ metronome: v })} />
        </Row>
        <Row label="Count-in">
          <Switch checked={Boolean(transport.countIn)} onCheckedChange={(v) => setTransport({ countIn: v })} />
        </Row>
        <Row label="Count-in length">
          <Pick
            value={p.countInBars}
            options={["1", "2", "4"]}
            onChange={(v) => {
              set("countInBars", v);
              setTransport({ countInBars: Number(v) });
            }}
            width="w-24"
          />
        </Row>
        <Row label="Count-in click" hint="Metronome click during the count-in">
          <Switch checked={transport.countInClick !== false} onCheckedChange={(countInClick) => setTransport({ countInClick })} />
        </Row>
        <Row label="Count-in vibration" hint={hapticsAvailable ? "Haptic pulse on each count-in beat" : "Vibration unavailable in this browser"}>
          <Switch disabled={!hapticsAvailable} checked={hapticsAvailable && !!transport.countInHaptics} onCheckedChange={(countInHaptics) => setTransport({ countInHaptics })} />
        </Row>
        <Row label="Click sound">
          <Pick value={p.clickSound} options={["Detroit Rim", "Click", "Cowbell", "Sidestick", "Beep"]} onChange={(v) => set("clickSound", v)} />
        </Row>
        <Row label="Click level">
          <Num value={Math.round(p.clickLevel * 100)} min={0} max={100} unit="%" onChange={(v) => set("clickLevel", v / 100)} />
        </Row>
        <Row label="Click during playback" hint="Off = click only while recording">
          <Switch checked={p.clickWhilePlaying} onCheckedChange={(v) => set("clickWhilePlaying", v)} />
        </Row>
      </TabsContent>

      <TabsContent value="timing" className="mt-4">
        <Row label="Tempo">
          <Num value={transport.bpm} min={60} max={190} unit="BPM" onChange={(v) => setTransport({ bpm: v })} />
        </Row>
        <Row label="Swing">
          <Num value={Math.round(transport.swing * 100)} min={0} max={60} unit="%" onChange={(v) => setTransport({ swing: v / 100 })} />
        </Row>
        <Row label="Beats per bar" hint="Quarter-note beats shared by the ruler, metronome and looper"><Num value={transport.beatsPerBar ?? 4} min={1} max={12} onChange={(beatsPerBar) => setTransport({ beatsPerBar })} /></Row>
        <Row label="Grid and note quantize"><Button variant="secondary" onClick={() => setActiveTab("timeline")}>Timeline settings</Button></Row>
        <Row label="Project key / scale lock" hint="Set the key in project setup and use the piano roll's scale controls."><Button variant="secondary" onClick={() => setPanel("piano")}>Piano roll</Button></Row>
      </TabsContent>

      <TabsContent value="timeline" className="mt-4">
        <Row label="Snap grid" hint="Used when you move or trim clips on the timeline">
          <Pick
            value={
              ({ 0: "Off", 1: "1/16 note", 2: "1/8 note", 4: "1/4 note", 8: "Half note" } as Record<number, string>)[transport.snap ?? 1] ?? "Bar"
            }
            options={["Off", "1/16 note", "1/8 note", "1/4 note", "Half note", "Bar"]}
            onChange={(v) => setTransport({ snap: ({ Off: 0, "1/16 note": 1, "1/8 note": 2, "1/4 note": 4, "Half note": 8 } as Record<string, number>)[v] ?? stepsPerBar() })}
            width="w-28"
          />
        </Row>
        <Row label="Follow playhead" hint="Scrolls the timeline to keep the playhead in view">
          <Switch checked={!!transport.follow} onCheckedChange={(v) => setTransport({ follow: v })} />
        </Row>
        <Row label="Timeline length">
          <Num value={transport.bars ?? 4} min={1} max={512} unit="bars" onChange={(v) => setTransport({ bars: v })} />
        </Row>
        <Row label="Loop playback">
          <Switch checked={transport.loop} onCheckedChange={(v) => setTransport({ loop: v })} />
        </Row>
      </TabsContent>

      <TabsContent value="midi" className="mt-4">
        <MidiSettingsPanel onDetect={scanMidi} />
        <Row label="MIDI thru" hint="Pass notes to the armed instrument">
          <Switch checked={p.midiThru} onCheckedChange={(v) => set("midiThru", v)} />
        </Row>
        <Row label="Velocity curve">
          <Pick value={p.velocityCurve} options={["Linear", "Soft", "Hard", "Fixed 100"]} onChange={(v) => set("velocityCurve", v)} />
        </Row>
        <Row label="Pitch bend range">
          <Num value={p.pitchBendRange} min={1} max={24} unit="st" onChange={(v) => set("pitchBendRange", v)} />
        </Row>
      </TabsContent>

      <TabsContent value="mixing" className="mt-4">
        <Row label="Master effects" hint="Limiter ceiling, compression, EQ and width use the real master effect chain."><Button variant="secondary" onClick={() => setPanel("mixer")}>Open mixer</Button></Row>
        <Row label="Mastering"><Button variant="secondary" onClick={() => setPanel("mastering")}>Open mastering</Button></Row>
        <Row label="Pan law / headroom target" hint="Global pan-law and headroom-target preferences are not implemented."><span className="text-xs text-muted-foreground">Not available</span></Row>
      </TabsContent>

      <TabsContent value="export" className="mt-4">
        <Row label="Export format">
          <Pick value={p.exportFormat} options={["WAV 16-bit", "WAV 24-bit", "WAV 32 float", "MP3 320", "FLAC"]} onChange={(v) => set("exportFormat", v)} width="w-44" />
        </Row>
        <Row label="Export sample rate">
          <Pick value={p.exportRate} options={["44.1 kHz", "48 kHz", "96 kHz"]} onChange={(v) => set("exportRate", v)} width="w-32" />
        </Row>
        <Row label="Tail length" hint="Extra time for reverb and delay to ring out">
          <Num value={p.exportTail} min={0} max={10} unit="s" onChange={(v) => set("exportTail", v)} />
        </Row>
        <Row label="Normalize on export">
          <Switch checked={p.normalizeExport} onCheckedChange={(v) => set("normalizeExport", v)} />
        </Row>
      </TabsContent>

      <TabsContent value="browsing" className="mt-4">
        <Row label="Sound browser"><Button variant="secondary" onClick={() => setPanel("browser")}>Open sound browser</Button></Row>
        <Row label="Default song / templates" hint="Choose an existing saved template or starter song. Opening a new project discards unsaved edits."><Button variant="secondary" onClick={() => { if (window.confirm("Open project setup? Save your current song first; unsaved changes will be lost.")) setStage("start"); }}>Projects & templates</Button></Row>
        <Row label="Stretch imported audio" hint="Manual stretching is available in the clip editor. Automatic import stretching, cloud-folder mounts and default-sound sorting are not implemented."><span className="text-xs text-muted-foreground">Manual only</span></Row>
        <LibraryPanel />
      </TabsContent>
      <TabsContent value="sync" className="mt-4">
        {["MIDI clock input / output", "Song position / Start / Stop / Continue", "MIDI clock offsets", "Ableton Link"].map((label) => <Row key={label} label={label} hint="External transport synchronization is not implemented."><span className="text-xs text-muted-foreground">Not available now</span></Row>)}
        <Row label="Ableton project handoff" hint="Audio stems and standard MIDI export are available; this is not live synchronization."><Button variant="secondary" onClick={() => setPanel("apps")}>Other apps</Button></Row>
      </TabsContent>
      <TabsContent value="controls" className="mt-4">
        <Row label="Computer keyboard notes"><Switch aria-label="Computer keyboard notes" checked={typing} onCheckedChange={setQwertyEnabled} /></Row>
        <Row label="Typing keyboard octave"><Num value={octave} min={1} max={7} onChange={setQwertyOctave} /></Row>
        <Row label="On-screen piano"><Button variant="secondary" onClick={() => setPanel("keys")}>Open keyboard</Button></Row>
        <Row label="External MIDI instruments" hint="Output port and channels 1–16 are set per instrument track."><Button variant="secondary" onClick={() => setPanel("synth")}>Instrument settings</Button></Row>
        <Row label="External buses A–D" hint="Reason-style external MIDI buses are not implemented."><span className="text-xs text-muted-foreground">Not available</span></Row>
      </TabsContent>
      <TabsContent value="folders" className="mt-4">
        <PluginManager />
        <Row label="Audio folders"><Button variant="secondary" onClick={() => setPanel("browser")}>Open folder browser</Button></Row>
        <Row label="Scratch disk" hint="Working audio uses memory and browser-managed storage. A selectable native scratch disk is not implemented."><span className="text-xs text-muted-foreground">Automatic</span></Row>
      </TabsContent>
      <TabsContent value="account" className="mt-4">
        <Row label="Signed-in account"><span className="break-all text-sm text-primary">{email ?? "Not signed in"}</span></Row>
        <Row label="Access"><span className="text-sm uppercase text-primary">{tier}</span><Button variant="secondary" onClick={() => openUpgrade()}>Manage plan</Button></Row>
        <Row label="Account / sign out" hint="Save your song before leaving the studio."><Button variant="secondary" onClick={() => { if (window.confirm("Return to your account and projects? Save your song first.")) setStage("start"); }}>Account & projects</Button></Row>
        <Row label="Offline authorization" hint="No offline license authorization is implemented. Cloud projects, subscriptions and AI require internet access."><span className="text-xs text-muted-foreground">Not available now</span></Row>
        <Row label="Project saving"><span className="text-xs text-primary">Manual — File → Save</span></Row>
        <div className="mt-6 rounded-md border border-destructive/50 p-4">
          <h3 className="text-sm font-semibold text-destructive">Delete my account</h3>
          <p className="mt-1 text-xs text-muted-foreground">
            Permanently deletes your account, cloud projects, library files and subscription record. This cannot be undone.
          </p>
          <Button variant="destructive" className="mt-3" onClick={() => { setDeleteText(""); setDeleteOpen(true); }}>
            Delete my account
          </Button>
        </div>
        <Dialog open={deleteOpen} onOpenChange={(open) => { if (!deleting) setDeleteOpen(open); }}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Delete your account forever?</DialogTitle>
              <DialogDescription>
                This permanently deletes your SYNCLAB account, all cloud projects, library files and your subscription record. This cannot be undone.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-2">
              <label htmlFor="delete-confirm" className="text-xs font-medium text-muted-foreground">
                Type DELETE to confirm
              </label>
              <Input
                id="delete-confirm"
                value={deleteText}
                onChange={(e) => setDeleteText(e.target.value)}
                placeholder="DELETE"
                autoComplete="off"
                disabled={deleting}
              />
            </div>
            <DialogFooter>
              <Button variant="secondary" onClick={() => setDeleteOpen(false)} disabled={deleting}>
                Cancel
              </Button>
              <Button variant="destructive" onClick={() => void handleDeleteAccount()} disabled={deleteText !== "DELETE" || deleting}>
                {deleting ? "Deleting…" : "Permanently delete my account"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </TabsContent>

      <TabsContent value="desktop" className="mt-4">
        <DesktopPanel />
      </TabsContent>

      <TabsContent value="mobile" className="mt-4">
        <label htmlFor="phone-large-controls" className="settings-row phone-feature-row grid min-h-20 cursor-pointer grid-cols-[minmax(0,1fr)_auto] items-center gap-4 border-b border-border/60 py-3">
          <span className="min-w-0"><span className="block text-base">Extra-large controls</span><span className="block text-sm text-muted-foreground">Larger buttons and more room for your fingers</span></span>
          <Switch id="phone-large-controls" className="h-7 w-12 shrink-0 [&>span]:size-6 data-[state=checked]:[&>span]:translate-x-5" checked={mobilePrefs.extraLargeControls} onCheckedChange={(value) => saveMobileAccessibility({ ...mobilePrefs, extraLargeControls: value })} />
        </label>
        <label htmlFor="phone-text-size" className="settings-row phone-feature-row grid min-h-20 cursor-pointer grid-cols-[minmax(0,1fr)_auto] items-center gap-4 border-b border-border/60 py-3">
          <span className="min-w-0"><span className="block text-base">Increased text size</span><span className="block text-sm text-muted-foreground">Bigger labels and text in the studio</span></span>
          <Switch id="phone-text-size" className="h-7 w-12 shrink-0 [&>span]:size-6 data-[state=checked]:[&>span]:translate-x-5" checked={mobilePrefs.increasedText} onCheckedChange={(value) => saveMobileAccessibility({ ...mobilePrefs, increasedText: value })} />
        </label>
        <label htmlFor="phone-high-contrast" className="settings-row phone-feature-row grid min-h-20 cursor-pointer grid-cols-[minmax(0,1fr)_auto] items-center gap-4 border-b border-border/60 py-3">
          <span className="min-w-0"><span className="block text-base">High-contrast mode</span><span className="block text-sm text-muted-foreground">Clearer text, borders and selected controls</span></span>
          <Switch id="phone-high-contrast" className="h-7 w-12 shrink-0 [&>span]:size-6 data-[state=checked]:[&>span]:translate-x-5" checked={mobilePrefs.highContrast} onCheckedChange={(value) => saveMobileAccessibility({ ...mobilePrefs, highContrast: value })} />
        </label>
        <div className="pt-4">
          <Button variant="secondary" className="h-12" onClick={replayMobileTour}>Replay mobile tour</Button>
        </div>
      </TabsContent>

      <TabsContent value="general" className="mt-4">
        <Row label="Theme, wallpaper and interface mode"><Button variant="secondary" onClick={() => setPanel("appearance")}>Appearance & themes</Button></Row>
        <Row label="Note audition / automation indication" hint="Note audition and per-track automation controls are available in the piano roll and timeline; global switches are not implemented."><Button variant="secondary" onClick={() => setPanel("piano")}>Piano roll</Button></Row>
        <Row label="Rack cable visibility" hint="Front / Back switching is available in Studio View. Automatic cable hiding and adjustable knob ranges are not implemented."><Button variant="secondary" onClick={() => setPanel("studio-view")}>Studio View</Button></Row>
        <Row label="Show tooltips">
          <Switch checked={p.showTooltips} onCheckedChange={(v) => set("showTooltips", v)} />
        </Row>
        <Row label="Reduce motion">
          <Switch checked={p.reduceMotion} onCheckedChange={(v) => set("reduceMotion", v)} />
        </Row>
        <div className="pt-4"><Button variant="secondary" onClick={() => setActiveTab("shortcuts")}>Keyboard shortcuts</Button></div>
        <div className="flex gap-2 pt-4">
          <Button
            size="sm"
            variant="secondary"
            onClick={() => {
              setP(DEFAULTS);
              try {
                localStorage.setItem(KEY, JSON.stringify(DEFAULTS));
                notifyPreferencesChanged();
              } catch {
                /* ignore */
              }
              toast.success("Settings reset to defaults");
            }}
          >
            Reset to defaults
          </Button>
        </div>
      </TabsContent>
    </Tabs>
  );
}

function InputMeter() {
  const bar = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    const id = window.setInterval(() => {
      const v = getEngine().inputLevel();
      if (bar.current) {
        bar.current.style.width = `${Math.min(100, v * 100)}%`;
        bar.current.dataset["clip"] = v >= 0.99 ? "1" : "0";
      }
    }, 50);
    return () => window.clearInterval(id);
  }, []);
  return (
    <div className="h-3 w-40 overflow-hidden rounded-sm bg-surface-2">
      <div ref={bar} className="h-full w-0 bg-primary data-[clip=1]:bg-destructive" />
    </div>
  );
}
