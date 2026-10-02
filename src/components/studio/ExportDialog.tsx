import { useCallback, useEffect, useRef, useState } from "react";
import { CloudUpload, Download, Share2, Square, Disc3 } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Slider } from "@/components/ui/slider";
import { useStudio } from "@/lib/synclab/store";
import { useApp } from "@/lib/synclab/app-state";
import { getEngine } from "@/lib/synclab/audio-engine";
import { canShareFile, downloadBlob, encodeMp3, encodeWav, normalize, peakOf, shareFile, type Capture } from "@/lib/synclab/bounce";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { uploadCloudExport } from "@/lib/synclab/cloud";
import { usePlan } from "@/lib/synclab/plan";

export const EXPORT_EVENT = "synclab:export";
export const openExport = () => window.dispatchEvent(new CustomEvent(EXPORT_EVENT));

type Status = "idle" | "recording" | "encoding" | "done";

export function ExportDialog() {
  const { transport, stop, setTransport } = useStudio();
  const { project } = useApp();
  const [open, setOpen] = useState(false);
  const [format, setFormat] = useState<"wav" | "mp3">("wav");
  const [bars, setBars] = useState(8);
  const [norm, setNorm] = useState(true);
  const [status, setStatus] = useState<Status>("idle");
  const [elapsed, setElapsed] = useState(0);
  const [result, setResult] = useState<{ blob: Blob; name: string; peak: number } | null>(null);
  const [uploading, setUploading] = useState(false);
  const timer = useRef<number | null>(null);

  const projectName = project?.name ?? "SYNCLAB Session";
  const safeName = projectName.replace(/[^\w\-. ]+/g, "").trim() || "synclab-mix";
  const barSeconds = (60 / transport.bpm) * 4;
  const flagsOn = transport.exportStart != null && transport.exportEnd != null;
  const flagStart = flagsOn ? Math.min(transport.exportStart!, transport.exportEnd! - 1) : 0;
  const flagEnd = flagsOn ? Math.max(transport.exportEnd!, flagStart + 1) : 0;
  const flagBars = (flagEnd - flagStart) / 16;
  const total = (flagsOn ? flagBars : bars) * barSeconds + 1;

  const { requirePro } = usePlan();

  useEffect(() => {
    const on = () => {
      if (!requirePro("Exporting WAV / MP3 files")) return;
      setOpen(true);
    };
    window.addEventListener(EXPORT_EVENT, on);
    return () => window.removeEventListener(EXPORT_EVENT, on);
  }, [requirePro]);

  const finish = useCallback(
    async (cap: Capture | null) => {
      if (timer.current) window.clearInterval(timer.current);
      timer.current = null;
      stop();
      if (!cap || cap.left.length < 2048) {
        setStatus("idle");
        toast("Nothing was captured", { description: "Make sure your session actually plays, then try again." });
        return;
      }
      setStatus("encoding");
      await new Promise((r) => setTimeout(r, 30));
      const src = norm ? normalize(cap) : cap;
      const blob = format === "wav" ? encodeWav(src) : encodeMp3(src, 320);
      setResult({ blob, name: `${safeName}.${format}`, peak: peakOf(cap) });
      setStatus("done");
    },
    [format, norm, safeName, stop]
  );

  const start = () => {
    setResult(null);
    setElapsed(0);
    const engine = getEngine();
    stop();
    engine.startCapture();
    setStatus("recording");
    setTransport({ playing: true, paused: false, step: flagsOn ? flagStart : 0 });
    const started = performance.now();
    timer.current = window.setInterval(() => {
      const t = (performance.now() - started) / 1000;
      setElapsed(t);
      if (t >= total) void finish(engine.stopCapture());
    }, 100);
  };

  const stopNow = () => void finish(getEngine().stopCapture());

  const file = result ? new File([result.blob], result.name, { type: result.blob.type }) : null;

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        if (!v && status === "recording") stopNow();
        setOpen(v);
      }}
    >
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="font-display uppercase tracking-widest">Export &amp; share</DialogTitle>
          <DialogDescription>
            Your track is played through the mixer and captured live to a finished stereo file.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div>
            <div className="label-xs mb-1">File type</div>
            <div className="grid grid-cols-2 gap-2">
              {(["wav", "mp3"] as const).map((f) => (
                <button
                  key={f}
                  disabled={status === "recording" || status === "encoding"}
                  onClick={() => setFormat(f)}
                  className={cn(
                    "rounded-sm border px-2 py-2 text-left font-mono text-[10px] uppercase",
                    format === f ? "border-primary bg-primary/15 text-foreground" : "border-border bg-surface-2 text-muted-foreground"
                  )}
                >
                  {f === "wav" ? "WAV · studio quality" : "MP3 · 320 kbps, small"}
                </button>
              ))}
            </div>
          </div>

          <div>
            <div className="label-xs mb-1 flex items-center justify-between">
              <span>Length</span>
              <span className="font-mono text-[10px] text-muted-foreground">
                {flagsOn ? `${flagBars} bars (flags)` : `${bars} bars`} · {total.toFixed(1)}s at {transport.bpm} BPM
              </span>
            </div>
            {flagsOn ? (
              <div className="rounded-sm border border-amber-400/50 bg-amber-400/10 px-2 py-2 font-mono text-[10px] text-amber-200">
                Using the export flags on the timeline: bar {Math.floor(flagStart / 16) + 1} → bar {Math.ceil(flagEnd / 16)}.
                Drag the amber flags to change the range, or press EXPORT on the ruler to turn them off.
              </div>
            ) : (
              <Slider
                value={[bars]}
                min={1}
                max={64}
                step={1}
                disabled={status === "recording"}
                onValueChange={([v = 8]) => setBars(v)}
              />
            )}
          </div>

          <div className="flex items-center justify-between rounded-sm border border-border bg-surface-2/50 px-2 py-2">
            <div>
              <div className="font-mono text-[10px] uppercase">Lift to full level</div>
              <div className="font-mono text-[9px] text-muted-foreground">Raises the whole mix just under clipping.</div>
            </div>
            <Switch checked={norm} onCheckedChange={setNorm} />
          </div>

          {status === "recording" && (
            <div className="rounded-sm border border-red-500/50 bg-red-500/10 px-2 py-2">
              <div className="flex items-center justify-between font-mono text-[10px] uppercase text-red-300">
                <span className="flex items-center gap-1">
                  <Disc3 className="size-3 animate-spin" /> Capturing
                </span>
                <span>
                  {elapsed.toFixed(1)}s / {total.toFixed(1)}s
                </span>
              </div>
              <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-black/40">
                <div className="h-full bg-red-500" style={{ width: `${Math.min(100, (elapsed / total) * 100)}%` }} />
              </div>
            </div>
          )}

          {status === "done" && result && (
            <div className="rounded-sm border border-primary/40 bg-primary/10 px-2 py-2 font-mono text-[10px]">
              <div className="uppercase">{result.name}</div>
              <div className="text-muted-foreground">
                {(result.blob.size / 1_000_000).toFixed(2)} MB · loudest peak {(20 * Math.log10(Math.max(result.peak, 1e-6))).toFixed(1)} dB
              </div>
            </div>
          )}

          <div className="flex gap-2">
            {status === "recording" ? (
              <Button variant="destructive" className="flex-1" onClick={stopNow}>
                <Square className="size-4" /> Stop &amp; keep
              </Button>
            ) : (
              <Button className="flex-1" disabled={status === "encoding"} onClick={start}>
                <Disc3 className="size-4" /> {status === "encoding" ? "Finishing…" : "Record mix"}
              </Button>
            )}
            <Button
              variant="outline"
              disabled={!result}
              onClick={() => result && downloadBlob(result.blob, result.name)}
            >
              <Download className="size-4" /> Save
            </Button>
            <Button
              variant="outline"
              disabled={!result || uploading}
              onClick={() => {
                if (!result) return;
                setUploading(true);
                void uploadCloudExport(result.blob, result.name)
                  .then(() => toast.success("Export saved to your cloud"))
                  .catch((error: unknown) => toast.error(error instanceof Error ? error.message : "Cloud upload failed"))
                  .finally(() => setUploading(false));
              }}
            >
              <CloudUpload className="size-4" /> {uploading ? "Uploading…" : "Cloud"}
            </Button>
            {file && canShareFile(file) && (
              <Button
                variant="outline"
                onClick={() =>
                  shareFile(file, projectName).catch(() =>
                    toast("Sharing was cancelled", { description: "You can still save the file and send it yourself." })
                  )
                }
              >
                <Share2 className="size-4" /> Share
              </Button>
            )}
          </div>

          <p className="font-mono text-[9px] leading-tight text-muted-foreground">
            Recording happens in real time, so a 16-bar loop takes 16 bars to capture. Keep this tab in front while it
            runs — browsers slow down audio in background tabs.
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
}
