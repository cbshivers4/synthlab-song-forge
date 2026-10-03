import { useState } from "react";
import { SkinControls, skinBackground, useImageDrop } from "@/components/studio/SkinControls";
import { useSkin } from "@/lib/synclab/skins";
import { Plus, Save, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectGroup, SelectItem, SelectLabel, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import { Knob } from "./Knob";
import { useStudio } from "@/lib/synclab/store";
import { SYNTH_PRESETS, defaultPatch } from "@/lib/synclab/presets";
import type { EnvelopeParams, LfoWave, ModDest, ModSource, OscWave, SynthPatch, Track } from "@/lib/synclab/types";
import { uid } from "@/lib/synclab/presets";
import { toast } from "sonner";

const WAVES: OscWave[] = ["sine", "triangle", "sawtooth", "square", "pulse", "noise", "wavetable"];

const MOD_SOURCES: ModSource[] = [
  "lfo1",
  "lfo2",
  "lfo3",
  "modEnv",
  "velocity",
  "keytrack",
  "random",
  "macro1",
  "macro2",
  "macro3",
  "macro4",
];

const MOD_DESTS: ModDest[] = [
  "pitch",
  "cutoff",
  "cutoff2",
  "resonance",
  "level",
  "pan",
  "pulseWidth",
  "morph",
  "fmAmount",
  "unisonDetune",
];

/** Destinations WebAudio can only set once per note, so only fixed sources move them. */
const FIXED_ONLY: ModDest[] = ["pulseWidth", "morph", "fmAmount", "unisonDetune"];

function EnvelopeGraph({ env }: { env: EnvelopeParams }) {
  const total = env.attack + env.decay + 0.6 + env.release || 1;
  const x = (t: number) => (t / total) * 100;
  const a = x(env.attack);
  const d = a + x(env.decay);
  const s = d + x(0.6);
  const r = s + x(env.release);
  const sustainY = 40 - env.sustain * 36;
  return (
    <svg viewBox="0 0 100 40" className="h-20 w-full rounded-md border border-border bg-background/60">
      <polyline
        points={`0,40 ${a},4 ${d},${sustainY} ${s},${sustainY} ${r},40`}
        fill="none"
        stroke="var(--neon)"
        strokeWidth="1.5"
      />
    </svg>
  );
}

export function SynthEditor({ track }: { track: Track }) {
  const { updatePatch, savePreset, loadPreset, userPresets, previewNote } = useStudio();
  const [presetName, setPresetName] = useState("");
  const patch = track.patch as SynthPatch;
  if (!patch) return null;
  const set = (p: Partial<SynthPatch>) => updatePatch(track.id, p);
  const f2 = patch.filter2 ?? { on: false, type: "highpass" as BiquadFilterType, cutoff: 200, resonance: 1, routing: "series" as const };
  const modEnv = patch.modEnv ?? { attack: 0.01, decay: 0.3, sustain: 0.4, release: 0.3 };
  const macros = patch.macros ?? [0, 0, 0, 0];
  const matrix = patch.modMatrix ?? [];
  const presetGroups = (() => {
    const all = [
      ...SYNTH_PRESETS.map((x) => ({ name: x.name, category: x.category })),
      ...userPresets.map((x) => ({ name: x.name, category: "My Presets" })),
    ];
    const order: string[] = [];
    const map = new Map<string, string[]>();
    all.forEach((x) => {
      if (!map.has(x.category)) {
        map.set(x.category, []);
        order.push(x.category);
      }
      map.get(x.category)!.push(x.name);
    });
    return order.map((category) => ({ category, items: map.get(category)! }));
  })();

  const skin = useSkin("synth");
  const drop = useImageDrop("synth");
  return (
    <div className="studio-wallpaper space-y-4 rounded-md p-3" data-studio-panel="synth" style={skinBackground(skin)} {...drop}>
      <SkinControls skinKey="synth" image />
      <div className="flex flex-wrap items-center gap-2">
        <Select value={patch.name} onValueChange={(v) => loadPreset(track.id, v)}>
          <SelectTrigger className="w-64">
            <SelectValue placeholder="Browse presets" />
          </SelectTrigger>
          <SelectContent className="max-h-[420px]">
            {presetGroups.map((g) => (
              <SelectGroup key={g.category}>
                <SelectLabel className="font-mono text-[10px] uppercase tracking-widest text-primary">
                  {g.category}
                </SelectLabel>
                {g.items.map((name) => (
                  <SelectItem key={name} value={name}>
                    {name}
                  </SelectItem>
                ))}
              </SelectGroup>
            ))}
          </SelectContent>
        </Select>
        <Input
          value={presetName}
          onChange={(e) => setPresetName(e.target.value)}
          placeholder="My preset name"
          className="w-48"
        />
        <Button
          onClick={() => {
            if (!presetName) return;
            savePreset(presetName);
            toast.success(`Preset "${presetName}" saved`);
            setPresetName("");
          }}
        >
          <Save className="size-4" /> SAVE PRESET
        </Button>
        <Button variant="secondary" onClick={() => previewNote(track.id, 60)}>
          Audition
        </Button>
        <Button
          variant="outline"
          onClick={() => {
            updatePatch(track.id, defaultPatch("Init Saw"));
            toast.success("Synth initialized", { description: "Blank starting patch — shape it into your own sound, then SAVE PRESET." });
          }}
        >
          Initialize
        </Button>
      </div>

      <Tabs defaultValue="osc">
        <TabsList>
          <TabsTrigger value="osc">Oscillators</TabsTrigger>
          <TabsTrigger value="filter">Filter</TabsTrigger>
          <TabsTrigger value="env">Envelopes</TabsTrigger>
          <TabsTrigger value="mod">LFO / Unison</TabsTrigger>
          <TabsTrigger value="matrix">Mod Matrix</TabsTrigger>
          <TabsTrigger value="voice">Voice</TabsTrigger>
          <TabsTrigger value="fx">Effects</TabsTrigger>
          <TabsTrigger value="arp">Arpeggiator</TabsTrigger>
          <TabsTrigger value="chords">Chords / Scale</TabsTrigger>
        </TabsList>

        <TabsContent value="osc" className="space-y-3 pt-3">
          {patch.oscillators.map((osc, i) => (
            <div key={i} className="panel flex flex-wrap items-center gap-3 p-3">
              <div className="flex w-28 items-center gap-2">
                <Switch
                  checked={osc.on}
                  onCheckedChange={(v) =>
                    set({ oscillators: patch.oscillators.map((o, j) => (j === i ? { ...o, on: v } : o)) })
                  }
                />
                <span className="font-display text-xs font-semibold">OSC {i + 1}</span>
              </div>
              <Select
                value={osc.wave}
                onValueChange={(v) =>
                  set({ oscillators: patch.oscillators.map((o, j) => (j === i ? { ...o, wave: v as OscWave } : o)) })
                }
              >
                <SelectTrigger className="w-32">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {WAVES.map((w) => (
                    <SelectItem key={w} value={w}>
                      {w}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {(
                [
                  ["OCT", "octave", -3, 3, 1],
                  ["SEMI", "semitone", -12, 12, 1],
                  ["FINE", "fine", -50, 50, 1],
                  ["DETUNE", "detune", -50, 50, 1],
                  ["PHASE", "phase", 0, 1, 0.01],
                  ["PW", "pulseWidth", 0.05, 0.95, 0.01],
                  ["LEVEL", "level", 0, 1, 0.01],
                  ["PAN", "pan", -1, 1, 0.01],
                ] as const
              ).map(([label, key, min, max, step]) => (
                <Knob
                  key={key}
                  label={label}
                  midiTarget={{ id: track.id, param: `synth:osc:${i}:${key}` }}
                  min={min}
                  max={max}
                  step={step}
                  value={(osc[key] as number | undefined) ?? 0}
                  onChange={(v) =>
                    set({ oscillators: patch.oscillators.map((o, j) => (j === i ? { ...o, [key]: v } : o)) })
                  }
                />
              ))}
              <label className="flex w-16 flex-col items-center gap-1">
                <span className="label-xs text-[9px]">SYNC</span>
                <Switch
                  checked={Boolean(osc.sync)}
                  onCheckedChange={(v) =>
                    set({ oscillators: patch.oscillators.map((o, j) => (j === i ? { ...o, sync: v } : o)) })
                  }
                />
              </label>
            </div>
          ))}
          <div className="panel p-3">
            <span className="label-xs">Oscillator mix</span>
            <div className="mt-2 grid gap-2 sm:grid-cols-4">
              {patch.oscillators.map((o, i) => (
                <Knob
                  key={i}
                  label={`OSC ${i + 1}`}
                  value={o.level}
                  min={0}
                  max={1}
                  step={0.01}
                  midiTarget={{ id: track.id, param: `synth:osc:${i}:level` }}
                  onChange={(v) =>
                    set({ oscillators: patch.oscillators.map((x, j) => (j === i ? { ...x, level: v } : x)) })
                  }
                />
              ))}
              <Knob
                label="NOISE"
                value={patch.noise}
                min={0}
                max={1}
                step={0.01}
                midiTarget={{ id: track.id, param: "synth:noise" }}
                onChange={(v) => set({ noise: v })}
              />
            </div>
          </div>
        </TabsContent>

        <TabsContent value="filter" className="pt-3">
          <div className="panel flex flex-wrap items-center gap-4 p-3">
            <Select value={patch.filterType} onValueChange={(v) => set({ filterType: v as BiquadFilterType })}>
              <SelectTrigger className="w-36">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {["lowpass", "highpass", "bandpass", "notch"].map((f) => (
                  <SelectItem key={f} value={f}>
                    {f}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Knob label="CUTOFF" midiTarget={{ id: track.id, param: "synth:cutoff" }} min={40} max={16000} step={10} value={patch.cutoff} onChange={(v) => set({ cutoff: v })} />
            <Knob label="RES" midiTarget={{ id: track.id, param: "synth:resonance" }} min={0} max={28} step={0.5} value={patch.resonance} onChange={(v) => set({ resonance: v })} />
            <Knob label="DRIVE" midiTarget={{ id: track.id, param: "synth:drive" }} value={patch.drive} onChange={(v) => set({ drive: v })} />
            <Knob
              label="KEY TRK"
              midiTarget={{ id: track.id, param: "synth:keyTracking" }}
              min={0}
              max={1}
              value={patch.keyTracking ?? 0}
              onChange={(v) => set({ keyTracking: v })}
            />
            <Knob label="GLIDE" midiTarget={{ id: track.id, param: "synth:glide" }} min={0} max={0.5} value={patch.glide} onChange={(v) => set({ glide: v })} />
            <Select
              value={patch.glideMode ?? "always"}
              onValueChange={(v) => set({ glideMode: v as "always" | "legato" })}
            >
              <SelectTrigger className="w-32">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="always">glide always</SelectItem>
                <SelectItem value="legato">glide legato</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="panel mt-3 flex flex-wrap items-center gap-4 p-3">
            <div className="flex items-center gap-2">
              <Switch
                checked={Boolean(patch.filter2?.on)}
                onCheckedChange={(v) => set({ filter2: { ...f2, on: v } })}
              />
              <span className="font-display text-xs font-semibold">FILTER 2</span>
            </div>
            <Select value={f2.type} onValueChange={(v) => set({ filter2: { ...f2, type: v as BiquadFilterType } })}>
              <SelectTrigger className="w-36">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {["lowpass", "highpass", "bandpass", "notch", "peaking"].map((t) => (
                  <SelectItem key={t} value={t}>
                    {t}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Knob label="CUTOFF" midiTarget={{ id: track.id, param: "synth:filter2:cutoff" }} min={40} max={16000} step={10} value={f2.cutoff} onChange={(v) => set({ filter2: { ...f2, cutoff: v } })} />
            <Knob label="RES" midiTarget={{ id: track.id, param: "synth:filter2:resonance" }} min={0} max={28} step={0.5} value={f2.resonance} onChange={(v) => set({ filter2: { ...f2, resonance: v } })} />
            <Select
              value={f2.routing}
              onValueChange={(v) => set({ filter2: { ...f2, routing: v as "series" | "parallel" } })}
            >
              <SelectTrigger className="w-32">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="series">series</SelectItem>
                <SelectItem value="parallel">parallel</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </TabsContent>

        <TabsContent value="env" className="grid gap-3 pt-3 md:grid-cols-2">
          <div className="panel space-y-2 p-3">
            <span className="label-xs">Amp envelope</span>
            <EnvelopeGraph env={patch.amp} />
            <div className="flex gap-2">
              {(["attack", "decay", "sustain", "release"] as const).map((k) => (
                <Knob
                  key={k}
                  label={k.slice(0, 3).toUpperCase()}
                  midiTarget={{ id: track.id, param: `synth:amp:${k}` }}
                  min={0}
                  max={k === "sustain" ? 1 : 3}
                  value={patch.amp[k]}
                  onChange={(v) => set({ amp: { ...patch.amp, [k]: v } })}
                />
              ))}
            </div>
          </div>
          <div className="panel space-y-2 p-3">
            <span className="label-xs">Filter envelope</span>
            <EnvelopeGraph env={patch.filterEnv} />
            <div className="flex flex-wrap gap-2">
              {(["attack", "decay", "sustain", "release"] as const).map((k) => (
                <Knob
                  key={k}
                  label={k.slice(0, 3).toUpperCase()}
                  midiTarget={{ id: track.id, param: `synth:filterEnv:${k}` }}
                  min={0}
                  max={k === "sustain" ? 1 : 3}
                  value={patch.filterEnv[k]}
                  onChange={(v) => set({ filterEnv: { ...patch.filterEnv, [k]: v } })}
                />
              ))}
              <Knob
                label="AMOUNT"
                midiTarget={{ id: track.id, param: "synth:filterEnv:amount" }}
                min={-6000}
                max={6000}
                step={50}
                value={patch.filterEnv.amount}
                onChange={(v) => set({ filterEnv: { ...patch.filterEnv, amount: v } })}
              />
            </div>
          </div>
          <div className="panel space-y-2 p-3">
            <span className="label-xs">Mod envelope — route it in the Mod Matrix</span>
            <EnvelopeGraph env={modEnv} />
            <div className="flex gap-2">
              {(["attack", "decay", "sustain", "release"] as const).map((k) => (
                <Knob
                  key={k}
                  label={k.slice(0, 3).toUpperCase()}
                  midiTarget={{ id: track.id, param: `synth:modEnv:${k}` }}
                  min={0}
                  max={k === "sustain" ? 1 : 3}
                  value={modEnv[k]}
                  onChange={(v) => set({ modEnv: { ...modEnv, [k]: v } })}
                />
              ))}
            </div>
          </div>
        </TabsContent>

        <TabsContent value="mod" className="grid gap-3 pt-3 md:grid-cols-2">
          {patch.lfos.map((lfo, i) => (
            <div key={i} className="panel flex flex-wrap items-center gap-3 p-3">
              <div className="flex items-center gap-2">
                <Switch
                  checked={lfo.on}
                  onCheckedChange={(v) => set({ lfos: patch.lfos.map((l, j) => (j === i ? { ...l, on: v } : l)) })}
                />
                <span className="font-display text-xs font-semibold">LFO {i + 1}</span>
              </div>
              <Select
                value={lfo.destination}
                onValueChange={(v) =>
                  set({ lfos: patch.lfos.map((l, j) => (j === i ? { ...l, destination: v as never } : l)) })
                }
              >
                <SelectTrigger className="w-28">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {["pitch", "filter", "volume", "pan", "wavetable"].map((d) => (
                    <SelectItem key={d} value={d}>
                      {d}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Knob
                label="RATE"
                midiTarget={{ id: track.id, param: `synth:lfo:${i}:rate` }}
                min={0.05}
                max={20}
                step={0.05}
                value={lfo.rate}
                onChange={(v) => set({ lfos: patch.lfos.map((l, j) => (j === i ? { ...l, rate: v } : l)) })}
              />
              <Knob
                label="AMOUNT"
                midiTarget={{ id: track.id, param: `synth:lfo:${i}:amount` }}
                value={lfo.amount}
                onChange={(v) => set({ lfos: patch.lfos.map((l, j) => (j === i ? { ...l, amount: v } : l)) })}
              />
              <Select
                value={lfo.wave}
                onValueChange={(v) =>
                  set({ lfos: patch.lfos.map((l, j) => (j === i ? { ...l, wave: v as LfoWave } : l)) })
                }
              >
                <SelectTrigger className="w-28">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {(["sine", "triangle", "sawtooth", "square"] as LfoWave[]).map((w) => (
                    <SelectItem key={w} value={w}>
                      {w}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <label className="flex items-center gap-2">
                <span className="label-xs">SYNC</span>
                <Switch
                  checked={Boolean(lfo.sync)}
                  onCheckedChange={(v) => set({ lfos: patch.lfos.map((l, j) => (j === i ? { ...l, sync: v } : l)) })}
                />
              </label>
            </div>
          ))}
          <div className="panel flex flex-wrap items-center gap-3 p-3">
            <span className="label-xs w-full">Unison</span>
            <Knob
              label="VOICES"
              midiTarget={{ id: track.id, param: "synth:unison:voices" }}
              min={1}
              max={7}
              step={1}
              value={patch.unison.voices}
              onChange={(v) => set({ unison: { ...patch.unison, voices: Math.round(v) } })}
            />
            <Knob
              label="DETUNE"
              midiTarget={{ id: track.id, param: "synth:unison:detune" }}
              min={0}
              max={60}
              step={1}
              value={patch.unison.detune}
              onChange={(v) => set({ unison: { ...patch.unison, detune: v } })}
            />
            <Knob
              label="WIDTH"
              midiTarget={{ id: track.id, param: "synth:unison:width" }}
              value={patch.unison.width}
              onChange={(v) => set({ unison: { ...patch.unison, width: v } })}
            />
          </div>
        </TabsContent>

        <TabsContent value="matrix" className="space-y-3 pt-3">
          <div className="panel flex flex-wrap items-center gap-4 p-3">
            <span className="label-xs w-full">Macros — assign them below, then perform with them</span>
            {[0, 1, 2, 3].map((i) => (
              <Knob
                key={i}
                label={`MACRO ${i + 1}`}
                midiTarget={{ id: track.id, param: `synth:macro:${i}` }}
                value={macros[i] ?? 0}
                onChange={(v) => set({ macros: macros.map((m, j) => (j === i ? v : m)) })}
              />
            ))}
          </div>
          <div className="panel space-y-2 p-3">
            <div className="flex items-center justify-between">
              <span className="label-xs">Modulation matrix</span>
              <Button
                size="sm"
                variant="secondary"
                onClick={() =>
                  set({
                    modMatrix: [...matrix, { id: uid(), on: true, source: "lfo1", dest: "cutoff", amount: 0.3 }],
                  })
                }
              >
                <Plus className="size-3.5" /> ADD ROUTE
              </Button>
            </div>
            {matrix.length === 0 && (
              <p className="text-xs text-muted-foreground">
                No routes yet. Add one to make an LFO, the mod envelope, velocity, key position or a macro move part of
                the sound.
              </p>
            )}
            {matrix.map((r) => (
              <div key={r.id} className="flex flex-wrap items-center gap-2 rounded-md border border-border p-2">
                <Switch
                  checked={r.on}
                  onCheckedChange={(v) =>
                    set({ modMatrix: matrix.map((x) => (x.id === r.id ? { ...x, on: v } : x)) })
                  }
                />
                <Select
                  value={r.source}
                  onValueChange={(v) =>
                    set({ modMatrix: matrix.map((x) => (x.id === r.id ? { ...x, source: v as ModSource } : x)) })
                  }
                >
                  <SelectTrigger className="w-32">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {MOD_SOURCES.map((sc) => (
                      <SelectItem key={sc} value={sc}>
                        {sc}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <span className="font-mono text-[10px] text-muted-foreground">→</span>
                <Select
                  value={r.dest}
                  onValueChange={(v) =>
                    set({ modMatrix: matrix.map((x) => (x.id === r.id ? { ...x, dest: v as ModDest } : x)) })
                  }
                >
                  <SelectTrigger className="w-36">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {MOD_DESTS.map((d) => (
                      <SelectItem key={d} value={d}>
                        {d}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <div className="w-40">
                  <Slider
                    min={-1}
                    max={1}
                    step={0.01}
                    value={[r.amount]}
                    onValueChange={([v = 0]) =>
                      set({ modMatrix: matrix.map((x) => (x.id === r.id ? { ...x, amount: v } : x)) })
                    }
                  />
                </div>
                <span className="w-12 font-mono text-[10px] text-primary">{r.amount.toFixed(2)}</span>
                {FIXED_ONLY.includes(r.dest) && !["velocity", "keytrack", "random", "macro1", "macro2", "macro3", "macro4"].includes(r.source) && (
                  <span className="font-mono text-[9px] text-muted-foreground">set per note, not moving</span>
                )}
                <Button
                  size="icon"
                  variant="ghost"
                  className="ml-auto size-7"
                  onClick={() => set({ modMatrix: matrix.filter((x) => x.id !== r.id) })}
                  aria-label="Remove route"
                >
                  <Trash2 className="size-3.5" />
                </Button>
              </div>
            ))}
            <p className="text-[10px] text-muted-foreground">
              Pitch, cutoff, filter 2, resonance, level and pan follow their source continuously. Pulse width, wavetable
              morph, FM and unison detune are set once at the start of each note, so use velocity, key position, random
              or a macro for those.
            </p>
          </div>
        </TabsContent>

        <TabsContent value="voice" className="pt-3">
          <div className="panel flex flex-wrap items-center gap-4 p-3">
            <Select value={patch.voiceMode ?? "poly"} onValueChange={(v) => set({ voiceMode: v as "poly" | "mono" | "legato" })}>
              <SelectTrigger className="w-36">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="poly">polyphonic</SelectItem>
                <SelectItem value="mono">mono</SelectItem>
                <SelectItem value="legato">legato</SelectItem>
              </SelectContent>
            </Select>
            <Knob label="GLIDE" midiTarget={{ id: track.id, param: "synth:glide" }} min={0} max={0.5} value={patch.glide} onChange={(v) => set({ glide: v })} />
            <Knob
              label="VEL SENS"
              midiTarget={{ id: track.id, param: "synth:velocitySens" }}
              value={patch.velocitySens ?? 1}
              onChange={(v) => set({ velocitySens: v })}
            />
            <Knob label="ANALOG" midiTarget={{ id: track.id, param: "synth:analog" }} value={patch.analog ?? 0} onChange={(v) => set({ analog: v })} />
            <Knob
              label="VOICES"
              min={1}
              max={7}
              step={1}
              value={patch.unison.voices}
              onChange={(v) => set({ unison: { ...patch.unison, voices: Math.round(v) } })}
            />
            <p className="w-full text-[10px] text-muted-foreground">
              Mono and legato keep one note sounding at a time so glide slides between them. Analog adds a small random
              tuning and filter shift to every note, like an old hardware synth.
            </p>
          </div>
        </TabsContent>

        <TabsContent value="fx" className="pt-3">
          <div className="panel flex flex-wrap gap-3 p-3">
            {(
              [
                ["DIST", "distortion"],
                ["SAT", "saturation"],
                ["CHORUS", "chorus"],
                ["FLANGER", "flanger"],
                ["PHASER", "phaser"],
                ["DELAY", "delay"],
                ["FEEDBK", "delayFeedback"],
                ["REVERB", "reverb"],
                ["CRUSH", "bitcrush"],
              ] as const
            ).map(([label, key]) => (
              <Knob
                key={key}
                label={label}
                midiTarget={{ id: track.id, param: `synth:fx:${key}` }}
                value={patch.fx[key] ?? 0}
                onChange={(v) => set({ fx: { ...patch.fx, [key]: v } })}
              />
            ))}
          </div>
        </TabsContent>

        <TabsContent value="arp" className="pt-3">
          <div className="panel flex flex-wrap items-center gap-4 p-3">
            <div className="flex items-center gap-2">
              <Switch checked={patch.arp.on} onCheckedChange={(v) => set({ arp: { ...patch.arp, on: v } })} />
              <span className="font-display text-xs font-semibold">ARPEGGIATOR</span>
            </div>
            <Select
              value={patch.arp.direction}
              onValueChange={(v) => set({ arp: { ...patch.arp, direction: v as never } })}
            >
              <SelectTrigger className="w-32">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {["up", "down", "updown", "random", "alternate"].map((d) => (
                  <SelectItem key={d} value={d}>
                    {d}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Knob
              label="OCTAVES"
              min={1}
              max={4}
              step={1}
              value={patch.arp.octaves}
              onChange={(v) => set({ arp: { ...patch.arp, octaves: Math.round(v) } })}
            />
            <Knob label="GATE" value={patch.arp.gate} onChange={(v) => set({ arp: { ...patch.arp, gate: v } })} />
            <Knob
              label="RATE"
              min={0.5}
              max={4}
              step={0.5}
              value={patch.arp.rate}
              onChange={(v) => set({ arp: { ...patch.arp, rate: v } })}
            />
            <Knob
              label="SWING"
              value={patch.arp.swing ?? 0}
              onChange={(v) => set({ arp: { ...patch.arp, swing: v } })}
            />
            <label className="flex items-center gap-2">
              <span className="label-xs">TEMPO SYNC</span>
              <Switch
                checked={patch.arp.sync ?? true}
                onCheckedChange={(v) => set({ arp: { ...patch.arp, sync: v } })}
              />
            </label>
          </div>
        </TabsContent>

        <TabsContent value="chords" className="pt-3">
          <ChordScale trackId={track.id} onPlay={(midi) => previewNote(track.id, midi)} />
        </TabsContent>
      </Tabs>
    </div>
  );
}

const NOTE_NAMES = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];
const SCALES: Record<string, number[]> = {
  Major: [0, 2, 4, 5, 7, 9, 11],
  Minor: [0, 2, 3, 5, 7, 8, 10],
  "Harmonic Minor": [0, 2, 3, 5, 7, 8, 11],
  Dorian: [0, 2, 3, 5, 7, 9, 10],
  Phrygian: [0, 1, 3, 5, 7, 8, 10],
  Lydian: [0, 2, 4, 6, 7, 9, 11],
  Mixolydian: [0, 2, 4, 5, 7, 9, 10],
  "Minor Pent": [0, 3, 5, 7, 10],
  Blues: [0, 3, 5, 6, 7, 10],
};
const ROMAN = ["I", "II", "III", "IV", "V", "VI", "VII"];
/** Stacked-thirds chord tones (semitones above the scale root) for a scale degree. */
const QUALITY = (steps: number[], index: number, size: 3 | 4 | 5) => {
  const pick = (n: number) => {
    const deg = index + n;
    return (steps[deg % steps.length] ?? 0) + 12 * Math.floor(deg / steps.length);
  };
  const tones = [pick(0), pick(2), pick(4)];
  if (size >= 4) tones.push(pick(6));
  if (size >= 5) tones.push(pick(8));
  return tones;
};

function chordLabel(intervals: number[]) {
  const rel = intervals.map((t) => t - (intervals[0] ?? 0));
  const third = rel[1];
  const fifth = rel[2];
  const seventh = rel[3];
  let name = third === 3 ? "m" : third === 4 ? "" : "sus";
  if (fifth === 6) name = third === 3 ? "dim" : "b5";
  if (fifth === 8 && third === 4) name = "aug";
  if (seventh !== undefined) name += seventh === 11 ? "maj7" : seventh === 10 ? "7" : seventh === 9 ? "6" : "7";
  return name || "maj";
}

function ChordScale({ trackId, onPlay }: { trackId: string; onPlay: (midi: number) => void }) {
  const [root, setRoot] = useState(0);
  const [scaleName, setScaleName] = useState("Minor");
  const [octave, setOctave] = useState(4);
  const [size, setSize] = useState<3 | 4 | 5>(3);
  const [inversion, setInversion] = useState(0);
  const [spread, setSpread] = useState(false);
  const [strum, setStrum] = useState(0);
  const [held, setHeld] = useState<number[]>([]);
  const steps = SCALES[scaleName] ?? SCALES["Minor"]!;
  const base = (octave + 1) * 12 + root;

  const voice = (degree: number) => {
    let tones = QUALITY(steps, degree, size);
    for (let i = 0; i < inversion; i++) {
      const [low, ...rest] = tones;
      tones = [...rest, (low ?? 0) + 12];
    }
    if (spread) tones = tones.map((t, i) => (i % 2 === 1 ? t + 12 : t));
    return tones.map((t) => base + t);
  };

  const playNotes = (notes: number[]) => {
    setHeld(notes);
    notes.forEach((midi, i) => {
      if (strum > 0) window.setTimeout(() => onPlay(midi), i * strum);
      else onPlay(midi);
    });
    window.setTimeout(() => setHeld([]), 300 + strum * notes.length);
  };

  const noteName = (midi: number) => `${NOTE_NAMES[((midi % 12) + 12) % 12]}${Math.floor(midi / 12) - 1}`;
  const scaleNotes = steps.map((s) => base + s).concat(base + 12);

  return (
    <div className="space-y-3">
      <div className="panel flex flex-wrap items-end gap-3 p-3">
        <label className="space-y-1">
          <span className="label-xs">ROOT</span>
          <Select value={String(root)} onValueChange={(v) => setRoot(Number(v))}>
            <SelectTrigger className="h-9 w-20"><SelectValue /></SelectTrigger>
            <SelectContent>
              {NOTE_NAMES.map((n, i) => <SelectItem key={n} value={String(i)}>{n}</SelectItem>)}
            </SelectContent>
          </Select>
        </label>
        <label className="space-y-1">
          <span className="label-xs">SCALE</span>
          <Select value={scaleName} onValueChange={setScaleName}>
            <SelectTrigger className="h-9 w-40"><SelectValue /></SelectTrigger>
            <SelectContent>
              {Object.keys(SCALES).map((n) => <SelectItem key={n} value={n}>{n}</SelectItem>)}
            </SelectContent>
          </Select>
        </label>
        <label className="space-y-1">
          <span className="label-xs">CHORD SIZE</span>
          <Select value={String(size)} onValueChange={(v) => setSize(Number(v) as 3 | 4 | 5)}>
            <SelectTrigger className="h-9 w-32"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="3">Triad</SelectItem>
              <SelectItem value="4">7th</SelectItem>
              <SelectItem value="5">9th</SelectItem>
            </SelectContent>
          </Select>
        </label>
        <label className="space-y-1">
          <span className="label-xs">INVERSION</span>
          <Select value={String(inversion)} onValueChange={(v) => setInversion(Number(v))}>
            <SelectTrigger className="h-9 w-28"><SelectValue /></SelectTrigger>
            <SelectContent>
              {[0, 1, 2, 3].map((i) => <SelectItem key={i} value={String(i)}>{i === 0 ? "Root" : `${i}${i === 1 ? "st" : i === 2 ? "nd" : "rd"}`}</SelectItem>)}
            </SelectContent>
          </Select>
        </label>
        <div className="flex items-center gap-2">
          <span className="label-xs">OCTAVE</span>
          <Slider className="w-28" value={[octave]} min={1} max={7} step={1} onValueChange={([v = 4]) => setOctave(v)} />
          <span className="font-mono text-xs text-primary">C{octave}</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="label-xs">STRUM</span>
          <Slider className="w-28" value={[strum]} min={0} max={120} step={5} onValueChange={([v = 0]) => setStrum(v)} />
          <span className="font-mono text-xs text-primary">{strum}ms</span>
        </div>
        <label className="flex items-center gap-2">
          <span className="label-xs">SPREAD</span>
          <Switch checked={spread} onCheckedChange={setSpread} />
        </label>
      </div>

      <div className="panel space-y-2 p-3">
        <span className="label-xs">CHORDS IN {NOTE_NAMES[root]} {scaleName.toUpperCase()}</span>
        <div className="flex flex-wrap gap-2">
          {steps.map((_, degree) => {
            const notes = voice(degree);
            const rel = QUALITY(steps, degree, size);
            const rootName = NOTE_NAMES[((base + (steps[degree] ?? 0)) % 12 + 12) % 12];
            const active = held.length > 0 && held[0] === notes[0];
            return (
              <Button
                key={degree}
                variant={active ? "default" : "secondary"}
                className="h-14 min-w-20 flex-col gap-0.5 px-3"
                onPointerDown={() => playNotes(notes)}
              >
                <span className="font-display text-sm font-semibold">{rootName}{chordLabel(rel)}</span>
                <span className="font-mono text-[10px] opacity-70">{ROMAN[degree] ?? degree + 1}</span>
              </Button>
            );
          })}
        </div>
      </div>

      <div className="panel space-y-2 p-3">
        <span className="label-xs">SCALE NOTES</span>
        <div className="flex flex-wrap gap-1.5">
          {scaleNotes.map((midi) => (
            <Button
              key={midi}
              size="sm"
              variant={held.includes(midi) ? "default" : "outline"}
              className="h-10 min-w-12 font-mono text-[11px]"
              onPointerDown={() => playNotes([midi])}
            >
              {noteName(midi)}
            </Button>
          ))}
        </div>
        <p className="label-xs">Plays through this synth patch on track {trackId.slice(0, 4)} · chord size, inversion, spread and strum shape the voicing.</p>
      </div>
    </div>
  );
}
