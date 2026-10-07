import { useRef } from "react";

type Axis = { label: string; value: number; min: number; max: number; step: number; logarithmic?: boolean; unit?: string };

export function SynthXYPad({ x, y, onChange }: { x: Axis; y: Axis; onChange: (x: number, y: number) => void }) {
  const activePointer = useRef<number | null>(null);
  const clamp = (v: number) => Math.min(1, Math.max(0, v));
  const position = (a: Axis) => clamp(a.logarithmic ? Math.log(Math.max(a.min, a.value) / a.min) / Math.log(a.max / a.min) : (a.value - a.min) / (a.max - a.min));
  const valueAt = (a: Axis, p: number) => {
    const raw = a.logarithmic ? a.min * Math.pow(a.max / a.min, clamp(p)) : a.min + clamp(p) * (a.max - a.min);
    return Math.min(a.max, Math.max(a.min, Math.round(raw / a.step) * a.step));
  };
  const format = (a: Axis) => a.unit === "%" ? `${Math.round(a.value * 100)}%` : `${Number(a.value.toFixed(1))}${a.unit ? ` ${a.unit}` : ""}`;
  const move = (e: React.PointerEvent<HTMLDivElement>) => {
    const r = e.currentTarget.getBoundingClientRect();
    onChange(valueAt(x, (e.clientX - r.left) / r.width), valueAt(y, 1 - (e.clientY - r.top) / r.height));
  };
  const px = position(x) * 100;
  const py = (1 - position(y)) * 100;
  return (
    <div
      role="slider"
      tabIndex={0}
      aria-label={`X-Y pad: ${x.label.toLowerCase()} and ${y.label.toLowerCase()}`}
      aria-valuemin={x.min} aria-valuemax={x.max} aria-valuenow={x.value}
      aria-valuetext={`${x.label} ${format(x)}, ${y.label} ${format(y)}`}
      className="relative aspect-square w-56 max-w-full touch-none select-none overflow-hidden rounded-md border border-border bg-surface/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      onPointerDown={(e) => { e.preventDefault(); activePointer.current = e.pointerId; e.currentTarget.focus(); e.currentTarget.setPointerCapture(e.pointerId); move(e); }}
      onPointerMove={(e) => { if (activePointer.current === e.pointerId) move(e); }}
      onPointerUp={() => { activePointer.current = null; }}
      onPointerCancel={() => { activePointer.current = null; }}
      onLostPointerCapture={() => { activePointer.current = null; }}
      onKeyDown={(e) => {
        if (!["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown"].includes(e.key)) return;
        e.preventDefault(); e.stopPropagation();
        const step = e.shiftKey ? 0.1 : 0.02;
        onChange(valueAt(x, position(x) + (e.key === "ArrowRight" ? step : e.key === "ArrowLeft" ? -step : 0)), valueAt(y, position(y) + (e.key === "ArrowUp" ? step : e.key === "ArrowDown" ? -step : 0)));
      }}
    >
      <div className="pointer-events-none absolute inset-0 opacity-40" style={{ backgroundImage: "linear-gradient(to right, var(--border) 1px, transparent 1px), linear-gradient(to bottom, var(--border) 1px, transparent 1px)", backgroundSize: "25% 25%" }} />
      <span className="pointer-events-none absolute left-2 top-2 font-mono text-[10px] uppercase text-muted-foreground">{y.label} ↑</span>
      <span className="pointer-events-none absolute bottom-2 right-2 font-mono text-[10px] uppercase text-muted-foreground">{x.label} →</span>
      <div className="pointer-events-none absolute inset-y-0 w-px bg-primary/50" style={{ left: `${px}%` }} />
      <div className="pointer-events-none absolute inset-x-0 h-px bg-primary/50" style={{ top: `${py}%` }} />
      <div className="pointer-events-none absolute size-4 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-primary bg-primary/40" style={{ left: `${px}%`, top: `${py}%` }} />
    </div>
  );
}