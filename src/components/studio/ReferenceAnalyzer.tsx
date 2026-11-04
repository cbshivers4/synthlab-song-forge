import { SkinControls, skinBackground, useImageDrop } from "@/components/studio/SkinControls";
import { useSkin } from "@/lib/synclab/skins";
import { useEffect, useRef, useState } from "react";
import { FileAudio, Pause, Play, Trash2, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { analyzeReferenceBuffer, type ReferenceAnalysisResult } from "@/lib/synclab/reference-analysis";
import { toast } from "sonner";
import { retainMediaInBackground } from "@/lib/synclab/media-library";

function formatTime(seconds: number) {
  const minutes = Math.floor(seconds / 60);
  return `${minutes}:${Math.floor(seconds % 60).toString().padStart(2, "0")}`;
}

export function ReferenceAnalyzer() {
  const skin = useSkin("reference");
  const skinDrop = useImageDrop("reference");
  const skinned = !!(skin.image || skin.color);
  const inputRef = useRef<HTMLInputElement>(null);
  const audioRef = useRef<HTMLAudioElement>(null);
  const urlRef = useRef<string | null>(null);
  const [dragging, setDragging] = useState(false);
  const [busy, setBusy] = useState(false);
  const [playing, setPlaying] = useState(false);
  const [name, setName] = useState("");
  const [result, setResult] = useState<ReferenceAnalysisResult | null>(null);

  const clear = () => {
    audioRef.current?.pause();
    if (urlRef.current) URL.revokeObjectURL(urlRef.current);
    urlRef.current = null;
    setPlaying(false);
    setName("");
    setResult(null);
  };

  useEffect(() => () => {
    if (urlRef.current) URL.revokeObjectURL(urlRef.current);
  }, []);

  const load = async (file?: File) => {
    if (!file) return;
    if (!file.type.startsWith("audio/") && !/\.(wav|mp3|aiff?|flac|m4a|ogg|webm)$/i.test(file.name)) {
      toast.error("Choose an audio file you own");
      return;
    }
    setBusy(true);
    retainMediaInBackground(file, file.name);
    try {
      const context = new AudioContext();
      const buffer = await context.decodeAudioData(await file.arrayBuffer());
      const analysis = analyzeReferenceBuffer(buffer);
      await context.close();
      clear();
      const url = URL.createObjectURL(file);
      urlRef.current = url;
      if (audioRef.current) audioRef.current.src = url;
      setName(file.name);
      setResult(analysis);
      toast.success("Reference analyzed on this device");
    } catch {
      toast.error("This audio file could not be analyzed", { description: "Try WAV, MP3, AIFF, M4A, OGG, or a browser-supported FLAC file." });
    } finally {
      setBusy(false);
    }
  };

  const togglePlayback = async () => {
    const audio = audioRef.current;
    if (!audio || !urlRef.current) return;
    if (audio.paused) await audio.play();
    else audio.pause();
  };

  return (
    <div className={`mx-auto max-w-4xl space-y-4${skinned ? " studio-wallpaper rounded-md p-3" : ""}`} data-skin-panel="reference" style={skinBackground(skin)} {...skinDrop}>
      <SkinControls skinKey="reference" image />
      <audio ref={audioRef} onPlay={() => setPlaying(true)} onPause={() => setPlaying(false)} onEnded={() => setPlaying(false)} />
      <input ref={inputRef} aria-label="Reference audio file" className="sr-only" type="file" accept="audio/*,.wav,.mp3,.aif,.aiff,.flac,.m4a,.ogg,.webm" onChange={(event) => void load(event.target.files?.[0])} />
      <div
        onDragOver={(event) => { event.preventDefault(); setDragging(true); }}
        onDragLeave={() => setDragging(false)}
        onDrop={(event) => { event.preventDefault(); setDragging(false); void load(event.dataTransfer.files[0]); }}
        className={`flex min-h-44 flex-col items-center justify-center gap-3 rounded-md border-2 border-dashed p-6 text-center transition-colors ${dragging ? "border-primary bg-primary/10" : "border-border bg-surface-2/40"}`}
      >
        <FileAudio className="size-10 text-primary" />
        <div><h3 className="font-display text-lg font-semibold">Analyze an audio reference you own</h3><p className="mt-1 text-sm text-muted-foreground">The file stays on this device and is never added to your timeline.</p></div>
        <Button className="min-h-12 gap-2" disabled={busy} onClick={() => inputRef.current?.click()}><Upload className="size-4" />{busy ? "Analyzing…" : "Choose audio"}</Button>
      </div>
      {result && (
        <section className="panel space-y-4 p-4" aria-label="Reference analysis results">
          <div className="flex flex-wrap items-center gap-2"><div className="min-w-0 flex-1"><div className="label-xs">REFERENCE</div><div className="truncate font-medium">{name}</div></div><Button size="icon" variant="secondary" className="size-12 sm:size-9" onClick={() => void togglePlayback()} aria-label={playing ? "Pause reference" : "Play reference"}>{playing ? <Pause /> : <Play />}</Button><Button size="icon" variant="ghost" className="size-12 sm:size-9" onClick={clear} aria-label="Remove reference"><Trash2 /></Button></div>
          <div className="flex h-24 items-center gap-px overflow-hidden rounded-[3px] border border-border bg-background/60 px-2" aria-label="Reference waveform">
            {result.waveform.map((peak, index) => <span key={index} className="min-w-px flex-1 bg-primary" style={{ height: `${Math.max(2, peak * 100)}%` }} />)}
          </div>
          <div className="grid grid-cols-2 gap-px overflow-hidden rounded-md border border-border bg-border sm:grid-cols-3 lg:grid-cols-6">
            {[
              ["TEMPO", result.tempo ? `${result.tempo} BPM` : "Unknown"], ["KEY", result.key ?? "Unknown"], ["LOUDNESS", `${result.averageDb.toFixed(1)} dBFS`], ["PEAK", `${result.peakDb.toFixed(1)} dBFS`], ["LENGTH", formatTime(result.duration)], ["FORMAT", `${(result.sampleRate / 1000).toFixed(1)} kHz · ${result.channels === 1 ? "Mono" : "Stereo"}`],
            ].map(([label, value]) => <div key={label} className="bg-surface p-3"><div className="label-xs">{label}</div><div className="mt-1 font-mono text-sm text-primary">{value}</div></div>)}
          </div>
          <p className="text-xs text-muted-foreground">Tempo, key, and loudness are local estimates for comparison—not mastering measurements.</p>
        </section>
      )}
    </div>
  );
}