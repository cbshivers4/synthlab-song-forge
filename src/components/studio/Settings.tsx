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
import { midiSupported } from "@/lib/synclab/midi";
import { DesktopPanel } from "@/components/studio/DesktopPanel";

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
  autosave: boolean;
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
  autosave: true,
  waveformDetail: "High",
  showTooltips: true,
  reduceMotion: false,
};

const KEY = "synclab.prefs";

function Row({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-4 border-b border-border/60 py-2.5 last:border-0">
      <div className="min-w-0">
        <div className="text-sm">{label}</div>
        {hint && <div className="text-xs text-muted-foreground">{hint}</div>}
      </div>
      <div className="flex shrink-0 items-center gap-2">{children}</div>
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

export function Settings() {
  const { transport, setTransport, midiInputs, midiInputId, enableMidi, setMidiInput } = useStudio();
  const [p, setP] = useState<Prefs>(DEFAULTS);
  const [inputs, setInputs] = useState<{ id: string; label: string }[]>([]);
  const [outputs, setOutputs] = useState<{ id: string; label: string }[]>([]);
  const [scanning, setScanning] = useState(false);
  const midiRef = useRef(midiInputs);
  midiRef.current = midiInputs;

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
        description: "Use Chrome or Edge on a computer to connect MIDI controllers.",
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
      } catch {
        /* ignore */
      }
      return next;
    });
  };

  return (
    <Tabs defaultValue="audio" className="w-full">
      <TabsList className="flex h-auto flex-wrap justify-start gap-1 bg-surface">
        {["audio", "recording", "metronome", "timing", "timeline", "midi", "mixing", "export", "desktop", "general"].map((t) => (
          <TabsTrigger key={t} value={t} className="font-mono text-[11px] uppercase tracking-widest">
            {t}
          </TabsTrigger>
        ))}
      </TabsList>

      <TabsContent value="audio" className="mt-4">
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
        <Row label="Output device" hint={outputs.length ? "Monitors, headphones or interface outputs" : ""}>
          <Pick
            value={p.outputDevice}
            options={["System default", ...outputs.map((d) => d.label)]}
            onChange={(v) => set("outputDevice", v)}
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
        <Row label="Sample rate" hint="Higher rates cost more CPU">
          <Pick value={p.sampleRate} options={["44100", "48000", "88200", "96000"]} onChange={(v) => set("sampleRate", v)} width="w-32" />
        </Row>
        <Row label="Buffer size" hint="Lower = less latency, more glitch risk">
          <Pick value={p.bufferSize} options={["64", "128", "256", "512", "1024"]} onChange={(v) => set("bufferSize", v)} width="w-32" />
        </Row>
        <Row label="Bit depth">
          <Pick value={p.bitDepth} options={["16", "24", "32 float"]} onChange={(v) => set("bitDepth", v)} width="w-32" />
        </Row>
        <Row label="Latency compensation">
          <Num value={p.latency} min={0} max={100} unit="ms" onChange={(v) => set("latency", v)} />
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
        <div className="pt-3">
          <Button size="sm" variant="secondary" onClick={() => toast.success("Audio engine restarted", { description: `${p.sampleRate} Hz · ${p.bufferSize} samples` })}>
            Apply audio settings
          </Button>
        </div>
      </TabsContent>

      <TabsContent value="recording" className="mt-4">
        <Row label="Record file format">
          <Pick value={p.recFormat} options={["WAV", "AIFF", "FLAC", "MP3 320"]} onChange={(v) => set("recFormat", v)} width="w-32" />
        </Row>
        <Row label="Record mode">
          <Pick value={p.recMode} options={["Replace", "Overdub", "Punch", "Loop takes"]} onChange={(v) => set("recMode", v)} />
        </Row>
        <Row label="Keep take lanes" hint="Stack every pass as a separate take">
          <Switch checked={p.takeLanes} onCheckedChange={(v) => set("takeLanes", v)} />
        </Row>
        <Row label="Auto-quantize while recording">
          <Switch checked={p.autoQuantizeRec} onCheckedChange={(v) => set("autoQuantizeRec", v)} />
        </Row>
        <Row label="Loop recording">
          <Switch checked={Boolean(transport.loop)} onCheckedChange={(v) => setTransport({ loop: v })} />
        </Row>
        <Row label="Overdub">
          <Switch checked={Boolean(transport.overdub)} onCheckedChange={(v) => setTransport({ overdub: v })} />
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
        <Row label="Time signature">
          <Pick value={p.timeSig} options={["4/4", "3/4", "6/8", "5/4", "7/8"]} onChange={(v) => set("timeSig", v)} width="w-24" />
        </Row>
        <Row label="Project key">
          <Pick
            value={p.key}
            options={["A minor", "C minor", "D minor", "F minor", "G minor", "C major", "F major", "G major"]}
            onChange={(v) => set("key", v)}
          />
        </Row>
        <Row label="Snap">
          <Pick value={p.snap} options={["Grid", "Off", "Events", "Bar"]} onChange={(v) => set("snap", v)} width="w-28" />
        </Row>
        <Row label="Default quantize">
          <Pick value={p.gridQuantize} options={["1/4", "1/8", "1/16", "1/32"]} onChange={(v) => set("gridQuantize", v)} width="w-24" />
        </Row>
        <Row label="Scale lock in piano roll">
          <Switch checked={p.scaleLock} onCheckedChange={(v) => set("scaleLock", v)} />
        </Row>
      </TabsContent>

      <TabsContent value="timeline" className="mt-4">
        <Row label="Snap grid" hint="Used when you move or trim clips on the timeline">
          <Pick
            value={
              (transport.snap ?? 1) === 0 ? "Off" : (transport.snap ?? 1) === 1 ? "1/4 note" : (transport.snap ?? 1) === 2 ? "Half bar" : "Bar"
            }
            options={["Off", "1/4 note", "Half bar", "Bar"]}
            onChange={(v) => setTransport({ snap: v === "Off" ? 0 : v === "1/4 note" ? 1 : v === "Half bar" ? 2 : 4 })}
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
        <Row
          label="MIDI controller"
          hint={
            midiInputs.length
              ? `${midiInputs.length} connected`
              : "Connect a controller and press Scan — Chrome and Edge support MIDI hardware"
          }
        >
          <Pick
            value={
              midiInputId === "all"
                ? "All devices"
                : (midiInputs.find((i) => i.id === midiInputId)?.name ?? "None")
            }
            options={["None", "All devices", ...midiInputs.map((i) => i.name)]}
            onChange={(v) => {
              if (v === "None") setMidiInput(null);
              else if (v === "All devices") setMidiInput("all");
              else setMidiInput(midiInputs.find((i) => i.name === v)?.id ?? null);
              set("midiInput", v);
            }}
          />
          <Button size="sm" variant="secondary" onClick={scanMidi}>
            Scan
          </Button>
        </Row>
        <Row
          label="Controllers found"
          hint={midiSupported() ? "Keyboards, pad controllers and control surfaces" : "MIDI needs Chrome or Edge"}
        >
          <div className="max-w-[18rem] text-right font-mono text-xs text-primary">
            {midiInputs.length ? midiInputs.map((m) => <div key={m.id}>{m.name}</div>) : (
              <span className="text-muted-foreground">None connected</span>
            )}
          </div>
        </Row>
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
        <Row label="Master limiter">
          <Switch checked={p.masterLimiter} onCheckedChange={(v) => set("masterLimiter", v)} />
        </Row>
        <Row label="Output ceiling">
          <Num value={p.masterCeiling} min={-12} max={0} step={0.1} unit="dB" onChange={(v) => set("masterCeiling", v)} />
        </Row>
        <Row label="Mix headroom target">
          <Num value={p.headroom} min={-18} max={0} unit="dB" onChange={(v) => set("headroom", v)} />
        </Row>
        <Row label="Pan law">
          <Pick value={p.panLaw} options={["0 dB", "-3 dB", "-4.5 dB", "-6 dB"]} onChange={(v) => set("panLaw", v)} width="w-28" />
        </Row>
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

      <TabsContent value="desktop" className="mt-4">
        <DesktopPanel />
      </TabsContent>

      <TabsContent value="general" className="mt-4">
        <Row label="Auto-save session">
          <Switch checked={p.autosave} onCheckedChange={(v) => set("autosave", v)} />
        </Row>
        <Row label="Waveform detail">
          <Pick value={p.waveformDetail} options={["Low", "Medium", "High"]} onChange={(v) => set("waveformDetail", v)} width="w-32" />
        </Row>
        <Row label="Show tooltips">
          <Switch checked={p.showTooltips} onCheckedChange={(v) => set("showTooltips", v)} />
        </Row>
        <Row label="Reduce motion">
          <Switch checked={p.reduceMotion} onCheckedChange={(v) => set("reduceMotion", v)} />
        </Row>
        <div className="mt-4 rounded-lg border border-border bg-surface p-3">
          <div className="label-xs mb-2">Keyboard shortcuts</div>
          <div className="grid gap-1 font-mono text-[11px] text-muted-foreground sm:grid-cols-2">
            <span>SPACE — play / pause</span>
            <span>R — record</span>
            <span>M — mute selected</span>
            <span>S — solo selected</span>
            <span>T — add track</span>
            <span>Q — quantize notes</span>
            <span>D — duplicate</span>
            <span>DEL — delete selection</span>
          </div>
        </div>
        <div className="flex gap-2 pt-4">
          <Button
            size="sm"
            variant="secondary"
            onClick={() => {
              setP(DEFAULTS);
              try {
                localStorage.setItem(KEY, JSON.stringify(DEFAULTS));
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
