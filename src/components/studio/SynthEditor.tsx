import { useState } from "react";
import { SkinControls, skinBackground, useImageDrop } from "@/components/studio/SkinControls";
import { useSkin } from "@/lib/synclab/skins";
import { Piano, Plus, Save, Trash2 } from "lucide-react";
import { Keyboard } from "./Keyboard";
import { TouchSynth } from "./TouchSynth";
import { SynthXYPad } from "./SynthXYPad";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectGroup, SelectItem, SelectLabel, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import { Knob } from "./Knob";
import { useStudio } from "@/lib/synclab/store";
import { SYNTH_PRESETS, defaultPatch, applyPreset } from "@/lib/synclab/presets";
import { initModularPatch } from "@/lib/synclab/modular";
import type { EnvelopeParams, LfoWave, ModDest, ModSource, OscWave, SynthPatch, Track } from "@/lib/synclab/types";
import { uid } from "@/lib/synclab/presets";
import { toast } from "sonner";
import { MidiLearnStrip } from "./MidiLearn";
import { PitchWheels } from "./PitchWheels";
import { ModularSynth } from "./ModularSynth";
import { AcidSequencer } from "./AcidSequencer";
import { PresetNavigator } from "./PresetNavigator";
import { HardwareBypass } from "./HardwareBypass";

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
  const x = (t: number) => 4 + (t / total) * 92;
  const a = x(env.attack);
  const d = a + x(env.decay);
  const s = d + x(0.6);
  const r = s + x(env.release);
  const sustainY = 42 - env.sustain * 34;
  const pts: [number, number][] = [[4, 42], [a, 6], [d, sustainY], [s, sustainY], [r, 42]];
  return (
    <div className="env-display" aria-hidden="true">
      <svg viewBox="0 0 100 46" className="h-24 w-full">
        {[25, 50, 75].map((g) => (
          <line key={g} x1={g} y1="0" x2={g} y2="46" className="env-grid-line" />
        ))}
        <polyline points={pts.map((p) => p.join(",")).join(" ")} fill="none" stroke="var(--neon)" strokeWidth="1.6" />
        {pts.map(([px, py], i) => (
          <circle key={i} cx={px} cy={py} r="2.1" className="env-dot" />
        ))}
      </svg>
      <div className="env-marks"><span>A</span><span>D</span><span>S</span><span>R</span></div>
    </div>
  );
}

export function SynthEditor({ track }: { track: Track }) {
  const { tracks, select } = useStudio();
  const synthTracks = tracks.filter((item) => (item.kind === "instrument" || item.kind === "midi") && item.patch);

  return (
    <Tabs value={track.id} onValueChange={select} className="min-w-0">
      <TabsList aria-label="Timeline synths" className="flex h-auto w-full flex-wrap justify-start gap-1 rounded-md">
        {synthTracks.map((item) => (
          <TabsTrigger key={item.id} value={item.id} title={item.name} className="min-h-10 min-w-0 max-w-full gap-2">
            <Piano className="size-4 shrink-0" aria-hidden="true" />
            <span className="truncate">{item.name}</span>
          </TabsTrigger>
        ))}
      </TabsList>
      <TabsContent value={track.id} className="min-w-0">
        <SynthTrackEditor key={track.id} track={track} />
      </TabsContent>
    </Tabs>
  );
}

function SynthTrackEditor({ track }: { track: Track }) {
  const { updatePatch, savePreset, loadPreset, userPresets, previewNote } = useStudio();
  const [presetName, setPresetName] = useState("");
  const [showKeyboard, setShowKeyboard] = useState(true);
  const patch = track.patch as SynthPatch;
  if (!patch) return null;
  const set = (p: Partial<SynthPatch>) => updatePatch(track.id, p);
  const f2 = patch.filter2 ?? { on: false, type: "highpass" as BiquadFilterType, cutoff: 200, resonance: 1, routing: "series" as const };
  const modEnv = patch.modEnv ?? { attack: 0.01, decay: 0.3, sustain: 0.4, release: 0.3 };
  const macros = patch.macros ?? [0, 0, 0, 0];
  const matrix = patch.modMatrix ?? [];
  const synthStyle = patch.modular ? "modular" : patch.name.startsWith("TD-3") || /ACID/i.test(track.name) ? "acid" : patch.name.startsWith("Poly Synth") || /POLY/i.test(track.name) ? "poly" : "spec4";
  const presetGroups = (() => {
    const all = [
      ...SYNTH_PRESETS.filter((x) => presetMatchesSynth(x.category, synthStyle)).map((x) => ({ name: x.name, category: x.category })),
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

  const selectPreset = (name: string) => {
    const selectedPatch = userPresets.find(p => p.name === name) ?? applyPreset(name);
    loadPreset(track.id, name);
    previewNote(track.id, 60, 0.75, false, selectedPatch);
  };
  const skin = useSkin("synth");
  const drop = useImageDrop("synth");
  return (
    <div className="studio-wallpaper hardware-device synth-hardware space-y-4 rounded-md p-3" data-studio-panel="synth" data-synth-style={synthStyle} style={skinBackground(skin)} {...drop}>
      <div className="synth-badge" aria-hidden>{patch.modular ? "MODULAR TECH SYNTH" : patch.name.startsWith("TD-3") || /ACID/i.test(track.name) ? "ACID BASS · TD-3 STYLE" : patch.name.startsWith("Poly Synth") || /POLY/i.test(track.name) ? "POLY SYNTH · 8 VOICE" : "SPEC 4 · ANALOG MODELING SYNTH"}</div>
      <SkinControls skinKey="synth" image />
      <MidiLearnStrip id={track.id} label={`${track.name} — every knob below also has its own MIDI button`} />
      <div className="synth-preset-deck flex flex-wrap items-center gap-2">
        <HardwareBypass track={track} />
        <PresetNavigator label="synth preset" options={presetGroups.flatMap(g => g.items)} current={patch.name} onSelect={selectPreset}>
        <Select value={patch.name} onValueChange={selectPreset}>
          <SelectTrigger className="synth-preset-window w-72" aria-label="Preset window">
            <span className="synth-preset-tag" aria-hidden>PRESET</span>
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
        </PresetNavigator>
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
        <Button variant="secondary" onClick={() => previewNote(track.id, 60, 0.75, false, patch)}>
          Audition
        </Button>
        <Button variant={showKeyboard ? "secondary" : "outline"} aria-pressed={showKeyboard} onClick={() => setShowKeyboard((value) => !value)}>
          <Piano className="size-4" /> {showKeyboard ? "Hide keyboard" : "Show keyboard"}
        </Button>
        <Button
          variant="outline"
          onClick={() => {
            if (patch.modular) { updatePatch(track.id, { modular: initModularPatch() }); toast.success("Modular patch initialized", { description: "One VCO, filter, envelope and amp patched to the output — build your new patch from here." }); return; }
            updatePatch(track.id, { ...defaultPatch("Init Saw"), modular: undefined });
            toast.success("Synth initialized", { description: "Blank starting patch — shape it into your own sound, then SAVE PRESET." });
          }}
        >
          Initialize
        </Button>
      </div>

      <PitchWheels trackId={track.id} />
      {(patch.name.startsWith("TD-3") || /ACID/i.test(track.name)) && <AcidSequencer track={track} />}
      {patch.modular ? <ModularSynth track={track} /> : (
      <Tabs defaultValue={/^touch synth$/i.test(track.name) ? "touch" : "oscillators"} className="synth-console-tabs min-w-0">
        <TabsList aria-label="Synth features" className="flex h-auto w-full flex-wrap justify-start gap-1">
          <TabsTrigger value="oscillators">Oscillators</TabsTrigger>
          <TabsTrigger value="filters">Filters</TabsTrigger>
          <TabsTrigger value="envelopes">Envelopes</TabsTrigger>
          <TabsTrigger value="lfos">LFOs</TabsTrigger>
          <TabsTrigger value="global">Global</TabsTrigger>
          <TabsTrigger value="matrix">Mod Matrix</TabsTrigger>
          <TabsTrigger value="fx">Effects</TabsTrigger>
          <TabsTrigger value="arp">Arpeggiator</TabsTrigger>
          <TabsTrigger value="chords">Chords / Scale</TabsTrigger>
          <TabsTrigger value="touch">Touch Synth</TabsTrigger>
          <TabsTrigger value="xy">X-Y Pads</TabsTrigger>
        </TabsList>
        <TabsContent value="touch" className="pt-3"><TouchSynth track={track} /></TabsContent>
        <TabsContent value="xy" className="space-y-3 pt-3">
          <div className="grid min-w-0 gap-5 md:grid-cols-2 xl:grid-cols-3">
            <div className="min-w-0 space-y-3">
              <h3 className="label-xs">FILTER</h3>
              <SynthXYPad
                x={{ label: "Cutoff", value: patch.cutoff, min: 40, max: 16000, step: 1, logarithmic: true, unit: "Hz" }}
                y={{ label: "Resonance", value: patch.resonance, min: 0, max: 28, step: 0.5 }}
                onChange={(cutoff, resonance) => set({ cutoff, resonance })}
              />
              <p className="font-mono text-xs text-muted-foreground">CUTOFF {Math.round(patch.cutoff)} Hz · RES {patch.resonance.toFixed(1)}</p>
              <div className="flex gap-2">
                <Knob label="CUTOFF" midiTarget={{ id: track.id, param: "synth:cutoff" }} min={40} max={16000} step={10} value={patch.cutoff} onChange={(v) => set({ cutoff: v })} />
                <Knob label="RES" midiTarget={{ id: track.id, param: "synth:resonance" }} min={0} max={28} step={0.5} value={patch.resonance} onChange={(v) => set({ resonance: v })} />
              </div>
            </div>
            {([
              { title: "SPACE", x: "delay", y: "reverb", xLabel: "Delay", yLabel: "Reverb" },
              { title: "TEXTURE", x: "distortion", y: "chorus", xLabel: "Distortion", yLabel: "Chorus" },
            ] as const).map((pad) => (
              <div key={pad.title} className="min-w-0 space-y-3">
                <h3 className="label-xs">{pad.title}</h3>
                <SynthXYPad
                  x={{ label: pad.xLabel, value: patch.fx[pad.x], min: 0, max: 1, step: 0.01, unit: "%" }}
                  y={{ label: pad.yLabel, value: patch.fx[pad.y], min: 0, max: 1, step: 0.01, unit: "%" }}
                  onChange={(x, y) => set({ fx: { ...patch.fx, [pad.x]: x, [pad.y]: y } })}
                />
                <p className="whitespace-nowrap font-mono text-xs uppercase text-muted-foreground">{pad.xLabel} {Math.round(patch.fx[pad.x] * 100)}% · {pad.yLabel} {Math.round(patch.fx[pad.y] * 100)}%</p>
                <div className="flex gap-2">
                  <Knob label={pad.xLabel.toUpperCase()} midiTarget={{ id: track.id, param: `synth:fx:${pad.x}` }} value={patch.fx[pad.x]} onChange={(v) => set({ fx: { ...patch.fx, [pad.x]: v } })} />
                  <Knob label={pad.yLabel.toUpperCase()} midiTarget={{ id: track.id, param: `synth:fx:${pad.y}` }} value={patch.fx[pad.y]} onChange={(v) => set({ fx: { ...patch.fx, [pad.y]: v } })} />
                </div>
              </div>
            ))}
          </div>
        </TabsContent>
        <TabsContent value="oscillators" className="pt-3">
        {/* Oscillators + noise */}
        <div className="grid min-w-0 gap-3 lg:grid-cols-2">
          {patch.oscillators.map((osc, i) => (
            <div key={i} className="synth-osc-module rounded-[3px] border border-border bg-surface/80">
              <div className="flex flex-wrap items-center gap-2 border-b border-border px-2 py-1">
                <span className={`size-1.5 rounded-full ${osc.on ? "bg-primary" : "bg-muted-foreground/40"}`} />
                <span className="font-mono text-[10px] font-semibold uppercase tracking-widest">Osc {i + 1}</span>
                <div className="ml-auto flex gap-0.5">
                  {WAVES.map((w) => (
                    <button
                      key={w}
                      title={w}
                      onClick={() => set({ oscillators: patch.oscillators.map((o, j) => (j === i ? { ...o, wave: w } : o)) })}
                      className={`rounded-[2px] border px-1.5 py-0.5 font-mono text-[8px] uppercase ${osc.wave === w ? "border-primary bg-primary/20 text-primary" : "border-border text-muted-foreground hover:text-foreground"}`}
                    >
                      {w === "sawtooth" ? "saw" : w === "triangle" ? "tri" : w === "wavetable" ? "wt" : w.slice(0, 4)}
                    </button>
                  ))}
                </div>
                <Switch
                  checked={osc.on}
                  onCheckedChange={(v) => set({ oscillators: patch.oscillators.map((o, j) => (j === i ? { ...o, on: v } : o)) })}
                  aria-label={`Oscillator ${i + 1} on`}
                />
              </div>
              <div className="flex flex-wrap items-end gap-2 p-2">
                <Knob label="OCT" midiTarget={{ id: track.id, param: `synth:osc:${i}:octave` }} min={-3} max={3} step={1} value={osc.octave ?? 0} onChange={(v) => set({ oscillators: patch.oscillators.map((o, j) => (j === i ? { ...o, octave: v } : o)) })} />
                <Knob label="SEMI" midiTarget={{ id: track.id, param: `synth:osc:${i}:semitone` }} min={-12} max={12} step={1} value={osc.semitone ?? 0} onChange={(v) => set({ oscillators: patch.oscillators.map((o, j) => (j === i ? { ...o, semitone: v } : o)) })} />
                <Knob label="FINE" midiTarget={{ id: track.id, param: `synth:osc:${i}:fine` }} min={-50} max={50} step={1} value={osc.fine ?? 0} onChange={(v) => set({ oscillators: patch.oscillators.map((o, j) => (j === i ? { ...o, fine: v } : o)) })} />
                <Knob label="DETUNE" midiTarget={{ id: track.id, param: `synth:osc:${i}:detune` }} min={-50} max={50} step={1} value={osc.detune ?? 0} onChange={(v) => set({ oscillators: patch.oscillators.map((o, j) => (j === i ? { ...o, detune: v } : o)) })} />
                <Knob label="PHASE" midiTarget={{ id: track.id, param: `synth:osc:${i}:phase` }} value={osc.phase ?? 0} onChange={(v) => set({ oscillators: patch.oscillators.map((o, j) => (j === i ? { ...o, phase: v } : o)) })} />
                <Knob label="LEVEL" midiTarget={{ id: track.id, param: `synth:osc:${i}:level` }} value={osc.level} onChange={(v) => set({ oscillators: patch.oscillators.map((o, j) => (j === i ? { ...o, level: v } : o)) })} />
                <Knob label="PAN" midiTarget={{ id: track.id, param: `synth:osc:${i}:pan` }} min={-1} max={1} value={osc.pan ?? 0} onChange={(v) => set({ oscillators: patch.oscillators.map((o, j) => (j === i ? { ...o, pan: v } : o)) })} />
                <Knob label="PW" midiTarget={{ id: track.id, param: `synth:osc:${i}:pulseWidth` }} min={0.05} max={0.95} value={osc.pulseWidth ?? 0.5} onChange={(v) => set({ oscillators: patch.oscillators.map((o, j) => (j === i ? { ...o, pulseWidth: v } : o)) })} />
                <label className="flex flex-col items-center gap-1">
                  <span className="label-xs text-[9px]">SYNC</span>
                  <Switch
                    checked={Boolean(osc.sync)}
                    onCheckedChange={(v) => set({ oscillators: patch.oscillators.map((o, j) => (j === i ? { ...o, sync: v } : o)) })}
                  />
                </label>
              </div>
            </div>
          ))}
          <div className="rounded-[3px] border border-border bg-surface/80">
            <div className="flex items-center gap-2 border-b border-border px-2 py-1">
              <span className={`size-1.5 rounded-full ${patch.noise > 0 ? "bg-primary" : "bg-muted-foreground/40"}`} />
              <span className="font-mono text-[10px] font-semibold uppercase tracking-widest">Noise</span>
            </div>
            <div className="p-2">
              <Knob label="LEVEL" midiTarget={{ id: track.id, param: "synth:noise" }} value={patch.noise} onChange={(v) => set({ noise: v })} />
            </div>
          </div>
        </div>
        </TabsContent>

        <TabsContent value="filters" className="space-y-3 pt-3">
          <div className="rounded-[3px] border border-border bg-surface/80">
            <div className="flex items-center gap-2 border-b border-border px-2 py-1">
              <span className="size-1.5 rounded-full bg-primary" />
              <span className="font-mono text-[10px] font-semibold uppercase tracking-widest">Filter</span>
              <Select value={patch.filterType} onValueChange={(v) => set({ filterType: v as BiquadFilterType })}>
                <SelectTrigger className="ml-auto h-6 w-28 text-[10px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {["lowpass", "highpass", "bandpass", "notch"].map((f) => (
                    <SelectItem key={f} value={f}>{f}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex flex-wrap items-end gap-2 p-2">
              <Knob label="CUTOFF" midiTarget={{ id: track.id, param: "synth:cutoff" }} min={40} max={16000} step={10} value={patch.cutoff} onChange={(v) => set({ cutoff: v })} />
              <Knob label="RES" midiTarget={{ id: track.id, param: "synth:resonance" }} min={0} max={28} step={0.5} value={patch.resonance} onChange={(v) => set({ resonance: v })} />
              <Knob label="DRIVE" midiTarget={{ id: track.id, param: "synth:drive" }} value={patch.drive} onChange={(v) => set({ drive: v })} />
              <Knob label="KEY" midiTarget={{ id: track.id, param: "synth:keyTracking" }} value={patch.keyTracking ?? 0} onChange={(v) => set({ keyTracking: v })} />
            </div>
            <div className="flex flex-wrap items-center gap-2 border-t border-border px-2 py-1.5">
              <Switch checked={Boolean(patch.filter2?.on)} onCheckedChange={(v) => set({ filter2: { ...f2, on: v } })} aria-label="Filter 2 on" />
              <span className="font-mono text-[9px] uppercase tracking-widest text-muted-foreground">Filter 2</span>
              <Select value={f2.type} onValueChange={(v) => set({ filter2: { ...f2, type: v as BiquadFilterType } })}>
                <SelectTrigger className="h-6 w-24 text-[10px]"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {["lowpass", "highpass", "bandpass", "notch", "peaking"].map((t) => (
                    <SelectItem key={t} value={t}>{t}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={f2.routing} onValueChange={(v) => set({ filter2: { ...f2, routing: v as "series" | "parallel" } })}>
                <SelectTrigger className="h-6 w-24 text-[10px]"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="series">series</SelectItem>
                  <SelectItem value="parallel">parallel</SelectItem>
                </SelectContent>
              </Select>
              <Knob label="CUT" midiTarget={{ id: track.id, param: "synth:filter2:cutoff" }} min={40} max={16000} step={10} value={f2.cutoff} onChange={(v) => set({ filter2: { ...f2, cutoff: v } })} />
              <Knob label="RES" midiTarget={{ id: track.id, param: "synth:filter2:resonance" }} min={0} max={28} step={0.5} value={f2.resonance} onChange={(v) => set({ filter2: { ...f2, resonance: v } })} />
            </div>
          </div>
        </TabsContent>
        <TabsContent value="lfos" className="pt-3">
          <div className="grid min-w-0 gap-3 lg:grid-cols-2">
          {patch.lfos.map((lfo, i) => (
            <div key={i} className="rounded-[3px] border border-border bg-surface/80">
              <div className="flex items-center gap-2 border-b border-border px-2 py-1">
                <span className={`size-1.5 rounded-full ${lfo.on ? "bg-primary" : "bg-muted-foreground/40"}`} />
                <span className="font-mono text-[10px] font-semibold uppercase tracking-widest">LFO {i + 1}</span>
                <div className="ml-auto flex gap-0.5">
                  {(["sine", "triangle", "sawtooth", "square"] as LfoWave[]).map((w) => (
                    <button
                      key={w}
                      title={w}
                      onClick={() => set({ lfos: patch.lfos.map((l, j) => (j === i ? { ...l, wave: w } : l)) })}
                      className={`rounded-[2px] border px-1.5 py-0.5 font-mono text-[8px] uppercase ${lfo.wave === w ? "border-primary bg-primary/20 text-primary" : "border-border text-muted-foreground hover:text-foreground"}`}
                    >
                      {w === "triangle" ? "tri" : w === "sawtooth" ? "saw" : w.slice(0, 4)}
                    </button>
                  ))}
                </div>
                <Switch checked={lfo.on} onCheckedChange={(v) => set({ lfos: patch.lfos.map((l, j) => (j === i ? { ...l, on: v } : l)) })} aria-label={`LFO ${i + 1} on`} />
              </div>
              <div className="flex flex-wrap items-end gap-2 p-2">
                <Knob label="RATE" midiTarget={{ id: track.id, param: `synth:lfo:${i}:rate` }} min={0.05} max={20} step={0.05} value={lfo.rate} onChange={(v) => set({ lfos: patch.lfos.map((l, j) => (j === i ? { ...l, rate: v } : l)) })} />
                <Knob label="AMOUNT" midiTarget={{ id: track.id, param: `synth:lfo:${i}:amount` }} value={lfo.amount} onChange={(v) => set({ lfos: patch.lfos.map((l, j) => (j === i ? { ...l, amount: v } : l)) })} />
                <Select value={lfo.destination === "wavetable" ? "pitch" : lfo.destination} onValueChange={(v) => set({ lfos: patch.lfos.map((l, j) => (j === i ? { ...l, destination: v as never } : l)) })}>
                  <SelectTrigger className="h-6 w-24 text-[10px]"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {["pitch", "filter", "volume", "pan"].map((d) => (
                      <SelectItem key={d} value={d}>{d}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <label className="flex items-center gap-1.5">
                  <span className="label-xs text-[9px]">SYNC</span>
                  <Switch checked={Boolean(lfo.sync)} onCheckedChange={(v) => set({ lfos: patch.lfos.map((l, j) => (j === i ? { ...l, sync: v } : l)) })} />
                </label>
              </div>
            </div>
          ))}
        </div>
        </TabsContent>

        {/* Envelope graphs */}
        <TabsContent value="envelopes" className="pt-3">
        <div className="grid min-w-0 gap-3 lg:grid-cols-3">
          <div className="rounded-[3px] border border-border bg-surface/80">
            <div className="border-b border-border px-2 py-1"><span className="font-mono text-[10px] font-semibold uppercase tracking-widest">Amp Env</span></div>
            <div className="space-y-1 p-2">
              <EnvelopeGraph env={patch.amp} />
              <div className="flex flex-wrap gap-2">
                {(["attack", "decay", "sustain", "release"] as const).map((k) => (
                  <Knob key={k} label={k.slice(0, 3).toUpperCase()} midiTarget={{ id: track.id, param: `synth:amp:${k}` }} min={0} max={k === "sustain" ? 1 : 3} value={patch.amp[k]} onChange={(v) => set({ amp: { ...patch.amp, [k]: v } })} />
                ))}
              </div>
            </div>
          </div>
          <div className="rounded-[3px] border border-border bg-surface/80">
            <div className="border-b border-border px-2 py-1"><span className="font-mono text-[10px] font-semibold uppercase tracking-widest">Env 2 · Filter</span></div>
            <div className="space-y-1 p-2">
              <EnvelopeGraph env={patch.filterEnv} />
              <div className="flex flex-wrap gap-2">
                {(["attack", "decay", "sustain", "release"] as const).map((k) => (
                  <Knob key={k} label={k.slice(0, 3).toUpperCase()} midiTarget={{ id: track.id, param: `synth:filterEnv:${k}` }} min={0} max={k === "sustain" ? 1 : 3} value={patch.filterEnv[k]} onChange={(v) => set({ filterEnv: { ...patch.filterEnv, [k]: v } })} />
                ))}
                <Knob label="AMT" midiTarget={{ id: track.id, param: "synth:filterEnv:amount" }} min={-6000} max={6000} step={50} value={patch.filterEnv.amount} onChange={(v) => set({ filterEnv: { ...patch.filterEnv, amount: v } })} />
              </div>
            </div>
          </div>
          <div className="rounded-[3px] border border-border bg-surface/80">
            <div className="border-b border-border px-2 py-1"><span className="font-mono text-[10px] font-semibold uppercase tracking-widest">Env 3 · Mod</span></div>
            <div className="space-y-1 p-2">
              <EnvelopeGraph env={modEnv} />
              <div className="flex flex-wrap gap-2">
                {(["attack", "decay", "sustain", "release"] as const).map((k) => (
                  <Knob key={k} label={k.slice(0, 3).toUpperCase()} midiTarget={{ id: track.id, param: `synth:modEnv:${k}` }} min={0} max={k === "sustain" ? 1 : 3} value={modEnv[k]} onChange={(v) => set({ modEnv: { ...modEnv, [k]: v } })} />
                ))}
              </div>
              <p className="text-[9px] text-muted-foreground">Heard through the Mod Matrix below.</p>
            </div>
          </div>
        </div>
        </TabsContent>

        {/* Global column */}
        <TabsContent value="global" className="pt-3">
        <div className="rounded-[3px] border border-border bg-surface/80">
          <div className="border-b border-border px-2 py-1"><span className="font-mono text-[10px] font-semibold uppercase tracking-widest">Global</span></div>
          <div className="flex flex-wrap items-end gap-3 p-2">
            <div className="flex gap-1">
              {(["poly", "mono", "legato"] as const).map((mode) => (
                <Button
                  key={mode}
                  size="sm"
                  variant={(patch.voiceMode ?? "poly") === mode ? "default" : "ghost"}
                  className="h-6 px-2 text-[10px] capitalize"
                  onClick={() => set({ voiceMode: mode })}
                >
                  {mode}
                </Button>
              ))}
            </div>
            <Knob label="GLIDE" midiTarget={{ id: track.id, param: "synth:glide" }} min={0} max={0.5} value={patch.glide} onChange={(v) => set({ glide: v })} />
            <Select value={patch.glideMode ?? "always"} onValueChange={(v) => set({ glideMode: v as "always" | "legato" })}>
              <SelectTrigger className="h-6 w-24 text-[10px]"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="always">glide always</SelectItem>
                <SelectItem value="legato">glide legato</SelectItem>
              </SelectContent>
            </Select>
            <Knob label="VOICES" midiTarget={{ id: track.id, param: "synth:unison:voices" }} min={1} max={7} step={1} value={patch.unison.voices} onChange={(v) => set({ unison: { ...patch.unison, voices: Math.round(v) } })} />
            <Knob label="DETUNE" midiTarget={{ id: track.id, param: "synth:unison:detune" }} min={0} max={60} step={1} value={patch.unison.detune} onChange={(v) => set({ unison: { ...patch.unison, detune: v } })} />
            <Knob label="WIDTH" midiTarget={{ id: track.id, param: "synth:unison:width" }} value={patch.unison.width} onChange={(v) => set({ unison: { ...patch.unison, width: v } })} />
            <Knob label="VEL SENS" midiTarget={{ id: track.id, param: "synth:velocitySens" }} value={patch.velocitySens ?? 1} onChange={(v) => set({ velocitySens: v })} />
            <Knob label="ANALOG" midiTarget={{ id: track.id, param: "synth:analog" }} value={patch.analog ?? 0} onChange={(v) => set({ analog: v })} />
          </div>
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
                <Knob
                  label="AMOUNT"
                  ariaLabel={`Route ${r.source} to ${r.dest} amount`}
                  layout="inline"
                  size={34}
                  min={-1}
                  max={1}
                  step={0.01}
                  defaultValue={0}
                  value={r.amount}
                  format={(v) => (v > 0 ? `+${v.toFixed(2)}` : v.toFixed(2))}
                  onChange={(v) => set({ modMatrix: matrix.map((x) => (x.id === r.id ? { ...x, amount: v } : x)) })}
                />
                {FIXED_ONLY.includes(r.dest) && !["velocity", "keytrack", "random", "macro1", "macro2", "macro3", "macro4"].includes(r.source) && (
                  <span role="status" className="font-mono text-[9px] text-destructive">no effect: {r.dest} only takes velocity, key, random or a macro</span>
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
      )}
      {showKeyboard && <div className="min-w-0 border-t border-border pt-3" aria-label="Synth keyboard"><Keyboard track={track} skinKey="synth-keyboard" /></div>}
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


/** Each synth's preset window lists only presets made for that instrument. */
export function presetMatchesSynth(category: string, style: string): boolean {
  const c = category.toLowerCase();
  const acid = c === "acid bass" || c === "acid";
  const poly = c === "poly synth";
  const modular = c === "modular tech";
  if (style === "acid") return acid;
  if (style === "poly") return poly;
  if (style === "modular") return modular;
  return !acid && !poly && !modular;
}
