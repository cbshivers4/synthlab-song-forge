import { useEffect, useRef, useState } from "react";
import { useDrumEditorView } from "@/lib/synclab/drum-editor-view";
import { stepsPerBar, getBeatsPerBar } from "@/lib/synclab/timebase";
import { SkinControls, skinBackground, useImageDrop } from "@/components/studio/SkinControls";
import { useSkin } from "@/lib/synclab/skins";
import { ChevronLeft, ChevronRight, Copy, Plus, RotateCcw, Save, Sparkles, Trash2, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { Select, SelectContent, SelectGroup, SelectItem, SelectLabel, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Knob } from "./Knob";
import { useStudio } from "@/lib/synclab/store";
import { DRUM_KITS, GENRES } from "@/lib/synclab/presets";
import type { DrumKitId } from "@/lib/synclab/types";
import { getEngine } from "@/lib/synclab/audio-engine";
import type { DrumPad, Track } from "@/lib/synclab/types";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { useIsMobile, useIsLandscapePhone } from "@/hooks/use-mobile";
import { DrumRoll } from "./DrumRoll";
import { markLiveHit, neighbourLiveHits } from "@/lib/synclab/live-take";

const PRESET_KEY = "synclab.drumPresets.v1";
type DrumPreset = { name: string; pads: Partial<DrumPad>[] };
function readPresets(): DrumPreset[] {
  try {
    const v = JSON.parse(localStorage.getItem(PRESET_KEY) ?? "[]");
    return Array.isArray(v) ? v : [];
  } catch {
    return [];
  }
}

const BANKS = ["1", "2", "3", "4", "5", "6", "7", "8"];
const PAD_ORDER: DrumPad["kind"][] = ["kick", "snare", "hat", "openhat", "clap", "rim", "tom", "perc", "ride", "crash", "fx"];

/** Instrument drawings, not abstract symbols; they fit inside the original pad layout. */
const INSTRUMENT_COLOR: Record<DrumPad["kind"], string> = {
  kick: "text-destructive", snare: "text-amber", clap: "text-magenta",
  hat: "text-primary", openhat: "text-neon", tom: "text-chart-2",
  perc: "text-chart-3", rim: "text-foreground", crash: "text-amber",
  ride: "text-chart-1", fx: "text-magenta",
};
function DrumInstrumentIcon({ kind, className }: { kind: DrumPad["kind"]; className?: string }) {
  const drum = kind === "snare" || kind === "tom" || kind === "rim";
  const cymbal = kind === "hat" || kind === "openhat" || kind === "crash" || kind === "ride";
  return (
    <svg viewBox="0 0 40 40" className={cn("shrink-0", INSTRUMENT_COLOR[kind], className)} fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      {kind === "kick" && <><circle cx="20" cy="20" r="13" /><circle cx="20" cy="20" r="10" /><circle cx="25" cy="25" r="3" /><path d="m10 30-3 6m23-6 3 6M20 31v6m-3 0h6" /></>}
      {drum && <><ellipse cx="20" cy="12" rx="14" ry="5" /><path d="M6 12v14c0 7 28 7 28 0V12M11 16v12m9-11v13m9-14v12m-18 3-3 6m21-6 3 6" />{kind === "snare" && <path d="M7 23h26M7 26h26m-22-22 14 9m8-10-17 11" />}{kind === "rim" && <path d="m4 3 24 15M7 4l24 15" />}</>}
      {cymbal && <><path d="M20 5v30m-7 2 7-7 7 7" /><ellipse cx="20" cy="14" rx="17" ry="4" /><path d="M15 12q5-8 10 0" />{(kind === "hat" || kind === "openhat") && <ellipse cx="20" cy={kind === "openhat" ? "22" : "18"} rx="17" ry="3" />}{kind === "crash" && <path d="m3 4 4 4m26-4-4 4M5 25l4-3m22 0 4 3" />}{kind === "ride" && <ellipse cx="20" cy="14" rx="12" ry="2" />}</>}
      {kind === "clap" && <><path d="m17 34-8-10q-3-4 0-5l6 5-5-15q-1-4 2-4l7 15-3-16q0-4 3-2l5 17 1-12q1-4 4-2l-1 17 4-7q2-3 4-1l-5 17-5 5Z" /><path d="m4 10-3-3m34-1 3-3M3 16H1" /></>}
      {kind === "perc" && <><ellipse cx="20" cy="7" rx="9" ry="4" /><path d="M11 7l3 16-2 12q8 4 16 0l-2-12 3-16M14 23h12M12 11l14 12M28 11 14 23" /><ellipse cx="20" cy="35" rx="8" ry="2" /></>}
      {kind === "fx" && <><rect x="6" y="9" width="28" height="24" rx="2" /><path d="M11 16h18M12 25h3m5 0h3m5 0h1M11 4v5m9-5v5m9-5v5" /><circle cx="14" cy="16" r="2" /><circle cx="27" cy="25" r="2" /></>}
    </svg>
  );
}

/** Small vertical fader used for the A / H / D envelope sliders, Impact-style. */
function VSlider({ label, value, min = 0, max = 1, onChange }: { label: string; value: number; min?: number; max?: number; onChange: (v: number) => void }) {
  const pct = Math.round(((value - min) / (max - min || 1)) * 100);
  return (
    <label className="flex w-9 flex-col items-center gap-1">
      <Slider orientation="vertical" className="h-20" min={min} max={max} step={0.01} value={[value]} onValueChange={([v = 0]) => onChange(v)} />
      <span className="font-mono text-[9px] text-muted-foreground">{label}</span>
      <span className="font-mono text-[8px] text-foreground/60">{pct}</span>
    </label>
  );
}

function Section({ title, active, children }: { title: string; active?: boolean; children: React.ReactNode }) {
  return (
    <div className="overflow-hidden rounded-md border border-border bg-surface/80">
      <div className="flex items-center gap-1.5 border-b border-border bg-surface-2/50 px-2.5 py-1.5">
        <span className={cn("size-1.5 rounded-full", active ? "bg-primary" : "bg-muted-foreground/40")} />
        <span className="font-mono text-[10px] font-semibold uppercase tracking-widest text-foreground/90">{title}</span>
      </div>
      <div className="flex flex-wrap items-start gap-x-2.5 gap-y-2 p-2.5">{children}</div>
    </div>
  );
}

export function DrumMachine({ track }: { track: Track }) {
  const isMobile = useIsMobile();
  const landscape = useIsLandscapePhone();
  const [phoneView, setPhoneView] = useState("roll");
  const [tapRec, setTapRec] = useState(false);
  const { view, updateView, ready } = useDrumEditorView(track.id);
  const rowRefs = useRef(new Map<string, HTMLDivElement>());
  const [stepPage, setStepPage] = useState(0);
  const [widePhone, setWidePhone] = useState(false);
  useEffect(() => {
    const query = window.matchMedia("(min-width: 480px)");
    const read = () => setWidePhone(query.matches);
    read();
    query.addEventListener("change", read);
    return () => query.removeEventListener("change", read);
  }, []);
  const { updatePad, updateTrack, setStepCount, addPad, generateBeat, transport, togglePlay, stop } = useStudio();
  const [genre, setGenre] = useState("Detroit Techno");
  const [energy, setEnergy] = useState(6);
  const [focusPadId, setFocusPadId] = useState<string | null>(null);
  const [selectedStep, setSelectedStep] = useState<{ padId: string; index: number } | null>(null);
  const pads = [...(track.pads ?? [])].sort((a, b) => PAD_ORDER.indexOf(a.kind) - PAD_ORDER.indexOf(b.kind));
  const hitPad = (pad: DrumPad) => {
    getEngine().playDrum(track.id, pad, 1);
    setFocusPadId(pad.id);
    if (!isMobile || !transport.playing || (!tapRec && !transport.recording)) return;
    const total = pad.steps.length || track.steps || 16;
    const at = transport.step % total;
    const stale = transport.recording ? neighbourLiveHits(track.id, pad.id, at, total) : [];
    if (transport.recording) markLiveHit(track.id, pad.id, at);
    updatePad(track.id, pad.id, { steps: Array.from({ length: total }, (_, i) => i === at ? 1 : stale.includes(i) ? 0 : pad.steps[i] ?? 0) });
    updateView({ padId: pad.id, step: at });
  };
  const pageSize = widePhone ? 4 : 3;
  const stepPages = Math.max(1, Math.ceil(track.steps / pageSize));
  const currentStepPage = Math.min(stepPage, stepPages - 1);
  const stepStart = currentStepPage * pageSize;
  const visibleSteps = Array.from({ length: isMobile ? Math.min(pageSize, track.steps - stepStart) : track.steps }, (_, i) => i + (isMobile ? stepStart : 0));
  const activePattern = Math.max(0, Math.min(7, track.activeDrumPattern ?? 0));
  const focusPad = pads.find((p) => p.id === focusPadId) ?? pads[0];
  useEffect(() => {
    if (!isMobile || !ready || !view.padId) return;
    setFocusPadId(view.padId);
    setSelectedStep({ padId: view.padId, index: Math.min(track.steps - 1, view.step) });
    setStepPage(Math.floor(Math.min(track.steps - 1, view.step) / pageSize));
    if (phoneView !== "steps") return;
    const id = requestAnimationFrame(() => rowRefs.current.get(view.padId ?? "")?.scrollIntoView({ block: "nearest" }));
    return () => cancelAnimationFrame(id);
  }, [phoneView, ready, isMobile, track.id, pageSize]);

  const clonePads = (source: DrumPad[]) => structuredClone(source) as DrumPad[];
  const switchPattern = (next: number) => {
    if (next === activePattern) return;
    const patterns = [...(track.drumPatterns ?? [])];
    patterns[activePattern] = clonePads(pads);
    const target = patterns[next]
      ? clonePads(patterns[next] as DrumPad[]).map((pad) => ({
          ...pad,
          steps: Array.from({ length: track.steps }, (_, i) => pad.steps[i] ?? 0),
        }))
      : pads.map((pad) => ({
          ...pad,
          steps: pad.steps.map(() => 0),
          probability: undefined,
          stepPitch: undefined,
          stepDecay: undefined,
          flam: undefined,
          retrig: undefined,
          glitch: undefined,
        }));
    patterns[next] = clonePads(target);
    updateTrack(track.id, { drumPatterns: patterns, activeDrumPattern: next, pads: target });
    setSelectedStep(null);
  };

  const copyPattern = () => {
    const destination = (activePattern + 1) % 8;
    const patterns = [...(track.drumPatterns ?? [])];
    patterns[activePattern] = clonePads(pads);
    patterns[destination] = clonePads(pads);
    updateTrack(track.id, { drumPatterns: patterns, activeDrumPattern: destination, pads: clonePads(pads) });
    toast.success(`Pattern ${activePattern + 1} copied to ${destination + 1}`);
  };

  const clearPattern = () => {
    const cleared = pads.map((pad) => ({ ...pad, steps: pad.steps.map(() => 0), probability: undefined, stepPitch: undefined, stepDecay: undefined, flam: undefined, retrig: undefined, glitch: undefined }));
    const patterns = [...(track.drumPatterns ?? [])];
    patterns[activePattern] = clonePads(cleared);
    updateTrack(track.id, { drumPatterns: patterns, pads: cleared });
  };

  const updateStepValue = (pad: DrumPad, key: "steps" | "probability" | "stepPitch" | "stepDecay" | "flam" | "retrig" | "glitch", index: number, value: number) => {
    const fallback = key === "probability" || key === "stepDecay" || key === "retrig" ? 1 : 0;
    const values = Array.from({ length: track.steps }, (_, i) => pad[key]?.[i] ?? fallback);
    values[index] = value;
    updatePad(track.id, pad.id, { [key]: values });
  };

  const mutate = (pad: DrumPad) => {
    const amount = pad.mutation ?? 0.2;
    updatePad(track.id, pad.id, {
      steps: pad.steps.map((value) => Math.random() < amount ? (value > 0 ? (Math.random() < 0.35 ? 0 : Math.max(0.25, Math.min(1, value + (Math.random() - 0.5) * 0.4))) : (Math.random() < 0.28 ? 0.55 : 0)) : value),
    });
  };

  // click cycles: off -> ghost -> normal -> accent
  const cycleStep = (padId: string, steps: number[], i: number) => {
    const v = steps[i] ?? 0;
    const next = v === 0 ? 0.35 : v <= 0.35 ? 0.7 : v <= 0.7 ? 1 : 0;
    updatePad(track.id, padId, { steps: steps.map((x, j) => (j === i ? next : x)) });
  };

  const humanize = () =>
    pads.forEach((p) =>
      updatePad(track.id, p.id, {
        steps: p.steps.map((v) => (v > 0 ? Math.min(1, Math.max(0.2, v + (Math.random() - 0.5) * 0.3)) : v)),
      }),
    );

  const flam = (padId: string, steps: number[]) =>
    updatePad(track.id, padId, {
      steps: steps.map((v, i) => (v === 0 && (steps[i - 1] ?? 0) > 0 ? 0.3 : v)),
    });

  const roll = (padId: string, steps: number[]) =>
    updatePad(track.id, padId, { steps: steps.map((v, i) => (i % 2 === 0 ? v : Math.max(v, 0.45))) });

  const kit = (pads[0]?.kit ?? "909") as DrumKitId;
  const loadKit = (id: DrumKitId) => {
    const def = DRUM_KITS.find((k) => k.id === id);
    pads.forEach((p) => updatePad(track.id, p.id, { kit: id, decay: def?.decay ?? p.decay }));
    toast.success(`${def?.name ?? id} kit loaded`, { description: "Patterns are kept — only the sounds change." });
  };

  const [presets, setPresets] = useState<DrumPreset[]>([]);
  useEffect(() => setPresets(readPresets()), []);
  const persist = (list: DrumPreset[]) => {
    setPresets(list);
    localStorage.setItem(PRESET_KEY, JSON.stringify(list));
  };
  const savePreset = () => {
    const name = window.prompt("Name this drum sound preset", `${track.name} kit`)?.trim();
    if (!name) return;
    const sounds = pads.map((p) => {
      const { id: _i, steps: _s, probability: _p, muted: _m, solo: _so, ...rest } = p;
      return rest;
    });
    persist([...presets.filter((p) => p.name !== name), { name, pads: sounds }]);
    toast.success(`Preset "${name}" saved`, { description: "Saved on this device. Patterns aren't included." });
  };
  const loadPreset = (name: string) => {
    const pr = presets.find((p) => p.name === name);
    if (!pr) return;
    pads.forEach((p, i) => {
      const s = pr.pads.find((x) => x.name === p.name) ?? pr.pads[i];
      if (s) updatePad(track.id, p.id, s);
    });
    toast.success(`Preset "${name}" loaded`, { description: "Your patterns are kept." });
  };
  const deletePreset = () => {
    const name = window.prompt(`Delete which preset?\n${presets.map((p) => p.name).join("\n")}`)?.trim();
    if (!name || !presets.some((p) => p.name === name)) return;
    persist(presets.filter((p) => p.name !== name));
    toast(`Preset "${name}" deleted`);
  };

  const kitGroups = (() => {
    const order: string[] = [];
    const map = new Map<string, typeof DRUM_KITS>();
    DRUM_KITS.forEach((k) => {
      if (!map.has(k.category)) {
        map.set(k.category, []);
        order.push(k.category);
      }
      map.get(k.category)!.push(k);
    });
    return order.map((category) => ({ category, items: map.get(category)! }));
  })();

  const skin = useSkin("drums");
  const drop = useImageDrop("drums");
  return (
    <div className="drum-machine studio-wallpaper space-y-3 rounded-md p-3" data-phone-view={isMobile ? phoneView : undefined} data-sideways={isMobile && landscape ? "true" : undefined} data-studio-panel="drums" style={skinBackground(skin)} {...drop}>
      {isMobile && <div className="grid grid-cols-4 gap-1" role="tablist" aria-label="Drum machine views">
        {([['roll', 'Drum roll'], ['pads', 'Play pads'], ['sound', 'Sound'], ['kit', 'Kit']] as const).map(([id, label]) => <Button key={id} role="tab" aria-selected={phoneView === id} variant={phoneView === id ? "default" : "secondary"} className="h-12 min-w-0 px-1" onClick={() => setPhoneView(id)}>{label}</Button>)}
      </div>}
      <div className="drum-skin"><SkinControls skinKey="drums" image /></div>

      <div className="drum-patterns flex flex-wrap items-center gap-2" role="group" aria-label="Drum patterns">
        <span className="label-xs">PATTERN {activePattern + 1}</span>
        <div className="flex flex-wrap gap-1">
          {BANKS.map((number, index) => (
            <Button
              key={number}
              size="sm"
              variant={activePattern === index ? "default" : "secondary"}
              className="h-8 w-8 p-0 font-mono"
              aria-label={`Pattern ${number}`}
              aria-pressed={activePattern === index}
              onClick={() => switchPattern(index)}
            >
              {number}
            </Button>
          ))}
        </div>
        <Button size="sm" variant="secondary" onClick={copyPattern}><Copy className="size-4" /> Copy next</Button>
        <Button size="sm" variant="ghost" onClick={clearPattern}><RotateCcw className="size-4" /> Clear</Button>
      </div>

      {/* Step sequencer */}
      {isMobile && (phoneView === "roll" || phoneView === "pads") && <div className="grid grid-cols-2 gap-2" aria-label="Drum playback">
        <Button variant="secondary" className="h-12" onClick={transport.playing ? stop : togglePlay}>{transport.playing ? "Stop beat" : "Play beat"}</Button>
        <Button variant={tapRec ? "destructive" : "outline"} className="h-12" aria-pressed={tapRec} onClick={() => { setTapRec(!tapRec); if (!tapRec && !transport.playing) togglePlay(); }}>{tapRec ? "Stop tap REC" : "Tap REC"}</Button>
      </div>}
      {isMobile && phoneView === "roll" && <DrumRoll track={track} initialFull />}
      {isMobile && phoneView === "steps" && (
        <div className="grid grid-cols-[48px_minmax(0,1fr)_48px] items-center gap-2" aria-label="Drum pattern step pages">
          <Button variant="outline" size="icon" className="size-12" aria-label="Previous pattern steps" disabled={currentStepPage === 0} onClick={() => setStepPage(Math.max(0, currentStepPage - 1))}><ChevronLeft /></Button>
          <span className="min-w-0 whitespace-nowrap text-center font-mono text-sm">Steps {stepStart + 1}–{Math.min(track.steps, stepStart + pageSize)} / {track.steps}</span>
          <Button variant="outline" size="icon" className="size-12" aria-label="Next pattern steps" disabled={currentStepPage === stepPages - 1} onClick={() => setStepPage(Math.min(stepPages - 1, currentStepPage + 1))}><ChevronRight /></Button>
        </div>
      )}
      <div aria-label="Drum pattern steps" className="drum-steps max-h-48 space-y-1 overflow-auto">
        {pads.map((pad) => (
          <div key={pad.id} className="space-y-1" ref={(el) => { if (el) rowRefs.current.set(pad.id, el); else rowRefs.current.delete(pad.id); }}>
            <div className="flex items-center gap-2">
              <Button variant="ghost"
                className={cn(
                  "w-24 shrink-0 rounded-md border px-2 py-1 text-left font-mono text-[10px] tracking-wider hover:glow",
                  focusPad?.id === pad.id ? "border-primary bg-primary/10" : "border-border bg-surface-2",
                )}
                onClick={() => {
                  getEngine().playDrum(track.id, pad, 1);
                  setFocusPadId(pad.id);
                }}
              >
                {pad.name}
              </Button>
              <div className="flex min-w-0 flex-1 gap-[3px]">
                {visibleSteps.map((i) => {
                  const v = pad.steps[i] ?? 0;
                  return <Button variant="ghost"
                    key={i}
                    aria-label={`${pad.name} step ${i + 1}`}
                    aria-pressed={selectedStep?.padId === pad.id && selectedStep.index === i}
                     onClick={() => {
                       cycleStep(pad.id, pad.steps, i);
                       setSelectedStep({ padId: pad.id, index: i });
                       updateView({ padId: pad.id, step: i, start: stepStart });
                     }}
                    title={v > 0 ? `velocity ${Math.round(v * 100)}%` : "empty"}
                    className="h-6 min-w-0 flex-1 rounded-[3px] border p-0 transition-all"
                    style={{
                      minWidth: isMobile ? undefined : 12,
                      borderColor:
                        transport.playing && transport.step % Math.max(1, pad.steps.length) === i ? "var(--neon)" : "var(--color-border)",
                      opacity: v > 0 ? 0.35 + v * 0.65 : 1,
                      background:
                        v > 0
                          ? "var(--gradient-neon)"
                          : i % 4 === 0
                            ? i % stepsPerBar() === 0
                              ? "color-mix(in oklab, var(--primary) 18%, var(--surface-2))"
                              : "color-mix(in oklab, var(--surface-2) 90%, transparent)"
                            : "color-mix(in oklab, var(--surface) 80%, transparent)",
                    }}
                  >{isMobile ? i + 1 : null}</Button>;
                })}
              </div>
            </div>
             {selectedStep?.padId === pad.id && (
                <div className={cn("flex items-end gap-3 p-3 sm:ml-24", isMobile ? "flex-nowrap overflow-x-auto [&>*]:shrink-0" : "panel flex-wrap")}>
                 <div className="min-w-20"><span className="label-xs">STEP</span><div className="font-mono text-sm text-primary">{selectedStep.index + 1}</div></div>
                 <Knob label="VELOCITY" value={pad.steps[selectedStep.index] ?? 0} onChange={(v) => updateStepValue(pad, "steps", selectedStep.index, v)} />
                 <Knob label="PITCH" min={-12} max={12} step={1} value={pad.stepPitch?.[selectedStep.index] ?? 0} onChange={(v) => updateStepValue(pad, "stepPitch", selectedStep.index, v)} />
                 <Knob label="DECAY" min={0.1} max={2} value={pad.stepDecay?.[selectedStep.index] ?? 1} onChange={(v) => updateStepValue(pad, "stepDecay", selectedStep.index, v)} />
                 <Knob label="CHANCE" value={pad.probability?.[selectedStep.index] ?? 1} onChange={(v) => updateStepValue(pad, "probability", selectedStep.index, v)} />
                 <Knob label="FLAM" value={pad.flam?.[selectedStep.index] ?? 0} onChange={(v) => updateStepValue(pad, "flam", selectedStep.index, v)} />
                 <Knob label="RETRIG" min={1} max={4} step={1} value={pad.retrig?.[selectedStep.index] ?? 1} onChange={(v) => updateStepValue(pad, "retrig", selectedStep.index, Math.round(v))} />
                 <Knob label="GLITCH" value={pad.glitch?.[selectedStep.index] ?? 0} onChange={(v) => updateStepValue(pad, "glitch", selectedStep.index, v)} />
                 <Button size="sm" variant="ghost" onClick={() => setSelectedStep(null)}>Close step</Button>
               </div>
             )}
          </div>
        ))}
      </div>

      {/* Toolbar */}
      <div className="drum-kit-tools flex flex-wrap items-center gap-2">
        <Select value={kit} onValueChange={(v) => loadKit(v as DrumKitId)}>
          <SelectTrigger className="w-56">
            <SelectValue placeholder="Kit" />
          </SelectTrigger>
          <SelectContent className="max-h-[420px]">
            {kitGroups.map((g) => (
              <SelectGroup key={g.category}>
                <SelectLabel className="font-mono text-[10px] uppercase tracking-widest text-primary">
                  {g.category}
                </SelectLabel>
                {g.items.map((k) => (
                  <SelectItem key={k.id} value={k.id}>
                    {k.name} — {k.desc}
                  </SelectItem>
                ))}
              </SelectGroup>
            ))}
          </SelectContent>
        </Select>
        <Button
          variant="outline"
          size="sm"
          onClick={() => {
            pads.forEach((p) =>
              updatePad(track.id, p.id, { kit: "909", volume: 0.8, pan: 0, pitch: 0, decay: 0.5, muted: false, solo: false }),
            );
            toast.success("Drum sounds initialized", { description: "All pads reset to a clean 909 starting point — your pattern steps are kept." });
          }}
        >
          Initialize sounds
        </Button>
        <Select value={String(track.steps)} onValueChange={(v) => setStepCount(track.id, Number(v))}>
          <SelectTrigger className="w-28">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {Array.from(new Set([16, 32, 64, ...[1, 2, 4].map((b) => b * stepsPerBar()), track.steps])).sort((x, y) => x - y).map((s) => (
              <SelectItem key={s} value={String(s)}>
                {s} steps{s % stepsPerBar() === 0 ? ` · ${s / stepsPerBar()} bar${s === stepsPerBar() ? "" : "s"} ${getBeatsPerBar()}/4` : ""}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={genre} onValueChange={setGenre}>
          <SelectTrigger className="w-44">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {GENRES.map((g) => (
              <SelectItem key={g} value={g}>
                {g}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <div className="flex items-center gap-2">
          <span className="label-xs">Energy</span>
          <Slider className="w-24" value={[energy]} min={1} max={10} step={1} onValueChange={([v = 0]) => setEnergy(v)} />
        </div>
        <Button
          onClick={() => {
            generateBeat(track.id, genre, energy);
            toast.success(`${genre} pattern generated`);
          }}
          className="glow"
        >
          <Sparkles className="size-4" /> GENERATE BEAT
        </Button>
        <Button variant="secondary" onClick={() => addPad(track.id)}>
          <Plus className="size-4" /> Add pad
        </Button>
        <Button variant="ghost" onClick={humanize}>
          Humanize
        </Button>
        <Button
          variant="ghost"
          onClick={() => toast("Drop samples on a pad", { description: "WAV, MP3, AIFF and OGG are supported." })}
        >
          <Upload className="size-4" /> Import samples
        </Button>
      </div>

      <div className="drum-presets flex flex-wrap items-center gap-2">
        <span className="label-xs">SOUND PRESET</span>
        <Select value="" onValueChange={loadPreset}>
          <SelectTrigger className="w-48">
            <SelectValue placeholder={presets.length ? "Load preset…" : "No saved presets"} />
          </SelectTrigger>
          <SelectContent>
            {presets.map((p) => (
              <SelectItem key={p.name} value={p.name}>
                {p.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button variant="secondary" size="sm" onClick={savePreset}>
          <Save className="size-4" /> Save preset
        </Button>
        {presets.length > 0 && (
          <Button variant="ghost" size="sm" onClick={deletePreset}>
            <Trash2 className="size-4" /> Delete
          </Button>
        )}
      </div>

      {/* Impact-style instrument surface */}
      <div className="drum-surface rounded-[3px] border border-border bg-background/70 p-2">
        {/* Display strip */}
        <div className="drum-display mb-2 flex items-center justify-between rounded-[3px] border border-border bg-background/60 px-3 py-2">
          <span className="font-display text-lg font-bold tracking-wide text-foreground/90">
            SYNC<span className="text-primary">PADS</span>
          </span>
          <div className="flex items-center gap-4 font-mono text-[10px] text-muted-foreground">
            <span className="flex items-center gap-1.5">
              {focusPad && <DrumInstrumentIcon kind={focusPad.kind} className="size-5" />}
              <span className="text-foreground/80">{focusPad ? focusPad.name : "—"}</span>
            </span>
            <span>{focusPad?.sample ?? "synthesized voice"}</span>
            <span>Start {Math.round((focusPad?.start ?? 0) * 100)}</span>
            <span>End {Math.round((focusPad?.end ?? 1) * 100)}</span>
          </div>
          {focusPad && (
            <Button
              size="sm"
              variant={focusPad.reverse ? "default" : "ghost"}
              className="h-6 px-2 text-[10px]"
              onClick={() => updatePad(track.id, focusPad.id, { reverse: !focusPad.reverse })}
            >
              Reverse
            </Button>
          )}
        </div>

        <div className="flex gap-2">
          {/* 1–8 → the 8 patterns */}
          <div className="drum-side-banks flex flex-col gap-1">
            <span className="font-mono text-[9px] text-muted-foreground">PATTERN</span>
            {BANKS.map((number, index) => (
              <Button variant="ghost"
                key={number}
                aria-label={`Pattern ${number}`}
                onClick={() => switchPattern(index)}
                className={cn(
                  "flex h-full min-h-8 w-6 items-center justify-center rounded-[3px] border font-mono text-[11px] font-semibold",
                  activePattern === index
                    ? "border-primary bg-primary/20 text-primary"
                    : "border-border bg-surface-2 text-muted-foreground hover:text-foreground",
                )}
              >
                {number}
              </Button>
            ))}
          </div>

          {/* Original pad proportions, with instrument artwork beside the labels. */}
          <div className="drum-pad-grid grid min-w-0 flex-1 grid-cols-5 gap-2">
            {pads.map((pad, padIndex) => {
              const focused = focusPad?.id === pad.id;
              const hasSteps = pad.steps.some((v) => v > 0);
              return (
                <div
                  key={pad.id}
                  role="button"
                  tabIndex={0}
                  aria-pressed={focused}
                  onClick={() => {
                    hitPad(pad);
                  }}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      hitPad(pad);
                    }
                  }}
                  className={cn(
                    "relative flex min-h-16 cursor-pointer flex-col justify-between rounded-[3px] border p-1.5 text-left outline-none transition-colors focus-visible:ring-1 focus-visible:ring-ring",
                    focused ? "border-primary" : "border-border hover:border-primary/50",
                    [0, 4, 8, 12].includes(padIndex) ? "drum-pad-dark" : "bg-surface-2",
                  )}
                >
                  <span aria-hidden className="pointer-events-none absolute inset-0 flex items-center justify-center">
                    <DrumInstrumentIcon kind={pad.kind} className="size-[52%]" />
                  </span>
                  <span className="relative min-w-0">
                    <span className="block truncate font-mono text-[10px] font-semibold tracking-wider">{padIndex + 1}. {pad.name}</span>
                    <span className="block font-mono text-[8px] text-muted-foreground">
                      {pad.sample ? "SMP" : pad.kit?.toUpperCase() ?? "909"}{hasSteps ? " ·" : ""}
                    </span>
                  </span>
                  <span className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
                    <Button
                      size="sm"
                      variant={pad.solo ? "default" : "ghost"}
                      className="h-5 px-1 text-[9px]"
                      onClick={() => updatePad(track.id, pad.id, { solo: !pad.solo })}
                    >
                      S
                    </Button>
                    <Button
                      size="sm"
                      variant={pad.muted ? "secondary" : "ghost"}
                      className="h-5 px-1 text-[9px]"
                      onClick={() => updatePad(track.id, pad.id, { muted: !pad.muted })}
                    >
                      M
                    </Button>
                    <span className="ml-auto font-mono text-[9px] text-muted-foreground">{Math.round(pad.volume * 100)}</span>
                  </span>
                </div>
              );
            })}
          </div>

          {/* Pad settings column */}
          {focusPad && (
            <div className="drum-sound-controls flex w-64 shrink-0 flex-col gap-2">
              <Section title="Pitch" active>
                <Knob label="TRANSP" midiTarget={{ id: track.id, param: `drum:${focusPad.id}:pitch` }} min={-12} max={12} step={1} value={focusPad.pitch} onChange={(v) => updatePad(track.id, focusPad.id, { pitch: v })} />
                <Knob label="ENV" midiTarget={{ id: track.id, param: `drum:${focusPad.id}:filterEnv` }} min={-1} max={1} value={focusPad.filterEnv ?? 0} onChange={(v) => updatePad(track.id, focusPad.id, { filterEnv: v })} />
                <Knob label="VEL" value={focusPad.volume} onChange={(v) => updatePad(track.id, focusPad.id, { volume: v })} />
                <div className="ml-0.5 flex items-end gap-1.5 border-l border-border pl-2.5">
                  <VSlider label="A" value={focusPad.attack ?? 0} onChange={(v) => updatePad(track.id, focusPad.id, { attack: v })} />
                  <VSlider label="H" value={focusPad.sustain ?? 0} onChange={(v) => updatePad(track.id, focusPad.id, { sustain: v })} />
                  <VSlider label="D" value={focusPad.decay} onChange={(v) => updatePad(track.id, focusPad.id, { decay: v })} />
                </div>
              </Section>
              <Section title="Filter" active={(focusPad.filterType ?? "off") !== "off"}>
                <div className="flex w-full gap-1">
                  {(["off", "lowpass", "highpass", "bandpass"] as const).map((ft) => (
                    <Button
                      key={ft}
                      size="sm"
                      variant={(focusPad.filterType ?? "off") === ft ? "default" : "ghost"}
                      className="h-6 flex-1 px-1 text-[9px]"
                      onClick={() => updatePad(track.id, focusPad.id, { filterType: ft })}
                    >
                      {ft === "off" ? "OFF" : ft === "lowpass" ? "LP" : ft === "highpass" ? "HP" : "BP"}
                    </Button>
                  ))}
                </div>
                <Knob label="CUTOFF" midiTarget={{ id: track.id, param: `drum:${focusPad.id}:cutoff` }} value={focusPad.cutoff ?? 1} onChange={(v) => updatePad(track.id, focusPad.id, { cutoff: v })} />
                <Knob label="RES" midiTarget={{ id: track.id, param: `drum:${focusPad.id}:resonance` }} value={focusPad.resonance ?? 0} onChange={(v) => updatePad(track.id, focusPad.id, { resonance: v })} />
                <Knob label="DRIVE" midiTarget={{ id: track.id, param: `drum:${focusPad.id}:drive` }} value={focusPad.drive ?? 0} onChange={(v) => updatePad(track.id, focusPad.id, { drive: v })} />
                <Knob label="PUNCH" midiTarget={{ id: track.id, param: `drum:${focusPad.id}:snap` }} value={focusPad.snap ?? 0} onChange={(v) => updatePad(track.id, focusPad.id, { snap: v })} />
              </Section>
              <Section title="Amp" active>
                <Knob label="GAIN" midiTarget={{ id: track.id, param: `drum:${focusPad.id}:volume` }} value={focusPad.volume} onChange={(v) => updatePad(track.id, focusPad.id, { volume: v })} />
                <Knob label="PAN" midiTarget={{ id: track.id, param: `drum:${focusPad.id}:pan` }} min={-1} max={1} value={focusPad.pan} onChange={(v) => updatePad(track.id, focusPad.id, { pan: v })} />
                <div className="ml-0.5 flex items-end gap-1.5 border-l border-border pl-2.5">
                  <VSlider label="A" value={focusPad.attack ?? 0} onChange={(v) => updatePad(track.id, focusPad.id, { attack: v })} />
                  <VSlider label="D" value={focusPad.decay} onChange={(v) => updatePad(track.id, focusPad.id, { decay: v })} />
                  <VSlider label="R" value={focusPad.release ?? 0.2} onChange={(v) => updatePad(track.id, focusPad.id, { release: v })} />
                </div>
              </Section>
              <Section title="Sample" active={Boolean(focusPad.sample)}>
                <Knob label="START" midiTarget={{ id: track.id, param: `drum:${focusPad.id}:start` }} value={focusPad.start ?? 0} onChange={(v) => updatePad(track.id, focusPad.id, { start: Math.min(v, (focusPad.end ?? 1) - 0.01) })} />
                <Knob label="END" midiTarget={{ id: track.id, param: `drum:${focusPad.id}:end` }} value={focusPad.end ?? 1} onChange={(v) => updatePad(track.id, focusPad.id, { end: Math.max(v, (focusPad.start ?? 0) + 0.01) })} />
              </Section>
              <Section title="Shape" active={(focusPad.tone ?? 0.5) !== 0.5 || (focusPad.compressor ?? 0) > 0 || (focusPad.noise ?? 0) > 0 || (focusPad.crush ?? 0) > 0}>
                <Knob label="TONE" midiTarget={{ id: track.id, param: `drum:${focusPad.id}:tone` }} value={focusPad.tone ?? 0.5} onChange={(v) => updatePad(track.id, focusPad.id, { tone: v })} />
                <Knob label="COMP" midiTarget={{ id: track.id, param: `drum:${focusPad.id}:compressor` }} value={focusPad.compressor ?? 0} onChange={(v) => updatePad(track.id, focusPad.id, { compressor: v })} />
                <Knob label="NOISE" midiTarget={{ id: track.id, param: `drum:${focusPad.id}:noise` }} value={focusPad.noise ?? 0} onChange={(v) => updatePad(track.id, focusPad.id, { noise: v })} />
                <Knob label="WIDTH" midiTarget={{ id: track.id, param: `drum:${focusPad.id}:width` }} value={focusPad.width ?? 0} onChange={(v) => updatePad(track.id, focusPad.id, { width: v })} />
                <Knob label="CRUSH" midiTarget={{ id: track.id, param: `drum:${focusPad.id}:crush` }} value={focusPad.crush ?? 0} onChange={(v) => updatePad(track.id, focusPad.id, { crush: v })} />
                <Knob label="MUTATE" midiTarget={{ id: track.id, param: `drum:${focusPad.id}:mutation` }} value={focusPad.mutation ?? 0.2} onChange={(v) => updatePad(track.id, focusPad.id, { mutation: v })} />
              </Section>
              <div className="rounded-md border border-border bg-surface/80 p-2.5">
                <div className="mb-2 flex items-center gap-1.5">
                  <span className={cn("size-1.5 rounded-full", (focusPad.choke ?? 0) > 0 ? "bg-primary" : "bg-muted-foreground/40")} />
                  <span className="font-mono text-[10px] font-semibold uppercase tracking-widest text-foreground/90">Choke</span>
                </div>
                <div className="flex gap-1.5">
                  {[0, 1, 2, 3, 4].map((g) => (
                    <button
                      key={g}
                      title={g === 0 ? "No choke group" : `Choke group ${g} — pads in the same group cut each other off`}
                      onClick={() => updatePad(track.id, focusPad.id, { choke: g })}
                      className={cn(
                        "h-10 flex-1 rounded-md border font-mono text-sm font-semibold transition-colors",
                        (focusPad.choke ?? 0) === g
                          ? "border-primary bg-primary/20 text-primary"
                          : "border-border bg-surface-2 text-muted-foreground hover:text-foreground",
                      )}
                    >
                      {g === 0 ? "–" : g}
                    </button>
                  ))}
                </div>
                <p className="mt-1.5 font-mono text-[9px] leading-snug text-muted-foreground">
                  Pads in the same group cut each other off — like closed and open hats.
                </p>
              </div>
              <div className="flex flex-wrap gap-1">
                <Button size="sm" variant="ghost" className="h-6 px-1.5 text-[10px]" onClick={() => flam(focusPad.id, focusPad.steps)}>Flam</Button>
                <Button size="sm" variant="ghost" className="h-6 px-1.5 text-[10px]" onClick={() => roll(focusPad.id, focusPad.steps)}>Roll</Button>
                <Button size="sm" variant="secondary" className="h-6 px-1.5 text-[10px]" onClick={() => mutate(focusPad)}>Mutate</Button>
                <label className="cursor-pointer rounded-md px-1.5 py-0.5 text-[10px] text-muted-foreground hover:text-foreground">
                  Load sample
                  <input
                    type="file"
                    accept="audio/*"
                    className="hidden"
                    onChange={async (e) => {
                      const file = e.target.files?.[0];
                      if (!file) return;
                      try {
                        const info = await getEngine().loadSampleFile(file, file.name);
                        updatePad(track.id, focusPad.id, { sample: file.name, sampleUrl: info.url });
                        toast.success(`${file.name} loaded on ${focusPad.name}`, {
                          description: `${info.duration.toFixed(2)}s — trim, pitch and reverse from this pad.`,
                        });
                      } catch {
                        toast.error("Could not read that audio file");
                      }
                    }}
                  />
                </label>
              </div>
            </div>
          )}
        </div>

      </div>


    </div>
  );
}

