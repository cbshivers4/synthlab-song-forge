import { useCallback, useRef } from "react";
import { canvasPoint } from "@/lib/synclab/canvas-point";
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
      start.current = { y: canvasPoint(e.clientX, e.clientY).y, v: value };
    },
    [value],
  );

  const onPointerMove = useCallback(
    (e: React.PointerEvent) => {
      if (!start.current) return;
      const delta = (start.current.y - canvasPoint(e.clientX, e.clientY).y) / 160;
      const next = Math.min(max, Math.max(min, start.current.v + delta * (max - min)));
      onChange(Math.round(next / step) * step);
    },
    [max, min, onChange, step],
  );

  const pct = (value - min) / (max - min || 1);
  const angle = -135 + pct * 270;
  const display = max - min > 40 ? Math.round(value) : Number(value.toFixed(2));

  return (
    <div className="hardware-knob flex w-16 flex-col items-center gap-1 select-none">
      <div
        role="slider"
        aria-label={label}
        aria-valuenow={value}
        aria-valuemin={min}
        aria-valuemax={max}
        aria-valuetext={`${display}${unit}`}
        tabIndex={0}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={() => (start.current = null)}
        onPointerCancel={() => (start.current = null)}
        onKeyDown={(e) => {
          if (e.key === "ArrowUp") onChange(Math.min(max, value + step));
          if (e.key === "ArrowDown") onChange(Math.max(min, value - step));
        }}
        className="hardware-knob-dial relative cursor-ns-resize touch-none rounded-full"
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
      <span className="hardware-knob-label label-xs text-[9px] leading-none">{label}</span>
      {midiTarget && <MidiLearnButton {...midiTarget} label={label} />}
      <span className="hardware-knob-value font-mono text-[10px] text-foreground/70">
        {display}
        {unit}
      </span>
    </div>
  );
}
