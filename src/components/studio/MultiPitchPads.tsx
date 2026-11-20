import { useRef, useState } from "react";
import { Layers } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  CHORDS,
  MULTI_PITCH_PADS,
  SCALES,
  chordName,
  padPitches,
  semitoneLabel,
  type MultiPitchChord,
  type MultiPitchMode,
  type MultiPitchScale,
  type MultiPitchSettings,
} from "@/lib/synclab/multi-pitch";

const MODES: { value: MultiPitchMode; label: string; title: string }[] = [
  { value: "off", label: "OFF", title: "Pads play their own sounds" },
  {
    value: "spread",
    label: "SPREAD",
    title: "One sound across all 16 pads, each pad a step higher",
  },
  { value: "chord", label: "CHORD", title: "One sound across all 16 pads, each pad plays a chord" },
];

/** Mode switch only — shown even when multi pitch is off so it can be turned on. */
export function MultiPitchModeSwitch({
  settings,
  onChange,
  disabled,
}: {
  settings: MultiPitchSettings;
  onChange: (next: MultiPitchSettings) => void;
  disabled?: boolean;
}) {
  return (
    <div className="flex flex-wrap items-center gap-2" role="group" aria-label="Multi pitch mode">
      <Layers className="size-4 text-primary" aria-hidden />
      <span className="label-xs">MULTI PITCH</span>
      <div className="flex gap-1">
        {MODES.map((m) => (
          <Button
            key={m.value}
            type="button"
            size="sm"
            variant={settings.mode === m.value ? "default" : "outline"}
            className="h-9 px-2.5 font-mono text-[10px] sm:h-7"
            aria-pressed={settings.mode === m.value}
            title={m.title}
            disabled={disabled}
            onClick={() => onChange({ ...settings, mode: m.value })}
          >
            {m.label}
          </Button>
        ))}
      </div>
    </div>
  );
}

/**
 * The multi pitch pad grid and its settings. Each pad reports the pitches (semitones from the
 * sound's original pitch) it should play; the owning sampler does the actual playing, so pads,
 * keys and recordings share that sampler's own sound path.
 */
export function MultiPitchPads({
  settings,
  onChange,
  sources,
  rootNote = 60,
  onPress,
  onRelease,
  padKeys,
  disabled,
  emptyMessage,
}: {
  settings: MultiPitchSettings;
  onChange: (next: MultiPitchSettings) => void;
  /** sounds the pads can play; value is the settings.source number */
  sources: { value: number; label: string }[];
  /** MIDI note the sound plays at its original pitch, for chord/note names */
  rootNote?: number;
  onPress: (pad: number, pitches: number[]) => void;
  onRelease?: (pad: number, pitches: number[]) => void;
  /** computer-key labels shown on the pads */
  padKeys?: ArrayLike<string>;
  disabled?: boolean;
  /** shown instead of the pads when there's no sound to play */
  emptyMessage?: string;
}) {
  const [held, setHeld] = useState<Set<number>>(new Set());
  const pressed = useRef<Set<number>>(new Set());
  const noSource = !sources.some((s) => s.value === settings.source);
  const set = (patch: Partial<MultiPitchSettings>) => onChange({ ...settings, ...patch });

  const press = (pad: number) => {
    if (disabled || noSource || pressed.current.has(pad)) return;
    pressed.current.add(pad);
    setHeld(new Set(pressed.current));
    onPress(pad, padPitches(pad, settings));
  };
  const release = (pad: number) => {
    if (!pressed.current.delete(pad)) return;
    setHeld(new Set(pressed.current));
    onRelease?.(pad, padPitches(pad, settings));
  };

  return (
    <section
      className="space-y-2 rounded-md border border-border bg-surface-2/40 p-2"
      aria-label="Multi pitch pads"
    >
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <label className="space-y-1">
          <span className="label-xs">SOUND</span>
          <Select
            value={noSource ? "" : String(settings.source)}
            onValueChange={(v) => set({ source: Number(v) })}
            disabled={!sources.length}
          >
            <SelectTrigger aria-label="Multi pitch sound" className="h-10 w-full sm:h-8">
              <SelectValue placeholder="Pick a sound" />
            </SelectTrigger>
            <SelectContent>
              {sources.map((s) => (
                <SelectItem key={s.value} value={String(s.value)}>
                  {s.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </label>
        <label className="space-y-1">
          <span className="label-xs">SCALE</span>
          <Select
            value={settings.scale}
            onValueChange={(v) => set({ scale: v as MultiPitchScale })}
          >
            <SelectTrigger aria-label="Multi pitch scale" className="h-10 w-full sm:h-8">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {(Object.keys(SCALES) as MultiPitchScale[]).map((k) => (
                <SelectItem key={k} value={k}>
                  {SCALES[k].label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </label>
        <label className="space-y-1">
          <span className="label-xs">ORIGINAL PITCH ON</span>
          <Select
            value={String(settings.rootPad)}
            onValueChange={(v) => set({ rootPad: Number(v) })}
          >
            <SelectTrigger
              aria-label="Pad that plays the original pitch"
              className="h-10 w-full sm:h-8"
            >
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {Array.from({ length: MULTI_PITCH_PADS }, (_, i) => (
                <SelectItem key={i} value={String(i)}>
                  Pad {i + 1}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </label>
        {settings.mode === "chord" ? (
          <label className="space-y-1">
            <span className="label-xs">CHORD</span>
            <Select
              value={settings.chord}
              onValueChange={(v) => set({ chord: v as MultiPitchChord })}
            >
              <SelectTrigger aria-label="Chord type" className="h-10 w-full sm:h-8">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {(Object.keys(CHORDS) as MultiPitchChord[]).map((k) => (
                  <SelectItem key={k} value={k}>
                    {CHORDS[k].label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </label>
        ) : (
          <p className="self-end text-[11px] text-muted-foreground">
            Pads climb the scale from the original-pitch pad; pads before it go lower.
          </p>
        )}
      </div>

      {noSource ? (
        <p className="rounded-md border border-dashed border-border p-4 text-center text-xs text-muted-foreground">
          {emptyMessage ?? "Load a sound first, then pick it under SOUND."}
        </p>
      ) : (
        <div className="performance-pad-grid grid grid-cols-4 gap-2">
          {Array.from({ length: MULTI_PITCH_PADS }, (_, pad) => {
            const pitches = padPitches(pad, settings);
            const root = pitches[0] ?? 0;
            const lit = held.has(pad);
            const isRoot = pad === settings.rootPad;
            const label =
              settings.mode === "chord" ? chordName(pitches, rootNote) : semitoneLabel(root);
            return (
              <Button
                key={pad}
                type="button"
                variant="outline"
                disabled={disabled}
                aria-label={`Multi pitch pad ${pad + 1}, ${settings.mode === "chord" ? `chord ${label}` : `${label} semitones`}`}
                aria-pressed={lit}
                onPointerDown={(e) => {
                  e.preventDefault();
                  try {
                    e.currentTarget.setPointerCapture(e.pointerId);
                  } catch {
                    /* pointer capture is unavailable in a few mobile webviews */
                  }
                  press(pad);
                }}
                onPointerUp={() => release(pad)}
                onPointerCancel={() => release(pad)}
                onLostPointerCapture={() => release(pad)}
                onKeyDown={(e) => {
                  if ((e.key === " " || e.key === "Enter") && !e.repeat) {
                    e.preventDefault();
                    press(pad);
                  }
                }}
                onKeyUp={(e) => {
                  if (e.key === " " || e.key === "Enter") release(pad);
                }}
                className={`mpc-pad relative flex h-20 min-w-0 touch-none flex-col items-start justify-between p-2 text-left select-none ${lit ? "is-lit border-primary bg-primary/40" : isRoot ? "border-primary/70 bg-primary/10" : "bg-surface-2"}`}
              >
                <span className="font-mono text-[9px] text-muted-foreground">
                  {pad + 1}
                  {padKeys?.[pad] ? ` · ${padKeys[pad]?.toUpperCase()}` : ""}
                </span>
                <span className="font-mono text-base font-semibold text-foreground">{label}</span>
                <span className="font-mono text-[9px] text-muted-foreground">
                  {settings.mode === "chord"
                    ? pitches.map(semitoneLabel).join(" ")
                    : isRoot
                      ? "ORIGINAL"
                      : "semitones"}
                </span>
              </Button>
            );
          })}
        </div>
      )}
    </section>
  );
}
