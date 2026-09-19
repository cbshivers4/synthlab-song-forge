import { useState } from "react";
import { Plus, Sparkles, Upload } from "lucide-react";
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

export function DrumMachine({ track }: { track: Track }) {
  const { updatePad, setStepCount, addPad, generateBeat, transport } = useStudio();
  const [genre, setGenre] = useState("Detroit Techno");
  const [energy, setEnergy] = useState(6);
  const [openPad, setOpenPad] = useState<string | null>(null);
  const pads = track.pads ?? [];

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

  return (
    <div className="space-y-3">
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

      {/* Tap pads now live under the piano roll — see the PIANO ROLL panel. */}

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
                    onClick={() => cycleStep(pad.id, pad.steps, i)}
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
                <Knob label="ATK" value={pad.attack ?? 0} onChange={(v) => updatePad(track.id, pad.id, { attack: v })} />
                <Knob
                  label="SUS"
                  value={pad.sustain ?? 0}
                  onChange={(v) => updatePad(track.id, pad.id, { sustain: v })}
                />
                <Knob
                  label="REL"
                  value={pad.release ?? 0.2}
                  onChange={(v) => updatePad(track.id, pad.id, { release: v })}
                />
                <Knob label="START" value={pad.start ?? 0} onChange={(v) => updatePad(track.id, pad.id, { start: v })} />
                <Knob label="END" value={pad.end ?? 1} onChange={(v) => updatePad(track.id, pad.id, { end: v })} />
                <Knob
                  label="TONE"
                  value={pad.tone ?? 0.5}
                  onChange={(v) => updatePad(track.id, pad.id, { tone: v })}
                />
                <Knob label="DRIVE" value={pad.drive ?? 0} onChange={(v) => updatePad(track.id, pad.id, { drive: v })} />
                <Knob label="SNAP" value={pad.snap ?? 0} onChange={(v) => updatePad(track.id, pad.id, { snap: v })} />
                <Knob label="NOISE" value={pad.noise ?? 0} onChange={(v) => updatePad(track.id, pad.id, { noise: v })} />
                <Knob label="WIDTH" value={pad.width ?? 0} onChange={(v) => updatePad(track.id, pad.id, { width: v })} />
                <Knob
                  label="CHOKE"
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
          </div>
        ))}
      </div>
    </div>
  );
}
