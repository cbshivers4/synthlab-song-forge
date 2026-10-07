/**
 * Drum roll — the piano roll for a drum track.
 *
 * A drum track's pattern lives in each pad's step array, so this editor writes
 * those same steps. What you draw here is exactly what the drum machine and the
 * timeline play; there is no second copy of the pattern. Rows are labelled with
 * the drum name and the MIDI note the pad sends, instead of melodic note names.
 */
import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useStudio } from "@/lib/synclab/store";
import { getEngine } from "@/lib/synclab/audio-engine";
import { DRUM_KIND_LABEL, drumRows, noteName } from "@/lib/synclab/drum-notes";
import type { DrumPad, Track } from "@/lib/synclab/types";
import { useIsMobile } from "@/hooks/use-mobile";
import { ChevronLeft, ChevronRight, Minus, Plus } from "lucide-react";
import { useDrumEditorView } from "@/lib/synclab/drum-editor-view";

const VELOCITIES = [0, 0.35, 0.7, 1] as const;

export function DrumRoll({ track }: { track: Track }) {
  const isMobile = useIsMobile();
  const { updatePad, setStepCount, transport, setTransport } = useStudio();
  const pads = track.pads ?? [];
  const rows = drumRows(pads);
  const total = Math.max(1, track.steps || 16);
  const { view, updateView, ready } = useDrumEditorView(track.id);
  const selected = view.padId;
  const setSelected = (padId: string | null) => updateView({ padId });
  const [paint, setPaint] = useState<number | null>(null);
  const touchStep = useRef<string | null>(null);
  const gridRef = useRef<HTMLDivElement>(null);
  const rowRefs = useRef(new Map<string, HTMLDivElement>());
  const [visibleRows, setVisibleRows] = useState([1, rows.length]);
  const [widePhone, setWidePhone] = useState(false);
  useEffect(() => { const query = window.matchMedia("(min-width: 480px)"); const read = () => setWidePhone(query.matches); read(); query.addEventListener("change", read); return () => query.removeEventListener("change", read); }, []);
  const baseSize = widePhone ? 4 : 3;
  const pageSize = isMobile ? Math.max(1, Math.floor(baseSize / view.zoom)) : total;
  const start = isMobile ? Math.min(view.start, Math.max(0, total - 1)) : 0;
  const visibleSteps = Array.from({ length: Math.min(pageSize, total - start) }, (_, i) => start + i);
  const zoomTo = (zoom: number, anchor = view.step) => {
    const next = Math.max(1, Math.min(3, zoom));
    const size = Math.max(1, Math.floor(baseSize / next));
    updateView({ zoom: next, start: Math.floor(Math.max(0, Math.min(total - 1, anchor)) / size) * size });
  };
  const zoomRef = useRef(zoomTo);
  zoomRef.current = zoomTo;
  const viewRef = useRef(view);
  viewRef.current = view;
  useEffect(() => {
    if (!isMobile || !ready || !view.padId) return;
    updateView({ start: Math.floor(Math.min(total - 1, view.step) / pageSize) * pageSize });
    const id = requestAnimationFrame(() => {
      const grid = gridRef.current, row = rowRefs.current.get(view.padId ?? "");
      if (!grid || !row) return;
      const offset = row.getBoundingClientRect().top - grid.getBoundingClientRect().top;
      if (offset < 24 || offset + 56 > grid.clientHeight) grid.scrollTop += offset - Math.max(24, grid.clientHeight - 64);
    });
    return () => cancelAnimationFrame(id);
  }, [ready, track.id, isMobile, widePhone]);
  useEffect(() => {
    const el = gridRef.current;
    if (!el || !isMobile) return;
    let initial: { distance: number; zoom: number; anchor: number } | null = null;
    const distance = (e: TouchEvent) => {
      const first = e.touches.item(0), second = e.touches.item(1);
      return first && second ? Math.hypot(first.clientX - second.clientX, first.clientY - second.clientY) : 1;
    };
    const begin = (e: TouchEvent) => {
      if (e.touches.length !== 2) return;
      const first = e.touches.item(0), second = e.touches.item(1);
      if (!first || !second) return;
      e.preventDefault();
      touchStep.current = null;
      const rect = el.getBoundingClientRect();
      const fraction = Math.max(0, Math.min(1, ((first.clientX + second.clientX) / 2 - rect.left - 152) / Math.max(1, rect.width - 152)));
      initial = { distance: Math.max(1, distance(e)), zoom: viewRef.current.zoom, anchor: viewRef.current.start + Math.floor(fraction * Math.max(1, Math.floor(baseSize / viewRef.current.zoom))) };
    };
    const move = (e: TouchEvent) => {
      if (!initial || e.touches.length !== 2) return;
      e.preventDefault();
      zoomRef.current(initial.zoom * distance(e) / initial.distance, initial.anchor);
    };
    const end = () => { initial = null; };
    el.addEventListener("touchstart", begin, { passive: false });
    el.addEventListener("touchmove", move, { passive: false });
    el.addEventListener("touchend", end);
    el.addEventListener("touchcancel", end);
    return () => { el.removeEventListener("touchstart", begin); el.removeEventListener("touchmove", move); el.removeEventListener("touchend", end); el.removeEventListener("touchcancel", end); };
  }, [isMobile, baseSize]);
  const readRows = () => {
    const el = gridRef.current;
    if (!el) return;
    const bounds = el.getBoundingClientRect();
    const visible = rows.flatMap(({ pad }, index) => {
      const rect = rowRefs.current.get(pad.id)?.getBoundingClientRect();
      return rect && rect.bottom > bounds.top + 24 && rect.top < bounds.bottom ? [index + 1] : [];
    });
    const first = visible[0], last = visible[visible.length - 1];
    if (first != null && last != null) setVisibleRows([first, last]);
  };
  useEffect(() => {
    if (!isMobile) return;
    const id = requestAnimationFrame(readRows);
    const el = gridRef.current;
    const observer = new ResizeObserver(readRows);
    if (el) observer.observe(el);
    return () => { cancelAnimationFrame(id); observer.disconnect(); };
  }, [isMobile, track.id, rows.length, selected]);

  const write = (pad: DrumPad, patch: Partial<DrumPad>) => updatePad(track.id, pad.id, patch);

  const setStep = (pad: DrumPad, i: number, value: number) => {
    const steps = Array.from({ length: total }, (_, k) => pad.steps[k] ?? 0);
    steps[i] = value;
    write(pad, { steps });
  };

  const cycle = (pad: DrumPad, i: number) => {
    updateView({ padId: pad.id, step: i });
    const current = pad.steps[i] ?? 0;
    const at = VELOCITIES.findIndex((v) => Math.abs(v - current) < 0.08);
    const next = VELOCITIES[(at + 1) % VELOCITIES.length] ?? 0;
    setStep(pad, i, next);
    if (next > 0) getEngine().playDrum(track.id, pad, next);
    return next;
  };

  const rowSteps = (pad: DrumPad) => Array.from({ length: total }, (_, k) => pad.steps[k] ?? 0);

  const probabilityOf = (pad: DrumPad) => {
    const written = rowSteps(pad).map((v, i) => (v > 0 ? (pad.probability?.[i] ?? 1) : null)).filter((v): v is number => v != null);
    return written.length ? Math.round((written.reduce((a, b) => a + b, 0) / written.length) * 100) : 100;
  };

  const setProbability = (pad: DrumPad, pct: number) =>
    write(pad, { probability: rowSteps(pad).map((v) => (v > 0 ? pct / 100 : 1)) });

  const tools = (pad: DrumPad) => {
    const steps = rowSteps(pad);
    return {
      clear: () => write(pad, { steps: steps.map(() => 0) }),
      accent: () => write(pad, { steps: steps.map((v, i) => (v > 0 ? (i % 4 === 0 ? 1 : Math.min(v, 0.6)) : 0)) }),
      humanize: () =>
        write(pad, {
          steps: steps.map((v) => (v > 0 ? Math.min(1, Math.max(0.2, v + (Math.random() - 0.5) * 0.3)) : 0)),
        }),
      flam: () => write(pad, { steps: steps.map((v, i) => (v === 0 && (steps[i - 1] ?? 0) > 0 ? 0.3 : v)) }),
      roll: () => write(pad, { steps: steps.map((v, i) => (i % 2 === 0 ? v : Math.max(v, 0.45))) }),
      repeat: () => write(pad, { steps: steps.map((v, i) => (v > 0 ? v : i % 4 === 0 ? 0.6 : 0)) }),
    };
  };

  if (pads.length === 0) {
    return <p className="text-sm text-muted-foreground">This drum track has no pads yet — add one in the drum machine.</p>;
  }

  return (
    <div
      className={`drum-roll space-y-1.5 ${isMobile ? "phone-drum-roll" : ""}`}
      onPointerUp={() => setPaint(null)}
      onPointerLeave={() => setPaint(null)}
    >
      <div className="flex flex-nowrap items-center gap-2 overflow-x-auto rounded-sm border border-border bg-surface/60 p-1.5 [&>*]:shrink-0">
        <span className="label-xs whitespace-nowrap px-1" title={track.name}>DRUM ROLL</span>
        <Select value={String(total)} onValueChange={(v) => setStepCount(track.id, Number(v))}>
          <SelectTrigger className="h-7 w-24 text-[10px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {[16, 32, 64].map((s) => (
              <SelectItem key={s} value={String(s)}>
                {s} steps
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <span className="label-xs px-1">SWING</span>
        <Slider
          className="w-28"
          value={[Math.round((transport.swing ?? 0) * 100)]}
          min={0}
          max={70}
          step={1}
          onValueChange={([v = 0]) => setTransport({ swing: v / 100 })}
        />
        <span className="w-8 font-mono text-[10px] text-primary">{Math.round((transport.swing ?? 0) * 100)}%</span>
        <Button
          size="sm"
          variant="ghost"
          className="h-7 text-[10px]"
          onClick={() => pads.forEach((p) => tools(p).humanize())}
        >
          HUMANIZE ALL
        </Button>
        <Button
          size="sm"
          variant="ghost"
          className="h-7 text-[10px]"
          onClick={() => pads.forEach((p) => tools(p).clear())}
        >
          CLEAR ALL
        </Button>
      </div>

      {isMobile && <div className="space-y-1.5">
        <div className="grid grid-cols-[48px_minmax(0,1fr)_48px] items-center gap-2"><Button variant="outline" size="icon" className="size-12" aria-label="Previous drum steps" disabled={start === 0} onClick={() => updateView({ start: Math.max(0, start - pageSize) })}><ChevronLeft /></Button><span className="min-w-0 text-center font-mono text-sm whitespace-nowrap">Steps {start + 1}–{Math.min(total, start + pageSize)} / {total}</span><Button variant="outline" size="icon" className="size-12" aria-label="Next drum steps" disabled={start + pageSize >= total} onClick={() => updateView({ start: Math.min(total - 1, start + pageSize) })}><ChevronRight /></Button></div>
        <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-2">
          <span className="min-w-0 whitespace-nowrap font-mono text-xs" aria-label="Visible drum rows">Rows {visibleRows[0]}–{visibleRows[1]} / {rows.length}</span>
          <div className="flex shrink-0 items-center gap-1"><Button variant="outline" size="icon" className="size-12" aria-label="Zoom out drum roll" title="Zoom out" disabled={view.zoom <= 1} onClick={() => zoomTo(view.zoom - 0.5)}><Minus /></Button><span className="w-12 text-center font-mono text-xs" aria-label="Drum roll zoom">{Math.round(view.zoom * 100)}%</span><Button variant="outline" size="icon" className="size-12" aria-label="Zoom in drum roll" title="Zoom in" disabled={view.zoom >= 3} onClick={() => zoomTo(view.zoom + 0.5)}><Plus /></Button></div>
        </div>
        <div className="truncate font-mono text-xs text-primary" aria-label="Selected drum position">{selected ? `Row ${rows.findIndex(({ pad }) => pad.id === selected) + 1} · ${pads.find((pad) => pad.id === selected)?.name ?? "Drum"} · Step ${Math.min(total, view.step + 1)}` : "No step selected"}</div>
      </div>}

      <div ref={gridRef} onScroll={readRows} aria-label="Drum roll grid" className={`overflow-auto rounded-[2px] border border-border bg-background ${isMobile ? "max-h-[45dvh] touch-pan-y" : ""}`}>
        <div className={isMobile ? "w-full" : "min-w-[640px]"}>
          {/* bar numbers */}
          <div className="sticky top-0 z-10 flex border-b border-border bg-surface-2">
            <div className="drum-roll-label-header w-32 shrink-0 border-r border-border px-2 py-0.5 font-mono text-[8px] uppercase tracking-widest text-muted-foreground">
              Drum · note
            </div>
            <div className="flex flex-1 gap-[2px] px-1 py-0.5">
              {visibleSteps.map((i) => (
                <div key={i} className={`flex-1 text-center font-mono text-muted-foreground ${isMobile ? "text-xs" : "text-[7px]"}`}>
                  {isMobile ? i + 1 : i % 4 === 0 ? i / 4 + 1 : ""}
                </div>
              ))}
            </div>
          </div>

          {rows.map(({ pad, note }, rowIndex) => {
            const steps = rowSteps(pad);
            const isSel = selected === pad.id;
            return (
              <div key={pad.id} ref={(el) => { if (el) rowRefs.current.set(pad.id, el); else rowRefs.current.delete(pad.id); }}>
                <div className={`flex items-center border-b border-border/40 ${isSel ? "bg-surface/60" : ""}`}>
                  <Button variant="ghost"
                    className="drum-row-name flex h-auto w-32 shrink-0 items-center justify-between gap-1 border-r border-border px-2 py-1 text-left hover:bg-surface"
                    onClick={() => {
                      getEngine().playDrum(track.id, pad, 1);
                      setSelected(isSel ? null : pad.id);
                    }}
                    title={`${pad.name} — MIDI note ${note} (${noteName(note)}). Click for tools.`}
                  >
                    <span className="truncate font-mono text-[10px] font-semibold uppercase tracking-wider">
                      {isMobile ? `${rowIndex + 1}. ` : ""}{DRUM_KIND_LABEL[pad.kind] ?? pad.name}
                    </span>
                    <span className="shrink-0 font-mono text-[8px] text-muted-foreground">{noteName(note)}</span>
                  </Button>
                  <Button variant="ghost"
                    className={`drum-row-mute mx-1 h-5 w-5 shrink-0 rounded-[3px] p-0 font-mono text-[9px] ${pad.muted ? "bg-amber text-background" : "bg-surface text-muted-foreground"}`}
                    onClick={() => write(pad, { muted: !pad.muted })}
                    title={pad.muted ? "Muted" : "Mute this drum"}
                  >
                    M
                  </Button>
                  <div className="flex flex-1 gap-[2px] px-1 py-1">
                    {visibleSteps.map((i) => {
                      const v = steps[i] ?? 0;
                      const playing = transport.playing && transport.step % total === i;
                      const chance = pad.probability?.[i] ?? 1;
                      return (
                        <Button variant="ghost"
                          key={i}
                          aria-label={`${pad.name} step ${i + 1}${v > 0 ? `, velocity ${Math.round(v * 100)}%` : ", empty"}`}
                           aria-pressed={selected === pad.id && view.step === i}
                          title={
                            v > 0
                              ? `velocity ${Math.round(v * 100)}%${chance < 1 ? ` · ${Math.round(chance * 100)}% chance` : ""}`
                              : "empty"
                          }
                           className={`drum-step relative h-6 min-w-0 flex-1 rounded-[3px] border p-0 transition-all ${selected === pad.id && view.step === i ? "ring-2 ring-primary ring-inset" : ""}`}
                          style={{
                            minWidth: 10,
                            borderColor: playing ? "var(--neon)" : "var(--color-border)",
                            opacity: v > 0 ? 0.4 + v * 0.6 : 1,
                            background:
                              v > 0
                                ? "var(--gradient-neon)"
                                : i % 4 === 0
                                  ? "color-mix(in oklab, var(--surface-2) 90%, transparent)"
                                  : "color-mix(in oklab, var(--surface) 80%, transparent)",
                          }}
                          onPointerDown={(e) => {
                            touchStep.current = e.pointerType === "touch" ? `${pad.id}:${i}` : null;
                            if (e.pointerType === "touch") return;
                            e.preventDefault();
                            setSelected(pad.id);
                            setPaint(cycle(pad, i));
                          }}
                          onPointerEnter={() => {
                            if (paint == null) return;
                            setStep(pad, i, paint);
                          }}
                          onClick={(e) => {
                            if (e.detail === 0 || touchStep.current === `${pad.id}:${i}`) {
                              touchStep.current = null;
                              setSelected(pad.id);
                              cycle(pad, i);
                            }
                          }}
                          onPointerCancel={() => { touchStep.current = null; }}
                          onContextMenu={(e) => {
                            e.preventDefault();
                            setStep(pad, i, 0);
                          }}
                        >
                           {isMobile && <span className="font-mono text-xs">{i + 1}</span>}
                          {v > 0 && chance < 1 && (
                            <span className="absolute inset-x-0 bottom-0 block h-[2px] bg-background/70" />
                          )}
                        </Button>
                      );
                    })}
                  </div>
                </div>

                {isSel && (
                  <div className="flex flex-nowrap items-center gap-1.5 overflow-x-auto whitespace-nowrap border-b border-border/40 bg-surface/40 px-2 py-1.5 [&>*]:shrink-0">
                    <span className="label-xs">{pad.name} tools</span>
                    {(
                      [
                        ["ACCENT", tools(pad).accent],
                        ["HUMANIZE", tools(pad).humanize],
                        ["FLAM", tools(pad).flam],
                        ["ROLL", tools(pad).roll],
                        ["NOTE REPEAT", tools(pad).repeat],
                        ["CLEAR", tools(pad).clear],
                      ] as const
                    ).map(([label, fn]) => (
                      <Button key={label} size="sm" variant="ghost" className="h-6 px-2 text-[10px]" onClick={fn}>
                        {label}
                      </Button>
                    ))}
                    <span className="label-xs ml-2">PROBABILITY</span>
                    <Slider
                      className="w-28"
                      value={[probabilityOf(pad)]}
                      min={10}
                      max={100}
                      step={5}
                      onValueChange={([v = 100]) => setProbability(pad, v)}
                    />
                    <span className="w-9 font-mono text-[10px] text-primary">{probabilityOf(pad)}%</span>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      <p className="font-mono text-[9px] leading-relaxed text-muted-foreground">
        Click a step to cycle ghost → normal → accent, drag across steps to paint, right-click to clear. Each row sends
        its own MIDI note, so a drum controller on those notes plays and records these same pads.
      </p>
    </div>
  );
}
