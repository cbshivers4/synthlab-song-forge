import { canvasPoint, canvasRect, sidewaysCanvas } from "@/lib/synclab/canvas-point";
import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { Minus, Maximize2, X } from "lucide-react";

type Props = {
  title: string;
  faceplate: string;
  initial?: { x: number; y: number; w: number; h: number };
  onClose: () => void;
  children: ReactNode;
};

export function FloatingDevice({ title, faceplate, initial, onClose, children }: Props) {
  const [pos, setPos] = useState(() => ({
    x: initial?.x ?? 120,
    y: initial?.y ?? 90,
    w: initial?.w ?? 980,
    h: initial?.h ?? 520,
  }));
  const [collapsed, setCollapsed] = useState(false);
  const drag = useRef<{
    mode: "move" | "size";
    sx: number;
    sy: number;
    ox: number;
    oy: number;
  } | null>(null);

  const start = useCallback(
    (mode: "move" | "size") => (e: React.PointerEvent) => {
      e.preventDefault();
      (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
      const pt = canvasPoint(e.clientX, e.clientY);
      drag.current = {
        mode,
        sx: pt.x,
        sy: pt.y,
        ox: mode === "move" ? pos.x : pos.w,
        oy: mode === "move" ? pos.y : pos.h,
      };
    },
    [pos],
  );

  useEffect(() => {
    const move = (e: PointerEvent) => {
      const d = drag.current;
      if (!d) return;
      const pt = canvasPoint(e.clientX, e.clientY);
      const dx = pt.x - d.sx;
      const dy = pt.y - d.sy;
      // On the rotated phone canvas the layout axes are swapped.
      const layoutW = sidewaysCanvas() ? window.innerHeight : window.innerWidth;
      const layoutH = sidewaysCanvas() ? window.innerWidth : window.innerHeight;
      setPos((p) =>
        d.mode === "move"
          ? {
              ...p,
              x: Math.max(-p.w + 160, Math.min(layoutW - 120, d.ox + dx)),
              y: Math.max(0, Math.min(layoutH - 48, d.oy + dy)),
            }
          : { ...p, w: Math.max(420, d.ox + dx), h: Math.max(220, d.oy + dy) },
      );
    };
    const up = () => {
      drag.current = null;
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
    return () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
    };
  }, []);

  return (
    <div
      className="fixed z-40 flex flex-col overflow-hidden rounded-md border border-border shadow-2xl"
      style={{
        left: pos.x,
        top: pos.y,
        width: pos.w,
        height: collapsed ? undefined : pos.h,
        background: "oklch(0.16 0.008 255)",
        boxShadow: "0 24px 60px oklch(0 0 0 / 0.65), inset 0 1px 0 oklch(1 0 0 / 0.06)",
      }}
    >
      {/* hardware faceplate header — drag handle */}
      <div
        className="relative shrink-0 cursor-grab select-none active:cursor-grabbing"
        onPointerDown={start("move")}
      >
        <img
          src={faceplate}
          alt={`${title} hardware panel`}
          loading="lazy"
          width={1920}
          height={640}
          className="h-[70px] w-full object-cover object-center"
          draggable={false}
        />
        <div className="absolute inset-0 bg-gradient-to-b from-black/80 via-black/25 to-background/90" />
        <div className="absolute inset-x-0 top-0 flex items-center gap-2 px-3 py-1.5">
          <span className="font-display text-[11px] font-semibold tracking-[0.3em] text-white drop-shadow">
            {title}
          </span>
          <div className="ml-auto flex items-center gap-1">
            <button
              className="grid size-6 place-items-center rounded-[3px] bg-black/50 text-white/80 hover:text-white"
              onPointerDown={(e) => e.stopPropagation()}
              onClick={() => setCollapsed((c) => !c)}
              aria-label={collapsed ? "Expand" : "Collapse"}
            >
              {collapsed ? <Maximize2 className="size-3.5" /> : <Minus className="size-3.5" />}
            </button>
            <button
              className="grid size-6 place-items-center rounded-[3px] bg-black/50 text-white/80 hover:text-white"
              onPointerDown={(e) => e.stopPropagation()}
              onClick={onClose}
              aria-label="Close device"
            >
              <X className="size-3.5" />
            </button>
          </div>
        </div>
      </div>

      {!collapsed && (
        <>
          <div className="min-h-0 flex-1 space-y-3 overflow-auto p-3">{children}</div>
          <div
            className="absolute right-0 bottom-0 size-4 cursor-nwse-resize"
            onPointerDown={start("size")}
            style={{
              background: "linear-gradient(135deg, transparent 50%, oklch(0.5 0.01 255) 50%)",
            }}
          />
        </>
      )}
    </div>
  );
}
