import { useEffect, useState } from "react";
import { stepsPerBar, getBeatsPerBar } from "@/lib/synclab/timebase";
import { SkinControls, skinBackground, useImageDrop } from "@/components/studio/SkinControls";
import { useSkin } from "@/lib/synclab/skins";
import { Asterisk, Circle, CircleDot, CircleSmall, Copy, Crosshair, Disc3, Hand, Plus, RotateCcw, Save, Sparkles, Sun, Trash2, Triangle, Upload, Zap } from "lucide-react";
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

const BANKS = ["A", "B", "C", "D", "E", "F", "G", "H"];

/** Every drum voice gets its own glyph and colour, so a pad reads as its instrument at a glance. */
const PAD_STYLE: Record<DrumPad["kind"], { color: string; Icon: typeof CircleDot }> = {
  kick: { color: "oklch(0.72 0.19 25)", Icon: CircleDot },
  snare: { color: "oklch(0.80 0.16 75)", Icon: Asterisk },
  clap: { color: "oklch(0.75 0.18 320)", Icon: Hand },
  hat: { color: "oklch(0.84 0.13 195)", Icon: CircleSmall },
  openhat: { color: "oklch(0.86 0.12 185)", Icon: Sun },
  tom: { color: "oklch(0.72 0.17 145)", Icon: Circle },
  perc: { color: "oklch(0.78 0.17 55)", Icon: Triangle },
  rim: { color: "oklch(0.80 0.05 250)", Icon: Crosshair },
  crash: { color: "oklch(0.88 0.10 95)", Icon: Sparkles },
  ride: { color: "oklch(0.78 0.14 230)", Icon: Disc3 },
  fx: { color: "oklch(0.72 0.20 300)", Icon: Zap },
};
const PAD_FALLBACK = PAD_STYLE.perc;

/** Small vertical fader used for the A / H / D envelope sliders, Impact-style. */
function VSlider({ label, value, min = 0, max = 1, onChange }: { label: string; value: number; min?: number; max?: number; onChange: (v: number) => void }) {
  return (
    <label className="flex w-7 flex-col items-center gap-1">
      <Slider orientation="vertical" className="h-14" min={min} max={max} step={0.01} value={[value]} onValueChange={([v = 0]) => onChange(v)} />
      <span className="font-mono text-[9px] text-muted-foreground">{label}</span>
    </label>
  );
}

function Section({ title, active, children }: { title: string; active?: boolean; children: React.ReactNode }) {
  return (
    <div className="rounded-[3px] border border-border bg-surface/80">
      <div className="flex items-center gap-1.5 border-b border-border px-2 py-1">
        <span className={cn("size-1.5 rounded-full", active ? "bg-primary" : "bg-muted-foreground/40")} />
        <span className="font-mono text-[10px] font-semibold uppercase tracking-widest">{title}</span>
      </div>
      <div className="flex flex-wrap items-end gap-2 p-2">{children}</div>
    </div>
  );
}

export function DrumMachine({ track }: { track: Track }) {
  const { updatePad, updateTrack, setStepCount, addPad, generateBeat, transport } = useStudio();
  const [genre, setGenre] = useState("Detroit Techno");
  const [energy, setEnergy] = useState(6);
  const [focusPadId, setFocusPadId] = useState<string | null>(null);
  const [selectedStep, setSelectedStep] = useState<{ padId: string; index: number } | null>(null);
  const pads = track.pads ?? [];
  const activePattern = Math.max(0, Math.min(7, track.activeDrumPattern ?? 0));
  const focusPad = pads.find((p) => p.id === focusPadId) ?? pads[0];
  const focusStyle = focusPad ? PAD_STYLE[focusPad.kind] ?? PAD_FALLBACK : null;

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
    <div className="studio-wallpaper space-y-3 rounded-md p-3" data-studio-panel="drums" style={skinBackground(skin)} {...drop}>
      <SkinControls skinKey="drums" image />

      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-2">
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

      <div className="flex flex-wrap items-center gap-2">
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
      <div className="rounded-[3px] border border-border bg-background/70 p-2">
        {/* Display strip */}
        <div className="mb-2 flex items-center justify-between rounded-[3px] border border-border bg-black/60 px-3 py-2">
          <span className="font-display text-lg font-bold tracking-wide text-foreground/90">
            SYNC<span className="text-primary">PADS</span>
          </span>
          <div className="flex items-center gap-4 font-mono text-[10px] text-muted-foreground">
            <span className="flex items-center gap-1.5">
              {focusStyle && <focusStyle.Icon className="size-4 shrink-0" strokeWidth={1.7} style={{ color: focusStyle.color }} aria-hidden />}
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
          {/* Bank letters → the 8 patterns */}
          <div className="flex flex-col gap-1">
            {BANKS.map((letter, index) => (
              <button
                key={letter}
                aria-label={`Bank ${letter} (pattern ${index + 1})`}
                onClick={() => switchPattern(index)}
                className={cn(
                  "flex h-full min-h-8 w-6 items-center justify-center rounded-[3px] border font-mono text-[11px] font-semibold",
                  activePattern === index
                    ? "border-primary bg-primary/20 text-primary"
                    : "border-border bg-surface-2 text-muted-foreground hover:text-foreground",
                )}
              >
                {letter}
              </button>
            ))}
          </div>

          {/* Pad grid: each pad shows its instrument glyph in that instrument's colour */}
          <div className="grid flex-1 grid-cols-4 gap-1.5">
            {pads.map((pad) => {
              const focused = focusPad?.id === pad.id;
              const hasSteps = pad.steps.some((v) => v > 0);
              const { color, Icon } = PAD_STYLE[pad.kind] ?? PAD_FALLBACK;
              const tint = `color-mix(in oklab, ${color} ${focused ? 22 : 11}%, transparent)`;
              return (
                <button
                  key={pad.id}
                  onClick={() => {
                    getEngine().playDrum(track.id, pad, 1);
                    setFocusPadId(pad.id);
                  }}
                  className={cn(
                    "flex min-h-[86px] flex-col justify-between gap-1 rounded-[3px] border p-1.5 text-left transition-colors",
                    focused ? "border-primary" : "border-border hover:border-primary/50",
                  )}
                  style={{
                    background: `linear-gradient(${tint}, ${tint})`,
                    borderColor: focused ? undefined : `color-mix(in oklab, ${color} 38%, var(--border))`,
                  }}
                >
                  <span className="flex items-center justify-between gap-1">
                    <span className="min-w-0 truncate font-mono text-[10px] font-semibold tracking-wider">{pad.name}</span>
                    <span className="shrink-0 font-mono text-[8px] text-muted-foreground">
                      {pad.sample ? "SMP" : pad.kit?.toUpperCase() ?? "909"}
                      {hasSteps ? " ·" : ""}
                    </span>
                  </span>
                  <span className="flex flex-1 items-center justify-center" style={{ color }}>
                    <Icon className="size-8" strokeWidth={1.5} aria-hidden />
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
                </button>
              );
            })}
          </div>

          {/* Pad settings column */}
          {focusPad && (
            <div className="flex w-64 shrink-0 flex-col gap-2">
              <Section title="Pitch" active>
                <Knob label="TRANSP" midiTarget={{ id: track.id, param: `drum:${focusPad.id}:pitch` }} min={-12} max={12} step={1} value={focusPad.pitch} onChange={(v) => updatePad(track.id, focusPad.id, { pitch: v })} />
                <VSlider label="A" value={focusPad.attack ?? 0} onChange={(v) => updatePad(track.id, focusPad.id, { attack: v })} />
                <VSlider label="H" value={focusPad.sustain ?? 0} onChange={(v) => updatePad(track.id, focusPad.id, { sustain: v })} />
                <VSlider label="D" value={focusPad.decay} onChange={(v) => updatePad(track.id, focusPad.id, { decay: v })} />
                <Knob label="ENV" midiTarget={{ id: track.id, param: `drum:${focusPad.id}:filterEnv` }} min={-1} max={1} value={focusPad.filterEnv ?? 0} onChange={(v) => updatePad(track.id, focusPad.id, { filterEnv: v })} />
                <Knob label="VEL" value={focusPad.volume} onChange={(v) => updatePad(track.id, focusPad.id, { volume: v })} />
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
                <VSlider label="A" value={focusPad.attack ?? 0} onChange={(v) => updatePad(track.id, focusPad.id, { attack: v })} />
                <VSlider label="D" value={focusPad.decay} onChange={(v) => updatePad(track.id, focusPad.id, { decay: v })} />
                <VSlider label="R" value={focusPad.release ?? 0.2} onChange={(v) => updatePad(track.id, focusPad.id, { release: v })} />
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
              <div className="flex items-center gap-2">
                <span className="label-xs text-[9px]">CHOKE</span>
                <div className="flex gap-0.5">
                  {[0, 1, 2, 3, 4].map((g) => (
                    <button
                      key={g}
                      title={g === 0 ? "No choke group" : `Choke group ${g} — pads in the same group cut each other off`}
                      onClick={() => updatePad(track.id, focusPad.id, { choke: g })}
                      className={cn(
                        "h-6 w-6 rounded-[3px] border font-mono text-[10px]",
                        (focusPad.choke ?? 0) === g
                          ? "border-primary bg-primary/20 text-primary"
                          : "border-border bg-surface-2 text-muted-foreground hover:text-foreground",
                      )}
                    >
                      {g === 0 ? "–" : g}
                    </button>
                  ))}
                </div>
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
                        const info = await getEngine().peaksFromFile(file);
                        updatePad(track.id, focusPad.id, { sample: file.name });
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

        {/* Pattern controls */}
        <div className="mt-2 flex flex-wrap items-center gap-2 border-t border-border pt-2">
          <span className="label-xs">PATTERN {activePattern + 1}</span>
          <Button size="sm" variant="secondary" onClick={copyPattern}><Copy className="size-4" /> Copy next</Button>
          <Button size="sm" variant="ghost" onClick={clearPattern}><RotateCcw className="size-4" /> Clear</Button>
        </div>
      </div>

      {/* Step sequencer */}
      <div className="space-y-1 overflow-x-auto">
        {pads.map((pad) => (
          <div key={pad.id} className="space-y-1">
            <div className="flex items-center gap-2">
              <button
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
              </button>
              <div className="flex flex-1 gap-[3px]">
                {pad.steps.map((v, i) => (
                  <button
                    key={i}
                    aria-label={`${pad.name} step ${i + 1}`}
                     onClick={() => {
                       cycleStep(pad.id, pad.steps, i);
                       setSelectedStep({ padId: pad.id, index: i });
                     }}
                    title={v > 0 ? `velocity ${Math.round(v * 100)}%` : "empty"}
                    className="h-6 flex-1 rounded-[3px] border transition-all"
                    style={{
                      minWidth: 12,
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
                  />
                ))}
              </div>
            </div>
             {selectedStep?.padId === pad.id && (
               <div className="panel flex flex-wrap items-end gap-3 p-3 sm:ml-24">
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
    </div>
  );
}

