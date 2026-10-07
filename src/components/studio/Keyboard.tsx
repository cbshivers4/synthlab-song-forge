import { useEffect, useState, useSyncExternalStore } from "react";
import { Keyboard as ComputerKeyboard, Lock, Minus, Music2, Plus, Unlock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import { useStudio } from "@/lib/synclab/store";
import { keysSnapshot, subscribeKeys } from "@/lib/synclab/active-keys";
import type { Track } from "@/lib/synclab/types";
import { QWERTY_MAP, qwertyEnabled, qwertyOctave, setQwertyEnabled, setQwertyOctave } from "@/lib/synclab/qwerty";

const NOTE_NAMES = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];
const BLACK = new Set([1, 3, 6, 8, 10]);
const SCALES: Record<string, number[]> = {
  Major: [0, 2, 4, 5, 7, 9, 11],
  Minor: [0, 2, 3, 5, 7, 8, 10],
  Dorian: [0, 2, 3, 5, 7, 9, 10],
  Phrygian: [0, 1, 3, 5, 7, 8, 10],
  Mixolydian: [0, 2, 4, 5, 7, 9, 10],
  "Minor Pent": [0, 3, 5, 7, 10],
  Blues: [0, 3, 5, 6, 7, 10],
  Chromatic: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11],
};
const EMPTY: number[] = [];
const CHORDS = [
  { name: "MAJ", intervals: [0, 4, 7] },
  { name: "MIN", intervals: [0, 3, 7] },
  { name: "7", intervals: [0, 4, 7, 10] },
  { name: "MAJ7", intervals: [0, 4, 7, 11] },
  { name: "MIN7", intervals: [0, 3, 7, 10] },
  { name: "SUS2", intervals: [0, 2, 7] },
  { name: "SUS4", intervals: [0, 5, 7] },
  { name: "DIM", intervals: [0, 3, 6] },
] as const;

export function Keyboard({ track, onPlay, disabled = false }: { track?: Track; onPlay?: (midi: number, velocity: number) => void; disabled?: boolean } = {}) {
  const { selected: studioSelected, previewNote } = useStudio();
  const selected = track ?? studioSelected;
  const [octave, setOctave] = useState(4); // C4 base
  const [velocity, setVelocity] = useState(0.9);
  const [held, setHeld] = useState<number[]>([]);
  const [locked, setLocked] = useState(false);
  const [root, setRoot] = useState(0);
  const [scaleName, setScaleName] = useState("Minor");
  const [scaleLock, setScaleLock] = useState(false);
  const [typing, setTyping] = useState(false);
  const [typingOctave, setTypingOctave] = useState(4);
  useEffect(() => {
    const sync = () => { setTyping(qwertyEnabled()); setTypingOctave(qwertyOctave()); };
    sync();
    window.addEventListener("synclab:qwerty", sync);
    return () => window.removeEventListener("synclab:qwerty", sync);
  }, []);
  // Notes sounding from any source (MIDI controller, typing keys, screen taps).
  const external = useSyncExternalStore(subscribeKeys, keysSnapshot, () => EMPTY);
  const litKeys = new Set([...held, ...external]);

  // Follow the player: when a note lands outside the visible two octaves,
  // slide the keyboard so it is in view (bass ←→ treble), unless range-locked.
  useEffect(() => {
    if (locked || external.length === 0) return;
    const lo = Math.min(...external);
    const hi = Math.max(...external);
    setOctave((o) => {
      const base = (o + 1) * 12;
      if (lo >= base && hi <= base + 23) return o;
      const center = Math.floor((lo + hi) / 2 / 12) - 1;
      return Math.min(7, Math.max(1, center));
    });
  }, [external, locked]);

  const slideTo = (o: number) => {
    if (locked) return;
    setOctave(Math.min(7, Math.max(1, o)));
  };

  const base = (octave + 1) * 12; // C of the chosen octave in MIDI
  const visibleWhite = 14; // two octaves of white keys in view
  const LOW = 24; // C1 — the full strip spans C1..B8 and slides under the window
  const whiteCount = 56;
  const whiteKeys: number[] = [];
  const blackKeys: { midi: number; pos: number }[] = [];
  for (let s = 0; s < 96; s++) {
    if (BLACK.has(s % 12)) blackKeys.push({ midi: LOW + s, pos: whiteKeys.length });
    else whiteKeys.push(LOW + s);
  }
  const shiftPct = ((octave - 1) * 7 / whiteCount) * 100;

  const scale = SCALES[scaleName] ?? SCALES["Minor"] ?? [];
  const inScale = (midi: number) => scale.includes((((midi - root) % 12) + 12) % 12);
  const fitToScale = (midi: number) => {
    if (!scaleLock || inScale(midi)) return midi;
    for (let distance = 1; distance < 12; distance++) {
      if (inScale(midi - distance)) return midi - distance;
      if (inScale(midi + distance)) return midi + distance;
    }
    return midi;
  };

  const playNotes = (notes: number[]) => {
    if (disabled || (!onPlay && !selected)) return;
    const fitted = [...new Set(notes.map(fitToScale))];
    setHeld(fitted);
    fitted.forEach((midi) => {
      if (onPlay) onPlay(midi, velocity);
      else if (selected) previewNote(selected.id, midi);
    });
    window.setTimeout(() => setHeld([]), 240);
  };

  const play = (midi: number) => playNotes([midi]);
  const playChord = (intervals: readonly number[]) => playNotes(intervals.map((interval) => base + root + interval));

  // Embedded keyboards claim typing once; never add a second global note path.
  useEffect(() => {
    if (!track && !onPlay) return;
    const down = (event: KeyboardEvent) => {
      const el = event.target as HTMLElement | null;
      if (disabled || !qwertyEnabled() || event.defaultPrevented || event.metaKey || event.ctrlKey || event.altKey || el?.isContentEditable || (el && /^(INPUT|TEXTAREA|SELECT)$/.test(el.tagName))) return;
      const key = event.key.toLowerCase();
      const offset = QWERTY_MAP[key];
      if (offset === undefined && key !== "z" && key !== "x") return;
      event.preventDefault();
      if (event.repeat) return;
      if (key === "z" || key === "x") {
        const next = qwertyOctave() + (key === "z" ? -1 : 1);
        setQwertyOctave(next);
        slideTo(next);
      } else if (offset !== undefined) play((qwertyOctave() + 1) * 12 + offset);
    };
    window.addEventListener("keydown", down, true);
    return () => window.removeEventListener("keydown", down, true);
  });

  const label = (midi: number) => `${NOTE_NAMES[midi % 12]}${Math.floor(midi / 12) - 1}`;

  if (!onPlay && (!selected || !selected.patch))
    return (
      <p className="text-sm text-muted-foreground">
        Select an instrument, MIDI or sampler track, then play the keys.
      </p>
    );

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-2">
        <Button size="sm" variant={typing ? "secondary" : "outline"} aria-pressed={typing} disabled={disabled}
          title="A W S E D F T G Y H U J K O L play notes; Z / X change octave"
          onClick={() => { setQwertyEnabled(!typing); if (!typing) setQwertyOctave(octave); }}>
          <ComputerKeyboard className="size-4" /> Computer keys {typing ? "ON" : "OFF"}
        </Button>
        {typing && <span className="font-mono text-xs text-muted-foreground">C{typingOctave} · Z / X</span>}
      </div>
      <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-2 sm:flex sm:gap-3">
        <span className="label-xs">
          {onPlay ? "Selected sample" : `Playing ${selected?.name} · ${selected?.instrument ?? "SYNTH"}`}
        </span>
        <div className="flex shrink-0 items-center gap-1 sm:ml-auto">
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
        <div className="col-span-2 flex w-full items-center gap-2 sm:col-auto sm:w-32">
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
        <Button
          size="sm"
          variant="outline"
          onClick={() => slideTo(1)}
          disabled={locked}
          className="h-6 px-2 font-mono text-[10px] tracking-wider"
        >
          BASS
        </Button>
        <Slider
          className="flex-1 py-2 [&>span]:h-2.5 [&_[role=slider]]:size-7 [&_[role=slider]]:border-2"
          value={[octave]}
          min={1}
          max={7}
          step={1}
          disabled={locked}
          aria-label="Slide keyboard range"
          onValueChange={([v = 4]) => slideTo(v)}
        />
        <Button
          size="sm"
          variant="outline"
          onClick={() => slideTo(4)}
          disabled={locked}
          className="h-6 px-2 font-mono text-[10px] tracking-wider"
        >
          MID
        </Button>
        <Button
          size="sm"
          variant="outline"
          onClick={() => slideTo(7)}
          disabled={locked}
          className="h-6 px-2 font-mono text-[10px] tracking-wider"
        >
          TREBLE
        </Button>
      </div>

      <div className="overflow-x-auto rounded-[3px] border border-border bg-surface/60 p-1.5">
        <div className="flex min-w-max items-center gap-1.5">
        <Music2 className="size-3.5 text-primary" />
        <span className="label-xs px-1">SCALE</span>
        <Select value={String(root)} onValueChange={(value) => setRoot(Number(value))}>
          <SelectTrigger className="h-7 w-16 text-[10px]" aria-label="Scale root">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {NOTE_NAMES.map((note, index) => (
              <SelectItem key={note} value={String(index)}>{note}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={scaleName} onValueChange={setScaleName}>
          <SelectTrigger className="h-7 w-28 text-[10px]" aria-label="Scale type">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {Object.keys(SCALES).map((name) => (
              <SelectItem key={name} value={name}>{name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button
          size="sm"
          variant={scaleLock ? "default" : "outline"}
          className="h-7 px-2 font-mono text-[10px] tracking-wider"
          aria-pressed={scaleLock}
          onClick={() => setScaleLock((value) => !value)}
        >
          SCALE LOCK
        </Button>
        <span className="mx-1 hidden h-5 w-px bg-border sm:block" />
        <span className="label-xs px-1">CHORDS</span>
        {CHORDS.map((chord) => (
          <Button
            key={chord.name}
            size="sm"
            variant="ghost"
            className="h-7 px-2 font-mono text-[10px] tracking-wider"
            onClick={() => playChord(chord.intervals)}
          >
            {NOTE_NAMES[root]} {chord.name}
          </Button>
        ))}
        </div>
      </div>

      <div
        onWheel={(e) => slideTo(octave + (e.deltaY > 0 ? -1 : 1))}
         className="relative h-36 w-full min-w-0 select-none overflow-hidden rounded-[3px] border border-border bg-background"
        style={{ touchAction: "none" }}
      >
        <div
          className="absolute inset-y-0 left-0 transition-transform duration-300 ease-out"
          style={{ width: `${(whiteCount / visibleWhite) * 100}%`, transform: `translateX(-${shiftPct}%)` }}
        >
        {/* white keys */}
        <div className="flex h-full gap-px bg-black">
          {whiteKeys.map((midi) => (
            <button
              key={midi}
               disabled={disabled}
              onPointerDown={() => play(midi)}
              className={`relative flex-1 rounded-b-[3px] transition-colors ${
                litKeys.has(midi)
                  ? "bg-[oklch(0.75_0.12_250)]"
                  : inScale(midi)
                    ? "bg-[oklch(0.94_0.035_195)] hover:bg-[oklch(0.88_0.06_195)]"
                    : "bg-[oklch(0.96_0.005_90)] hover:bg-[oklch(0.9_0.005_90)]"
              }`}
              style={{
                backgroundImage: litKeys.has(midi)
                  ? "linear-gradient(180deg, var(--primary) 0%, color-mix(in oklab, var(--primary) 55%, white) 100%)"
                  : inScale(midi)
                  ? "linear-gradient(180deg, color-mix(in oklab, var(--primary) 32%, oklch(0.9 0.005 90)) 0%, color-mix(in oklab, var(--primary) 12%, oklch(0.98 0.003 90)) 16%, oklch(0.95 0.02 195) 100%)"
                  : "linear-gradient(180deg, oklch(0.9 0.005 90) 0%, oklch(0.98 0.003 90) 12%, oklch(0.96 0.005 90) 100%)",
              }}
              aria-label={label(midi)}
            >
              {typing && Object.entries(QWERTY_MAP).map(([key, offset]) => (typingOctave + 1) * 12 + offset === midi ? <span key={key} className="absolute bottom-5 left-1/2 -translate-x-1/2 font-mono text-xs text-background">{key.toUpperCase()}</span> : null)}
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
             disabled={disabled}
            onPointerDown={() => play(midi)}
            className={`absolute top-0 z-10 h-[58%] rounded-b-[3px] transition-colors ${
               litKeys.has(midi)
                 ? "bg-[oklch(0.5_0.12_250)]"
                 : inScale(midi)
                   ? "bg-[oklch(0.24_0.055_195)] hover:bg-[oklch(0.3_0.07_195)]"
                   : "bg-[oklch(0.12_0.005_255)] hover:bg-[oklch(0.2_0.005_255)]"
            }`}
            style={{
              left: `calc(${(pos / whiteCount) * 100}% + ${100 / whiteCount * 0.72}%)`,
              width: `${(100 / whiteCount) * 0.62}%`,
               backgroundImage: litKeys.has(midi)
                 ? "linear-gradient(180deg, color-mix(in oklab, var(--primary) 70%, black) 0%, var(--primary) 100%)"
                 : inScale(midi)
                 ? "linear-gradient(180deg, color-mix(in oklab, var(--primary) 45%, oklch(0.25 0.005 255)) 0%, oklch(0.12 0.03 195) 80%)"
                 : "linear-gradient(180deg, oklch(0.25 0.005 255) 0%, oklch(0.08 0.005 255) 80%)",
              boxShadow: "0 3px 6px oklch(0 0 0 / 0.6)",
            }}
            aria-label={label(midi)}
          >
            {typing && Object.entries(QWERTY_MAP).map(([key, offset]) => (typingOctave + 1) * 12 + offset === midi ? <span key={key} className="absolute bottom-2 left-1/2 -translate-x-1/2 font-mono text-xs text-primary">{key.toUpperCase()}</span> : null)}
          </button>
        ))}
        </div>
      </div>
      <p className="label-xs">Highlighted keys are in {NOTE_NAMES[root]} {scaleName} · click a chord to play it</p>
    </div>
  );
}
