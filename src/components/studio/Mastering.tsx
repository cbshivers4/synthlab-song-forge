import { useEffect, useRef, useState } from "react";
import { Download, Gauge, Play, Square } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { useStudio } from "@/lib/synclab/store";
import { useApp } from "@/lib/synclab/app-state";
import { getEngine } from "@/lib/synclab/audio-engine";
import { downloadBlob, encodeMp3, encodeWav, type Capture } from "@/lib/synclab/bounce";
import {
  MASTER_DEFAULTS,
  MASTER_PRESETS,
  master,
  measure,
  type LoudnessReport,
  type MasterResult,
  type MasterSettings,
} from "@/lib/synclab/mastering";

type Phase = "idle" | "capturing" | "working" | "ready";

const KNOBS: { key: keyof MasterSettings; label: string; min: number; max: number; step: number; unit: string; hint: string }[] = [
  { key: "targetLufs", label: "Loudness", min: -24, max: -5, step: 0.5, unit: "LUFS", hint: "How loud the finished track sits" },
  { key: "ceilingDb", label: "Ceiling", min: -3, max: -0.1, step: 0.1, unit: "dBTP", hint: "Highest peak allowed — keeps it from distorting" },
  { key: "bass", label: "Bass", min: -6, max: 6, step: 0.25, unit: "dB", hint: "Low end weight at 90 Hz" },
  { key: "air", label: "Air", min: -6, max: 6, step: 0.25, unit: "dB", hint: "Top end sparkle at 6 kHz" },
  { key: "width", label: "Width", min: 0, max: 2, step: 0.05, unit: "x", hint: "Stereo spread — 1 leaves it as mixed" },
  { key: "glue", label: "Glue", min: 0, max: 1, step: 0.05, unit: "", hint: "Holds the mix together" },
  { key: "drive", label: "Drive", min: 0, max: 1, step: 0.05, unit: "", hint: "Warmth and saturation" },
  { key: "monoBass", label: "Mono bass", min: 0, max: 250, step: 5, unit: "Hz", hint: "Keeps deep bass centred" },
];

const fmt = (v: number, unit: string) => `${v > 0 && (unit === "dB" ) ? "+" : ""}${v.toFixed(unit === "Hz" ? 0 : 2)}${unit ? ` ${unit}` : ""}`;

function Meter({ label, value, unit, good }: { label: string; value: number; unit: string; good?: boolean | undefined }) {
  return (
    <div className="rounded-sm border border-border bg-surface-2 px-2 py-1.5">
      <div className="label-xs">{label}</div>
      <div className={cn("font-mono text-sm", good === false ? "text-destructive" : good ? "text-primary" : "text-foreground")}>
        {Number.isFinite(value) ? value.toFixed(1) : "—"}
        <span className="ml-1 text-[9px] text-muted-foreground">{unit}</span>
      </div>
    </div>
  );
}

/**
 * Mastering panel — bounces the song through the mixer, measures real loudness
 * (BS.1770) and renders a mastered version you can compare and download.
 */
export function Mastering() {
  const { transport, stop, setTransport } = useStudio();
  const { project } = useApp();
  const [settings, setSettings] = useState<MasterSettings>(MASTER_DEFAULTS);
  const [presetId, setPresetId] = useState("streaming");
  const [phase, setPhase] = useState<Phase>("idle");
  const [progress, setProgress] = useState(0);
  const [elapsed, setElapsed] = useState(0);
  const [capture, setCapture] = useState<Capture | null>(null);
  const [before, setBefore] = useState<LoudnessReport | null>(null);
  const [result, setResult] = useState<MasterResult | null>(null);
  const [compare, setCompare] = useState<"master" | "original">("master");
  const timer = useRef<number | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [playing, setPlaying] = useState(false);

  const safeName = (project?.name ?? "synclab-master").replace(/[^\w\-. ]+/g, "").trim() || "synclab-master";
  const barSeconds = (60 / transport.bpm) * 4;
  const bars = Math.max(1, transport.bars ?? 8);
  const total = bars * barSeconds + 0.6;

  useEffect(() => () => {
    if (timer.current) window.clearInterval(timer.current);
    audioRef.current?.pause();
  }, []);

  const set = (k: keyof MasterSettings, v: number | boolean) => {
    setSettings((s) => ({ ...s, [k]: v }));
    setPresetId("custom");
  };

  const runMaster = async (cap: Capture, s = settings) => {
    setPhase("working");
    setProgress(0);
    try {
      const out = await master(cap, s, (_stage, pct) => setProgress(pct));
      setResult(out);
      setBefore(out.before);
      setPhase("ready");
      toast.success("Master finished", {
        description: `${out.after.lufs.toFixed(1)} LUFS, peaks at ${out.after.truePeakDb.toFixed(1)} dB.`,
      });
    } catch (err) {
      setPhase(capture ? "ready" : "idle");
      toast.error("The master could not be finished", {
        description: err instanceof Error ? err.message : "Try a shorter section of the song.",
      });
    }
  };

  const finishCapture = async (cap: Capture | null) => {
    if (timer.current) window.clearInterval(timer.current);
    timer.current = null;
    stop();
    if (!cap || cap.left.length < 4096) {
      setPhase("idle");
      toast("Nothing was captured", { description: "Make sure the song actually plays, then press Bounce again." });
      return;
    }
    setCapture(cap);
    setBefore(await measure(cap));
    await runMaster(cap);
  };

  const bounce = () => {
    setResult(null);
    setElapsed(0);
    const engine = getEngine();
    stop();
    engine.startCapture();
    setPhase("capturing");
    setTransport({ playing: true, paused: false, step: 0 });
    const started = performance.now();
    timer.current = window.setInterval(() => {
      const t = (performance.now() - started) / 1000;
      setElapsed(t);
      if (t >= total) void finishCapture(engine.stopCapture());
    }, 100);
  };

  const audition = () => {
    const cap = compare === "master" ? result?.audio : capture;
    if (!cap) return;
    audioRef.current?.pause();
    if (playing) {
      setPlaying(false);
      return;
    }
    const url = URL.createObjectURL(encodeWav(cap));
    const el = new Audio(url);
    el.onended = () => {
      setPlaying(false);
      URL.revokeObjectURL(url);
    };
    audioRef.current = el;
    void el.play();
    setPlaying(true);
  };

  const save = (format: "wav" | "mp3") => {
    if (!result) return;
    const blob = format === "wav" ? encodeWav(result.audio) : encodeMp3(result.audio, 320);
    downloadBlob(blob, `${safeName}-master.${format}`);
  };

  const busy = phase === "capturing" || phase === "working";

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2 rounded-sm border border-border bg-surface-2/60 p-2">
        <Gauge className="size-4 text-primary" />
        <span className="font-display text-[11px] font-semibold tracking-[0.2em]">MASTERING</span>
        <span className="label-xs">real loudness measurement · true-peak limiting</span>
        <div className="ml-auto flex items-center gap-2">
          {phase === "capturing" && (
            <Button size="sm" variant="destructive" className="h-8 gap-1.5" onClick={() => void finishCapture(getEngine().stopCapture())}>
              <Square className="size-3.5" /> Stop
            </Button>
          )}
          <Button size="sm" className="h-8 gap-1.5 font-mono text-[10px] uppercase tracking-widest" disabled={busy} onClick={bounce}>
            <Play className="size-3.5" />
            {phase === "capturing" ? `Bouncing ${elapsed.toFixed(0)}s` : phase === "working" ? `Mastering ${(progress * 100) | 0}%` : "Bounce & master"}
          </Button>
        </div>
      </div>

      <div>
        <div className="label-xs mb-1">Style</div>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          {MASTER_PRESETS.map((p) => (
            <button
              key={p.id}
              type="button"
              title={p.note}
              onClick={() => {
                setPresetId(p.id);
                setSettings(p.settings);
                if (capture) void runMaster(capture, p.settings);
              }}
              className={cn(
                "rounded-sm border px-2 py-2 text-left",
                presetId === p.id ? "border-primary bg-primary/15" : "border-border bg-surface-2",
              )}
            >
              <div className="font-mono text-[10px] uppercase tracking-widest">{p.name}</div>
              <div className="mt-0.5 text-[9px] leading-tight text-muted-foreground">{p.note}</div>
            </button>
          ))}
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        {KNOBS.map((k) => (
          <div key={k.key} className="rounded-sm border border-border bg-surface-2/50 p-2" title={k.hint}>
            <div className="mb-1 flex items-center justify-between">
              <span className="label-xs">{k.label}</span>
              <span className="font-mono text-[10px] text-muted-foreground">{fmt(settings[k.key] as number, k.unit)}</span>
            </div>
            <Slider
              min={k.min}
              max={k.max}
              step={k.step}
              value={[settings[k.key] as number]}
              onValueChange={([v]) => set(k.key, v ?? 0)}
              onValueCommit={() => capture && void runMaster(capture)}
            />
          </div>
        ))}
        <div className="flex items-center justify-between rounded-sm border border-border bg-surface-2/50 p-2">
          <div>
            <div className="label-xs">Dither</div>
            <div className="text-[9px] text-muted-foreground">Smooths the very quietest detail for CD-style files</div>
          </div>
          <Switch
            checked={settings.dither}
            onCheckedChange={(v) => {
              set("dither", v);
              if (capture) void runMaster(capture, { ...settings, dither: v });
            }}
          />
        </div>
      </div>

      {(before || result) && (
        <div className="space-y-2">
          <div className="label-xs">Measured</div>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            <Meter label="Before · loudness" value={before?.lufs ?? NaN} unit="LUFS" />
            <Meter label="Before · peak" value={before?.truePeakDb ?? NaN} unit="dBTP" />
            <Meter
              label="After · loudness"
              value={result?.after.lufs ?? NaN}
              unit="LUFS"
              good={result ? Math.abs(result.after.lufs - settings.targetLufs) < 1 : undefined}
            />
            <Meter
              label="After · peak"
              value={result?.after.truePeakDb ?? NaN}
              unit="dBTP"
              good={result ? result.after.truePeakDb <= settings.ceilingDb + 0.2 : undefined}
            />
            <Meter label="Dynamics (LRA)" value={result?.after.lra ?? before?.lra ?? NaN} unit="LU" />
            <Meter label="Headroom (PLR)" value={result?.after.plr ?? before?.plr ?? NaN} unit="dB" />
            <Meter label="Gain applied" value={result?.matchDb ?? NaN} unit="dB" />
            <Meter label="Length" value={capture ? capture.left.length / capture.sampleRate : NaN} unit="sec" />
          </div>
        </div>
      )}

      {result && (
        <div className="flex flex-wrap items-center gap-2 rounded-sm border border-border bg-surface-2/60 p-2">
          <div className="flex overflow-hidden rounded-sm border border-border">
            {(["original", "master"] as const).map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => {
                  setCompare(m);
                  audioRef.current?.pause();
                  setPlaying(false);
                }}
                className={cn(
                  "px-2 py-1 font-mono text-[10px] uppercase",
                  compare === m ? "bg-primary text-primary-foreground" : "bg-surface-2 text-muted-foreground",
                )}
              >
                {m}
              </button>
            ))}
          </div>
          <Button size="sm" variant="outline" className="h-8 gap-1.5" onClick={audition}>
            {playing ? <Square className="size-3.5" /> : <Play className="size-3.5" />}
            {playing ? "Stop" : `Listen to ${compare}`}
          </Button>
          <Button size="sm" variant="outline" className="ml-auto h-8 gap-1.5" onClick={() => save("wav")}>
            <Download className="size-3.5" /> WAV
          </Button>
          <Button size="sm" variant="outline" className="h-8 gap-1.5" onClick={() => save("mp3")}>
            <Download className="size-3.5" /> MP3
          </Button>
        </div>
      )}

      <p className="text-[10px] leading-relaxed text-muted-foreground">
        This is real measuring and processing done on your device — loudness is read the same way streaming services read it, and the
        ceiling is held by a true-peak limiter. It shapes and levels a finished mix; it cannot repair a mix that needs fixing at the
        channels first.
      </p>
    </div>
  );
}
