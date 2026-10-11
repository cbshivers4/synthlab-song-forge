import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useStudio } from "@/lib/synclab/store";
import { claimMidiNotes, midiSupported, midiUnsupportedMessage } from "@/lib/synclab/midi";

export type PadNote = { pitch: number; channel: number } | null;
const KEY = "synclab.midiPads.v1";
const NAMES = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];
export const padNoteLabel = (n: PadNote) => (n ? `${NAMES[n.pitch % 12]}${Math.floor(n.pitch / 12) - 1} · CH ${n.channel + 1}` : "");

function load(scope: string): PadNote[] {
  try { return (JSON.parse(window.localStorage.getItem(KEY) || "{}") as Record<string, PadNote[]>)[scope] ?? []; } catch { return []; }
}
function save(scope: string, notes: PadNote[]) {
  try {
    const all = JSON.parse(window.localStorage.getItem(KEY) || "{}") as Record<string, PadNote[]>;
    all[scope] = notes;
    window.localStorage.setItem(KEY, JSON.stringify(all));
  } catch { /* storage unavailable */ }
}

/** Controller notes mapped to on-screen pads; mapped notes are consumed so tracks don't also play them. */
export function useMidiPads(scope: string, count: number, onPress: (i: number, velocity: number) => void, onRelease?: (i: number) => void) {
  const [notes, setNotes] = useState<PadNote[]>([]);
  const [learnMode, setLearnModeState] = useState(false);
  const [target, setTarget] = useState<number | null>(null);
  useEffect(() => setNotes(load(scope)), [scope]);
  const r = useRef({ notes, target, count, onPress, onRelease });
  r.current = { notes, target, count, onPress, onRelease };

  const update = useCallback((fn: (n: PadNote[]) => PadNote[]) => {
    setNotes((prev) => { const next = fn(prev); save(scope, next); return next; });
  }, [scope]);

  useEffect(() => claimMidiNotes((msg) => {
    if (msg.type !== "on" && msg.type !== "off") return false;
    const cur = r.current;
    if (msg.type === "on" && cur.target !== null) {
      const t = cur.target;
      const note = { pitch: msg.pitch, channel: msg.channel };
      update((prev) => Array.from({ length: Math.max(prev.length, t + 1) }, (_, i) =>
        i === t ? note : prev[i]?.pitch === note.pitch && prev[i]?.channel === note.channel ? null : prev[i] ?? null));
      setTarget(null);
      toast.success(`Pad ${t + 1} mapped`, { description: padNoteLabel(note) });
      return true;
    }
    const i = cur.notes.findIndex((n) => n && n.pitch === msg.pitch && n.channel === msg.channel);
    if (i < 0 || i >= cur.count) return false;
    if (msg.type === "on") cur.onPress(i, msg.velocity || 1);
    else cur.onRelease?.(i);
    return true;
  }), [update]);

  return {
    notes, learnMode, target, count,
    setLearnMode: (v: boolean) => { setLearnModeState(v); if (!v) setTarget(null); },
    arm: (i: number) => setTarget((t) => (t === i ? null : i)),
    clear: (i: number) => update((prev) => prev.map((n, j) => (j === i ? null : n))),
    clearAll: () => update(() => []),
  };
}

export function MidiPadLearnBar({ pads, label = "pads", names }: { pads: ReturnType<typeof useMidiPads>; label?: string; names?: (i: number) => string }) {
  const { midiInputId, enableMidi } = useStudio();
  const mapped = pads.notes.slice(0, pads.count).filter(Boolean).length;
  return (
    <div className="space-y-2 rounded-md border border-border bg-surface-2/60 p-2" aria-label={`MIDI Learn ${label}`}>
      <div className="flex flex-wrap items-center gap-2">
        <Button type="button" size="sm" variant={pads.learnMode ? "default" : "secondary"} className="min-h-9 font-mono text-[10px] tracking-widest"
          aria-pressed={pads.learnMode}
          onClick={() => { if (!midiSupported()) { toast.error(midiUnsupportedMessage()); return; } pads.setLearnMode(!pads.learnMode); if (!midiInputId) enableMidi(); }}>
          {pads.learnMode ? "DONE" : `MIDI LEARN ${label.toUpperCase()}`}
        </Button>
        <span className="text-xs text-muted-foreground">
          {pads.learnMode
            ? pads.target !== null ? `Press a key or pad on your controller for ${names?.(pads.target) ?? `pad ${pads.target + 1}`}…` : "Pick a number, then press a controller key or pad."
            : mapped ? `${mapped} mapped to your controller` : "Map your controller's pads or keys"}
        </span>
        {pads.learnMode && mapped > 0 && <Button type="button" size="sm" variant="ghost" className="min-h-9 text-xs" onClick={pads.clearAll}>Clear all</Button>}
      </div>
      {pads.learnMode && (
        <div className="flex flex-wrap gap-1">
          {Array.from({ length: pads.count }, (_, i) => {
            const n = pads.notes[i] ?? null;
            return (
              <span key={i} className="inline-flex items-center">
                <Button type="button" size="sm" variant={pads.target === i ? "default" : n ? "secondary" : "outline"}
                  className={cn("min-h-9 min-w-12 px-2 font-mono text-[10px]", pads.target === i && "animate-pulse")}
                  aria-label={`Learn ${names?.(i) ?? `pad ${i + 1}`}`} aria-pressed={pads.target === i} onClick={() => pads.arm(i)}>
                  {i + 1}{n ? ` · ${padNoteLabel(n).split(" ·")[0]}` : ""}
                </Button>
                {n && <Button type="button" size="sm" variant="ghost" className="min-h-9 px-1 text-xs" aria-label={`Clear ${names?.(i) ?? `pad ${i + 1}`} mapping`} onClick={() => pads.clear(i)}>×</Button>}
              </span>
            );
          })}
        </div>
      )}
    </div>
  );
}
