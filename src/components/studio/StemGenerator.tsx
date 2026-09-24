import { useEffect, useRef, useState } from "react";
import { Loader2, Play, Repeat, Plus, RefreshCw, Sparkles, Square } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Slider } from "@/components/ui/slider";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { useStudio } from "@/lib/synclab/store";
import { uid, DRUM_KITS, defaultPads, applyPreset } from "@/lib/synclab/presets";
import { getEngine } from "@/lib/synclab/audio-engine";
import { stepSeconds } from "@/lib/synclab/timebase";
import type { DrumKitId, DrumPad, MidiNote, Track } from "@/lib/synclab/types";
import { generateParts } from "@/lib/stems.functions";

const GENRES = [
  "Detroit Techno",
  "Techno",
  "Trance",
  "Italo Disco",
  "Ghetto Tech",
  "Electro",
  "House",
  "Deep House",
  "Acid",
  "Breakbeat",
  "Jungle",
  "Hip-Hop",
  "Trap",
  "Funk",
  "Ambient",
  "Industrial",
];

const KEYS = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];
const MODES = ["Minor", "Major"];

type Part = Awaited<ReturnType<typeof generateParts>>["parts"][number];

const noteName = (p: number) => `${KEYS[p % 12]}${Math.floor(p / 12) - 1}`;

/** Little piano-roll / step picture of a generated part. */
function PartPreview({ part, steps }: { part: Part; steps: number }) {
  if (part.drums.length) {
    return (
      <div className="space-y-0.5">
        {part.drums.slice(0, 8).map((row) => (
          <div key={row.voice} className="flex items-center gap-1">
            <span className="w-14 shrink-0 font-mono text-[8px] uppercase text-muted-foreground">{row.voice}</span>
            <div className="flex flex-1 gap-[1px]">
              {row.steps.slice(0, steps).map((v, i) => (
                <span
                  key={i}
                  className={cn("h-2 flex-1 rounded-[1px]", v > 0 ? "bg-primary" : "bg-foreground/10")}
                  style={v > 0 ? { opacity: 0.35 + v * 0.65 } : undefined}
                />
              ))}
            </div>
          </div>
        ))}
      </div>
    );
  }
  const pitches = part.notes.map((n) => n.pitch);
  const lo = Math.min(...pitches, 127);
  const hi = Math.max(...pitches, 0);
  const span = Math.max(6, hi - lo + 1);
  return (
    <div className="relative h-16 overflow-hidden rounded-[3px] bg-foreground/5">
      {part.notes.map((n, i) => (
        <span
          key={i}
          title={`${noteName(n.pitch)} at step ${n.step}`}
          className="absolute rounded-[1px] bg-primary"
          style={{
            left: `${(n.step / steps) * 100}%`,
            width: `max(2px, ${(Math.max(0.5, n.length) / steps) * 100}%)`,
            bottom: `${((n.pitch - lo) / span) * 100}%`,
            height: `${Math.max(6, 100 / span)}%`,
            opacity: 0.4 + n.velocity * 0.6,
          }}
        />
      ))}
    </div>
  );
}

/**
 * AI stem generator — writes parts that fit the song and drops them in as new
 * channels played by the built-in synth and drum machine.
 */
export function StemGenerator() {
  const { tracks, transport, addTrack, updateTrack, select } = useStudio();
  const [genre, setGenre] = useState("Detroit Techno");
  const [root, setRoot] = useState("A");
  const [mode, setMode] = useState("Minor");
  const [bars, setBars] = useState(1);
  const [count, setCount] = useState(3);
  const [brief, setBrief] = useState("");
  const [busy, setBusy] = useState(false);
  const [advice, setAdvice] = useState("");
  const [parts, setParts] = useState<Part[]>([]);
  const [added, setAdded] = useState<Record<number, boolean>>({});

  const steps = bars * 16;
  const [playing, setPlaying] = useState<number | null>(null);
  const [regen, setRegen] = useState<number | null>(null);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);
  const [looping, setLooping] = useState(true);
  const loopingRef = useRef(looping);
  loopingRef.current = looping;

  const stop = () => {
    if (timer.current) clearInterval(timer.current);
    timer.current = null;
    // Kill already-scheduled preview voices too — removeChannel disconnects the
    // "__preview" channel, and the engine recreates it on the next preview.
    getEngine().removeChannel("__preview");
    setPlaying(null);
  };
  useEffect(() => stop, []);

  /** Loops one part through the studio engine without touching the project. */
  const preview = (part: Part, index: number) => {
    if (playing === index) return stop();
    stop();
    const engine = getEngine();
    const ctx = engine.init();
    const sd = stepSeconds(transport.bpm);
    const loop = steps * sd;
    const pads = part.drums.length ? defaultPads(steps, (DRUM_KITS.find((k) => k.id === part.sound)?.id ?? "909") as DrumKitId) : [];
    const patch = part.drums.length ? null : applyPreset(part.sound);
    const scheduleLoop = (t0: number) => {
      if (patch) {
        for (const n of part.notes) {
          if (n.step < 0 || n.step >= steps) continue;
          engine.playNote("__preview", patch, Math.round(n.pitch), Math.max(1, n.length) * sd, Math.max(0.15, Math.min(1, n.velocity || 0.8)), t0 + n.step * sd);
        }
      } else {
        for (const row of part.drums) {
          const pad = pads.find((p) => p.kind === row.voice);
          if (!pad) continue;
          row.steps.slice(0, steps).forEach((v, i) => {
            if (v > 0) engine.playDrum("__preview", pad, Math.min(1, v), t0 + i * sd);
          });
        }
      }
    };
    let next = ctx.currentTime + 0.08;
    scheduleLoop(next);
    next += loop;
    timer.current = setInterval(() => {
      if (!loopingRef.current) {
        if (ctx.currentTime >= next) stop();
        return;
      }
      if (next - ctx.currentTime < 0.4) {
        scheduleLoop(next);
        next += loop;
      }
    }, 100);
    setPlaying(index);
  };

  const regenerate = async (index: number) => {
    const old = parts[index];
    if (!old) return;
    if (playing === index) stop();
    setRegen(index);
    try {
      const out = await generateParts({
        data: {
          genre, bpm: transport.bpm, key: `${root} ${mode}`, bars, context, count: 1,
          brief: `Write a fresh variation of a ${old.role} part called "${old.name}" (different rhythm and notes). ${brief}`.slice(0, 500),
        },
      });
      const fresh = out.parts[0];
      if (!fresh) throw new Error("No part came back.");
      setParts((ps) => ps.map((p, i) => (i === index ? fresh : p)));
      setAdded((a) => ({ ...a, [index]: false }));
    } catch (error) {
      toast.error("Could not regenerate", { description: (error as Error)?.message ?? "Try again in a moment." });
    } finally {
      setRegen(null);
    }
  };

  const context = tracks.length
    ? tracks
        .map((t) => {
          if (t.kind === "drum" && t.pads) {
            const rows = t.pads
              .filter((p) => p.steps.some((v) => v > 0))
              .map((p) => `${p.name}: ${p.steps.map((v) => (v > 0 ? "x" : ".")).join("")}`);
            return `${t.name} (drum machine, kit ${t.pads[0]?.kit ?? "909"}):\n  ${rows.join("\n  ") || "empty"}`;
          }
          if (t.notes?.length) {
            const list = t.notes
              .slice(0, 48)
              .map((n) => `${noteName(n.pitch)}@${n.step}/${n.length}`)
              .join(" ");
            return `${t.name} (${t.patch?.name ?? "synth"}): ${list}`;
          }
          if (t.clips?.length) return `${t.name} (recorded audio, ${t.clips.length} clip(s))`;
          return `${t.name} (${t.kind}, empty)`;
        })
        .join("\n")
    : "";

  const run = async () => {
    stop();
    setBusy(true);
    setAdded({});
    try {
      const out = await generateParts({
        data: { genre, bpm: transport.bpm, key: `${root} ${mode}`, bars, brief, context, count },
      });
      setAdvice(out.advice);
      setParts(out.parts);
      toast.success(`${out.parts.length} part${out.parts.length === 1 ? "" : "s"} written`, { description: genre });
    } catch (error) {
      toast.error("Could not generate parts", { description: (error as Error)?.message ?? "Try again in a moment." });
    } finally {
      setBusy(false);
    }
  };

  const addPart = (part: Part, index: number) => {
    if (part.drums.length) {
      const kit = (DRUM_KITS.find((k) => k.id === part.sound)?.id ?? "909") as DrumKitId;
      const id = addTrack("drum", part.name.toUpperCase().slice(0, 18));
      const pads: DrumPad[] = defaultPads(steps, kit).map((pad) => {
        const row = part.drums.find((r) => r.voice === pad.kind);
        if (!row) return { ...pad, steps: new Array(steps).fill(0) as number[] };
        const grid = new Array(steps).fill(0).map((_, i) => Math.max(0, Math.min(1, row.steps[i] ?? 0)));
        return { ...pad, steps: grid };
      });
      updateTrack(id, { pads, steps } as Partial<Track>);
      select(id);
    } else {
      const id = addTrack("instrument", part.name.toUpperCase().slice(0, 18), part.sound);
      const notes: MidiNote[] = part.notes
        .filter((n) => n.step >= 0 && n.step < steps && n.pitch >= 12 && n.pitch <= 120)
        .map((n) => ({
          id: uid(),
          step: Math.round(n.step),
          length: Math.max(1, Math.round(n.length)),
          pitch: Math.round(n.pitch),
          velocity: Math.max(0.15, Math.min(1, n.velocity || 0.8)),
        }));
      updateTrack(id, { notes, steps } as Partial<Track>);
      select(id);
    }
    setAdded((a) => ({ ...a, [index]: true }));
    toast.success(`${part.name} added`, { description: "Press play — it loops with the song." });
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2 rounded-sm border border-border bg-surface-2/60 p-2">
        <Sparkles className="size-4 text-primary" />
        <span className="font-display text-[11px] font-semibold tracking-[0.2em]">STEM GENERATOR</span>
        <span className="label-xs">writes parts that fit what you already have</span>
        <Button size="sm" className="ml-auto h-8 gap-1.5 font-mono text-[10px] uppercase tracking-widest" disabled={busy} onClick={() => void run()}>
          {busy ? <Loader2 className="size-3.5 animate-spin" /> : <Sparkles className="size-3.5" />}
          {busy ? "Writing…" : "Generate parts"}
        </Button>
      </div>

      <div>
        <div className="label-xs mb-1">Genre</div>
        <div className="flex flex-wrap gap-1.5">
          {GENRES.map((g) => (
            <button
              key={g}
              type="button"
              onClick={() => setGenre(g)}
              className={cn(
                "rounded-full border px-2.5 py-1 font-mono text-[10px] uppercase tracking-wider",
                genre === g ? "border-primary bg-primary/15 text-foreground" : "border-border bg-surface-2 text-muted-foreground",
              )}
            >
              {g}
            </button>
          ))}
        </div>
        <Input
          value={genre}
          onChange={(e) => setGenre(e.target.value)}
          placeholder="…or type any genre"
          className="mt-2 h-8 text-xs"
        />
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <div className="rounded-sm border border-border bg-surface-2/50 p-2">
          <div className="label-xs mb-1">Key</div>
          <div className="flex flex-wrap gap-1">
            {KEYS.map((k) => (
              <button
                key={k}
                onClick={() => setRoot(k)}
                className={cn(
                  "rounded-[3px] border px-1.5 py-0.5 font-mono text-[10px]",
                  root === k ? "border-primary bg-primary/15" : "border-border text-muted-foreground",
                )}
              >
                {k}
              </button>
            ))}
            {MODES.map((m) => (
              <button
                key={m}
                onClick={() => setMode(m)}
                className={cn(
                  "rounded-[3px] border px-1.5 py-0.5 font-mono text-[10px] uppercase",
                  mode === m ? "border-primary bg-primary/15" : "border-border text-muted-foreground",
                )}
              >
                {m}
              </button>
            ))}
          </div>
        </div>
        <div className="space-y-2 rounded-sm border border-border bg-surface-2/50 p-2">
          <div className="flex items-center justify-between">
            <span className="label-xs">Length</span>
            <span className="font-mono text-[10px] text-muted-foreground">{bars} bar{bars === 1 ? "" : "s"}</span>
          </div>
          <Slider min={1} max={4} step={1} value={[bars]} onValueChange={([v]) => setBars(v ?? 1)} />
          <div className="flex items-center justify-between">
            <span className="label-xs">How many parts</span>
            <span className="font-mono text-[10px] text-muted-foreground">{count}</span>
          </div>
          <Slider min={1} max={5} step={1} value={[count]} onValueChange={([v]) => setCount(v ?? 1)} />
        </div>
      </div>

      <div>
        <div className="label-xs mb-1">What do you want it to add?</div>
        <Textarea
          rows={2}
          value={brief}
          onChange={(e) => setBrief(e.target.value)}
          placeholder="e.g. rolling bassline and a dark stab, keep the hats sparse"
          className="text-xs"
        />
        <p className="mt-1 text-[10px] text-muted-foreground">
          Working at {transport.bpm} BPM with {tracks.length} channel{tracks.length === 1 ? "" : "s"} in the song — what you already
          have is sent along so the new parts fit it.
        </p>
      </div>

      {advice && <p className="rounded-sm border border-primary/40 bg-primary/10 p-2 text-[11px] leading-relaxed">{advice}</p>}

      <div className="space-y-2">
        {parts.map((part, i) => (
          <div key={`${part.name}-${i}`} className="space-y-2 rounded-sm border border-border bg-surface-2/50 p-2">
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-display text-[11px] font-semibold tracking-widest">{part.name}</span>
              <span className="rounded-full border border-border px-1.5 py-0.5 font-mono text-[9px] uppercase text-muted-foreground">
                {part.role}
              </span>
              <span className="font-mono text-[9px] uppercase text-muted-foreground">{part.sound}</span>
              <span className="font-mono text-[9px] uppercase text-muted-foreground">
                V{i + 1} · {transport.bpm} BPM · {root} {mode} · {bars} bar{bars === 1 ? "" : "s"}
              </span>
              {!added[i] && <span className="rounded-full bg-primary/15 px-1.5 py-0.5 font-mono text-[9px] uppercase">Preview only</span>}
              <Button size="sm" variant={looping ? "secondary" : "ghost"} aria-pressed={looping} title="Loop the preview" className="ml-auto h-7 gap-1.5 font-mono text-[10px] uppercase" onClick={() => setLooping((v) => !v)}>
                <Repeat className="size-3.5" /> Loop {looping ? "On" : "Off"}
              </Button>
              <Button size="sm" variant="secondary" className="h-7 gap-1.5 font-mono text-[10px] uppercase" onClick={() => preview(part, i)}>
                {playing === i ? <Square className="size-3.5" /> : <Play className="size-3.5" />} {playing === i ? "Stop" : "Play"}
              </Button>
              <Button size="sm" variant="ghost" className="h-7 gap-1.5 font-mono text-[10px] uppercase" disabled={regen !== null} onClick={() => void regenerate(i)}>
                {regen === i ? <Loader2 className="size-3.5 animate-spin" /> : <RefreshCw className="size-3.5" />} Regenerate
              </Button>
              <Button
                size="sm"
                variant={added[i] ? "ghost" : "outline"}
                className="h-7 gap-1.5 font-mono text-[10px] uppercase"
                onClick={() => addPart(part, i)}
              >
                <Plus className="size-3.5" /> {added[i] ? "Add again" : "Add to timeline"}
              </Button>
            </div>
            <PartPreview part={part} steps={steps} />
            <p className="text-[10px] leading-relaxed text-muted-foreground">{part.why}</p>
          </div>
        ))}
        {parts.length > 0 && (
          <Button
            size="sm"
            variant="outline"
            className="h-8 gap-1.5 font-mono text-[10px] uppercase"
            onClick={() => parts.forEach((p, i) => addPart(p, i))}
          >
            <Plus className="size-3.5" /> Add every part
          </Button>
        )}
      </div>

      <p className="text-[10px] leading-relaxed text-muted-foreground">
        Honest note: this writes musical parts — note patterns and drum patterns — played by SYNCLAB's own synth and drum machine. It
        does not create recorded audio stems or copy anyone's record.
      </p>
    </div>
  );
}
