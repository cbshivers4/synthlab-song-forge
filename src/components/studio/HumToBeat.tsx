import { useEffect, useMemo, useRef, useState } from "react";
import { Mic, Play, Plus, RefreshCw, RotateCcw, ScanSearch, Square, Volume2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { openInOwnTab, openMic, preferredRecordingMime, releaseMic } from "@/lib/synclab/mic";
import { useStudio } from "@/lib/synclab/store";
import { getEngine } from "@/lib/synclab/audio-engine";
import { defaultPads } from "@/lib/synclab/presets";
import { stepSeconds, stepsPerBar } from "@/lib/synclab/timebase";
import { analyzeHum, generateBeat, HUM_GENRES, quantize, type HumAnalysis } from "@/lib/synclab/hum-analysis";
import { toast } from "sonner";
import { CreativeToolThemePicker, useCreativeToolTheme } from "./CreativeToolTheme";

type Row = "kick" | "snare" | "hat" | "openhat";
const ROWS: { id: Row; label: string }[] = [
  { id: "kick", label: "KICK" },
  { id: "snare", label: "SNARE" },
  { id: "hat", label: "HAT" },
  { id: "openhat", label: "OPEN" },
];
type Beat = Record<Row, number[]>;

export function HumToBeat() {
  const { addTrack, updatePad, setStepCount, setPanel, select, transport } = useStudio();
  const [recording, setRecording] = useState(false);
  const [busy, setBusy] = useState(false);
  const [take, setTake] = useState<{ url: string; buffer: AudioBuffer } | null>(null);
  const [analysis, setAnalysis] = useState<HumAnalysis | null>(null);
  const [genreId, setGenreId] = useState(HUM_GENRES[0]!.id);
  const [bars, setBars] = useState(1);
  const [variation, setVariation] = useState(0.5);
  const [seed, setSeed] = useState(1);
  const [beat, setBeat] = useState<Beat | null>(null);
  const [previewing, setPreviewing] = useState(false);
  const [playStep, setPlayStep] = useState(-1);
  const recordingRef = useRef<{ recorder: MediaRecorder; stream: MediaStream; chunks: Blob[] } | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const previewRef = useRef<number | null>(null);
  const { theme, setTheme } = useCreativeToolTheme("hum");
  const genre = HUM_GENRES.find((g) => g.id === genreId) ?? HUM_GENRES[0]!;
  const steps = bars * stepsPerBar();

  const stopPreview = () => {
    if (previewRef.current) window.clearInterval(previewRef.current);
    previewRef.current = null;
    setPreviewing(false);
    setPlayStep(-1);
  };

  useEffect(() => () => {
    const current = recordingRef.current;
    if (current) {
      if (current.recorder.state !== "inactive") current.recorder.stop();
      releaseMic(current.stream);
    }
    audioRef.current?.pause();
    if (previewRef.current) window.clearInterval(previewRef.current);
  }, []);
  useEffect(() => () => { if (take) URL.revokeObjectURL(take.url); }, [take]);

  // regenerate whenever the inputs change, so the grid always reflects the real analysis
  useEffect(() => {
    if (!analysis) return;
    const base = quantize(analysis.hits, transport.bpm, steps);
    setBeat(generateBeat(base, genre, variation, seed));
  }, [analysis, genre, variation, seed, steps, transport.bpm]);

  const start = async () => {
    stopPreview();
    const result = await openMic({ echoCancellation: false, noiseSuppression: false, autoGainControl: true }, "hum-to-beat");
    if ("error" in result) {
      toast.error("Microphone not available", {
        description: result.error,
        duration: 9000,
        ...(result.canOpenTab ? { action: { label: "Open in tab", onClick: openInOwnTab } } : {}),
      });
      return;
    }
    const mimeType = preferredRecordingMime();
    const recorder = new MediaRecorder(result.stream, mimeType ? { mimeType } : undefined);
    const chunks: Blob[] = [];
    recorder.ondataavailable = (event) => event.data.size > 0 && chunks.push(event.data);
    recorder.start(100);
    recordingRef.current = { recorder, stream: result.stream, chunks };
    setRecording(true);
  };

  const stop = async () => {
    const current = recordingRef.current;
    if (!current) return;
    setBusy(true);
    const blob = await new Promise<Blob>((resolve) => {
      current.recorder.onstop = () => resolve(new Blob(current.chunks, { type: current.recorder.mimeType }));
      current.recorder.stop();
    });
    releaseMic(current.stream);
    recordingRef.current = null;
    setRecording(false);
    try {
      const ctx = getEngine().init();
      const buffer = await ctx.decodeAudioData(await blob.arrayBuffer());
      setTake({ url: URL.createObjectURL(blob), buffer });
      setAnalysis(null);
      setBeat(null);
      toast.success("Hum recorded", { description: "Replay it, then press Analyze." });
    } catch {
      toast.error("Could not read that recording", { description: "Try again; make sure the microphone picks up your voice." });
    } finally {
      setBusy(false);
    }
  };

  const replay = () => {
    if (!take) return;
    audioRef.current?.pause();
    const a = new Audio(take.url);
    audioRef.current = a;
    void a.play();
  };

  const analyze = () => {
    if (!take) return;
    const a = analyzeHum(take.buffer);
    if (!a.hits.length) {
      toast.error("No rhythm found", { description: "Hum or beatbox short, punchy hits (\"boom\", \"tss\", \"ka\") a little louder." });
      setAnalysis(null);
      return;
    }
    setAnalysis(a);
    toast.success(`${a.hits.length} hits detected`, { description: "Low voiced hits → kick, noisy hits → hat, the rest → snare." });
  };

  const padsFor = useMemo(() => {
    const kit = defaultPads(16, genre.kit);
    return (row: Row) => kit.find((p) => p.id === row)!;
  }, [genre.kit]);

  const preview = () => {
    if (previewing) return stopPreview();
    if (!beat) return;
    const engine = getEngine();
    const ctx = engine.init();
    const dur = stepSeconds(transport.bpm);
    let next = ctx.currentTime + 0.08;
    let n = 0;
    const tick = () => {
      while (next < ctx.currentTime + 0.15) {
        const s = n % steps;
        for (const r of ROWS) {
          const v = beat[r.id][s] ?? 0;
          if (v > 0) engine.playDrum("hum-preview", padsFor(r.id), v, next);
        }
        const at = next, shown = s;
        window.setTimeout(() => setPlayStep(shown), Math.max(0, (at - ctx.currentTime) * 1000));
        next += dur;
        n++;
      }
    };
    tick();
    previewRef.current = window.setInterval(tick, 25);
    setPreviewing(true);
  };

  const addToTimeline = () => {
    if (!beat) return;
    stopPreview();
    const id = addTrack("drum", `HUM ${genre.name.toUpperCase()}`);
    setStepCount(id, steps);
    for (const p of defaultPads(steps, genre.kit)) {
      const row = (ROWS.find((r) => r.id === p.id)?.id ?? null) as Row | null;
      updatePad(id, p.id, { kit: genre.kit, steps: row ? beat[row] : new Array(steps).fill(0) });
    }
    select(id);
    setPanel("drums");
    toast.success("Beat added to the timeline", { description: "It's a new drum track; edit it in the Drum Machine." });
  };

  const toggleCell = (row: Row, i: number) =>
    setBeat((b) => (b ? { ...b, [row]: b[row].map((v, j) => (j === i ? (v ? 0 : 0.8) : v)) } : b));

  return (
    <div className="creative-tool mx-auto max-w-3xl space-y-4 p-3" data-creative-theme={theme}>
      <div className="flex justify-end"><CreativeToolThemePicker tool="hum" theme={theme} onChange={setTheme} /></div>
      <div>
        <h3 className="font-display text-lg font-semibold">Hum or beatbox a rhythm</h3>
        <p className="mt-1 text-sm text-muted-foreground">
          Record → Replay → Analyze → Preview → Add to timeline. Analysis runs on this device: it finds each hit, measures its pitch and brightness, and snaps it to the {transport.bpm} BPM grid starting from your first hit.
        </p>
      </div>

      <div className="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap">
        <Button className="min-h-12 gap-2" variant={recording ? "destructive" : "default"} disabled={busy} onClick={() => (recording ? void stop() : void start())}>
          {recording ? <Square className="size-4" /> : <Mic className="size-4" />} {recording ? "Stop" : take ? "Record again" : "Record"}
        </Button>
        <Button className="min-h-12 gap-2" variant="secondary" disabled={!take || recording} onClick={replay}>
          <Volume2 className="size-4" /> Replay
        </Button>
        <Button className="min-h-12 gap-2" variant="secondary" disabled={!take || recording} onClick={analyze}>
          <ScanSearch className="size-4" /> Analyze
        </Button>
        <Button className="min-h-12 gap-2" variant="secondary" disabled={!beat} onClick={preview}>
          {previewing ? <Square className="size-4" /> : <Play className="size-4" />} {previewing ? "Stop preview" : "Preview"}
        </Button>
        <Button className="min-h-12 gap-2" variant="outline" disabled={!analysis} onClick={() => setSeed((s) => s + 1)}>
          <RefreshCw className="size-4" /> Regenerate
        </Button>
        <Button className="min-h-12 gap-2" disabled={!beat} onClick={addToTimeline}>
          <Plus className="size-4" /> Add to timeline
        </Button>
      </div>

      {take && (
        <div className="rounded-sm border border-border bg-surface-2/50 p-2">
          <div className="label-xs mb-1">YOUR TAKE · {take.buffer.duration.toFixed(1)}s{analysis ? ` · ${analysis.hits.length} hits` : ""}</div>
          <div className="relative flex h-12 items-center gap-px">
            {(analysis?.envelope ?? []).map((v, i) => (
              <div key={i} className="flex-1 rounded-[1px] bg-primary/60" style={{ height: `${Math.max(4, v * 100)}%` }} />
            ))}
            {!analysis && <span className="text-xs text-muted-foreground">Press Analyze to find the hits in this take.</span>}
            {analysis?.hits.map((h, i) => (
              <span key={i} className="absolute top-0 h-full w-0.5 bg-accent" style={{ left: `${(h.time / analysis.duration) * 100}%` }} title={`${h.cls} · ${h.pitch ? Math.round(h.pitch) + " Hz" : "unpitched"}`} />
            ))}
          </div>
        </div>
      )}

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <label className="text-xs">
          <span className="label-xs">GENRE / KIT</span>
          <select className="mt-1 block w-full rounded-sm border border-border bg-background px-2 py-2" value={genreId} onChange={(e) => setGenreId(e.target.value)}>
            {HUM_GENRES.map((g) => <option key={g.id} value={g.id}>{g.name}</option>)}
          </select>
        </label>
        <label className="text-xs">
          <span className="label-xs">LENGTH</span>
          <select className="mt-1 block w-full rounded-sm border border-border bg-background px-2 py-2" value={bars} onChange={(e) => setBars(Number(e.target.value))}>
            {[1, 2, 4].map((b) => <option key={b} value={b}>{b} bar{b > 1 ? "s" : ""}</option>)}
          </select>
        </label>
        <label className="col-span-2 text-xs">
          <span className="label-xs">VARIATION {Math.round(variation * 100)}%</span>
          <input type="range" min={0} max={1} step={0.05} value={variation} onChange={(e) => setVariation(Number(e.target.value))} className="mt-3 block w-full" />
        </label>
      </div>

      {beat ? (
        <div className="space-y-1 overflow-x-auto">
          {ROWS.map((r) => (
            <div key={r.id} className="flex items-center gap-1">
              <span className="w-12 shrink-0 font-mono text-[10px] text-muted-foreground">{r.label}</span>
              {beat[r.id].map((v, i) => (
                <button
                  key={i}
                  type="button"
                  aria-label={`${r.label} step ${i + 1}`}
                  onClick={() => toggleCell(r.id, i)}
                  className={`h-8 min-w-5 flex-1 touch-manipulation rounded-[3px] border ${v ? "border-primary bg-primary" : i % 4 === 0 ? "border-border bg-surface-2" : "border-border/60 bg-surface"} ${playStep === i ? "ring-2 ring-accent" : ""}`}
                  style={v ? { opacity: 0.4 + v * 0.6 } : undefined}
                />
              ))}
            </div>
          ))}
          <p className="pt-1 text-xs text-muted-foreground">Your detected hits are always kept; the genre adds supporting hats and backbeat. Tap any cell to fix it.</p>
        </div>
      ) : (
        <p className="rounded-sm border border-dashed border-border p-4 text-center text-sm text-muted-foreground">
          No beat yet — record a hum and press Analyze. Nothing is generated until real hits are detected.
        </p>
      )}
      <div className="flex justify-end">
        <Button size="sm" variant="ghost" disabled={recording} onClick={() => { stopPreview(); setTake(null); setAnalysis(null); setBeat(null); }}>
          <RotateCcw className="size-4" /> Clear
        </Button>
      </div>
    </div>
  );
}
