import { useEffect, useRef, useState } from "react";
import { useStudio } from "@/lib/synclab/store";
import { LIVE_FX, getLiveFx, type LiveFxInfo } from "@/lib/synclab/live-fx";
import { cn } from "@/lib/utils";

function FxPad({ fx }: { fx: LiveFxInfo }) {
  const box = useRef<HTMLDivElement | null>(null);
  const [pos, setPos] = useState<{ x: number; y: number } | null>(null);
  const [hold, setHold] = useState(false);
  const holdRef = useRef(hold);
  holdRef.current = hold;
  const down = useRef(false);

  const read = (e: React.PointerEvent) => {
    const r = box.current!.getBoundingClientRect();
    return {
      x: Math.min(1, Math.max(0, (e.clientX - r.left) / r.width)),
      y: 1 - Math.min(1, Math.max(0, (e.clientY - r.top) / r.height)),
    };
  };
  const end = () => {
    down.current = false;
    if (holdRef.current) return;
    getLiveFx().release(fx.id);
    setPos(null);
  };

  useEffect(() => {
    if (!hold && !down.current && pos) {
      getLiveFx().release(fx.id);
      setPos(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hold]);

  const active = pos !== null;
  return (
    <div className={cn("panel flex flex-col gap-1.5 p-2 transition-colors", active && "border-primary")}>
      <div className="flex items-center justify-between gap-1">
        <span className="font-display text-[11px] font-semibold tracking-[0.14em] uppercase">{fx.name}</span>
        <button
          type="button"
          onClick={() => setHold((h) => !h)}
          aria-pressed={hold}
          className={cn(
            "rounded-[3px] border px-2 py-1 font-mono text-[9px] tracking-widest uppercase",
            hold ? "border-primary bg-primary text-primary-foreground" : "border-border text-muted-foreground",
          )}
        >
          Hold
        </button>
      </div>
      <div
        ref={box}
        role="slider"
        aria-label={`${fx.name} X-Y pad`}
        aria-valuenow={pos ? Math.round(pos.x * 100) : 0}
        tabIndex={0}
        className="relative aspect-square w-full cursor-crosshair touch-none overflow-hidden rounded-[4px] border border-border bg-surface-2/60"
        onPointerDown={(e) => {
          e.currentTarget.setPointerCapture(e.pointerId);
          down.current = true;
          const p = read(e);
          setPos(p);
          getLiveFx().engage(fx.id, p.x, p.y);
        }}
        onPointerMove={(e) => {
          if (!down.current) return;
          const p = read(e);
          setPos(p);
          getLiveFx().move(fx.id, p.x, p.y);
        }}
        onPointerUp={end}
        onPointerCancel={end}
      >
        <div className="pointer-events-none absolute inset-0 opacity-40 [background-image:linear-gradient(to_right,var(--border)_1px,transparent_1px),linear-gradient(to_bottom,var(--border)_1px,transparent_1px)] [background-size:25%_25%]" />
        {pos && (
          <>
            <div className="pointer-events-none absolute inset-y-0 w-px bg-primary/50" style={{ left: `${pos.x * 100}%` }} />
            <div className="pointer-events-none absolute inset-x-0 h-px bg-primary/50" style={{ top: `${(1 - pos.y) * 100}%` }} />
            <div
              className="pointer-events-none absolute size-6 -translate-x-1/2 -translate-y-1/2 rounded-full bg-primary shadow-[0_0_18px_var(--primary)]"
              style={{ left: `${pos.x * 100}%`, top: `${(1 - pos.y) * 100}%` }}
            />
          </>
        )}
        <span className="pointer-events-none absolute bottom-1 left-1.5 font-mono text-[9px] text-muted-foreground uppercase">X · {fx.x}</span>
        <span className="pointer-events-none absolute left-1.5 top-1 font-mono text-[9px] text-muted-foreground uppercase">Y · {fx.y}</span>
      </div>
    </div>
  );
}

export function LiveView() {
  const { transport } = useStudio();
  useEffect(() => { getLiveFx().bpm = transport.bpm; }, [transport.bpm]);
  useEffect(() => () => getLiveFx().detach(), []);
  return (
    <section className="space-y-2">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h3 className="font-display text-xs font-semibold tracking-[0.2em]">PERFORMANCE FX · WHOLE SONG</h3>
        <p className="text-[11px] text-muted-foreground">Touch and drag a pad to play the effect. Let go to return to dry, or tap HOLD to latch it.</p>
      </div>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        {LIVE_FX.map((fx) => <FxPad key={fx.id} fx={fx} />)}
      </div>
    </section>
  );
}
