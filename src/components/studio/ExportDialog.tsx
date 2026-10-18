import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { CloudUpload, Download, Share2, Square, Disc3 } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Slider } from "@/components/ui/slider";
import { useStudio } from "@/lib/synclab/store";
import { useApp } from "@/lib/synclab/app-state";
import { getEngine } from "@/lib/synclab/audio-engine";
import { canShareFile, downloadBlob, encodeMp3, normalize, peakOf, shareFile, type Capture } from "@/lib/synclab/bounce";
import {
  applyGain, browserMime, encodeAiff, encodeCaf, encodeFlac, encodeWavDepth, encodeWithBrowser, measureLufs, resample,
  type BitDepth,
} from "@/lib/synclab/export-formats";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { uploadCloudExport } from "@/lib/synclab/cloud";
import { usePlan } from "@/lib/synclab/plan";
import { stepsPerBar } from "@/lib/synclab/timebase";
import { playbackPreferences } from "@/lib/synclab/preferences";

export const EXPORT_EVENT = "synclab:export";
export const openExport = () => window.dispatchEvent(new CustomEvent(EXPORT_EVENT));

type Status = "idle" | "recording" | "encoding" | "done";
type Fmt = "wav" | "aiff" | "flac" | "caf" | "m4a" | "ogg" | "opus" | "mp3";
type Range = "bars" | "loop" | "flags";

const FORMATS: { id: Fmt; label: string; note: string }[] = [
  { id: "wav", label: "Wave File", note: "Uncompressed" },
  { id: "aiff", label: "AIFF File", note: "Uncompressed, Mac" },
  { id: "flac", label: "FLAC File", note: "Lossless, smaller" },
  { id: "caf", label: "CAF File", note: "Apple Core Audio" },
  { id: "m4a", label: "M4A File", note: "AAC" },
  { id: "ogg", label: "Ogg Vorbis File", note: "Compressed" },
  { id: "opus", label: "Opus File", note: "Compressed" },
  { id: "mp3", label: "MP3 File", note: "Compressed" },
];
const LOUDNESS = [
  { id: "ebu", label: "EBU R128", lufs: -23 },
  { id: "spotify", label: "Streaming (Spotify/YouTube)", lufs: -14 },
  { id: "apple", label: "Apple Music", lufs: -16 },
  { id: "club", label: "Club / loud", lufs: -9 },
];

const sel = "h-7 rounded-sm border border-border bg-surface-2 px-1.5 font-mono text-[10px] text-foreground";

interface Result { blob: Blob; name: string }

export function ExportDialog() {
  const { transport, stop, setTransport, addTrack, addClip } = useStudio();
  const [importBack, setImportBack] = useState(false);
  const { project } = useApp();
  const [open, setOpen] = useState(false);
  const [formats, setFormats] = useState<Fmt[]>(["wav"]);
  const [rate, setRate] = useState(44100);
  const [depth, setDepth] = useState<BitDepth>(24);
  const [kbps, setKbps] = useState(256);
  const [range, setRange] = useState<Range>("bars");
  const [bars, setBars] = useState(8);
  const [loud, setLoud] = useState(false);
  const [loudPreset, setLoudPreset] = useState("spotify");
  const [peakDb, setPeakDb] = useState(-1);
  const [norm, setNorm] = useState(true);
  const [tail, setTail] = useState(1);
  const [closeAfter, setCloseAfter] = useState(false);
  const [filename, setFilename] = useState("");
  const [status, setStatus] = useState<Status>("idle");
  const [stage, setStage] = useState("");
  const [elapsed, setElapsed] = useState(0);
  const [results, setResults] = useState<Result[]>([]);
  const [info, setInfo] = useState("");
  const [uploading, setUploading] = useState(false);
  const timer = useRef<number | null>(null);
  const savedLoop = useRef<boolean | null>(null);

  const projectName = project?.name ?? "SYNCLAB Session";
  const safeName = (filename || projectName).replace(/[^\w\-. ]+/g, "").trim() || "synclab-mix";
  const bpb = transport.beatsPerBar ?? 4;
  const stepsBar = stepsPerBar();
  const barSeconds = (60 / transport.bpm) * bpb;
  const flagsOn = transport.exportStart != null && transport.exportEnd != null;
  const loopOk = transport.loopStart != null && transport.loopEnd != null && transport.loopEnd > transport.loopStart;

  const { startStep, lenBars } = useMemo(() => {
    if (range === "flags" && flagsOn) {
      const s = Math.min(transport.exportStart!, transport.exportEnd! - 1);
      const e = Math.max(transport.exportEnd!, s + 1);
      return { startStep: s, lenBars: (e - s) / stepsBar };
    }
    if (range === "loop" && loopOk) return { startStep: transport.loopStart!, lenBars: (transport.loopEnd! - transport.loopStart!) / stepsBar };
    return { startStep: 0, lenBars: bars };
  }, [range, flagsOn, loopOk, transport.exportStart, transport.exportEnd, transport.loopStart, transport.loopEnd, stepsBar, bars]);
  const total = lenBars * barSeconds + tail;

  const support = useMemo(() => {
    const m: Partial<Record<Fmt, string | null>> = {};
    if (typeof window !== "undefined") {
      m.m4a = browserMime("m4a"); m.ogg = browserMime("ogg"); m.opus = browserMime("opus");
    }
    return m;
  }, [open]);
  const unavailable = (f: Fmt) => (f === "m4a" || f === "ogg" || f === "opus") && !support[f];

  const { requirePro } = usePlan();

  useEffect(() => {
    const on = () => {
      if (!requirePro("Exporting audio files")) return;
      const prefs = playbackPreferences();
      const format = prefs.exportFormat;
      setFormats([format.startsWith("MP3") ? "mp3" : format === "FLAC" ? "flac" : "wav"]);
      setDepth(format.includes("16-bit") ? 16 : format.includes("32 float") ? 32 : 24);
      setKbps(format.startsWith("MP3") ? 320 : 256);
      setRate(prefs.exportRate === "96 kHz" ? 96000 : prefs.exportRate === "44.1 kHz" ? 44100 : 48000);
      setNorm(prefs.normalizeExport);
      setTail(prefs.exportTail);
      setRange(flagsOn ? "flags" : transport.loop && loopOk ? "loop" : "bars");
      setOpen(true);
    };
    window.addEventListener(EXPORT_EVENT, on);
    return () => window.removeEventListener(EXPORT_EVENT, on);
  }, [requirePro, flagsOn, loopOk, transport.loop]);

  const encodeOne = async (f: Fmt, cap: Capture): Promise<Blob> => {
    const d16 = depth === 16 ? 16 : 24;
    switch (f) {
      case "wav": return encodeWavDepth(cap, depth);
      case "aiff": return encodeAiff(cap, d16);
      case "flac": return encodeFlac(cap, d16);
      case "caf": return encodeCaf(cap, depth);
      case "mp3": return encodeMp3(cap, Math.min(320, kbps));
      default: return encodeWithBrowser(cap, support[f]!, kbps);
    }
  };
  const ext = (f: Fmt, blob: Blob) => (f === "opus" && blob.type.includes("webm") ? "webm" : f);

  const finish = useCallback(
    async (raw: Capture | null) => {
      if (timer.current) window.clearInterval(timer.current);
      timer.current = null;
      stop();
      if (savedLoop.current != null) { setTransport({ loop: savedLoop.current }); savedLoop.current = null; }
      if (!raw || raw.left.length < 2048) {
        setStatus("idle");
        toast("Nothing was captured", { description: "Make sure your session actually plays, then try again." });
        return;
      }
      setStatus("encoding");
      try {
        setStage("Converting sample rate…");
        let cap = await resample(raw, rate);
        const notes: string[] = [];
        if (loud) {
          setStage("Measuring loudness…");
          const target = LOUDNESS.find((l) => l.id === loudPreset)!.lufs;
          const now = await measureLufs(cap);
          const peak = 20 * Math.log10(Math.max(peakOf(cap), 1e-9));
          if (Number.isFinite(now)) {
            const want = target - now;
            const gain = Math.min(want, peakDb - peak);
            cap = applyGain(cap, gain);
            const reached = now + gain;
            notes.push(`Loudness ${reached.toFixed(1)} LUFS (target ${target})`);
            if (gain < want - 0.5) notes.push(`held back by the ${peakDb} dB peak limit`);
          }
        } else if (norm) cap = normalize(cap);
        const out: Result[] = [];
        for (const f of formats) {
          setStage(`Encoding ${f.toUpperCase()}…${["m4a", "ogg", "opus"].includes(f) ? " (plays through in real time)" : ""}`);
          await new Promise((r) => setTimeout(r, 20));
          const blob = await encodeOne(f, cap);
          out.push({ blob, name: `${safeName}.${ext(f, blob)}` });
        }
        notes.push(`peak ${(20 * Math.log10(Math.max(peakOf(cap), 1e-6))).toFixed(1)} dB · ${rate / 1000} kHz`);
        setInfo(notes.join(" · "));
        setResults(out);
        setStatus("done");
        if (importBack && out[0]) {
          const engine = getEngine();
          await engine.init();
          const nm = `MIX ${safeName}`.toUpperCase().slice(0, 18);
          const loaded = await engine.loadSampleFile(new File([out[0].blob], out[0].name, { type: out[0].blob.type }), nm);
          const id = addTrack("audio", nm);
          if (id) {
            addClip(id, { id: crypto.randomUUID(), name: nm, peaks: loaded.peaks, duration: loaded.duration, url: loaded.url, start: startStep, offset: 0, length: loaded.duration, gain: 1 });
            toast.success("Mixdown placed on a new track");
          }
        }
        if (closeAfter) {
          out.forEach((r) => downloadBlob(r.blob, r.name));
          setOpen(false);
          toast.success(`Exported ${out.length} file${out.length > 1 ? "s" : ""}`);
        }
      } catch (e) {
        setStatus("idle");
        toast.error("Export failed", { description: e instanceof Error ? e.message : String(e) });
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [formats, rate, depth, kbps, loud, loudPreset, peakDb, norm, closeAfter, importBack, startStep, addTrack, addClip, safeName, stop, setTransport, support]
  );

  const start = () => {
    if (!formats.length) { toast("Pick at least one file type"); return; }
    setResults([]);
    setElapsed(0);
    const engine = getEngine();
    stop();
    engine.startCapture();
    setStatus("recording");
    savedLoop.current = transport.loop;
    setTransport({ playing: true, paused: false, step: startStep, loop: range === "loop" });
    const started = performance.now();
    timer.current = window.setInterval(() => {
      const t = (performance.now() - started) / 1000;
      setElapsed(t);
      if (t >= total) void finish(engine.stopCapture());
    }, 100);
  };

  const stopNow = () => void finish(getEngine().stopCapture());
  const busy = status === "recording" || status === "encoding";
  const lossy = formats.some((f) => ["mp3", "m4a", "ogg", "opus"].includes(f));
  const pcmFmt = formats.some((f) => ["wav", "aiff", "flac", "caf"].includes(f));
  const first = results[0];
  const file = first ? new File([first.blob], first.name, { type: first.blob.type }) : null;

  const radio = (id: Range, label: string, ok = true) => (
    <label className={cn("flex items-center gap-2 font-mono text-[10px]", !ok && "opacity-40")}>
      <input type="radio" disabled={!ok || busy} checked={range === id} onChange={() => setRange(id)} className="accent-primary" />
      {label}
    </label>
  );

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v && status === "recording") stopNow(); setOpen(v); }}>
      <DialogContent className="max-h-[92vh] max-w-3xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="font-display uppercase tracking-widest">Export mixdown</DialogTitle>
          <DialogDescription>Your song plays through the mixer and is captured to one or more finished files.</DialogDescription>
        </DialogHeader>

        <div className="grid gap-3 md:grid-cols-2">
          <div className="space-y-3">
            <section className="rounded-sm border border-border bg-surface-2/40 p-2">
              <div className="label-xs mb-1">Filename</div>
              <input value={filename} placeholder={projectName} onChange={(e) => setFilename(e.target.value)} disabled={busy}
                className="h-7 w-full rounded-sm border border-border bg-surface-2 px-2 font-mono text-[11px]" />
              <p className="mt-1 font-mono text-[9px] text-muted-foreground">Files go to your Downloads folder.</p>
            </section>

            <section className="rounded-sm border border-border bg-surface-2/40 p-2">
              <div className="label-xs mb-1">Format — tick one or more</div>
              <div className="grid grid-cols-2 gap-1">
                {FORMATS.map((f) => {
                  const na = unavailable(f.id);
                  const on = formats.includes(f.id);
                  return (
                    <label key={f.id} title={na ? "Your browser can't make this file type — try Chrome, Safari or the desktop app" : f.note}
                      className={cn("flex items-center gap-2 rounded-sm border px-2 py-1.5 font-mono text-[10px]",
                        on ? "border-primary bg-primary/15" : "border-border bg-surface-2", na && "opacity-40")}>
                      <input type="checkbox" className="accent-primary" disabled={na || busy} checked={on}
                        onChange={() => setFormats((l) => (on ? l.filter((x) => x !== f.id) : [...l, f.id]))} />
                      <span>{f.label}{na && <span className="block text-[8px] text-muted-foreground">not in this browser</span>}</span>
                    </label>
                  );
                })}
              </div>
              <div className="mt-2 grid grid-cols-2 gap-2 font-mono text-[10px]">
                <label className="flex flex-col gap-0.5">Sample rate
                  <select className={sel} value={rate} disabled={busy} onChange={(e) => setRate(+e.target.value)}>
                    {[44100, 48000, 88200, 96000].map((r) => <option key={r} value={r}>{r / 1000} kHz</option>)}
                  </select>
                </label>
                {pcmFmt && (
                  <label className="flex flex-col gap-0.5">Bit depth
                    <select className={sel} value={depth} disabled={busy} onChange={(e) => setDepth(+e.target.value as BitDepth)}>
                      <option value={16}>16-bit</option><option value={24}>24-bit</option><option value={32}>32-bit float (WAV/CAF)</option>
                    </select>
                  </label>
                )}
                {lossy && (
                  <label className="flex flex-col gap-0.5">Bitrate
                    <select className={sel} value={kbps} disabled={busy} onChange={(e) => setKbps(+e.target.value)}>
                      {[128, 192, 256, 320].map((k) => <option key={k} value={k}>{k} kbps</option>)}
                    </select>
                  </label>
                )}
              </div>
            </section>
          </div>

          <div className="space-y-3">
            <section className="space-y-1.5 rounded-sm border border-border bg-surface-2/40 p-2">
              <div className="label-xs">Export range</div>
              {radio("bars", "From the start, set length")}
              {range === "bars" && (
                <Slider value={[bars]} min={1} max={Math.max(64, transport.bars)} step={1} disabled={busy} onValueChange={([v = 8]) => setBars(v)} />
              )}
              {radio("loop", "Between loop", loopOk)}
              {radio("flags", "Between export flags", flagsOn)}
              <div className="font-mono text-[10px] text-muted-foreground">
                Duration {lenBars} bars · {Math.floor(total / 60)}:{String(Math.round(total % 60)).padStart(2, "0")} min at {transport.bpm} BPM
              </div>
            </section>

            <section className="space-y-1.5 rounded-sm border border-border bg-surface-2/40 p-2">
              <div className="flex items-center justify-between">
                <span className="label-xs">Adjust loudness</span>
                <Switch checked={loud} onCheckedChange={setLoud} disabled={busy} />
              </div>
              {loud ? (
                <div className="grid grid-cols-2 gap-2 font-mono text-[10px]">
                  <label className="col-span-2 flex flex-col gap-0.5">Target
                    <select className={sel} value={loudPreset} onChange={(e) => setLoudPreset(e.target.value)}>
                      {LOUDNESS.map((l) => <option key={l.id} value={l.id}>{l.label} · {l.lufs} LUFS</option>)}
                    </select>
                  </label>
                  <label className="flex flex-col gap-0.5">Max peak
                    <select className={sel} value={peakDb} onChange={(e) => setPeakDb(+e.target.value)}>
                      {[-0.1, -0.3, -1, -2].map((p) => <option key={p} value={p}>{p} dB</option>)}
                    </select>
                  </label>
                  <p className="text-[9px] leading-tight text-muted-foreground">Gain only — if the peak limit stops it, add the mastering limiter.</p>
                </div>
              ) : (
                <label className="flex items-center justify-between font-mono text-[10px]">
                  Lift to full level (peak just under 0 dB)
                  <Switch checked={norm} onCheckedChange={setNorm} disabled={busy} />
                </label>
              )}
            </section>

            <section className="space-y-1.5 rounded-sm border border-border bg-surface-2/40 p-2">
              <label className="flex items-center justify-between font-mono text-[10px]">
                Import to new track (first file)
                <Switch checked={importBack} onCheckedChange={setImportBack} disabled={busy} />
              </label>
              <label className="flex items-center justify-between font-mono text-[10px]">
                Save and close when finished
                <Switch checked={closeAfter} onCheckedChange={setCloseAfter} disabled={busy} />
              </label>
            </section>
          </div>
        </div>

        {status === "recording" && (
          <div className="rounded-sm border border-destructive/50 bg-destructive/10 px-2 py-2">
            <div className="flex items-center justify-between font-mono text-[10px] uppercase text-destructive">
              <span className="flex items-center gap-1"><Disc3 className="size-3 animate-spin" /> Capturing</span>
              <span>{elapsed.toFixed(1)}s / {total.toFixed(1)}s</span>
            </div>
            <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-background/60">
              <div className="h-full bg-destructive" style={{ width: `${Math.min(100, (elapsed / total) * 100)}%` }} />
            </div>
          </div>
        )}
        {status === "encoding" && <div className="font-mono text-[10px] text-muted-foreground">{stage}</div>}
        {status === "done" && results.length > 0 && (
          <div className="space-y-1 rounded-sm border border-primary/40 bg-primary/10 px-2 py-2 font-mono text-[10px]">
            {results.map((r) => (
              <div key={r.name} className="flex items-center justify-between gap-2">
                <span className="truncate uppercase">{r.name} · {(r.blob.size / 1_000_000).toFixed(2)} MB</span>
                <button className="text-primary underline" onClick={() => downloadBlob(r.blob, r.name)}>Save</button>
              </div>
            ))}
            <div className="text-muted-foreground">{info}</div>
          </div>
        )}

        <div className="flex flex-wrap gap-2">
          {status === "recording" ? (
            <Button variant="destructive" className="flex-1" onClick={stopNow}><Square className="size-4" /> Stop &amp; keep</Button>
          ) : (
            <Button className="flex-1" disabled={status === "encoding"} onClick={start}>
              <Disc3 className="size-4" /> {status === "encoding" ? "Finishing…" : "Export"}
            </Button>
          )}
          <Button variant="outline" disabled={!results.length} onClick={() => results.forEach((r) => downloadBlob(r.blob, r.name))}>
            <Download className="size-4" /> Save all
          </Button>
          <Button variant="outline" disabled={!results.length || uploading}
            onClick={() => {
              setUploading(true);
              void Promise.all(results.map((r) => uploadCloudExport(r.blob, r.name)))
                .then(() => toast.success("Export saved to your cloud"))
                .catch((error: unknown) => toast.error(error instanceof Error ? error.message : "Cloud upload failed"))
                .finally(() => setUploading(false));
            }}>
            <CloudUpload className="size-4" /> {uploading ? "Uploading…" : "Cloud"}
          </Button>
          {file && canShareFile(file) && (
            <Button variant="outline" onClick={() => shareFile(file, projectName).catch(() => toast("Sharing was cancelled"))}>
              <Share2 className="size-4" /> Share
            </Button>
          )}
        </div>
        <p className="font-mono text-[9px] leading-tight text-muted-foreground">
          Capture runs in real time — keep this tab in front. M4A, Ogg and Opus use your browser's own encoder, so they take one extra play-through and appear only where the browser supports them.
        </p>
      </DialogContent>
    </Dialog>
  );
}
