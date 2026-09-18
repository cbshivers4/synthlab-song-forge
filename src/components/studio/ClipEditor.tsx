import { useMemo, useRef, useState } from "react";
import type { KeyboardEvent, PointerEvent as ReactPointerEvent } from "react";
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

        <InteractiveWaveform
          clip={clip}
          peaks={peaks}
          offset={offset}
          length={length}
          fadeIn={fadeIn}
          fadeOut={fadeOut}
          onChange={set}
        />

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

type WaveHandle = "trim-start" | "trim-end" | "fade-in" | "fade-out";

function InteractiveWaveform({
  clip,
  peaks,
  offset,
  length,
  fadeIn,
  fadeOut,
  onChange,
}: {
  clip: AudioClip;
  peaks: number[];
  offset: number;
  length: number;
  fadeIn: number;
  fadeOut: number;
  onChange: (patch: Partial<AudioClip>) => void;
}) {
  const surfaceRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<{
    kind: WaveHandle;
    pointerId: number;
    offset: number;
    length: number;
    fadeIn: number;
    fadeOut: number;
  } | null>(null);
  const dur = Math.max(0.01, clip.duration);
  const leftPct = (offset / dur) * 100;
  const widthPct = Math.max(0.5, (length / dur) * 100);
  const fadeInPct = (Math.min(fadeIn, length / 2) / dur) * 100;
  const fadeOutPct = (Math.min(fadeOut, length / 2) / dur) * 100;

  const applyAt = (kind: WaveHandle, seconds: number, start = { offset, length, fadeIn, fadeOut }) => {
    const minimum = Math.min(0.05, dur);
    if (kind === "trim-start") {
      const nextOffset = Math.max(0, Math.min(seconds, start.offset + start.length - minimum));
      const nextLength = start.offset + start.length - nextOffset;
      onChange({
        offset: nextOffset,
        length: nextLength,
        fadeIn: Math.min(start.fadeIn, nextLength / 2),
        fadeOut: Math.min(start.fadeOut, nextLength / 2),
      });
      return;
    }
    if (kind === "trim-end") {
      const nextLength = Math.max(minimum, Math.min(dur - start.offset, seconds - start.offset));
      onChange({
        length: nextLength,
        fadeIn: Math.min(start.fadeIn, nextLength / 2),
        fadeOut: Math.min(start.fadeOut, nextLength / 2),
      });
      return;
    }
    if (kind === "fade-in") {
      onChange({ fadeIn: Math.max(0, Math.min(length / 2, seconds - offset)) });
      return;
    }
    onChange({ fadeOut: Math.max(0, Math.min(length / 2, offset + length - seconds)) });
  };

  const beginDrag = (e: ReactPointerEvent<HTMLDivElement>, kind: WaveHandle) => {
    e.preventDefault();
    e.stopPropagation();
    e.currentTarget.setPointerCapture(e.pointerId);
    dragRef.current = { kind, pointerId: e.pointerId, offset, length, fadeIn, fadeOut };
  };

  const drag = (e: ReactPointerEvent<HTMLDivElement>) => {
    const active = dragRef.current;
    const rect = surfaceRef.current?.getBoundingClientRect();
    if (!active || active.pointerId !== e.pointerId || !rect) return;
    const seconds = Math.max(0, Math.min(dur, ((e.clientX - rect.left) / rect.width) * dur));
    applyAt(active.kind, seconds, active);
  };

  const finishDrag = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (dragRef.current?.pointerId !== e.pointerId) return;
    dragRef.current = null;
    e.currentTarget.releasePointerCapture(e.pointerId);
  };

  const nudge = (e: KeyboardEvent<HTMLDivElement>, kind: WaveHandle) => {
    if (e.key !== "ArrowLeft" && e.key !== "ArrowRight") return;
    e.preventDefault();
    const amount = (e.shiftKey ? 0.001 : 0.01) * (e.key === "ArrowRight" ? 1 : -1);
    const current =
      kind === "trim-start"
        ? offset
        : kind === "trim-end"
          ? offset + length
          : kind === "fade-in"
            ? offset + fadeIn
            : offset + length - fadeOut;
    applyAt(kind, current + amount);
  };

  const handleProps = (kind: WaveHandle, value: number, max: number) => ({
    role: "slider" as const,
    tabIndex: 0,
    "aria-label": kind.replace("-", " "),
    "aria-valuemin": 0,
    "aria-valuemax": Number(max.toFixed(3)),
    "aria-valuenow": Number(value.toFixed(3)),
    onPointerDown: (e: ReactPointerEvent<HTMLDivElement>) => beginDrag(e, kind),
    onPointerMove: drag,
    onPointerUp: finishDrag,
    onPointerCancel: finishDrag,
    onKeyDown: (e: KeyboardEvent<HTMLDivElement>) => nudge(e, kind),
  });

  return (
    <div className="space-y-1.5">
      <div
        ref={surfaceRef}
        className="relative h-36 touch-none select-none overflow-hidden rounded-[3px] border border-border bg-background"
      >
        <WaveformView
          peaks={clip.reverse ? [...peaks].reverse() : peaks}
          color="var(--clip-audio)"
          label={`${clip.name} interactive waveform`}
          gain={clip.gain ?? 1}
        />

        <div className="pointer-events-none absolute inset-y-0 left-0 bg-background/75" style={{ width: `${leftPct}%` }} />
        <div
          className="pointer-events-none absolute inset-y-0 bg-background/75"
          style={{ left: `${leftPct + widthPct}%`, right: 0 }}
        />
        <div
          className="pointer-events-none absolute inset-y-0 border-y border-clip-audio/40 bg-clip-audio/[0.04]"
          style={{ left: `${leftPct}%`, width: `${widthPct}%` }}
        />

        <svg className="pointer-events-none absolute inset-0 size-full" preserveAspectRatio="none" viewBox="0 0 100 100" aria-hidden="true">
          <path
            d={`M ${leftPct} 0 L ${leftPct + fadeInPct} 100 L ${leftPct} 100 Z`}
            fill="var(--clip-audio)"
            fillOpacity="0.14"
          />
          <line
            x1={leftPct}
            y1="0"
            x2={leftPct + fadeInPct}
            y2="100"
            stroke="var(--clip-audio)"
            strokeOpacity="0.9"
            vectorEffect="non-scaling-stroke"
          />
          <path
            d={`M ${leftPct + widthPct - fadeOutPct} 100 L ${leftPct + widthPct} 0 L ${leftPct + widthPct} 100 Z`}
            fill="var(--primary)"
            fillOpacity="0.14"
          />
          <line
            x1={leftPct + widthPct - fadeOutPct}
            y1="100"
            x2={leftPct + widthPct}
            y2="0"
            stroke="var(--primary)"
            strokeOpacity="0.9"
            vectorEffect="non-scaling-stroke"
          />
        </svg>

        <div
          {...handleProps("trim-start", offset, dur)}
          className="absolute inset-y-0 z-20 w-3 -translate-x-1/2 cursor-ew-resize border-x border-clip-audio bg-clip-audio/25 outline-none focus-visible:ring-2 focus-visible:ring-ring"
          style={{ left: `${leftPct}%` }}
          title={`Trim start ${offset.toFixed(2)}s`}
        >
          <span className="absolute bottom-1 left-1/2 -translate-x-1/2 rounded-[2px] bg-background/90 px-1 font-mono text-[8px] text-clip-audio">
            {offset.toFixed(2)}s
          </span>
        </div>
        <div
          {...handleProps("trim-end", offset + length, dur)}
          className="absolute inset-y-0 z-20 w-3 -translate-x-1/2 cursor-ew-resize border-x border-clip-audio bg-clip-audio/25 outline-none focus-visible:ring-2 focus-visible:ring-ring"
          style={{ left: `${leftPct + widthPct}%` }}
          title={`Trim end ${(offset + length).toFixed(2)}s`}
        >
          <span className="absolute right-1 bottom-1 rounded-[2px] bg-background/90 px-1 font-mono text-[8px] text-clip-audio">
            {(offset + length).toFixed(2)}s
          </span>
        </div>

        <div
          {...handleProps("fade-in", fadeIn, length / 2)}
          className="absolute top-2 z-30 size-4 -translate-x-1/2 cursor-ew-resize rounded-full border-2 border-background bg-clip-audio shadow-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
          style={{ left: `${leftPct + fadeInPct}%` }}
          title={`Fade in ${fadeIn.toFixed(3)}s`}
        />
        <div
          {...handleProps("fade-out", fadeOut, length / 2)}
          className="absolute top-2 z-30 size-4 -translate-x-1/2 cursor-ew-resize rounded-full border-2 border-background bg-primary shadow-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
          style={{ left: `${leftPct + widthPct - fadeOutPct}%` }}
          title={`Fade out ${fadeOut.toFixed(3)}s`}
        />

        <div className="pointer-events-none absolute top-1 left-2 font-mono text-[8px] tracking-wider text-clip-audio">
          TRIM / FADE IN
        </div>
        <div className="pointer-events-none absolute top-1 right-2 font-mono text-[8px] tracking-wider text-primary">
          FADE OUT / TRIM
        </div>
      </div>
      <p className="font-mono text-[9px] text-muted-foreground">
        Drag the tall edge handles to trim. Drag the round handles to shape the fades. Hold Shift with arrow keys for fine adjustment.
      </p>
    </div>
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
