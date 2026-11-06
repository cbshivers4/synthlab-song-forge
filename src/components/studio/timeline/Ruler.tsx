import { usePlayStep } from "@/lib/synclab/playhead";
import { useEffect, useRef, useState } from "react";
import { stepsPerBar, getBeatsPerBar, songSteps, stepSeconds, positionLabel } from "@/lib/synclab/timebase";
import { useIsMobile } from "@/hooks/use-mobile";
import { Flag, Settings2 } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useStudio } from "@/lib/synclab/store";
import { canvasPoint, canvasRect } from "@/lib/synclab/canvas-point";
import { TimelineOptionsPanel } from "./EditToolbar";

/** Density-aware measure numbering for the ruler: keeps bar labels readable
 *  past 100+ bars by numbering every Nth bar (snapped to 1/2/5/10/25/50/100)
 *  based on real pixels per bar, with ticks for the bars in between. */
function BarNumbering({ gridRef, bars }: { gridRef: React.RefObject<HTMLDivElement | null>; bars: number }) {
  const [gridW, setGridW] = useState(0);
  useEffect(() => {
    const el = gridRef.current;
    if (!el) return;
    const update = () => setGridW(el.clientWidth);
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, [gridRef]);

  const bpb = getBeatsPerBar();
  const beats = Math.max(1, bars) * bpb;
  const pxPerBar = gridW > 0 ? gridW / Math.max(1, bars) : 0;
  // ~56px keeps up to 5-digit numbers from colliding; snap to a musical step.
  const need = pxPerBar > 0 ? Math.ceil(56 / pxPerBar) : 1;
  const step = [1, 2, 5, 10, 25, 50, 100, 250, 500].find((s) => s >= need) ?? need;
  const showBeats = pxPerBar === 0 || pxPerBar >= 18;

  return (
    <div className="grid w-full" style={{ gridTemplateColumns: `repeat(${beats},minmax(0,1fr))` }}>
      {Array.from({ length: beats }).map((_, i) => {
        const isBar = i % bpb === 0;
        const bar = i / bpb;
        const labeled = isBar && bar % step === 0;
        return (
          <div
            key={i}
            className={`relative py-1 pl-[14px] font-mono leading-none ${labeled ? "text-[10px]" : "text-[9px]"}`}
          >
            {/* measure-bar tick: tall line on the bar, short line on each beat */}
            <span
              aria-hidden="true"
              className={`absolute bottom-0 left-0 w-px ${isBar ? "inset-y-0 bg-foreground/60" : "h-2.5 bg-foreground/35"}`}
            />
            {labeled ? (
              <span className="inline-block rounded-[2px] bg-surface-2/80 px-1 py-0.5 font-medium text-foreground/85">
                {bar + 1}
              </span>
            ) : isBar ? (
              <span className="text-muted-foreground/45">{pxPerBar >= 10 ? "·" : ""}</span>
            ) : (
              showBeats ? <span className="text-muted-foreground/25">·</span> : null
            )}
          </div>
        );
      })}
    </div>
  );
}

export function Ruler() {
  const liveStep = usePlayStep();
  const { transport, setTransport } = useStudio();
  const isMobile = useIsMobile();
  const gridRef = useRef<HTMLDivElement>(null);
  const bars = Math.max(1, transport.bars ?? 4);
  const total = bars * stepsPerBar();
  const lo = transport.loopStart ?? 0;
  const hi = Math.max(lo + 1, transport.loopEnd ?? total);
  const exportOn = transport.exportStart != null && transport.exportEnd != null;
  const exLo = exportOn ? Math.min(transport.exportStart!, transport.exportEnd! - 1) : 0;
  const exHi = exportOn ? Math.max(transport.exportEnd!, exLo + 1) : total;


  const stepFromX = (clientX: number, clientY: number) => {
    const el = gridRef.current;
    if (!el) return 0;
    const r = canvasRect(el);
    return Math.min(total, Math.max(0, Math.round(((canvasPoint(clientX, clientY).x - r.left) / r.width) * total)));
  };

  // Drag on empty ruler space to draw a loop region. A plain click (no drag)
  // leaves the existing region alone and just moves the playhead.
  const startDrag = (e: React.PointerEvent) => {
    if (e.button !== 0) return;
    e.preventDefault();
    const s = stepFromX(e.clientX, e.clientY);
    let moved = false;
    const move = (ev: PointerEvent) => {
      const end = stepFromX(ev.clientX, ev.clientY);
      if (!moved && end === s) return;
      moved = true;
      const a = Math.min(s, end);
      const b = Math.max(s, end);
      setTransport({ loopStart: a, loopEnd: Math.max(a + 1, b), loop: true });
    };
    const up = () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
      if (!moved) setTransport({ step: Math.min(total - 1, s) });
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
  };

  /** Drag a loop marker, or the whole band when grabbing between them. */
  const dragLoop = (which: "start" | "end" | "band") => (e: React.PointerEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const from = stepFromX(e.clientX, e.clientY);
    const len = hi - lo;
    const move = (ev: PointerEvent) => {
      const s = stepFromX(ev.clientX, ev.clientY);
      if (which === "start") setTransport({ loopStart: Math.max(0, Math.min(s, hi - 1)), loop: true });
      else if (which === "end") setTransport({ loopEnd: Math.min(total, Math.max(s, lo + 1)), loop: true });
      else {
        const shift = s - from;
        const start = Math.max(0, Math.min(total - len, lo + shift));
        setTransport({ loopStart: start, loopEnd: start + len, loop: true });
      }
    };
    const up = () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
  };


  const dragFlag = (which: "start" | "end") => (e: React.PointerEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const move = (ev: PointerEvent) => {
      const s = stepFromX(ev.clientX, ev.clientY);
      if (which === "start") setTransport({ exportStart: Math.min(s, exHi - 1) });
      else setTransport({ exportEnd: Math.max(s, exLo + 1) });
    };
    const up = () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
  };

  return (
    <div className="sticky top-0 z-10 flex border-b border-border bg-surface-2/70 backdrop-blur">
      <div className="relative z-40 flex w-[var(--timeline-header-width)] shrink-0 flex-col justify-center gap-1 border-r border-border bg-surface-2 px-2 py-1 sm:px-3" style={{ transform: "translateX(var(--timeline-scroll-x, 0px))" }}>
        <div className="flex items-center gap-2">
          <span className="font-display text-[11px] font-semibold tracking-[0.2em]">TIMELINE</span>
          <span className="label-xs ml-auto">
            {(transport.timebase ?? "bars") === "seconds"
              ? (() => { const t = liveStep * stepSeconds(transport.bpm); return `${Math.floor(t / 60)}:${(t % 60).toFixed(2).padStart(5, "0")}`; })()
              : positionLabel(liveStep)}
          </span>
        </div>
        <div className="flex items-center gap-1.5">
        {/* song length + export flags: menu on desktop, timeline tools menu on phones */}
        {(
          <Popover>
            <PopoverTrigger asChild>
              <button
                type="button"
                aria-label="Timeline options"
                title="Song length and export range"
                className="flex items-center gap-1 rounded-[3px] border border-border bg-background/70 px-1.5 py-0.5 font-mono text-[9px] uppercase tracking-wider text-muted-foreground hover:text-foreground"
              >
                <Settings2 className="size-3" /> {bars} {bars === 1 ? "bar" : "bars"}
                {exportOn && <Flag className="size-3 text-amber-300" />}
              </button>
            </PopoverTrigger>
            <PopoverContent align="start" className="w-60 space-y-3 p-3">
              <div className="label-xs">Timeline options</div>
              <TimelineOptionsPanel />
            </PopoverContent>
          </Popover>
        )}

        </div>
      </div>
      <div
        ref={gridRef}
        onPointerDown={startDrag}
        title="Drag on the ruler to set the loop region"
        className="relative flex flex-1 cursor-ew-resize select-none"
      >
        {/* one column per beat; every fourth column starts a new bar.
            Numbering is density-aware: once bars get narrow, only every Nth
            bar keeps a number (small ticks between) so labels never overlap. */}
        <BarNumbering gridRef={gridRef} bars={bars} />


        {/* dim outside the loop */}
        {transport.loop && (
          <>
            <div className="pointer-events-none absolute inset-y-0 left-0 bg-background/60" style={{ width: `${(lo / total) * 100}%` }} />
            <div className="pointer-events-none absolute inset-y-0 right-0 bg-background/60" style={{ width: `${((total - hi) / total) * 100}%` }} />
            {/* loop band — drag it to move the whole region */}
            <div
              onPointerDown={dragLoop("band")}
              aria-label="Move loop range"
              title={`Loop bar ${Math.floor(lo / stepsPerBar()) + 1} to ${Math.floor(hi / stepsPerBar()) + 1} — drag to move`}
              className="absolute inset-y-0 z-10 cursor-grab touch-none border-x-2 border-y border-primary bg-primary/35 active:cursor-grabbing"
              style={{ left: `${(lo / total) * 100}%`, width: `${((hi - lo) / total) * 100}%` }}
            />
            {/* draggable loop markers */}
            {(["start", "end"] as const).map((which) => {
              const p = which === "start" ? lo : hi;
              return (
                <div
                  key={which}
                  role="slider"
                  aria-label={which === "start" ? "Loop start" : "Loop end"}
                  aria-valuenow={p}
                  aria-valuemin={0}
                  aria-valuemax={total}
                  tabIndex={0}
                  onPointerDown={dragLoop(which)}
                  onKeyDown={(ev) => {
                    const d = ev.key === "ArrowLeft" ? -1 : ev.key === "ArrowRight" ? 1 : 0;
                    if (!d) return;
                    ev.preventDefault();
                    if (which === "start") setTransport({ loopStart: Math.max(0, Math.min(lo + d, hi - 1)), loop: true });
                    else setTransport({ loopEnd: Math.min(total, Math.max(hi + d, lo + 1)), loop: true });
                  }}
                  title={`Loop ${which} — drag or use arrow keys (bar ${Math.floor(p / stepsPerBar()) + 1})`}
                  className="absolute top-0 z-20 flex h-full w-6 cursor-ew-resize touch-none flex-col items-center outline-none focus-visible:ring-1 focus-visible:ring-primary"
                  style={{ left: `calc(${(p / total) * 100}% - 12px)` }}
                >
                  <div className="h-0 w-0 border-x-[6px] border-x-transparent" style={{ borderTop: "9px solid var(--primary)" }} />
                  <div className="w-[2px] flex-1 bg-primary/80" />
                </div>
              );
            })}

          </>
        )}

        {/* export range: amber band + draggable flags */}
        {exportOn && (
          <>
            <div
              className="pointer-events-none absolute inset-y-0 border-x border-amber-400/70 bg-amber-400/10"
              style={{ left: `${(exLo / total) * 100}%`, width: `${((exHi - exLo) / total) * 100}%` }}
            />
            {(["start", "end"] as const).map((which) => {
              const p = which === "start" ? exLo : exHi;
              return (
                <div
                  key={which}
                  role="slider"
                  aria-label={which === "start" ? "Export start flag" : "Export end flag"}
                  aria-valuenow={p}
                  onPointerDown={dragFlag(which)}
                  title={`Export ${which} — drag to move (bar ${Math.floor(p / stepsPerBar()) + 1})`}
                  className="absolute top-0 z-20 flex h-full w-5 cursor-ew-resize touch-none flex-col items-center"
                  style={{ left: `calc(${(p / total) * 100}% - 10px)` }}
                >
                  <div
                    className="h-0 w-0 border-x-[6px] border-x-transparent"
                    style={{ borderTop: "9px solid rgb(251 191 36)" }}
                  />
                  <div className="w-[2px] flex-1 bg-amber-400/80" />
                </div>
              );
            })}
          </>
        )}

        <div
          className="pointer-events-none absolute top-0 z-30 h-full"
          style={{ left: `${(liveStep / total) * 100}%` }}
        >
          {/* grab the line anywhere along the ruler to move the playhead */}
          <div
            role="slider"
            aria-label="Playhead — drag to move"
            aria-valuemin={0}
            aria-valuemax={total - 1}
            aria-valuenow={liveStep}
            tabIndex={0}
            className="playhead-grip pointer-events-auto absolute left-1/2 top-0 h-full w-6 -translate-x-1/2"
            title="Drag to move the playhead"
            onKeyDown={(e) => {
              const d = e.key === "ArrowLeft" ? -1 : e.key === "ArrowRight" ? 1 : 0;
              if (!d) return;
              e.preventDefault();
              setTransport({ step: Math.max(0, Math.min(total - 1, liveStep + d)) });
            }}
            onPointerDown={(e) => {
              e.preventDefault();
              e.stopPropagation();
              const move = (ev: PointerEvent) => setTransport({ step: Math.min(total - 1, stepFromX(ev.clientX, ev.clientY)) });
              const up = () => {
                window.removeEventListener("pointermove", move);
                window.removeEventListener("pointerup", up);
              };
              window.addEventListener("pointermove", move);
              window.addEventListener("pointerup", up);
            }}
          />
          <div
            className="playhead-head pointer-events-none absolute left-1/2 top-0 h-0 w-0 -translate-x-1/2 border-x-[7px] border-x-transparent"
            style={{ borderTopWidth: 10 }}
          />
          <div className="playhead-line pointer-events-none absolute bottom-0 left-1/2 top-2 w-[2px] -translate-x-1/2" />
        </div>
      </div>
    </div>
  );
}

/**
 * Overview strip under the arrangement: the whole song at a glance with a
 * draggable viewport. Dragging it scrolls the timeline; the +/− buttons widen
 * the arrangement so bars get more room without changing anything you hear.
 */
export function TimelineOverview({
  scrollRef,
  zoom,
  setZoom,
}: {
  scrollRef: React.RefObject<HTMLDivElement | null>;
  zoom: number;
  setZoom: (z: number) => void;
}) {
  const liveStep = usePlayStep();
  const { transport } = useStudio();
  const total = songSteps(transport.bars);
  const [view, setView] = useState({ left: 0, width: 1 });
  const barRef = useRef<HTMLDivElement>(null);

  // mirror the arrangement's scroll position into the little viewport box
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const read = () => {
      const w = el.scrollWidth || 1;
      setView({ left: el.scrollLeft / w, width: Math.min(1, el.clientWidth / w) });
    };
    read();
    el.addEventListener("scroll", read, { passive: true });
    const ro = new ResizeObserver(read);
    ro.observe(el);
    return () => {
      el.removeEventListener("scroll", read);
      ro.disconnect();
    };
  }, [scrollRef, zoom, transport.bars]);

  const scrollTo = (clientX: number) => {
    const bar = barRef.current;
    const el = scrollRef.current;
    if (!bar || !el) return;
    const r = bar.getBoundingClientRect();
    const frac = Math.min(1, Math.max(0, (clientX - r.left) / r.width));
    el.scrollLeft = Math.max(0, frac * el.scrollWidth - el.clientWidth / 2);
  };

  const drag = (e: React.PointerEvent) => {
    e.preventDefault();
    scrollTo(e.clientX);
    const move = (ev: PointerEvent) => scrollTo(ev.clientX);
    const up = () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
  };

  const loopFrom = (transport.loopStart ?? 0) / total;
  const loopTo = Math.max((transport.loopStart ?? 0) + 1, transport.loopEnd ?? total) / total;

  return (
    <div className="flex shrink-0 items-center gap-2 border-t border-border bg-surface-2/60 px-2 py-1">
      <span className="hidden font-mono text-[9px] uppercase tracking-widest text-muted-foreground sm:inline">
        Overview
      </span>
      <div
        ref={barRef}
        onPointerDown={drag}
        role="scrollbar"
        aria-label="Timeline overview — drag to scroll the arrangement"
        aria-controls="timeline-scroll"
        aria-orientation="horizontal"
        aria-valuenow={Math.round(view.left * 100)}
        tabIndex={0}
        className="relative h-6 flex-1 cursor-grab touch-none overflow-hidden rounded-[3px] border border-border bg-background active:cursor-grabbing"
      >
        {/* bar ticks */}
        {Array.from({ length: Math.max(1, transport.bars) }).map((_, i) => (
          <span
            key={i}
            className="absolute inset-y-0 w-px bg-border/60"
            style={{ left: `${(i / Math.max(1, transport.bars)) * 100}%` }}
          />
        ))}
        {transport.loop && (
          <span
            className="absolute inset-y-0 bg-primary/15"
            style={{ left: `${loopFrom * 100}%`, width: `${Math.max(1, (loopTo - loopFrom) * 100)}%` }}
          />
        )}
        {/* playhead */}
        <span
          className="playhead-line absolute inset-y-0 w-[2px]"
          style={{ left: `${((liveStep % total) / total) * 100}%` }}
        />
        {/* viewport */}
        <span
          className="absolute inset-y-0 rounded-[2px] border border-primary/70 bg-primary/10"
          style={{ left: `${view.left * 100}%`, width: `${Math.max(4, view.width * 100)}%` }}
        />
      </div>
      <div className="flex items-center gap-1">
        <button
          className="h-5 w-5 rounded-[3px] border border-border font-mono text-[11px] leading-none text-muted-foreground hover:text-foreground"
          onClick={() => setZoom(Math.max(1, Math.round((zoom - 0.5) * 2) / 2))}
          aria-label="Zoom out the arrangement"
          title="Zoom out"
        >
          −
        </button>
        <span className="w-8 text-center font-mono text-[9px] text-muted-foreground">{zoom.toFixed(1)}×</span>
        <button
          className="h-5 w-5 rounded-[3px] border border-border font-mono text-[11px] leading-none text-muted-foreground hover:text-foreground"
          onClick={() => setZoom(Math.min(8, Math.round((zoom + 0.5) * 2) / 2))}
          aria-label="Zoom in on the arrangement"
          title="Zoom in"
        >
          +
        </button>
      </div>
    </div>
  );
}

/** The white song playhead over the track lanes; only it re-renders on each playback step. */
export function SongPlayhead({ totalSteps, onDragStart, onMove }: { totalSteps: number; onDragStart: (e: React.PointerEvent<HTMLDivElement>) => void; onMove: (step: number) => void }) {
  const step = usePlayStep();
  return (
    <div
      className="pointer-events-none absolute inset-y-0 z-30 -translate-x-1/2"
      style={{ left: `calc(var(--timeline-header-width) + (100% - var(--timeline-header-width)) * ${(step % totalSteps) / totalSteps})` }}
    >
      <div
        data-timeline-playhead
        className="playhead-line absolute inset-y-0 left-1/2 w-[2px] -translate-x-1/2"
        aria-hidden="true"
      />
      <div
        data-playhead-drag
        role="slider"
        aria-label="Playhead — drag to move"
        aria-valuemin={0}
        aria-valuemax={totalSteps - 1}
        aria-valuenow={step % totalSteps}
        tabIndex={0}
        title="Drag to move the playhead"
        className="playhead-grip pointer-events-auto absolute inset-y-0 left-1/2 w-5 -translate-x-1/2"
        onPointerDown={onDragStart}
        onKeyDown={(e) => {
          const d = e.key === "ArrowLeft" ? -1 : e.key === "ArrowRight" ? 1 : 0;
          if (!d) return;
          e.preventDefault();
          onMove(Math.max(0, Math.min(totalSteps - 1, (step % totalSteps) + d)));
        }}
      />
    </div>
  );
}
