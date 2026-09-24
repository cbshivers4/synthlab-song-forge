import { useEffect, useMemo, useRef, useState } from "react";
import { AudioWaveform, Dice5, Play, Repeat, SlidersHorizontal, Square } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import { useStudio } from "@/lib/synclab/store";
import { getEngine } from "@/lib/synclab/audio-engine";
import { defaultPatch, SYNTH_PRESETS, uid } from "@/lib/synclab/presets";
import type { MidiNote } from "@/lib/synclab/types";
import { toast } from "sonner";

const PREVIEW_CHANNEL = "bass-generator-preview";

/** Builds the patch a style would use, so the preview sounds like the real thing. */
function previewPatch(name: string) {
  const patch = defaultPatch(name);
  SYNTH_PRESETS.find((p) => p.name === name)?.mutate(patch);
  patch.name = name;
  return patch;
}

const ROOTS = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];
const SCALES: Record<string, number[]> = {
  Minor: [0, 2, 3, 5, 7, 8, 10], Major: [0, 2, 4, 5, 7, 9, 11], Dorian: [0, 2, 3, 5, 7, 9, 10],
  Phrygian: [0, 1, 3, 5, 7, 8, 10], "Minor Pent": [0, 3, 5, 7, 10], Blues: [0, 3, 5, 6, 7, 10],
};
const STYLES = {
  "Detroit Techno": { preset: "Moog Mono", rhythm: [0, 3, 6, 8, 11, 14], degrees: [0, 0, 4, 2, 0, 5] },
  "Detroit Electro": { preset: "Ghetto Tech Bass", rhythm: [0, 2, 5, 7, 10, 12, 15], degrees: [0, 4, 0, 6, 2, 0, 5] },
  Acid: { preset: "303 Acid", rhythm: [0, 2, 4, 7, 8, 10, 12, 15], degrees: [0, 0, 2, 4, 3, 2, 5, 6] },
  House: { preset: "Sub Bass", rhythm: [0, 3, 6, 10, 14], degrees: [0, 0, 4, 5, 2] },
  "Hip-Hop": { preset: "808 Sub Glide", rhythm: [0, 5, 7, 11, 14], degrees: [0, 0, 4, 3, 5] },
  Funk: { preset: "Moog Mono", rhythm: [0, 2, 4, 7, 9, 11, 14, 15], degrees: [0, 4, 5, 0, 2, 4, 6, 5] },
} as const;

type StyleName = keyof typeof STYLES;

export function BassGenerator() {
  const { tracks, selected, transport, addTrack, setNotes, changeInstrument, select, setPanel } = useStudio();
  const [root, setRoot] = useState(0);
  const [scaleName, setScaleName] = useState("Minor");
  const [style, setStyle] = useState<StyleName>("Detroit Techno");
  const [bars, setBars] = useState(2);
  const [density, setDensity] = useState(70);
  const [movement, setMovement] = useState(45);
  const [octave, setOctave] = useState(2);
  const [seed, setSeed] = useState(1);
  const bassTracks = tracks.filter((t) => t.kind === "instrument" || t.kind === "midi");
  const [targetId, setTargetId] = useState(selected && bassTracks.some((t) => t.id === selected.id) ? selected.id : "new");
  const scale = SCALES[scaleName] ?? (SCALES["Minor"] as number[]);
  const preview = useMemo(() => generate(root, scale, style, bars, density, movement, octave, seed), [root, scale, style, bars, density, movement, octave, seed]);

  const [playing, setPlaying] = useState(false);
  const [playStep, setPlayStep] = useState(0);
  const timers = useRef<number[]>([]);
  const [loop, setLoop] = useState(true);
  const loopRef = useRef(loop);
  loopRef.current = loop;

  const stopPreview = () => {
    timers.current.forEach((t) => window.clearTimeout(t));
    timers.current = [];
    setPlaying(false);
    setPlayStep(0);
  };
  useEffect(() => stopPreview, []);

  /** Auditions the generated pattern on its own preview channel, without touching the song. */
  const playPreview = () => {
    stopPreview();
    const patch = previewPatch(STYLES[style].preset);
    const stepSec = 60 / Math.max(40, transport.bpm) / 4;
    const engine = getEngine();
    engine.init();
    setPlaying(true);
    const passMs = bars * 16 * stepSec * 1000;
    const schedule = (offset: number) => preview.forEach((n) => {
      timers.current.push(
        window.setTimeout(() => {
          engine.playNote(PREVIEW_CHANNEL, patch, n.pitch, n.length * stepSec, n.velocity);
          setPlayStep(n.step);
        }, offset + n.step * stepSec * 1000),
      );
    });
    const pass = (offset: number) => {
      schedule(offset);
      timers.current.push(
        window.setTimeout(() => {
          if (!loopRef.current) return stopPreview();
          timers.current = [];
          pass(0);
        }, offset + passMs),
      );
    };
    pass(0);
  };

  const apply = () => {
    const def = STYLES[style];
    const id = targetId === "new" ? addTrack("instrument", `${style.toUpperCase()} BASS`, def.preset) : targetId;
    changeInstrument(id, def.preset);
    setNotes(id, preview);
    select(id);
    setTargetId(id);
    toast.success("Bassline added", { description: `${style} · ${bars} bars · fully editable in the piano roll.` });
  };

  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(260px,360px)_1fr]">
      <div className="space-y-3 rounded-sm border border-border bg-surface/60 p-3">
        <div className="flex items-center gap-2"><AudioWaveform className="size-4 text-primary" /><span className="label-xs">BASS GENERATOR</span></div>
        <div className="grid grid-cols-2 gap-2">
          <Pick label="Style" value={style} values={Object.keys(STYLES)} onChange={(v) => setStyle(v as StyleName)} />
          <Pick label="Scale" value={scaleName} values={Object.keys(SCALES)} onChange={setScaleName} />
          <Pick label="Root" value={String(root)} values={ROOTS.map((_, i) => String(i))} names={ROOTS} onChange={(v) => setRoot(Number(v))} />
          <Pick label="Length" value={String(bars)} values={["1", "2", "4", "8"]} names={["1 bar", "2 bars", "4 bars", "8 bars"]} onChange={(v) => setBars(Number(v))} />
          <Pick label="Register" value={String(octave)} values={["1", "2", "3"]} names={["Sub", "Bass", "Upper bass"]} onChange={(v) => setOctave(Number(v))} />
          <Pick label="Destination" value={targetId} values={["new", ...bassTracks.map((t) => t.id)]} names={["New bass track", ...bassTracks.map((t) => t.name)]} onChange={setTargetId} />
        </div>
        <Control label="Density" value={density} onChange={setDensity} />
        <Control label="Movement" value={movement} onChange={setMovement} />
        <div className="flex gap-2">
          <Button variant="secondary" className="flex-1" onClick={() => setSeed((s) => s + 1)}><Dice5 className="size-4" /> New variation</Button>
          <Button className="flex-1" onClick={apply}><AudioWaveform className="size-4" /> Add bassline</Button>
        </div>
      </div>
      <div className="space-y-3 rounded-sm border border-border bg-background p-3">
        <div className="flex items-center gap-2">
          <SlidersHorizontal className="size-4 text-primary" /><span className="label-xs">PATTERN PREVIEW · {preview.length} NOTES</span>
          <Button size="sm" variant={loop ? "secondary" : "ghost"} aria-pressed={loop} title="Loop the preview" className="ml-auto h-9 gap-1.5 sm:h-7" onClick={() => setLoop((v) => !v)}>
            <Repeat className="size-3.5" /> Loop {loop ? "On" : "Off"}
          </Button>
          <Button size="sm" variant={playing ? "secondary" : "ghost"} className="h-9 gap-1.5 sm:h-7" onClick={playing ? stopPreview : playPreview}>
            {playing ? <Square className="size-3.5" /> : <Play className="size-3.5" />} {playing ? "Stop" : "Play"}
          </Button>
        </div>
        <div className="relative h-36 overflow-hidden border border-border bg-surface-2/30">
          {Array.from({ length: bars * 16 }, (_, i) => <span key={i} className="absolute inset-y-0 border-l border-border/40" style={{ left: `${(i / (bars * 16)) * 100}%` }} />)}
          {preview.map((n) => <span key={n.id} className="absolute h-3 rounded-[2px] bg-primary shadow-[0_0_8px_hsl(var(--primary)/0.35)]" style={{ left: `${(n.step / (bars * 16)) * 100}%`, width: `${Math.max(1, (n.length / (bars * 16)) * 100)}%`, bottom: `${8 + (n.pitch - (octave + 1) * 12) * 4}px`, opacity: n.velocity }} />)}
          {playing && (
            <span
              className="pointer-events-none absolute inset-y-0 w-px bg-accent shadow-[0_0_10px_hsl(var(--accent))] transition-[left] duration-100"
              style={{ left: `${(playStep / (bars * 16)) * 100}%` }}
            />
          )}
        </div>
        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <span>{STYLES[style].preset} sound · scale-safe notes · varied velocity and note length</span>
          <Button size="sm" variant="outline" onClick={() => { apply(); setPanel("piano"); }}>Add &amp; edit notes</Button>
        </div>
      </div>
    </div>
  );
}

function generate(root: number, scale: number[], style: StyleName, bars: number, density: number, movement: number, octave: number, seed: number): MidiNote[] {
  const def = STYLES[style];
  let x = seed * 997 + root * 31 + bars;
  const rand = () => ((x = (x * 16807) % 2147483647) - 1) / 2147483646;
  const out: MidiNote[] = [];
  for (let bar = 0; bar < bars; bar++) def.rhythm.forEach((step, i) => {
    if (i > 0 && rand() * 100 > density) return;
    const baseDegree = def.degrees[i % def.degrees.length] ?? 0;
    const degree = rand() * 100 < movement ? Math.max(0, Math.min(scale.length - 1, baseDegree + (rand() > 0.5 ? 1 : -1))) : baseDegree;
    const pitch = 12 * (octave + 1) + root + (scale[degree % scale.length] ?? 0) + (rand() > 0.9 ? 12 : 0);
    out.push({ id: uid(), step: bar * 16 + step, length: style === "Acid" ? (rand() > 0.5 ? 1.75 : 0.75) : (rand() > 0.72 ? 2 : 1), pitch, velocity: 0.68 + rand() * 0.3 });
  });
  return out;
}

function Pick({ label, value, values, names, onChange }: { label: string; value: string; values: string[]; names?: string[]; onChange: (v: string) => void }) {
  return <label className="space-y-1"><span className="label-xs">{label}</span><Select value={value} onValueChange={onChange}><SelectTrigger className="h-8"><SelectValue /></SelectTrigger><SelectContent>{values.map((v, i) => <SelectItem key={v} value={v}>{names?.[i] ?? v}</SelectItem>)}</SelectContent></Select></label>;
}
function Control({ label, value, onChange }: { label: string; value: number; onChange: (v: number) => void }) {
  return <div><div className="mb-1 flex justify-between"><span className="label-xs">{label}</span><span className="font-mono text-[10px] text-primary">{value}%</span></div><Slider value={[value]} min={10} max={100} step={1} onValueChange={([v]) => onChange(v ?? value)} /></div>;
}