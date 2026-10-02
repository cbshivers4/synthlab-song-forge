import { useEffect, useMemo, useRef, useState } from "react";
import { Download, Loader2, Music2, Pause, Play, Plus, RotateCcw, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { getEngine } from "@/lib/synclab/audio-engine";
import { downloadBlob, encodeWav, normalize, peakOf, type Capture } from "@/lib/synclab/bounce";
import { separate, type Separation, type StemId } from "@/lib/synclab/separate";
import { useStudio } from "@/lib/synclab/store";
import type { AudioClip } from "@/lib/synclab/types";
import { toast } from "sonner";
import { CreativeToolThemePicker, useCreativeToolTheme } from "./CreativeToolTheme";

const uid = () => Math.random().toString(36).slice(2, 10);

interface Piece {
  id: StemId;
  name: string;
  color: string;
  capture: Capture;
}

const ORDER: { id: StemId; name: string; color: string }[] = [
  { id: "vocals", name: "VOCALS", color: "oklch(0.78 0.17 20)" },
  { id: "drums", name: "DRUMS", color: "oklch(0.8 0.16 85)" },
  { id: "bass", name: "BASS", color: "oklch(0.72 0.15 300)" },
  { id: "other", name: "MUSIC", color: "oklch(0.8 0.14 195)" },
];

export function StemSeparator({ mode = "stems" }: { mode?: "stems" | "voice" }) {
  const { tracks, addTrack, addClip, select } = useStudio();
  const [fileName, setFileName] = useState<string | null>(null);
  const [buffer, setBuffer] = useState<AudioBuffer | null>(null);
  const [busy, setBusy] = useState(false);
  const [stage, setStage] = useState("");
  const [progress, setProgress] = useState(0);
  const [result, setResult] = useState<Separation | null>(null);
  const [failed, setFailed] = useState<string | null>(null);
  const [strength, setStrength] = useState(1);
  const [playing, setPlaying] = useState<string | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const urlsRef = useRef<string[]>([]);
  const tool = mode === "voice" ? "voice" : "stems";
  const { theme, setTheme } = useCreativeToolTheme(tool);

  useEffect(() => () => {
    audioRef.current?.pause();
    urlsRef.current.forEach((u) => URL.revokeObjectURL(u));
  }, []);

  /** Audio clips already sitting on the timeline that can be separated. */
  const clipSources = useMemo(
    () =>
      tracks.flatMap((t) =>
        (t.clips ?? [])
          .filter((c) => !!c.url)
          .map((c) => ({ trackName: t.name, clip: c as AudioClip & { url: string } })),
      ),
    [tracks],
  );

  const loadFile = async (file: File) => {
    try {
      const ctx = getEngine().init();
      const decoded = await ctx.decodeAudioData(await file.arrayBuffer());
      setBuffer(decoded);
      setFileName(file.name);
      setResult(null);
    } catch {
      toast.error("That file could not be read", { description: "Try a standard WAV, MP3, AIFF, M4A or OGG file." });
    }
  };

  const loadClip = async (url: string, name: string) => {
    try {
      const ctx = getEngine().init();
      const data = await fetch(url).then((r) => r.arrayBuffer());
      const decoded = await ctx.decodeAudioData(data);
      setBuffer(decoded);
      setFileName(name);
      setResult(null);
    } catch {
      toast.error("That clip could not be read", { description: "Re-import the audio file and try again." });
    }
  };

  const run = async () => {
    if (!buffer) return;
    setBusy(true);
    setResult(null);
    setFailed(null);
    setProgress(0);
    try {
      const separation = await separate(buffer, {
        strength,
        onProgress: (s, f) => {
          setStage(s);
          setProgress(f);
        },
      });
      setResult(separation);
      if (separation.mono) {
        toast("Mono source — limited separation", {
          description: "Centre extraction needs a stereo mix. The bands and transients still split, but the voice will bleed.",
          duration: 9000,
        });
      } else {
        toast.success(mode === "voice" ? "Instrumental ready" : "Stems ready", {
          description: "Audition each part, then add the ones you want to the timeline.",
        });
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : "This browser could not process that audio offline.";
      setFailed(message);
      toast.error("Separation failed", { description: message });
    } finally {
      setBusy(false);
      setStage("");
    }
  };

  const pieces: Piece[] = useMemo(() => {
    if (!result) return [];
    if (mode === "voice") {
      return [
        { id: "instrumental", name: "INSTRUMENTAL", color: "oklch(0.8 0.14 195)", capture: result.instrumental },
        { id: "vocals", name: "VOCALS ONLY", color: "oklch(0.78 0.17 20)", capture: result.vocals },
      ];
    }
    return ORDER.map((o) => ({ ...o, capture: result[o.id] as Capture }));
  }, [result, mode]);

  const blobFor = (p: Piece) => encodeWav(peakOf(p.capture) > 0.98 ? normalize(p.capture) : p.capture);

  const toggle = (p: Piece) => {
    if (playing === p.id) {
      audioRef.current?.pause();
      setPlaying(null);
      return;
    }
    audioRef.current?.pause();
    const url = URL.createObjectURL(blobFor(p));
    urlsRef.current.push(url);
    const el = new Audio(url);
    el.onended = () => setPlaying(null);
    audioRef.current = el;
    setPlaying(p.id);
    void el.play().catch(() => {
      setPlaying(null);
      toast.error("Playback blocked", { description: "Tap anywhere in the studio once, then press play again." });
    });
  };

  const addToProject = async (p: Piece) => {
    const engine = getEngine();
    engine.init();
    const base = (fileName ?? "MIX").replace(/\.[^.]+$/, "").toUpperCase().slice(0, 18);
    const name = `${base} ${p.name}`;
    const loaded = await engine.loadSampleFile(blobFor(p), name);
    const trackId = addTrack("audio", name);
    const clip: AudioClip = {
      id: uid(),
      name: p.name,
      peaks: loaded.peaks,
      duration: loaded.duration,
      url: loaded.url,
      start: 0,
      offset: 0,
      length: loaded.duration,
      gain: 1,
    };
    addClip(trackId, clip);
    select(trackId);
    toast.success(`${p.name} added`, { description: "It is on its own channel at bar 1." });
  };

  const download = (p: Piece) => {
    const base = (fileName ?? "mix").replace(/\.[^.]+$/, "");
    downloadBlob(blobFor(p), `${base}-${p.id}.wav`);
  };

  return (
    <div className="creative-tool mx-auto max-w-3xl space-y-5 p-3" data-creative-theme={theme}>
      <div className="flex justify-end"><CreativeToolThemePicker tool={tool} theme={theme} onChange={setTheme} /></div>
      <div>
        <h3 className="font-display text-lg font-semibold">
          {mode === "voice" ? "Voice Remover" : "Stem Separator"}
        </h3>
        <p className="mt-1 text-sm text-muted-foreground">
          {mode === "voice"
            ? "Makes an instrumental by pulling the centred lead voice out of a stereo mix — everything runs on this device."
            : "Splits a stereo mix into vocals, drums, bass and music on this device. No upload, no account."}
        </p>
      </div>

      <div className="rounded-[3px] border border-border bg-surface p-3">
        <div className="flex flex-wrap items-center gap-2">
          <label className="inline-flex">
            <input
              type="file"
              accept="audio/*"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) void loadFile(f);
                e.target.value = "";
              }}
            />
            <span className="inline-flex min-h-11 cursor-pointer items-center gap-2 rounded-[3px] border border-border bg-surface-2 px-3 text-xs">
              <Upload className="size-4" /> Choose audio file
            </span>
          </label>
          {clipSources.length > 0 && (
            <select
              className="min-h-11 rounded-[3px] border border-border bg-surface-2 px-2 text-xs"
              value=""
              onChange={(e) => {
                const found = clipSources[Number(e.target.value)];
                if (found) void loadClip(found.clip.url, `${found.trackName} ${found.clip.name}`);
              }}
            >
              <option value="">Use a clip from this project…</option>
              {clipSources.map((s, i) => (
                <option key={`${s.clip.id}-${i}`} value={i}>
                  {s.trackName} — {s.clip.name}
                </option>
              ))}
            </select>
          )}
          <span className="text-xs text-muted-foreground">
            {fileName ? `${fileName}${buffer ? ` · ${buffer.duration.toFixed(1)}s · ${buffer.numberOfChannels > 1 ? "stereo" : "mono"}` : ""}` : "No audio chosen yet"}
          </span>
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-3">
          <div className="min-w-[200px] flex-1">
            <div className="label-xs mb-1 flex justify-between">
              <span>Voice pull</span>
              <span className="font-mono">{Math.round(strength * 100)}%</span>
            </div>
            <Slider value={[strength]} min={0.4} max={1.3} step={0.05} onValueChange={([v]) => setStrength(v ?? 1)} />
          </div>
          <Button className="min-h-11 gap-2" disabled={!buffer || busy} onClick={() => void run()}>
            {busy ? <Loader2 className="size-4 animate-spin" /> : <Music2 className="size-4" />}
            {busy ? stage || "Working" : mode === "voice" ? "Remove voice" : "Separate stems"}
          </Button>
        </div>
        {busy && (
          <div className="mt-3 h-1.5 w-full overflow-hidden rounded-full bg-surface-2">
            <div className="h-full bg-primary transition-all" style={{ width: `${Math.round(progress * 100)}%` }} />
          </div>
        )}
        {failed && !busy && (
          <div className="mt-3 flex flex-wrap items-center gap-2 rounded-[3px] border border-destructive/50 bg-destructive/10 p-2">
            <span className="font-mono text-[10px] tracking-widest text-destructive">FAILED</span>
            <span className="min-w-0 flex-1 text-xs text-foreground/80">{failed}</span>
            <Button size="sm" variant="outline" className="min-h-10 gap-2" onClick={() => void run()}>
              <RotateCcw className="size-4" />
              Retry
            </Button>
          </div>
        )}
      </div>

      {pieces.length > 0 && (
        <div className="space-y-2">
          {pieces.map((p) => (
            <div key={p.id} className="flex flex-wrap items-center gap-2 rounded-[3px] border border-border bg-surface p-2">
              <span className="size-3 rounded-full" style={{ background: p.color }} />
              <span className="min-w-[120px] font-mono text-xs tracking-widest">{p.name}</span>
              <Button size="sm" variant="secondary" className="min-h-10 gap-2" onClick={() => toggle(p)}>
                {playing === p.id ? <Pause className="size-4" /> : <Play className="size-4" />}
                {playing === p.id ? "Stop" : "Listen"}
              </Button>
              <Button size="sm" variant="outline" className="min-h-10 gap-2" onClick={() => void addToProject(p)}>
                <Plus className="size-4" /> Add to timeline
              </Button>
              <Button size="sm" variant="ghost" className="min-h-10 gap-2" onClick={() => download(p)}>
                <Download className="size-4" /> WAV
              </Button>
            </div>
          ))}
        </div>
      )}

      <p className="text-xs leading-relaxed text-muted-foreground">
        How this works, honestly: SYNCLAB separates with centre/side masking, band splitting and transient detection right
        here in the browser. It is strong on wide stereo mixes with a centred lead vocal. It is not a trained separation
        model, so mono files, doubled or heavily panned vocals and dense mixes will leave some bleed between parts.
      </p>
    </div>
  );
}
