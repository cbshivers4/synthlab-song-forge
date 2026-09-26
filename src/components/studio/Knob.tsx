import { useCallback, useRef } from "react";
import { MidiLearnButton } from "./MidiLearn";

interface KnobProps {
  label: string;
  value: number;
  min?: number;
  max?: number;
  step?: number;
  unit?: string;
  size?: number;
  onChange: (v: number) => void;
  midiTarget?: { id: string; param: string };
}

export function Knob({ label, value, min = 0, max = 1, step = 0.01, unit = "", size = 44, onChange, midiTarget }: KnobProps) {
  const start = useRef<{ y: number; v: number } | null>(null);

  const onPointerDown = useCallback(
    (e: React.PointerEvent) => {
      (e.target as Element).setPointerCapture(e.pointerId);
      start.current = { y: e.clientY, v: value };
    },
    [value],
  );

  const onPointerMove = useCallback(
    (e: React.PointerEvent) => {
      if (!start.current) return;
      const delta = (start.current.y - e.clientY) / 160;
      const next = Math.min(max, Math.max(min, start.current.v + delta * (max - min)));
      onChange(Math.round(next / step) * step);
    },
    [max, min, onChange, step],
  );

  const pct = (value - min) / (max - min || 1);
  const angle = -135 + pct * 270;
  const display = max - min > 40 ? Math.round(value) : Number(value.toFixed(2));

  return (
    <div className="flex w-16 flex-col items-center gap-1 select-none">
      <div
        role="slider"
        aria-label={label}
        aria-valuenow={value}
        aria-valuemin={min}
        aria-valuemax={max}
        tabIndex={0}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={() => (start.current = null)}
        onKeyDown={(e) => {
          if (e.key === "ArrowUp") onChange(Math.min(max, value + step));
          if (e.key === "ArrowDown") onChange(Math.max(min, value - step));
        }}
        className="relative cursor-ns-resize rounded-full border border-border bg-surface-2 transition-shadow hover:glow"
        style={{ width: size, height: size }}
      >
        <div
          className="absolute inset-[6px] rounded-full"
          style={{
            background: `conic-gradient(from 225deg, var(--neon) ${pct * 270}deg, color-mix(in oklab, var(--border) 80%, transparent) ${pct * 270}deg 270deg, transparent 270deg)`,
          }}
        />
        <div className="absolute inset-[10px] rounded-full bg-surface" />
        <div
          className="absolute top-1/2 left-1/2 h-[38%] w-[2px] origin-bottom rounded-full bg-primary"
          style={{ transform: `translate(-50%,-100%) rotate(${angle}deg)` }}
        />
      </div>
      <span className="label-xs text-[9px] leading-none">{label}</span>
      {midiTarget && <MidiLearnButton {...midiTarget} label={label} />}
      <span className="font-mono text-[10px] text-foreground/70">
        {display}
        {unit}
      </span>
    </div>
  );
}
