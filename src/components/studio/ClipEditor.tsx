import { useMemo, useState } from "react";
import { Play, RotateCcw, Square, Undo2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Slider } from "@/components/ui/slider";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Knob } from "@/components/studio/Knob";
import { WaveformView } from "@/components/studio/WaveformView";
import { useStudio } from "@/lib/synclab/store";
import { getEngine } from "@/lib/synclab/audio-engine";
import { clipRate } from "@/lib/synclab/types";
import type { AudioClip, Track } from "@/lib/synclab/types";
import { toast } from "sonner";

/**
 * Inline audio editor for one arrangement clip. Every control is non-destructive:
 * the recorded file is never rewritten, only the clip's playback settings change,
 * and REVERT puts everything back.
 */
export function ClipEditor({ track, clip, onClose }: { track: Track; clip: AudioClip; onClose: () => void }) {
  const { updateClip, previewClip } = useStudio();
  const [zoomTrim, setZoomTrim] = useState(true);

  const dur = Math.max(0.01, clip.duration);
  const offset = clip.offset ?? 0;
  const length = clip.length ?? dur - offset;
  const gain = clip.gain ?? 1;
  const pitch = clip.pitch ?? 0;
  const speed = clip.speed ?? 1;
  const fadeIn = clip.fadeIn ?? 0.004;
  const fadeOut = clip.fadeOut ?? 0.01;
  const rate = clipRate(clip);

  const set = (patch: Partial<AudioClip>) => updateClip(track.id, clip.id, patch);

  const peaks = clip.peaks.length > 1 ? clip.peaks : [0, 0];
  const view = useMemo(() => {
    if (!zoomTrim) return peaks;
    const a = Math.floor((offset / dur) * peaks.length);
    const b = Math.ceil(((offset + length) / dur) * peaks.length);
    const slice = peaks.slice(Math.max(0, a), Math.max(a + 2, b));
    return clip.reverse ? [...slice].reverse() : slice;
  }, [peaks, zoomTrim, offset, length, dur, clip.reverse]);

  const trimPeak = useMemo(() => {
    const a = Math.floor((offset / dur) * peaks.length);
    const b = Math.ceil(((offset + length) / dur) * peaks.length);
    return Math.max(0.0001, ...peaks.slice(Math.max(0, a), Math.max(a + 1, b)));
  }, [peaks, offset, length, dur]);

  const leftPct = (offset / dur) * 100;
  const widthPct = Math.max(1, (length / dur) * 100);

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle className="font-display tracking-wide">AUDIO CLIP EDITOR</DialogTitle>
          <DialogDescription>
            Nothing here changes your recording — the original file is kept and every edit can be reverted.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-wrap items-center gap-2">
          <Input
            value={clip.name}
            onChange={(e) => set({ name: e.target.value })}
            aria-label="Clip name"
            className="h-8 w-56 font-mono text-xs"
          />
          <span className="font-mono text-[10px] text-muted-foreground">
            {length.toFixed(2)}s source · {(length / rate).toFixed(2)}s on the timeline
          </span>
          <div className="ml-auto flex items-center gap-1">
            <Button size="sm" variant="secondary" onClick={() => previewClip(track.id, clip.id)}>
              <Play className="size-3.5" /> PLAY
            </Button>
            <Button size="sm" variant="ghost" onClick={() => getEngine().stopSamples(track.id)}>
              <Square className="size-3.5" /> STOP
            </Button>
          </div>
        </div>

        {/* waveform with the trim window shown */}
        <div className="relative h-28 overflow-hidden rounded-[3px] border border-border bg-background px-1">
          <WaveformView peaks={view} color="var(--clip-audio)" label={`${clip.name} waveform`} />
          {!zoomTrim && (
            <>
              <div className="pointer-events-none absolute inset-y-0 left-0 bg-background/70" style={{ width: `${leftPct}%` }} />
              <div
                className="pointer-events-none absolute inset-y-0 bg-background/70"
                style={{ left: `${leftPct + widthPct}%`, right: 0 }}
              />
              <div
                className="pointer-events-none absolute inset-y-0 border-x border-clip-audio/70"
                style={{ left: `${leftPct}%`, width: `${widthPct}%` }}
              />
            </>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-1">
          <Toggle on={zoomTrim} onClick={() => setZoomTrim((z) => !z)} label={zoomTrim ? "ZOOM: TRIM" : "ZOOM: FULL"} />
          <Toggle on={Boolean(clip.reverse)} onClick={() => set({ reverse: !clip.reverse })} label="REVERSE" />
          <Toggle on={Boolean(clip.loopClip)} onClick={() => set({ loopClip: !clip.loopClip })} label="LOOP" />
          <Button
            size="sm"
            variant="ghost"
            className="h-7 font-mono text-[10px] tracking-wider"
            onClick={() => {
              const g = Math.min(2, 0.98 / trimPeak);
              set({ gain: g });
              toast.success("Normalised", { description: `Clip gain set to ${g.toFixed(2)}× so the loudest peak sits just under 0 dB.` });
            }}
          >
            NORMALIZE
          </Button>
          <Button
            size="sm"
            variant="ghost"
            className="h-7 font-mono text-[10px] tracking-wider"
            onClick={() => {
              set({ offset: 0, length: dur, gain: 1, pitch: 0, speed: 1, reverse: false, fadeIn: 0.004, fadeOut: 0.01 });
              toast("Back to the original", { description: "All clip edits cleared." });
            }}
          >
            <Undo2 className="size-3.5" /> REVERT
          </Button>
        </div>

        {/* horizontal sliders = ranges and positions */}
        <div className="grid gap-3 sm:grid-cols-2">
          <Range
            label="START"
            value={offset}
            min={0}
            max={Math.max(0.01, dur - 0.05)}
            step={0.01}
            unit="s"
            onChange={(v) => set({ offset: v, length: Math.max(0.05, Math.min(length, dur - v)) })}
            onReset={() => set({ offset: 0, length: dur })}
          />
          <Range
            label="END"
            value={offset + length}
            min={offset + 0.05}
            max={dur}
            step={0.01}
            unit="s"
            onChange={(v) => set({ length: Math.max(0.05, v - offset) })}
            onReset={() => set({ length: dur - offset })}
          />
          <Range
            label="FADE IN"
            value={fadeIn}
            min={0.001}
            max={Math.max(0.01, length / 2)}
            step={0.001}
            unit="s"
            onChange={(v) => set({ fadeIn: v })}
            onReset={() => set({ fadeIn: 0.004 })}
          />
          <Range
            label="FADE OUT"
            value={fadeOut}
            min={0.001}
            max={Math.max(0.01, length / 2)}
            step={0.001}
            unit="s"
            onChange={(v) => set({ fadeOut: v })}
            onReset={() => set({ fadeOut: 0.01 })}
          />
        </div>

        {/* knobs = sound shaping */}
        <div className="flex flex-wrap items-start gap-3 rounded-[3px] border border-border bg-surface-2 p-3">
          <Knob label="GAIN" value={gain} min={0} max={2} step={0.01} unit="×" onChange={(v) => set({ gain: v })} />
          <Knob label="PITCH" value={pitch} min={-24} max={24} step={1} unit=" st" onChange={(v) => set({ pitch: v })} />
          <Knob label="SPEED" value={speed} min={0.25} max={4} step={0.01} unit="×" onChange={(v) => set({ speed: v })} />
          <div className="flex-1 self-center text-[11px] leading-relaxed text-muted-foreground">
            In the browser, pitch and speed share one playback rate — raising the pitch also shortens the clip
            ({rate.toFixed(2)}× right now). Independent time stretching that keeps the length needs the SYNCLAB desktop
            companion, so it isn't offered here rather than faked.
            <button
              type="button"
              className="ml-2 inline-flex items-center gap-1 text-primary hover:underline"
              onClick={() => set({ pitch: 0, speed: 1 })}
            >
              <RotateCcw className="size-3" /> reset both
            </button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function Toggle({ on, onClick, label }: { on: boolean; onClick: () => void; label: string }) {
  return (
    <Button
      size="sm"
      variant="ghost"
      aria-pressed={on}
      onClick={onClick}
      className={`h-7 gap-1 px-2 font-mono text-[10px] tracking-wider ${
        on ? "bg-primary/15 text-primary shadow-[inset_0_0_0_1px_var(--primary)]" : "text-muted-foreground"
      }`}
    >
      <span className={`size-1.5 rounded-full ${on ? "bg-primary" : "bg-border"}`} />
      {label}
    </Button>
  );
}

function Range({
  label,
  value,
  min,
  max,
  step,
  unit,
  onChange,
  onReset,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  unit: string;
  onChange: (v: number) => void;
  onReset: () => void;
}) {
  return (
    <div className="rounded-[3px] border border-border bg-background/60 px-2 py-1.5">
      <div className="flex items-center justify-between">
        <span className="label-xs">{label}</span>
        <span className="font-mono text-[10px] text-primary">
          {value.toFixed(step < 0.01 ? 3 : 2)}
          {unit}
        </span>
      </div>
      <Slider
        className="mt-1"
        value={[Math.min(max, Math.max(min, value))]}
        min={min}
        max={max}
        step={step}
        onValueChange={([v = min]) => onChange(v)}
        onDoubleClick={onReset}
        aria-label={label}
      />
    </div>
  );
}
