import { usePlayStep } from "@/lib/synclab/playhead";
import { useMemo, useState } from "react";
import { useStudio } from "@/lib/synclab/store";
import { uid } from "@/lib/synclab/presets";
import type { MidiNote, Track } from "@/lib/synclab/types";

const NAMES = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];
const noteName = (p: number) => `${NAMES[p % 12]}${Math.floor(p / 12) - 1}`;

interface Step { pitch: number; on: boolean; accent: boolean; slide: boolean }

/** TD-3-style 16-step pattern: step write, accent, slide, rest, transpose. Reads/writes the track's real notes. */
export function AcidSequencer({ track }: { track: Track }) {
  const liveStep = usePlayStep();
  const { setNotes, previewNote, transport } = useStudio();
  const [cursor, setCursor] = useState(0);
  const [octave, setOctave] = useState(2); // C2 = 36
  const playStep = transport.playing ? Math.floor(liveStep) % 16 : -1;

  const steps: Step[] = useMemo(() => {
    const out: Step[] = Array.from({ length: 16 }, () => ({ pitch: 36, on: false, accent: false, slide: false }));
    for (const n of track.notes ?? []) {
      if (n.step < 0 || n.step >= 16) continue;
      const s = out[Math.floor(n.step)]!;
      s.on = true; s.pitch = n.pitch; s.accent = n.velocity >= 0.95; s.slide = n.length > 1.05;
    }
    return out;
  }, [track.notes]);

  const commit = (next: Step[]) => {
    const kept = (track.notes ?? []).filter((n) => n.step >= 16);
    const notes: MidiNote[] = next.flatMap((s, i) =>
      s.on ? [{ id: uid(), step: i, length: s.slide ? 1.25 : 0.5, pitch: s.pitch, velocity: s.accent ? 1 : 0.7 }] : [],
    );
    setNotes(track.id, [...notes, ...kept]);
  };
  const edit = (i: number, p: Partial<Step>) => commit(steps.map((s, j) => (j === i ? { ...s, ...p } : s)));

  const writeNote = (semi: number) => {
    const pitch = (octave + 1) * 12 + semi;
    previewNote(track.id, pitch);
    edit(cursor, { pitch, on: true });
    setCursor((c) => (c + 1) % 16);
  };

  const btn = (active: boolean) =>
    `rounded-[3px] border px-2 py-1 font-mono text-[10px] ${active ? "border-primary bg-primary font-bold text-primary-foreground" : "border-border text-muted-foreground hover:text-foreground"}`;

  return (
    <div className="space-y-3 rounded-md border border-border bg-surface/70 p-3" aria-label="TD-3 step sequencer">
      <div className="flex flex-wrap items-center gap-2">
        <h3 className="label-xs text-primary">TD-3 STEP WRITE</h3>
        <span className="text-[10px] text-muted-foreground">Tap a step, then a note key — the cursor advances like the TD-3.</span>
        <div className="ml-auto flex flex-wrap gap-1">
          <button type="button" className={btn(false)} onClick={() => edit(cursor, { on: false })}>REST</button>
          <button type="button" className={btn(steps[cursor]!.accent)} onClick={() => edit(cursor, { accent: !steps[cursor]!.accent })}>ACCENT</button>
          <button type="button" className={btn(steps[cursor]!.slide)} onClick={() => edit(cursor, { slide: !steps[cursor]!.slide })}>SLIDE</button>
          <button type="button" className={btn(false)} onClick={() => commit(steps.map((s) => ({ ...s, pitch: Math.max(12, s.pitch - 1) })))}>TRANSPOSE −</button>
          <button type="button" className={btn(false)} onClick={() => commit(steps.map((s) => ({ ...s, pitch: Math.min(96, s.pitch + 1) })))}>TRANSPOSE +</button>
          <button type="button" className={btn(false)} onClick={() => commit(steps.map(() => ({ pitch: 36, on: false, accent: false, slide: false })))}>CLEAR</button>
        </div>
      </div>

      <div className="grid grid-cols-8 gap-1 md:grid-cols-16">
        {steps.map((s, i) => (
          <button
            key={i}
            type="button"
            aria-label={`Step ${i + 1}${s.on ? ` ${noteName(s.pitch)}` : " rest"}`}
            aria-pressed={cursor === i}
            onClick={() => setCursor(i)}
            className={`flex flex-col items-center gap-0.5 rounded-[3px] border p-1 font-mono text-[9px] ${
              cursor === i ? "border-primary" : "border-border"
            } ${playStep === i ? "bg-primary/25" : s.on ? "bg-surface-2" : "bg-surface"}`}
          >
            <span className="text-muted-foreground">{i + 1}</span>
            <span className={s.on ? "text-foreground" : "text-muted-foreground"}>{s.on ? noteName(s.pitch) : "—"}</span>
            <span className="flex gap-0.5">
              <span className={s.accent ? "font-bold text-primary" : "text-muted-foreground"}>A</span>
              <span className={s.slide ? "font-bold text-primary" : "text-muted-foreground"}>S</span>
            </span>
          </button>
        ))}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <div className="flex gap-1">
          <button type="button" className={btn(false)} onClick={() => setOctave((o) => Math.max(0, o - 1))}>OCT −</button>
          <span className="px-1 font-mono text-[10px]">C{octave}</span>
          <button type="button" className={btn(false)} onClick={() => setOctave((o) => Math.min(5, o + 1))}>OCT +</button>
        </div>
        <div className="flex flex-wrap gap-1">
          {Array.from({ length: 13 }, (_, semi) => (
            <button
              key={semi}
              type="button"
              onClick={() => writeNote(semi)}
              className={`h-9 w-8 rounded-[3px] border border-border font-mono text-[9px] ${NAMES[semi % 12]!.includes("#") ? "bg-surface-2" : "bg-foreground/90 text-background"}`}
            >
              {NAMES[semi % 12]}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
