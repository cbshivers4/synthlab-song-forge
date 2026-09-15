import { useState } from "react";
import { Plus, Sparkles, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Knob } from "./Knob";
import { useStudio } from "@/lib/synclab/store";
import { GENRES } from "@/lib/synclab/presets";
import { getEngine } from "@/lib/synclab/audio-engine";
import type { Track } from "@/lib/synclab/types";
import { toast } from "sonner";

export function DrumMachine({ track }: { track: Track }) {
  const { toggleStep, updatePad, setStepCount, addPad, generateBeat, transport } = useStudio();
  const [genre, setGenre] = useState("Detroit Techno");
  const [energy, setEnergy] = useState(6);
  const [openPad, setOpenPad] = useState<string | null>(null);
  const pads = track.pads ?? [];

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <Select value={String(track.steps)} onValueChange={(v) => setStepCount(track.id, Number(v))}>
          <SelectTrigger size="sm" className="w-28">
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
          <SelectTrigger size="sm" className="w-44">
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
          <Slider className="w-24" value={[energy]} min={1} max={10} step={1} onValueChange={([v]) => setEnergy(v)} />
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
        <Button
          variant="ghost"
          onClick={() => toast("Drop samples on a pad", { description: "WAV, MP3, AIFF and OGG are supported." })}
        >
          <Upload className="size-4" /> Import samples
        </Button>
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
                    onClick={() => toggleStep(track.id, pad.id, i)}
                    className="h-6 flex-1 rounded-[3px] border transition-all"
                    style={{
                      minWidth: 12,
                      borderColor:
                        transport.playing && transport.step === i % 16 ? "var(--neon)" : "var(--color-border)",
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
              <div className="panel ml-24 flex flex-wrap gap-3 p-3">
                <Knob label="VOL" value={pad.volume} onChange={(v) => updatePad(track.id, pad.id, { volume: v })} />
                <Knob label="PAN" min={-1} max={1} value={pad.pan} onChange={(v) => updatePad(track.id, pad.id, { pan: v })} />
                <Knob
                  label="PITCH"
                  min={-12}
                  max={12}
                  step={1}
                  value={pad.pitch}
                  onChange={(v) => updatePad(track.id, pad.id, { pitch: v })}
                />
                <Knob label="DECAY" value={pad.decay} onChange={(v) => updatePad(track.id, pad.id, { decay: v })} />
                <div className="flex items-end">
                  <Button variant="ghost" size="sm" onClick={() => toast("Sample editor", { description: "Trim, normalise, reverse and time-stretch this pad's sample." })}>
                    Sample editor
                  </Button>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
