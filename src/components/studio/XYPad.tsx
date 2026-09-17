import { useEffect, useMemo, useRef, useState } from "react";
import { useStudio } from "@/lib/synclab/store";
import type { PluginInstance } from "@/lib/synclab/types";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

/**
 * Performance X-Y pad: drag to ride two of the effect's parameters at once.
 * X moves the left parameter, Y moves the right one (up = higher).
 */
export function XYPad({
  trackId,
  plugin,
  onParam,
}: {
  trackId?: string;
  plugin: PluginInstance;
  onParam?: (paramId: string, value: number) => void;
}) {
  const { setPluginParam } = useStudio();
  const write = (paramId: string, value: number) => {
    if (onParam) onParam(paramId, value);
    else if (trackId) setPluginParam(trackId, plugin.id, paramId, value);
  };
  const params = plugin.params;
  const [xId, setXId] = useState(() => params[0]?.id ?? "");
  const [yId, setYId] = useState(() => params[1]?.id ?? params[0]?.id ?? "");
  const boxRef = useRef<HTMLDivElement | null>(null);
  const [dragging, setDragging] = useState(false);

  useEffect(() => {
    if (!params.some((p) => p.id === xId)) setXId(params[0]?.id ?? "");
    if (!params.some((p) => p.id === yId)) setYId(params[1]?.id ?? params[0]?.id ?? "");
  }, [params, xId, yId]);

  const xP = useMemo(() => params.find((p) => p.id === xId), [params, xId]);
  const yP = useMemo(() => params.find((p) => p.id === yId), [params, yId]);

  const norm = (p: typeof xP) => (p && p.max > p.min ? (p.value - p.min) / (p.max - p.min) : 0);
  const px = norm(xP);
  const py = norm(yP);

  const apply = (clientX: number, clientY: number) => {
    const el = boxRef.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const nx = Math.min(1, Math.max(0, (clientX - r.left) / r.width));
    const ny = 1 - Math.min(1, Math.max(0, (clientY - r.top) / r.height));
    if (xP) write(xP.id, xP.min + nx * (xP.max - xP.min));
    if (yP) write(yP.id, yP.min + ny * (yP.max - yP.min));
  };

  if (params.length === 0) return null;

  return (
    <div className="space-y-1.5">
      <div className="flex items-center gap-1.5">
        <span className="label-xs">X-Y PAD</span>
        <Select value={xId} onValueChange={setXId}>
          <SelectTrigger className="h-6 flex-1 text-[10px]">
            <SelectValue placeholder="X" />
          </SelectTrigger>
          <SelectContent>
            {params.map((p) => (
              <SelectItem key={p.id} value={p.id} className="text-[11px]">
                X · {p.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={yId} onValueChange={setYId}>
          <SelectTrigger className="h-6 flex-1 text-[10px]">
            <SelectValue placeholder="Y" />
          </SelectTrigger>
          <SelectContent>
            {params.map((p) => (
              <SelectItem key={p.id} value={p.id} className="text-[11px]">
                Y · {p.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div
        ref={boxRef}
        role="slider"
        tabIndex={0}
        aria-label={`X-Y pad: ${xP?.name ?? "X"} and ${yP?.name ?? "Y"}`}
        aria-valuenow={Math.round(px * 100)}
        className="panel relative h-36 cursor-crosshair touch-none overflow-hidden bg-surface-2/50"
        onPointerDown={(e) => {
          e.currentTarget.setPointerCapture(e.pointerId);
          setDragging(true);
          apply(e.clientX, e.clientY);
        }}
        onPointerMove={(e) => {
          if (dragging) apply(e.clientX, e.clientY);
        }}
        onPointerUp={() => setDragging(false)}
        onPointerCancel={() => setDragging(false)}
      >
        <div className="pointer-events-none absolute inset-0 opacity-40 [background-image:linear-gradient(to_right,rgba(255,255,255,.06)_1px,transparent_1px),linear-gradient(to_bottom,rgba(255,255,255,.06)_1px,transparent_1px)] [background-size:25%_25%]" />
        <div className="pointer-events-none absolute inset-y-0" style={{ left: `${px * 100}%` }}>
          <div className="h-full w-px bg-primary/40" />
        </div>
        <div className="pointer-events-none absolute inset-x-0" style={{ top: `${(1 - py) * 100}%` }}>
          <div className="h-px w-full bg-primary/40" />
        </div>
        <div
          className="pointer-events-none absolute size-4 -translate-x-1/2 -translate-y-1/2 rounded-full bg-primary shadow-[0_0_14px_hsl(187_85%_55%/0.8)]"
          style={{ left: `${px * 100}%`, top: `${(1 - py) * 100}%` }}
        />
        <span className="pointer-events-none absolute bottom-1 left-1.5 font-mono text-[9px] tracking-wider text-muted-foreground uppercase">
          {xP?.name ?? "—"} {xP ? xP.value.toFixed(2) : ""}
        </span>
        <span className="pointer-events-none absolute left-1.5 top-1.5 font-mono text-[9px] tracking-wider text-muted-foreground uppercase">
          {yP?.name ?? "—"} {yP ? yP.value.toFixed(2) : ""}
        </span>
      </div>
    </div>
  );
}
