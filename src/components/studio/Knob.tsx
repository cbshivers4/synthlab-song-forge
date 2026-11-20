import { useCallback, useEffect, useId, useRef } from "react";
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
  /** Called once a gesture finishes (pointer released, key released, wheel settled). */
  onCommit?: (() => void) | undefined;
}

/** Point on the dial ring; 0° is straight up, clockwise positive. */
const ringPoint = (deg: number, r: number) => {
  const a = (deg * Math.PI) / 180;
  return `${(50 + r * Math.sin(a)).toFixed(2)} ${(50 - r * Math.cos(a)).toFixed(2)}`;
};
/** SVG arc between two dial angles (degrees). */
export function knobArc(from: number, to: number, r = 44) {
  const [a, b] = from <= to ? [from, to] : [to, from];
  if (b - a < 0.01) return "";
  return `M ${ringPoint(a, r)} A ${r} ${r} 0 ${b - a > 180 ? 1 : 0} 1 ${ringPoint(b, r)}`;
}

/** Snaps to the step grid without floating-point drift. */
export function knobStep(value: number, min: number, max: number, step: number) {
  const clamped = Math.min(max, Math.max(min, value));
  const snapped = Math.round(clamped / step) * step;
  return Number(Math.min(max, Math.max(min, snapped)).toFixed(6));
}

/**
 * Rotary knob shared by instruments, effects, mastering and the mixer: a dark machined dial with a
 * lit value ring (accent from --knob-accent) and a white pointer.
 * Drag up/down (Shift = fine), mouse wheel, arrow / Page keys, Home or double-click to reset.
 */
export function Knob({
  label,
  value,
  min = 0,
  max = 1,
  step = 0.01,
  unit = "",
  size = 44,
  onChange,
  midiTarget,
  defaultValue,
  format,
  layout = "stack",
  ariaLabel,
  className,
  onCommit,
}: KnobProps) {
  const gid = useId().replace(/:/g, "");
  const start = useRef<{ y: number; v: number } | null>(null);
  const commitRef = useRef(onCommit);
  commitRef.current = onCommit;
  const wheelTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
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
      const next = knobStep(start.current.v + delta * (max - min), min, max, step);
      // Moves that land on the same step change nothing; skipping them avoids redrawing the studio.
      if (next === latest.current.value) return;
      latest.current = { ...latest.current, value: next };
      onChange(next);
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
      change(
        knobStep(v + (e.deltaY < 0 ? 1 : -1) * st * ticks * (e.shiftKey ? 0.25 : 1), lo, hi, st),
      );
      if (wheelTimer.current) clearTimeout(wheelTimer.current);
      wheelTimer.current = setTimeout(() => commitRef.current?.(), 350);
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => {
      el.removeEventListener("wheel", onWheel);
      if (wheelTimer.current) clearTimeout(wheelTimer.current);
    };
  }, []);

  const pct = Math.min(1, Math.max(0, (value - min) / (max - min || 1)));
  const angle = -135 + pct * 270;
  // Bipolar controls (pan, ±dB) light the ring from their centre; others from the minimum.
  const origin =
    defaultValue !== undefined && defaultValue > min && defaultValue < max
      ? -135 + ((defaultValue - min) / (max - min)) * 270
      : -135;
  const lit = knobArc(origin, angle);
  const display = format
    ? format(value)
    : `${max - min > 40 ? Math.round(value) : Number(value.toFixed(2))}${unit}`;
  const reset = () => {
    if (defaultValue !== undefined) onChange(defaultValue);
  };

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
      title={
        defaultValue !== undefined
          ? `${ariaLabel ?? label}: drag, scroll or use arrow keys · double-click to reset`
          : undefined
      }
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={() => {
        if (start.current) commitRef.current?.();
        start.current = null;
      }}
      onPointerCancel={() => (start.current = null)}
      onDoubleClick={() => {
        reset();
        commitRef.current?.();
      }}
      onKeyUp={(e) => {
        if (/^(Arrow|Page|Home)/.test(e.key)) commitRef.current?.();
      }}
      onKeyDown={(e) => {
        const big = step * Math.max(1, Math.round((max - min) / step / 10));
        if (e.key === "ArrowUp" || e.key === "ArrowRight")
          onChange(knobStep(value + step, min, max, step));
        else if (e.key === "ArrowDown" || e.key === "ArrowLeft")
          onChange(knobStep(value - step, min, max, step));
        else if (e.key === "PageUp") onChange(knobStep(value + big, min, max, step));
        else if (e.key === "PageDown") onChange(knobStep(value - big, min, max, step));
        else if (e.key === "Home" && defaultValue !== undefined) reset();
        else return;
        e.preventDefault();
      }}
      className="hardware-knob-dial relative shrink-0 cursor-ns-resize touch-none rounded-full"
      style={{ width: size, height: size }}
    >
      <svg
        className="hardware-knob-svg absolute inset-0 size-full overflow-visible"
        viewBox="0 0 100 100"
        aria-hidden="true"
      >
        <defs>
          <radialGradient id={`kb${gid}`} cx="38%" cy="30%" r="80%">
            <stop offset="0" className="hardware-knob-body-hi" />
            <stop offset="1" className="hardware-knob-body-lo" />
          </radialGradient>
          <linearGradient id={`kc${gid}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" className="hardware-knob-cap-hi" />
            <stop offset="1" className="hardware-knob-cap-lo" />
          </linearGradient>
        </defs>
        <path className="hardware-knob-track" d={knobArc(-135, 135)} />
        {lit && <path className="hardware-knob-arc" d={lit} />}
        <circle className="hardware-knob-shadow" cx="50" cy="53" r="33" />
        <circle className="hardware-knob-body" cx="50" cy="50" r="33" fill={`url(#kb${gid})`} />
        <circle className="hardware-knob-face" cx="50" cy="50" r="26" fill={`url(#kc${gid})`} />
        <line
          className="hardware-knob-mark"
          x1="50"
          y1="40"
          x2="50"
          y2="25"
          transform={`rotate(${angle} 50 50)`}
        />
      </svg>
    </div>
  );

  if (layout === "inline") {
    return (
      <div
        className={cn(
          "hardware-knob hardware-knob-inline flex min-w-0 items-center gap-1.5 select-none",
          className,
        )}
      >
        {dialEl}
        <span className="flex min-w-0 flex-col leading-none">
          <span className="hardware-knob-label label-xs text-[9px] leading-none">{label}</span>
          <span className="hardware-knob-value font-mono text-[11px] font-semibold text-foreground">
            {display}
          </span>
        </span>
        {midiTarget && <MidiLearnButton {...midiTarget} label={ariaLabel ?? label} />}
      </div>
    );
  }

  return (
    <div
      className={cn("hardware-knob flex w-16 flex-col items-center gap-1 select-none", className)}
    >
      {dialEl}
      <span className="hardware-knob-label label-xs text-[9px] leading-none">{label}</span>
      {midiTarget && <MidiLearnButton {...midiTarget} label={ariaLabel ?? label} />}
      <span className="hardware-knob-value font-mono text-[10px] text-foreground/70">
        {display}
      </span>
    </div>
  );
}
