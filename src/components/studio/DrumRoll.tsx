/**
 * Drum roll — the piano roll for a drum track.
 *
 * A drum track's pattern lives in each pad's step array, so this editor writes
 * those same steps. What you draw here is exactly what the drum machine and the
 * timeline play; there is no second copy of the pattern. Rows are labelled with
 * the drum name and the MIDI note the pad sends, instead of melodic note names.
 */
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useStudio } from "@/lib/synclab/store";
import { getEngine } from "@/lib/synclab/audio-engine";
import { DRUM_KIND_LABEL, drumRows, noteName } from "@/lib/synclab/drum-notes";
import type { DrumPad, Track } from "@/lib/synclab/types";
import { useIsMobile } from "@/hooks/use-mobile";
import { ChevronLeft, ChevronRight } from "lucide-react";

const VELOCITIES = [0, 0.35, 0.7, 1] as const;

export function DrumRoll({ track }: { track: Track }) {
  const isMobile = useIsMobile();
  const { updatePad, setStepCount, transport, setTransport } = useStudio();
  const pads = track.pads ?? [];
  const rows = drumRows(pads);
  const total = Math.max(1, track.steps || 16);
  const [selected, setSelected] = useState<string | null>(null);
  const [paint, setPaint] = useState<number | null>(null);
  const [page, setPage] = useState(0);
  const pageSize = isMobile ? 4 : total;
  const pages = Math.ceil(total / pageSize);
  const start = Math.min(page, pages - 1) * pageSize;
  const visibleSteps = Array.from({ length: Math.min(pageSize, total - start) }, (_, i) => start + i);

  const write = (pad: DrumPad, patch: Partial<DrumPad>) => updatePad(track.id, pad.id, patch);

  const setStep = (pad: DrumPad, i: number, value: number) => {
    const steps = Array.from({ length: total }, (_, k) => pad.steps[k] ?? 0);
    steps[i] = value;
    write(pad, { steps });
  };

  const cycle = (pad: DrumPad, i: number) => {
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

      {isMobile && <div className="grid grid-cols-[48px_minmax(0,1fr)_48px] items-center gap-2"><Button variant="outline" size="icon" className="size-12" aria-label="Previous drum steps" disabled={start === 0} onClick={() => setPage(Math.max(0, page - 1))}><ChevronLeft /></Button><span className="text-center font-mono text-sm whitespace-nowrap">Steps {start + 1}–{Math.min(total, start + pageSize)} / {total}</span><Button variant="outline" size="icon" className="size-12" aria-label="Next drum steps" disabled={start + pageSize >= total} onClick={() => setPage(Math.min(pages - 1, page + 1))}><ChevronRight /></Button></div>}

      <div className="overflow-x-auto rounded-[2px] border border-border bg-background">
        <div className={isMobile ? "w-full" : "min-w-[640px]"}>
          {/* bar numbers */}
          <div className="flex border-b border-border bg-surface-2/70">
            <div className="w-32 shrink-0 border-r border-border px-2 py-0.5 font-mono text-[8px] uppercase tracking-widest text-muted-foreground">
              Drum · note
            </div>
            <div className="flex flex-1 gap-[2px] px-1 py-0.5">
              {visibleSteps.map((i) => (
                <div key={i} className="flex-1 text-center font-mono text-[7px] text-muted-foreground">
                  {i % 4 === 0 ? i / 4 + 1 : ""}
                </div>
              ))}
            </div>
          </div>

          {rows.map(({ pad, note }) => {
            const steps = rowSteps(pad);
            const isSel = selected === pad.id;
            return (
              <div key={pad.id}>
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
                      {DRUM_KIND_LABEL[pad.kind] ?? pad.name}
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
                          title={
                            v > 0
                              ? `velocity ${Math.round(v * 100)}%${chance < 1 ? ` · ${Math.round(chance * 100)}% chance` : ""}`
                              : "empty"
                          }
                          className="drum-step relative h-6 min-w-0 flex-1 rounded-[3px] border p-0 transition-all"
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
                            e.preventDefault();
                            setSelected(pad.id);
                            setPaint(cycle(pad, i));
                          }}
                          onPointerEnter={() => {
                            if (paint == null) return;
                            setStep(pad, i, paint);
                          }}
                          onContextMenu={(e) => {
                            e.preventDefault();
                            setStep(pad, i, 0);
                          }}
                        >
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
