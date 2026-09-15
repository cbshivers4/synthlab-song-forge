import { useState } from "react";
import { Minus, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { useStudio } from "@/lib/synclab/store";

const NOTE_NAMES = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];
const BLACK = new Set([1, 3, 6, 8, 10]);

export function Keyboard() {
  const { selected, previewNote } = useStudio();
  const [octave, setOctave] = useState(4); // C4 base
  const [velocity, setVelocity] = useState(0.9);
  const [held, setHeld] = useState<number | null>(null);

  const base = (octave + 1) * 12; // C of the chosen octave in MIDI
  const whiteCount = 14; // two octaves of white keys
  const whiteKeys = Array.from({ length: whiteCount }, (_, i) => {
    // walk semitones, skip blacks
    let semis = 0;
    let seen = 0;
    while (true) {
      if (!BLACK.has(semis % 12)) {
        if (seen === i) break;
        seen++;
      }
      semis++;
    }
    return base + semis;
  });
  const blackKeys: { midi: number; pos: number }[] = [];
  {
    let wi = 0;
    for (let s = 0; s < 24 && wi < whiteCount; s++) {
      if (BLACK.has(s % 12)) blackKeys.push({ midi: base + s, pos: wi });
      else wi++;
    }
  }

  const play = (midi: number) => {
    if (!selected) return;
    setHeld(midi);
    previewNote(selected.id, midi);
    window.setTimeout(() => setHeld((h) => (h === midi ? null : h)), 180);
  };

  const label = (midi: number) => `${NOTE_NAMES[midi % 12]}${Math.floor(midi / 12) - 1}`;

  if (!selected || !selected.patch)
    return (
      <p className="text-sm text-muted-foreground">
        Select an instrument, MIDI or sampler track, then play the keys.
      </p>
    );

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-3">
        <span className="label-xs">
          Playing {selected.name} · {selected.instrument ?? "SYNTH"}
        </span>
        <div className="ml-auto flex items-center gap-1">
          <span className="label-xs mr-1">OCTAVE</span>
          <Button
            size="icon"
            variant="ghost"
            className="size-6"
            aria-label="Octave down"
            disabled={octave <= 1}
            onClick={() => setOctave((o) => Math.max(1, o - 1))}
          >
            <Minus className="size-3" />
          </Button>
          <span className="w-8 text-center font-mono text-xs text-primary">C{octave}</span>
          <Button
            size="icon"
            variant="ghost"
            className="size-6"
            aria-label="Octave up"
            disabled={octave >= 7}
            onClick={() => setOctave((o) => Math.min(7, o + 1))}
          >
            <Plus className="size-3" />
          </Button>
        </div>
        <div className="flex w-32 items-center gap-2">
          <span className="label-xs">VEL</span>
          <Slider
            value={[velocity]}
            min={0.1}
            max={1}
            step={0.01}
            onValueChange={([v = 0.9]) => setVelocity(v)}
          />
        </div>
      </div>

      <div
        className="relative h-36 select-none overflow-hidden rounded-[3px] border border-border bg-background/60"
        style={{ touchAction: "none" }}
      >
        {/* white keys */}
        <div className="flex h-full">
          {whiteKeys.map((midi) => (
            <button
              key={midi}
              onPointerDown={() => play(midi)}
              className={`relative flex-1 rounded-b-[3px] border-r border-border/70 transition-colors ${
                held === midi ? "bg-primary/70" : "bg-surface-2 hover:bg-surface"
              }`}
              aria-label={label(midi)}
            >
              {midi % 12 === 0 && (
                <span className="absolute bottom-1 left-1/2 -translate-x-1/2 font-mono text-[9px] text-muted-foreground">
                  {label(midi)}
                </span>
              )}
            </button>
          ))}
        </div>
        {/* black keys */}
        {blackKeys.map(({ midi, pos }) => (
          <button
            key={midi}
            onPointerDown={() => play(midi)}
            className={`absolute top-0 z-10 h-[58%] rounded-b-[3px] border border-border transition-colors ${
              held === midi ? "bg-primary" : "bg-background hover:bg-surface"
            }`}
            style={{
              left: `calc(${(pos / whiteCount) * 100}% - ${100 / whiteCount / 3}%)`,
              width: `${(100 / whiteCount) * 0.62}%`,
              boxShadow: "0 3px 6px oklch(0 0 0 / 0.5)",
            }}
            aria-label={label(midi)}
          />
        ))}
      </div>
      <p className="label-xs">Click or tap the keys to audition the selected instrument</p>
    </div>
  );
}
