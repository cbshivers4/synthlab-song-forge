import { useCallback, useEffect, useRef } from "react";
import { canvasPoint } from "@/lib/synclab/canvas-point";
import { MidiLearnButton } from "./MidiLearn";
import { cn } from "@/lib/utils";

interface KnobProps {
  label: string;
  value: number;
  min?: number;
  max?: number;
  step?: number;
  unit?: string;
  size?: number;
  onChange: (v: number) => void;
  midiTarget?: { id: string; param: string } | undefined;
  /** Double-click / Home key returns here (e.g. pan centre). */
  defaultValue?: number | undefined;
  /** Custom value text (e.g. "L20", "C", "120%"). */
  format?: ((v: number) => string) | undefined;
  /** "inline" puts label + value beside the dial for compact rows (mixer pan). */
  layout?: "stack" | "inline";
  /** Accessible name when the visible label is short (e.g. "PAN"). */
  ariaLabel?: string | undefined;
  className?: string | undefined;
}

/** Snaps to the step grid without floating-point drift. */
export function knobStep(value: number, min: number, max: number, step: number) {
  const clamped = Math.min(max, Math.max(min, value));
  const snapped = Math.round(clamped / step) * step;
  return Number(Math.min(max, Math.max(min, snapped)).toFixed(6));
}

/**
 * Physical-style rotary knob shared by instruments, effects and the mixer.
 * Drag up/down (Shift = fine), mouse wheel, arrow / Page keys, Home or double-click to reset.
 */
export function Knob({ label, value, min = 0, max = 1, step = 0.01, unit = "", size = 44, onChange, midiTarget, defaultValue, format, layout = "stack", ariaLabel, className }: KnobProps) {
  const start = useRef<{ y: number; v: number } | null>(null);
  const dial = useRef<HTMLDivElement>(null);
  const latest = useRef({ value, min, max, step, onChange });
  latest.current = { value, min, max, step, onChange };

  const onPointerDown = useCallback(
    (e: React.PointerEvent) => {
      (e.target as Element).setPointerCapture(e.pointerId);
      start.current = { y: canvasPoint(e.clientX, e.clientY).y, v: value };
    },
    [value],
  );

  const onPointerMove = useCallback(
    (e: React.PointerEvent) => {
      if (!start.current) return;
      const y = canvasPoint(e.clientX, e.clientY).y;
      const delta = (start.current.y - y) / (e.shiftKey ? 640 : 160);
      onChange(knobStep(start.current.v + delta * (max - min), min, max, step));
    },
    [max, min, onChange, step],
  );

  // Wheel needs a non-passive listener so turning the knob doesn't also scroll the page.
  useEffect(() => {
    const el = dial.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const { value: v, min: lo, max: hi, step: st, onChange: change } = latest.current;
      const ticks = Math.max(1, Math.round((hi - lo) / st / 100));
      change(knobStep(v + (e.deltaY < 0 ? 1 : -1) * st * ticks * (e.shiftKey ? 0.25 : 1), lo, hi, st));
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, []);

  const pct = (value - min) / (max - min || 1);
  const angle = -135 + pct * 270;
  const display = format ? format(value) : `${max - min > 40 ? Math.round(value) : Number(value.toFixed(2))}${unit}`;
  const reset = () => { if (defaultValue !== undefined) onChange(defaultValue); };

  const dialEl = (
    <div
      ref={dial}
      role="slider"
      aria-label={ariaLabel ?? label}
      aria-valuenow={value}
      aria-valuemin={min}
      aria-valuemax={max}
      aria-valuetext={display}
      tabIndex={0}
      title={defaultValue !== undefined ? `${ariaLabel ?? label}: drag, scroll or use arrow keys · double-click to reset` : undefined}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={() => (start.current = null)}
      onPointerCancel={() => (start.current = null)}
      onDoubleClick={reset}
      onKeyDown={(e) => {
        const big = step * Math.max(1, Math.round((max - min) / step / 10));
        if (e.key === "ArrowUp" || e.key === "ArrowRight") onChange(knobStep(value + step, min, max, step));
        else if (e.key === "ArrowDown" || e.key === "ArrowLeft") onChange(knobStep(value - step, min, max, step));
        else if (e.key === "PageUp") onChange(knobStep(value + big, min, max, step));
        else if (e.key === "PageDown") onChange(knobStep(value - big, min, max, step));
        else if (e.key === "Home" && defaultValue !== undefined) reset();
        else return;
        e.preventDefault();
      }}
      className="hardware-knob-dial relative shrink-0 cursor-ns-resize touch-none rounded-full"
      style={{ width: size, height: size }}
    >
      <svg className="hardware-knob-scale absolute inset-0 size-full" viewBox="0 0 100 100" aria-hidden="true">
        {Array.from({ length: 11 }, (_, i) => <line key={i} x1="50" y1="3" x2="50" y2={i % 5 === 0 ? "12" : "8"} transform={`rotate(${-135 + i * 27} 50 50)`} />)}
      </svg>
      <div className="hardware-knob-grip absolute inset-[17%] rounded-full">
        <div className="hardware-knob-cap absolute inset-[12%] rounded-full" />
        <div className="hardware-knob-pointer absolute inset-0" style={{ transform: `rotate(${angle}deg)` }}><i /></div>
      </div>
    </div>
  );

  if (layout === "inline") {
    return (
      <div className={cn("hardware-knob hardware-knob-inline flex min-w-0 items-center gap-1.5 select-none", className)}>
        {dialEl}
        <span className="flex min-w-0 flex-col leading-none">
          <span className="hardware-knob-label label-xs text-[9px] leading-none">{label}</span>
          <span className="hardware-knob-value font-mono text-[11px] font-semibold text-foreground">{display}</span>
        </span>
        {midiTarget && <MidiLearnButton {...midiTarget} label={ariaLabel ?? label} />}
      </div>
    );
  }

  return (
    <div className={cn("hardware-knob flex w-16 flex-col items-center gap-1 select-none", className)}>
      {dialEl}
      <span className="hardware-knob-label label-xs text-[9px] leading-none">{label}</span>
      {midiTarget && <MidiLearnButton {...midiTarget} label={ariaLabel ?? label} />}
      <span className="hardware-knob-value font-mono text-[10px] text-foreground/70">{display}</span>
    </div>
  );
}
