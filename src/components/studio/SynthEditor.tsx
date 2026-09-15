import { useState } from "react";
import { Save } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import { Knob } from "./Knob";
import { useStudio } from "@/lib/synclab/store";
import { SYNTH_PRESETS } from "@/lib/synclab/presets";
import type { EnvelopeParams, OscWave, SynthPatch, Track } from "@/lib/synclab/types";
import { toast } from "sonner";

const WAVES: OscWave[] = ["sine", "triangle", "sawtooth", "square"];

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

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <Select value={patch.name} onValueChange={(v) => loadPreset(track.id, v)}>
          <SelectTrigger className="w-60">
            <SelectValue placeholder="Browse presets" />
          </SelectTrigger>
          <SelectContent>
            {[...SYNTH_PRESETS.map((p) => ({ name: p.name, category: p.category })), ...userPresets.map((p) => ({ name: p.name, category: "My Presets" }))].map(
              (p) => (
                <SelectItem key={p.name} value={p.name}>
                  <span className="font-mono text-[10px] text-primary">{p.category}</span> {p.name}
                </SelectItem>
              ),
            )}
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
      </div>

      <Tabs defaultValue="osc">
        <TabsList>
          <TabsTrigger value="osc">Oscillators</TabsTrigger>
          <TabsTrigger value="filter">Filter</TabsTrigger>
          <TabsTrigger value="env">Envelopes</TabsTrigger>
          <TabsTrigger value="mod">LFO / Unison</TabsTrigger>
          <TabsTrigger value="fx">Effects</TabsTrigger>
          <TabsTrigger value="arp">Arpeggiator</TabsTrigger>
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
                  ["DETUNE", "detune", -50, 50, 1],
                  ["LEVEL", "level", 0, 1, 0.01],
                  ["PAN", "pan", -1, 1, 0.01],
                ] as const
              ).map(([label, key, min, max, step]) => (
                <Knob
                  key={key}
                  label={label}
                  min={min}
                  max={max}
                  step={step}
                  value={osc[key] as number}
                  onChange={(v) =>
                    set({ oscillators: patch.oscillators.map((o, j) => (j === i ? { ...o, [key]: v } : o)) })
                  }
                />
              ))}
            </div>
          ))}
          <div className="panel p-3">
            <span className="label-xs">Oscillator mix</span>
            <div className="mt-2 grid gap-2 sm:grid-cols-4">
              {patch.oscillators.map((o, i) => (
                <div key={i}>
                  <span className="label-xs">OSC {i + 1}</span>
                  <Slider
                    value={[o.level]}
                    min={0}
                    max={1}
                    step={0.01}
                    onValueChange={([v = 0]) =>
                      set({ oscillators: patch.oscillators.map((x, j) => (j === i ? { ...x, level: v } : x)) })
                    }
                  />
                </div>
              ))}
              <div>
                <span className="label-xs">NOISE</span>
                <Slider value={[patch.noise]} min={0} max={1} step={0.01} onValueChange={([v = 0]) => set({ noise: v })} />
              </div>
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
            <Knob label="CUTOFF" min={40} max={16000} step={10} value={patch.cutoff} onChange={(v) => set({ cutoff: v })} />
            <Knob label="RES" min={0} max={28} step={0.5} value={patch.resonance} onChange={(v) => set({ resonance: v })} />
            <Knob label="DRIVE" value={patch.drive} onChange={(v) => set({ drive: v })} />
            <Knob label="GLIDE" min={0} max={0.5} value={patch.glide} onChange={(v) => set({ glide: v })} />
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
                  min={0}
                  max={k === "sustain" ? 1 : 3}
                  value={patch.filterEnv[k]}
                  onChange={(v) => set({ filterEnv: { ...patch.filterEnv, [k]: v } })}
                />
              ))}
              <Knob
                label="AMOUNT"
                min={-6000}
                max={6000}
                step={50}
                value={patch.filterEnv.amount}
                onChange={(v) => set({ filterEnv: { ...patch.filterEnv, amount: v } })}
              />
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
                  {["pitch", "filter", "volume", "pan"].map((d) => (
                    <SelectItem key={d} value={d}>
                      {d}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Knob
                label="RATE"
                min={0.05}
                max={20}
                step={0.05}
                value={lfo.rate}
                onChange={(v) => set({ lfos: patch.lfos.map((l, j) => (j === i ? { ...l, rate: v } : l)) })}
              />
              <Knob
                label="AMOUNT"
                value={lfo.amount}
                onChange={(v) => set({ lfos: patch.lfos.map((l, j) => (j === i ? { ...l, amount: v } : l)) })}
              />
            </div>
          ))}
          <div className="panel flex flex-wrap items-center gap-3 p-3">
            <span className="label-xs w-full">Unison</span>
            <Knob
              label="VOICES"
              min={1}
              max={7}
              step={1}
              value={patch.unison.voices}
              onChange={(v) => set({ unison: { ...patch.unison, voices: Math.round(v) } })}
            />
            <Knob
              label="DETUNE"
              min={0}
              max={60}
              step={1}
              value={patch.unison.detune}
              onChange={(v) => set({ unison: { ...patch.unison, detune: v } })}
            />
            <Knob
              label="WIDTH"
              value={patch.unison.width}
              onChange={(v) => set({ unison: { ...patch.unison, width: v } })}
            />
          </div>
        </TabsContent>

        <TabsContent value="fx" className="pt-3">
          <div className="panel flex flex-wrap gap-3 p-3">
            {(
              [
                ["DIST", "distortion"],
                ["CHORUS", "chorus"],
                ["DELAY", "delay"],
                ["FEEDBK", "delayFeedback"],
                ["REVERB", "reverb"],
                ["CRUSH", "bitcrush"],
              ] as const
            ).map(([label, key]) => (
              <Knob
                key={key}
                label={label}
                value={patch.fx[key]}
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
                {["up", "down", "updown", "random"].map((d) => (
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
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
