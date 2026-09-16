import { useRef, useState, type PointerEvent as ReactPointerEvent } from "react";
import { AudioLines, Play, RotateCcw, Square, Trash2, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { useStudio } from "@/lib/synclab/store";
import type { Track } from "@/lib/synclab/types";
import { toast } from "sonner";

const NOTE_NAMES = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];
const noteName = (m: number) => `${NOTE_NAMES[((m % 12) + 12) % 12]}${Math.floor(m / 12) - 1}`;
const AUDIO_RE = /\.(mp3|wav|wave|aif|aiff|m4a|aac|ogg|flac|webm)$/i;

function Row({ label, value, children }: { label: string; value: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1">
      <div className="flex items-baseline justify-between">
        <span className="label-xs">{label}</span>
        <span className="font-mono text-[10px] text-primary">{value}</span>
      </div>
      {children}
    </div>
  );
}

/** Waveform with draggable trim handles and chop markers. */
function Waveform({ track, onSlice }: { track: Track; onSlice: (i: number) => void }) {
  const { updateSampler } = useStudio();
  const s = track.sampler!;
  const ref = useRef<HTMLDivElement | null>(null);
  const [drag, setDrag] = useState<"start" | "end" | number | null>(null);
  const chops = s.slices ?? [];

  const fracAt = (clientX: number) => {
    const box = ref.current?.getBoundingClientRect();
    if (!box) return 0;
    return Math.min(1, Math.max(0, (clientX - box.left) / box.width));
  };

  const move = (e: ReactPointerEvent) => {
    if (drag === null) return;
    const f = fracAt(e.clientX);
    if (drag === "start") updateSampler(track.id, { start: Math.min(f, s.end - 0.002) });
    else if (drag === "end") updateSampler(track.id, { end: Math.max(f, s.start + 0.002) });
    else {
      const next = chops.slice();
      next[drag] = Math.min(Math.max(f, s.start), s.end);
      updateSampler(track.id, { slices: next.slice().sort((a, b) => a - b) });
    }
  };

  return (
    <div
      ref={ref}
      className="relative h-40 w-full touch-none overflow-hidden rounded-lg border border-border bg-surface-2/60"
      onPointerMove={move}
      onPointerUp={() => setDrag(null)}
      onPointerLeave={() => setDrag(null)}
    >
      <div className="absolute inset-0 flex items-center gap-px px-px">
        {s.peaks.map((p, i) => (
          <span
            key={i}
            className="flex-1 rounded-sm"
            style={{
              height: `${Math.max(2, p * 100)}%`,
              background:
                i / s.peaks.length >= s.start && i / s.peaks.length <= s.end
                  ? "var(--color-primary)"
                  : "color-mix(in oklab, var(--color-muted-foreground) 45%, transparent)",
            }}
          />
        ))}
      </div>

      <div className="absolute inset-y-0 left-0 bg-background/70" style={{ width: `${s.start * 100}%` }} />
      <div className="absolute inset-y-0 right-0 bg-background/70" style={{ width: `${(1 - s.end) * 100}%` }} />

      {chops.map((c, i) => (
        <div
          key={`chop-${i}`}
          role="slider"
          tabIndex={0}
          aria-label={`Chop ${i + 1}`}
          aria-valuenow={Math.round(c * 100)}
          aria-valuemin={0}
          aria-valuemax={100}
          onPointerDown={(e) => {
            e.preventDefault();
            setDrag(i);
          }}
          onDoubleClick={() => onSlice(i)}
          className="absolute inset-y-0 z-20 w-3 -translate-x-1/2 cursor-col-resize"
          style={{ left: `${c * 100}%` }}
        >
          <span className="absolute inset-y-0 left-1/2 w-px -translate-x-1/2 bg-accent" />
          <span className="absolute bottom-1 left-1/2 -translate-x-1/2 rounded-sm bg-accent px-1 font-mono text-[9px] text-accent-foreground">
            {i + 1}
          </span>
        </div>
      ))}

      {(["start", "end"] as const).map((h) => (
        <div
          key={h}
          role="slider"
          tabIndex={0}
          aria-label={h === "start" ? "Trim start" : "Trim end"}
          aria-valuenow={Math.round((h === "start" ? s.start : s.end) * 100)}
          aria-valuemin={0}
          aria-valuemax={100}
          onPointerDown={(e) => {
            e.preventDefault();
            setDrag(h);
          }}
          onKeyDown={(e) => {
            const d = e.key === "ArrowLeft" ? -0.01 : e.key === "ArrowRight" ? 0.01 : 0;
            if (!d) return;
            e.preventDefault();
            if (h === "start") updateSampler(track.id, { start: Math.min(Math.max(0, s.start + d), s.end - 0.002) });
            else updateSampler(track.id, { end: Math.max(Math.min(1, s.end + d), s.start + 0.002) });
          }}
          className="absolute inset-y-0 z-10 w-3 -translate-x-1/2 cursor-col-resize"
          style={{ left: `${(h === "start" ? s.start : s.end) * 100}%` }}
        >
          <span className="absolute inset-y-0 left-1/2 w-0.5 -translate-x-1/2 bg-primary" />
          <span className="absolute top-1 left-1/2 size-2.5 -translate-x-1/2 rounded-sm bg-primary" />
        </div>
      ))}
    </div>
  );
}

export function Sampler() {
  const { tracks, selected, select, addTrack, loadSample, updateSampler, clearSample, stopSamples, previewNote } =
    useStudio();
  const [over, setOver] = useState(false);
  const fileRef = useRef<HTMLInputElement | null>(null);

  const samplerTracks = tracks.filter((t) => t.kind === "sampler");
  const track =
    selected?.kind === "sampler" ? selected : samplerTracks.find((t) => t.sampler) ?? samplerTracks[0] ?? null;

  const take = async (file: File | undefined) => {
    if (!file) return;
    if (!file.type.startsWith("audio") && !AUDIO_RE.test(file.name)) {
      toast.error("That is not an audio file", { description: "Drop an MP3, WAV, AIFF, M4A, OGG or FLAC file." });
      return;
    }
    let id = track?.id;
    if (!id) {
      id = addTrack("sampler", file.name.replace(/\.[^.]+$/, "").toUpperCase().slice(0, 16));
      select(id);
    }
    await loadSample(id, file);
  };

  const s = track?.sampler;

  return (
    <div className="space-y-3">
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setOver(true);
        }}
        onDragLeave={() => setOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setOver(false);
          void take(e.dataTransfer.files[0]);
        }}
        onClick={() => fileRef.current?.click()}
        className={`flex cursor-pointer items-center justify-center gap-2 rounded-lg border-2 border-dashed px-4 py-5 text-center transition-colors ${
          over ? "border-primary bg-primary/10" : "border-border hover:border-primary/50"
        }`}
      >
        <Upload className="size-4 text-primary" />
        <span className="font-mono text-[11px] tracking-wider">
          Drop an MP3 or WAV here — or click to choose a file
        </span>
        <input
          ref={fileRef}
          type="file"
          accept="audio/*,.mp3,.wav,.aiff,.aif,.m4a,.ogg,.flac"
          className="hidden"
          onChange={(e) => {
            void take(e.target.files?.[0]);
            e.target.value = "";
          }}
        />
      </div>

      {samplerTracks.length > 1 && (
        <div className="flex flex-wrap gap-1">
          {samplerTracks.map((t) => (
            <Button
              key={t.id}
              size="sm"
              variant={t.id === track?.id ? "secondary" : "ghost"}
              className="h-7 font-mono text-[10px] tracking-widest"
              onClick={() => select(t.id)}
            >
              {t.name}
            </Button>
          ))}
        </div>
      )}

      {!track || !s ? (
        <p className="text-sm text-muted-foreground">
          No sample loaded yet. Drop a file above and it lands on a sampler channel you can play from the keyboard,
          piano roll or your MIDI controller.
        </p>
      ) : (
        <>
          <div className="flex flex-wrap items-center gap-2">
            <AudioLines className="size-4 text-primary" />
            <span className="font-mono text-[11px]">{s.name}</span>
            <span className="label-xs">
              {s.duration.toFixed(2)}s · trimmed {(s.duration * (s.end - s.start)).toFixed(2)}s
            </span>
            <div className="ml-auto flex gap-1">
              <Button size="sm" variant="secondary" className="h-7 gap-1.5" onClick={() => previewNote(track.id, s.rootNote)}>
                <Play className="size-3.5" /> Play
              </Button>
              <Button size="sm" variant="ghost" className="h-7 gap-1.5" onClick={() => stopSamples(track.id)}>
                <Square className="size-3.5" /> Stop
              </Button>
              <Button
                size="sm"
                variant="ghost"
                className="h-7 gap-1.5"
                onClick={() => updateSampler(track.id, { start: 0, end: 1 })}
              >
                <RotateCcw className="size-3.5" /> Full length
              </Button>
              <Button size="sm" variant="ghost" className="h-7 gap-1.5 text-destructive" onClick={() => clearSample(track.id)}>
                <Trash2 className="size-3.5" /> Remove
              </Button>
            </div>
          </div>

          <Waveform track={track} />

          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <Row label="Trim start" value={`${(s.start * s.duration).toFixed(2)}s`}>
              <Slider
                value={[s.start]}
                min={0}
                max={1}
                step={0.001}
                onValueChange={([v]) => updateSampler(track.id, { start: Math.min(v ?? 0, s.end - 0.002) })}
              />
            </Row>
            <Row label="Trim end" value={`${(s.end * s.duration).toFixed(2)}s`}>
              <Slider
                value={[s.end]}
                min={0}
                max={1}
                step={0.001}
                onValueChange={([v]) => updateSampler(track.id, { end: Math.max(v ?? 1, s.start + 0.002) })}
              />
            </Row>
            <Row label="Level" value={`${Math.round(s.gain * 100)}%`}>
              <Slider value={[s.gain]} min={0} max={2} step={0.01} onValueChange={([v]) => updateSampler(track.id, { gain: v ?? 1 })} />
            </Row>
            <Row label="Tune" value={`${s.pitch > 0 ? "+" : ""}${s.pitch.toFixed(1)} st`}>
              <Slider value={[s.pitch]} min={-24} max={24} step={0.1} onValueChange={([v]) => updateSampler(track.id, { pitch: v ?? 0 })} />
            </Row>
            <Row label="Root note" value={noteName(s.rootNote)}>
              <Slider
                value={[s.rootNote]}
                min={24}
                max={96}
                step={1}
                onValueChange={([v]) => updateSampler(track.id, { rootNote: v ?? 60 })}
              />
            </Row>
            <Row label="Attack" value={`${Math.round(s.attack * 1000)} ms`}>
              <Slider value={[s.attack]} min={0} max={2} step={0.001} onValueChange={([v]) => updateSampler(track.id, { attack: v ?? 0 })} />
            </Row>
            <Row label="Release" value={`${Math.round(s.release * 1000)} ms`}>
              <Slider value={[s.release]} min={0.005} max={4} step={0.005} onValueChange={([v]) => updateSampler(track.id, { release: v ?? 0.06 })} />
            </Row>
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="label-xs">Loop</span>
                <Switch checked={s.loop} onCheckedChange={(v) => updateSampler(track.id, { loop: v })} />
              </div>
              <div className="flex items-center justify-between">
                <span className="label-xs">Reverse</span>
                <Switch checked={s.reverse} onCheckedChange={(v) => updateSampler(track.id, { reverse: v })} />
              </div>
              <div className="flex items-center justify-between">
                <span className="label-xs">One shot</span>
                <Switch checked={s.oneShot} onCheckedChange={(v) => updateSampler(track.id, { oneShot: v })} />
              </div>
            </div>
          </div>

          <p className="text-xs text-muted-foreground">
            Play the trimmed sample from the on-screen keyboard, the piano roll or your MIDI controller — the root note
            plays it at its original speed and every other key pitches it up or down.
          </p>
        </>
      )}
    </div>
  );
}
