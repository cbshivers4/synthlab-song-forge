import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useStudio } from "@/lib/synclab/store";
import { uid } from "@/lib/synclab/presets";
import type { Track } from "@/lib/synclab/types";

const NOTE_NAMES = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];
const isBlack = (p: number) => [1, 3, 6, 8, 10].includes(p % 12);

export function PianoRoll({ track }: { track: Track }) {
  const { setNotes, previewNote, transport } = useStudio();
  const [low, setLow] = useState(48);
  const [len, setLen] = useState(1);
  const notes = track.notes ?? [];
  const pitches = Array.from({ length: 24 }, (_, i) => low + 23 - i);

  const toggle = (pitch: number, step: number) => {
    const hit = notes.find((n) => n.pitch === pitch && step >= n.step && step < n.step + n.length);
    if (hit) setNotes(track.id, notes.filter((n) => n.id !== hit.id));
    else {
      setNotes(track.id, [...notes, { id: uid(), pitch, step, length: len, velocity: 0.85 }]);
      previewNote(track.id, pitch);
    }
  };

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-2">
        <span className="label-xs">Quantize</span>
        {[
          ["1/4", 4],
          ["1/8", 2],
          ["1/16", 1],
        ].map(([label, v]) => (
          <Button key={label as string} size="sm" variant={len === v ? "default" : "ghost"} onClick={() => setLen(v as number)}>
            {label}
          </Button>
        ))}
        <Select value={String(low)} onValueChange={(v) => setLow(Number(v))}>
          <SelectTrigger size="sm" className="w-28">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {[24, 36, 48, 60, 72].map((o) => (
              <SelectItem key={o} value={String(o)}>
                Octave {Math.floor(o / 12) - 1}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button size="sm" variant="ghost" onClick={() => setNotes(track.id, notes.map((n) => ({ ...n, pitch: n.pitch + 12 })))}>
          Transpose +12
        </Button>
        <Button size="sm" variant="ghost" onClick={() => setNotes(track.id, notes.map((n) => ({ ...n, step: Math.round(n.step / 2) * 2 })))}>
          Quantize notes
        </Button>
        <Button size="sm" variant="ghost" onClick={() => setNotes(track.id, [])}>
          Clear
        </Button>
      </div>

      <div className="overflow-x-auto rounded-md border border-border bg-background/50 p-1">
        {pitches.map((p) => (
          <div key={p} className="flex items-center gap-[3px]">
            <span
              className={`w-12 shrink-0 rounded-sm px-1 font-mono text-[9px] ${isBlack(p) ? "bg-surface-2 text-muted-foreground" : "bg-surface text-foreground"}`}
              onClick={() => previewNote(track.id, p)}
            >
              {NOTE_NAMES[p % 12]}
              {Math.floor(p / 12) - 1}
            </span>
            {Array.from({ length: 16 }).map((_, s) => {
              const on = notes.some((n) => n.pitch === p && s >= n.step % 16 && s < (n.step % 16) + n.length);
              return (
                <button
                  key={s}
                  aria-label={`note ${p} step ${s + 1}`}
                  onClick={() => toggle(p, s)}
                  className="h-4 flex-1 rounded-[2px] border transition-colors"
                  style={{
                    minWidth: 14,
                    borderColor: transport.playing && transport.step === s ? "var(--neon)" : "transparent",
                    background: on
                      ? `color-mix(in oklab, ${track.color} 80%, transparent)`
                      : s % 4 === 0
                        ? "color-mix(in oklab, var(--surface-2) 75%, transparent)"
                        : "color-mix(in oklab, var(--surface) 60%, transparent)",
                  }}
                />
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
}
