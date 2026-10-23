import { canvasPoint, canvasRect } from "@/lib/synclab/canvas-point";
import { useEffect, useRef, useState } from "react";
import { useStudio } from "@/lib/synclab/store";
import { LIVE_FX, getLiveFx, type LiveFxInfo } from "@/lib/synclab/live-fx";
import { cn } from "@/lib/utils";
import { SkinControls, skinBackground, useImageDrop } from "@/components/studio/SkinControls";
import { useSkin } from "@/lib/synclab/skins";
import { registerCcAction } from "@/lib/synclab/midi-actions";
import { MidiLearnButton } from "./MidiLearn";

function FxPad({ fx }: { fx: LiveFxInfo }) {
  const box = useRef<HTMLDivElement | null>(null);
  const [pos, setPos] = useState<{ x: number; y: number } | null>(null);
  const [hold, setHold] = useState(false);
  const holdRef = useRef(hold);
  holdRef.current = hold;
  const down = useRef(false);

  const read = (e: React.PointerEvent) => {
    const r = canvasRect(box.current!);
    const pt = canvasPoint(e.clientX, e.clientY);
    return {
      x: Math.min(1, Math.max(0, (pt.x - r.left) / r.width)),
      y: 1 - Math.min(1, Math.max(0, (pt.y - r.top) / r.height)),
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

  // Learned controller knobs move X / Y; the effect lets go 1.5 s after the last move unless Hold is on.
  const posRef = useRef(pos);
  posRef.current = pos;
  useEffect(() => {
    let idle = 0;
    const move = (axis: "x" | "y") => (v: number) => {
      const prev = posRef.current;
      const next = { x: prev?.x ?? 0.5, y: prev?.y ?? 0.5, [axis]: v };
      if (prev) getLiveFx().move(fx.id, next.x, next.y); else getLiveFx().engage(fx.id, next.x, next.y);
      posRef.current = next;
      setPos(next);
      window.clearTimeout(idle);
      idle = window.setTimeout(() => {
        if (holdRef.current || down.current) return;
        getLiveFx().release(fx.id);
        posRef.current = null;
        setPos(null);
      }, 1500);
    };
    const offX = registerCcAction(`livefx:${fx.id}`, "x", move("x"));
    const offY = registerCcAction(`livefx:${fx.id}`, "y", move("y"));
    return () => { offX(); offY(); window.clearTimeout(idle); };
  }, [fx.id]);

  const active = pos !== null;
  return (
    <div
      className="panel flex flex-col gap-1.5 p-2 transition-colors"
      style={{ borderColor: active ? fx.color : `${fx.color}55`, boxShadow: active ? `0 0 18px ${fx.color}44` : undefined }}
    >
      <div className="flex items-center justify-between gap-1">
        <span className="font-display text-[11px] font-semibold tracking-[0.14em] uppercase" style={{ color: fx.color }}>{fx.name}</span>
        <button
          type="button"
          onClick={() => setHold((h) => !h)}
          aria-pressed={hold}
          className={cn(
            "rounded-[3px] border px-2 py-1 font-mono text-[9px] tracking-widest uppercase",
            hold ? "text-background" : "text-muted-foreground",
          )}
          style={hold ? { background: fx.color, borderColor: fx.color } : { borderColor: `${fx.color}66` }}
        >
          Hold
        </button>
      </div>
      <div className="flex flex-wrap items-center gap-1 font-mono text-[9px] uppercase text-muted-foreground">
        X <MidiLearnButton id={`livefx:${fx.id}`} param="x" label={`${fx.name} X`} />
        Y <MidiLearnButton id={`livefx:${fx.id}`} param="y" label={`${fx.name} Y`} />
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
        <div className="pointer-events-none absolute inset-0" style={{ background: `radial-gradient(circle at 50% 120%, ${fx.color}22, transparent 70%)` }} />
        {pos && (
          <>
            <div className="pointer-events-none absolute inset-y-0 w-px" style={{ left: `${pos.x * 100}%`, background: `${fx.color}88` }} />
            <div className="pointer-events-none absolute inset-x-0 h-px" style={{ top: `${(1 - pos.y) * 100}%`, background: `${fx.color}88` }} />
            <div
              className="pointer-events-none absolute size-6 -translate-x-1/2 -translate-y-1/2 rounded-full"
              style={{ left: `${pos.x * 100}%`, top: `${(1 - pos.y) * 100}%`, background: fx.color, boxShadow: `0 0 18px ${fx.color}` }}
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
  const skin = useSkin("live");
  const drop = useImageDrop("live");
  const { transport } = useStudio();
  useEffect(() => { getLiveFx().bpm = transport.bpm; }, [transport.bpm]);
  useEffect(() => () => getLiveFx().detach(), []);
  return (
    <section className="studio-wallpaper space-y-3 rounded-md p-3" data-studio-panel="live" style={skinBackground(skin)} {...drop}>
      <SkinControls skinKey="live" image />
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
