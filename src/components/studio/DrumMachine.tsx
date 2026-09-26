import { useEffect, useState } from "react";
import { SkinControls, skinBackground } from "@/components/studio/SkinControls";
import { useSkin } from "@/lib/synclab/skins";
import { Copy, Plus, RotateCcw, Save, Sparkles, Trash2, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { Select, SelectContent, SelectGroup, SelectItem, SelectLabel, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Knob } from "./Knob";
import { DrumPads } from "./DrumPads";
import { useStudio } from "@/lib/synclab/store";
import { DRUM_KITS, GENRES } from "@/lib/synclab/presets";
import type { DrumKitId } from "@/lib/synclab/types";
import { getEngine } from "@/lib/synclab/audio-engine";
import type { DrumPad, Track } from "@/lib/synclab/types";
import { toast } from "sonner";

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


export function DrumMachine({ track }: { track: Track }) {
  const { updatePad, updateTrack, setStepCount, addPad, generateBeat, transport } = useStudio();
  const [genre, setGenre] = useState("Detroit Techno");
  const [energy, setEnergy] = useState(6);
  const [openPad, setOpenPad] = useState<string | null>(null);
  const [selectedStep, setSelectedStep] = useState<{ padId: string; index: number } | null>(null);
  const pads = track.pads ?? [];
  const activePattern = Math.max(0, Math.min(7, track.activeDrumPattern ?? 0));

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
  return (
    <div className={`space-y-3 ${skinBackground(skin) ? "rounded-xl p-3" : ""}`} style={skinBackground(skin)}>
      <SkinControls skinKey="drums" />
      <div className="flex flex-wrap items-center gap-2 rounded-[3px] border border-border bg-surface/80 p-2">
        <span className="label-xs mr-1">PATTERNS</span>
        {Array.from({ length: 8 }, (_, index) => (
          <Button key={index} size="icon" variant={activePattern === index ? "default" : "outline"} className="size-10" aria-label={`Pattern ${index + 1}`} onClick={() => switchPattern(index)}>
            {index + 1}
          </Button>
        ))}
        <Button size="sm" variant="secondary" onClick={copyPattern}><Copy className="size-4" /> Copy next</Button>
        <Button size="sm" variant="ghost" onClick={clearPattern}><RotateCcw className="size-4" /> Clear</Button>
      </div>
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
        <Select value={String(track.steps)} onValueChange={(v) => setStepCount(track.id, Number(v))}>
          <SelectTrigger className="w-28">
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

      <div className="space-y-1 overflow-x-auto">
        {pads.map((pad) => (
          <div key={pad.id} className="space-y-1">
            <div className="flex items-center gap-2">
              <button
                className="w-24 shrink-0 rounded-md border border-border bg-surface-2 px-2 py-1 text-left font-mono text-[10px] tracking-wider hover:glow"
                onClick={() => {
                  getEngine().playDrum(track.id, pad, 1);
                  setOpenPad(openPad === pad.id ? null : pad.id);
                }}
              >
                {pad.name}
              </button>
              <Button
                size="sm"
                variant={pad.muted ? "secondary" : "ghost"}
                className="h-6 px-1.5 text-[10px]"
                onClick={() => updatePad(track.id, pad.id, { muted: !pad.muted })}
              >
                M
              </Button>
              <Button
                size="sm"
                variant={pad.solo ? "default" : "ghost"}
                className="h-6 px-1.5 text-[10px]"
                onClick={() => updatePad(track.id, pad.id, { solo: !pad.solo })}
              >
                S
              </Button>
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
                        transport.playing && transport.step === i % 16 ? "var(--neon)" : "var(--color-border)",
                      opacity: v > 0 ? 0.35 + v * 0.65 : 1,
                      background:
                        v > 0
                          ? "var(--gradient-neon)"
                          : i % 4 === 0
                            ? "color-mix(in oklab, var(--surface-2) 90%, transparent)"
                            : "color-mix(in oklab, var(--surface) 80%, transparent)",
                    }}
                  />
                ))}
              </div>
            </div>
            {openPad === pad.id && (
              <div className="panel flex flex-wrap gap-3 p-3 sm:ml-24">
                <Knob label="VOL" midiTarget={{ id: track.id, param: `drum:${pad.id}:volume` }} value={pad.volume} onChange={(v) => updatePad(track.id, pad.id, { volume: v })} />
                <Knob label="PAN" midiTarget={{ id: track.id, param: `drum:${pad.id}:pan` }} min={-1} max={1} value={pad.pan} onChange={(v) => updatePad(track.id, pad.id, { pan: v })} />
                <Knob
                  label="PITCH"
                  midiTarget={{ id: track.id, param: `drum:${pad.id}:pitch` }}
                  min={-12}
                  max={12}
                  step={1}
                  value={pad.pitch}
                  onChange={(v) => updatePad(track.id, pad.id, { pitch: v })}
                />
                <Knob label="DECAY" midiTarget={{ id: track.id, param: `drum:${pad.id}:decay` }} value={pad.decay} onChange={(v) => updatePad(track.id, pad.id, { decay: v })} />
                <Knob label="ATK" midiTarget={{ id: track.id, param: `drum:${pad.id}:attack` }} value={pad.attack ?? 0} onChange={(v) => updatePad(track.id, pad.id, { attack: v })} />
                <Knob
                  label="SUS"
                  midiTarget={{ id: track.id, param: `drum:${pad.id}:sustain` }}
                  value={pad.sustain ?? 0}
                  onChange={(v) => updatePad(track.id, pad.id, { sustain: v })}
                />
                <Knob
                  label="REL"
                  midiTarget={{ id: track.id, param: `drum:${pad.id}:release` }}
                  value={pad.release ?? 0.2}
                  onChange={(v) => updatePad(track.id, pad.id, { release: v })}
                />
                <Knob label="START" midiTarget={{ id: track.id, param: `drum:${pad.id}:start` }} value={pad.start ?? 0} onChange={(v) => updatePad(track.id, pad.id, { start: v })} />
                <Knob label="END" midiTarget={{ id: track.id, param: `drum:${pad.id}:end` }} value={pad.end ?? 1} onChange={(v) => updatePad(track.id, pad.id, { end: v })} />
                <Knob
                  label="TONE"
                  midiTarget={{ id: track.id, param: `drum:${pad.id}:tone` }}
                  value={pad.tone ?? 0.5}
                  onChange={(v) => updatePad(track.id, pad.id, { tone: v })}
                />
                 <Knob label="DISTORT" midiTarget={{ id: track.id, param: `drum:${pad.id}:drive` }} value={pad.drive ?? 0} onChange={(v) => updatePad(track.id, pad.id, { drive: v })} />
                 <Knob label="COMP" midiTarget={{ id: track.id, param: `drum:${pad.id}:compressor` }} value={pad.compressor ?? 0} onChange={(v) => updatePad(track.id, pad.id, { compressor: v })} />
                <Knob label="SNAP" midiTarget={{ id: track.id, param: `drum:${pad.id}:snap` }} value={pad.snap ?? 0} onChange={(v) => updatePad(track.id, pad.id, { snap: v })} />
                <Knob label="NOISE" midiTarget={{ id: track.id, param: `drum:${pad.id}:noise` }} value={pad.noise ?? 0} onChange={(v) => updatePad(track.id, pad.id, { noise: v })} />
                <Knob label="WIDTH" midiTarget={{ id: track.id, param: `drum:${pad.id}:width` }} value={pad.width ?? 0} onChange={(v) => updatePad(track.id, pad.id, { width: v })} />
                <Knob label="CRUSH" midiTarget={{ id: track.id, param: `drum:${pad.id}:crush` }} value={pad.crush ?? 0} onChange={(v) => updatePad(track.id, pad.id, { crush: v })} />
                 <Knob label="MUTATION" midiTarget={{ id: track.id, param: `drum:${pad.id}:mutation` }} value={pad.mutation ?? 0.2} onChange={(v) => updatePad(track.id, pad.id, { mutation: v })} />
                <div className="flex flex-col gap-1">
                  <span className="label-xs">FILTER</span>
                  <div className="flex gap-1">
                    {(["off", "lowpass", "highpass", "bandpass"] as const).map((ft) => (
                      <Button
                        key={ft}
                        size="sm"
                        variant={(pad.filterType ?? "off") === ft ? "default" : "ghost"}
                        className="h-6 px-1.5 text-[10px]"
                        onClick={() => updatePad(track.id, pad.id, { filterType: ft })}
                      >
                        {ft === "off" ? "OFF" : ft === "lowpass" ? "LP" : ft === "highpass" ? "HP" : "BP"}
                      </Button>
                    ))}
                  </div>
                </div>
                <Knob label="CUTOFF" midiTarget={{ id: track.id, param: `drum:${pad.id}:cutoff` }} value={pad.cutoff ?? 1} onChange={(v) => updatePad(track.id, pad.id, { cutoff: v })} />
                <Knob label="RESO" midiTarget={{ id: track.id, param: `drum:${pad.id}:resonance` }} value={pad.resonance ?? 0} onChange={(v) => updatePad(track.id, pad.id, { resonance: v })} />
                <Knob
                  label="F.ENV"
                  midiTarget={{ id: track.id, param: `drum:${pad.id}:filterEnv` }}
                  min={-1}
                  max={1}
                  value={pad.filterEnv ?? 0}
                  onChange={(v) => updatePad(track.id, pad.id, { filterEnv: v })}
                />
                <Knob
                  label="CHOKE"
                  midiTarget={{ id: track.id, param: `drum:${pad.id}:choke` }}
                  min={0}
                  max={4}
                  step={1}
                  value={pad.choke ?? 0}
                  onChange={(v) => updatePad(track.id, pad.id, { choke: Math.round(v) })}
                />
                <div className="flex items-end gap-1">
                  <Button
                    size="sm"
                    variant={pad.reverse ? "default" : "ghost"}
                    onClick={() => updatePad(track.id, pad.id, { reverse: !pad.reverse })}
                  >
                    Reverse
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => flam(pad.id, pad.steps)}>
                    Flam
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => roll(pad.id, pad.steps)}>
                    Roll
                  </Button>
                   <Button size="sm" variant="secondary" onClick={() => mutate(pad)}>
                     Mutate
                   </Button>
                  <label className="cursor-pointer rounded-md px-2 py-1 text-xs text-muted-foreground hover:text-foreground">
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
                          updatePad(track.id, pad.id, { sample: file.name });
                          toast.success(`${file.name} loaded on ${pad.name}`, {
                            description: `${info.duration.toFixed(2)}s — trim, pitch and reverse from this pad.`,
                          });
                        } catch {
                          toast.error("Could not read that audio file");
                        }
                      }}
                    />
                  </label>
                </div>
                <div className="flex items-end">
                  <Button variant="ghost" size="sm" onClick={() => toast("Sample editor", { description: "Trim, normalise, reverse and time-stretch this pad's sample." })}>
                    Sample editor
                  </Button>
                </div>
              </div>
            )}
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

      <DrumPads track={track} />
    </div>
  );
}
