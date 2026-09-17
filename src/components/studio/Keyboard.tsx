import { useState } from "react";
import { Lock, Minus, Plus, Unlock } from "lucide-react";
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
  const [locked, setLocked] = useState(false);

  const slideTo = (o: number) => {
    if (locked) return;
    setOctave(Math.min(7, Math.max(1, o)));
  };

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
            disabled={octave <= 1 || locked}
            onClick={() => slideTo(octave - 1)}
          >
            <Minus className="size-3" />
          </Button>
          <span className="w-8 text-center font-mono text-xs text-primary">C{octave}</span>
          <Button
            size="icon"
            variant="ghost"
            className="size-6"
            aria-label="Octave up"
            disabled={octave >= 7 || locked}
            onClick={() => slideTo(octave + 1)}
          >
            <Plus className="size-3" />
          </Button>
          <Button
            size="sm"
            variant="ghost"
            aria-pressed={locked}
            aria-label={locked ? "Unlock keyboard range" : "Lock keyboard range"}
            onClick={() => setLocked((l) => !l)}
            className={`h-6 gap-1 px-2 font-mono text-[10px] tracking-wider ${
              locked ? "bg-primary/15 text-primary shadow-[inset_0_0_0_1px_var(--primary)]" : "text-muted-foreground"
            }`}
          >
            {locked ? <Lock className="size-3" /> : <Unlock className="size-3" />}
            {locked ? "LOCKED" : "LOCK"}
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

      {/* fast range slide: bass ←→ treble */}
      <div className="flex items-center gap-2">
        <button
          onClick={() => slideTo(1)}
          disabled={locked}
          className="rounded-[3px] border border-border px-2 py-0.5 font-mono text-[10px] tracking-wider text-muted-foreground transition-colors hover:text-primary disabled:opacity-40"
        >
          BASS
        </button>
        <Slider
          className="flex-1"
          value={[octave]}
          min={1}
          max={7}
          step={1}
          disabled={locked}
          aria-label="Slide keyboard range"
          onValueChange={([v = 4]) => slideTo(v)}
        />
        <button
          onClick={() => slideTo(4)}
          disabled={locked}
          className="rounded-[3px] border border-border px-2 py-0.5 font-mono text-[10px] tracking-wider text-muted-foreground transition-colors hover:text-primary disabled:opacity-40"
        >
          MID
        </button>
        <button
          onClick={() => slideTo(7)}
          disabled={locked}
          className="rounded-[3px] border border-border px-2 py-0.5 font-mono text-[10px] tracking-wider text-muted-foreground transition-colors hover:text-primary disabled:opacity-40"
        >
          TREBLE
        </button>
      </div>


      <div
        onWheel={(e) => slideTo(octave + (e.deltaY > 0 ? -1 : 1))}
        className="relative h-36 select-none overflow-hidden rounded-[3px] border border-border bg-black"
        style={{ touchAction: "none" }}
      >
        {/* white keys */}
        <div className="flex h-full gap-px bg-black">
          {whiteKeys.map((midi) => (
            <button
              key={midi}
              onPointerDown={() => play(midi)}
              className={`relative flex-1 rounded-b-[3px] transition-colors ${
                held === midi
                  ? "bg-[oklch(0.75_0.12_250)]"
                  : "bg-[oklch(0.96_0.005_90)] hover:bg-[oklch(0.9_0.005_90)]"
              }`}
              style={{
                backgroundImage: "linear-gradient(180deg, oklch(0.9 0.005 90) 0%, oklch(0.98 0.003 90) 12%, oklch(0.96 0.005 90) 100%)",
              }}
              aria-label={label(midi)}
            >
              {midi % 12 === 0 && (
                <span className="absolute bottom-1 left-1/2 -translate-x-1/2 font-mono text-[9px] font-medium text-neutral-500">
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
            className={`absolute top-0 z-10 h-[58%] rounded-b-[3px] transition-colors ${
              held === midi ? "bg-[oklch(0.5_0.12_250)]" : "bg-[oklch(0.12_0.005_255)] hover:bg-[oklch(0.2_0.005_255)]"
            }`}
            style={{
              left: `calc(${(pos / whiteCount) * 100}% + ${100 / whiteCount * 0.72}%)`,
              width: `${(100 / whiteCount) * 0.62}%`,
              backgroundImage: "linear-gradient(180deg, oklch(0.25 0.005 255) 0%, oklch(0.08 0.005 255) 80%)",
              boxShadow: "0 3px 6px oklch(0 0 0 / 0.6)",
            }}
            aria-label={label(midi)}
          />
        ))}
      </div>
      <p className="label-xs">Click or tap the keys to audition the selected instrument</p>
    </div>
  );
}
