import { useRef, useState } from "react";
import { useIsMobile } from "@/hooks/use-mobile";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useStudio } from "@/lib/synclab/store";
import { uid } from "@/lib/synclab/presets";
import type { MidiNote, Track } from "@/lib/synclab/types";

const NOTE_NAMES = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];
const isBlack = (p: number) => [1, 3, 6, 8, 10].includes(((p % 12) + 12) % 12);
const ROWS = 24;
const ROW_H = 16;

const SCALES: Record<string, number[]> = {
  Minor: [0, 2, 3, 5, 7, 8, 10],
  Major: [0, 2, 4, 5, 7, 9, 11],
  Dorian: [0, 2, 3, 5, 7, 9, 10],
  Phrygian: [0, 1, 3, 5, 7, 8, 10],
  "Minor Pent": [0, 3, 5, 7, 10],
  Chromatic: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11],
};

type Drag =
  | { mode: "move"; id: string; startX: number; startY: number; step: number; pitch: number }
  | { mode: "resize"; id: string; startX: number; length: number }
  | null;

export function PianoRoll({ track }: { track: Track }) {
  const isMobile = useIsMobile();
  const { setNotes, previewNote, transport } = useStudio();
  const [low, setLow] = useState(48);
  const [grid, setGrid] = useState(1); // steps per snap
  const [len, setLen] = useState(1);
  const [bars, setBars] = useState(2);
  const [scaleLock, setScaleLock] = useState(false);
  const [root, setRoot] = useState(0);
  const [scaleName, setScaleName] = useState("Minor");
  const [sel, setSel] = useState<string[]>([]);
  const [trackOct, setTrackOct] = useState(0);
  const gridRef = useRef<HTMLDivElement | null>(null);
  const drag = useRef<Drag>(null);

  const steps = bars * 16;
  const notes = track.notes ?? [];
  const pitches = Array.from({ length: ROWS }, (_, i) => low + ROWS - 1 - i);
  const scale = SCALES[scaleName] ?? SCALES["Minor"]!;
  const inScale = (p: number) => scale.includes((((p - root) % 12) + 12) % 12);
  const snap = (v: number) => Math.max(0, Math.round(v / grid) * grid);
  const apply = (fn: (n: MidiNote) => MidiNote) =>
    setNotes(
      track.id,
      notes.map((n) => (sel.length === 0 || sel.includes(n.id) ? fn(n) : n)),
    );
  const targets = () => (sel.length ? notes.filter((n) => sel.includes(n.id)) : notes);

  /** Move every note on this track up or down an octave and follow it with the view. */
  const shiftTrackOctave = (dir: number) => {
    const next = trackOct + dir;
    if (next < -3 || next > 3) return;
    setTrackOct(next);
    setNotes(track.id, notes.map((n) => ({ ...n, pitch: Math.min(120, Math.max(12, n.pitch + dir * 12)) })));
    setLow((l) => Math.min(96, Math.max(12, l + dir * 12)));
  };

  const posFromEvent = (e: React.PointerEvent | React.MouseEvent) => {
    const el = gridRef.current;
    if (!el) return null;
    const r = el.getBoundingClientRect();
    const x = ((e.clientX - r.left) / r.width) * steps;
    const row = Math.floor((e.clientY - r.top) / ROW_H);
    const pitch = pitches[Math.min(ROWS - 1, Math.max(0, row))]!;
    return { step: snap(x), pitch, rawX: x };
  };

  const addNote = (e: React.MouseEvent) => {
    const p = posFromEvent(e);
    if (!p) return;
    if (scaleLock && !inScale(p.pitch)) return;
    const n: MidiNote = { id: uid(), pitch: p.pitch, step: p.step, length: len, velocity: 0.85 };
    setNotes(track.id, [...notes, n]);
    setSel([n.id]);
    previewNote(track.id, p.pitch);
  };

  const onNoteDown = (e: React.PointerEvent, n: MidiNote, resize: boolean) => {
    e.stopPropagation();
    e.currentTarget.setPointerCapture(e.pointerId);
    setSel(e.shiftKey ? (s) => (s.includes(n.id) ? s : [...s, n.id]) : [n.id]);
    drag.current = resize
      ? { mode: "resize", id: n.id, startX: e.clientX, length: n.length }
      : { mode: "move", id: n.id, startX: e.clientX, startY: e.clientY, step: n.step, pitch: n.pitch };
  };

  const onMove = (e: React.PointerEvent) => {
    const d = drag.current;
    const el = gridRef.current;
    if (!d || !el) return;
    const stepPx = el.getBoundingClientRect().width / steps;
    if (d.mode === "resize") {
      const nl = Math.max(grid, snap(d.length + (e.clientX - d.startX) / stepPx) || grid);
      setNotes(track.id, notes.map((n) => (n.id === d.id ? { ...n, length: nl } : n)));
    } else {
      const ds = snap(d.step + (e.clientX - d.startX) / stepPx);
      const dp = d.pitch - Math.round((e.clientY - d.startY) / ROW_H);
      setNotes(
        track.id,
        notes.map((n) => (n.id === d.id ? { ...n, step: ds, pitch: Math.max(0, Math.min(120, dp)) } : n)),
      );
    }
  };

  const endDrag = () => {
    drag.current = null;
  };

  const del = (id: string) => setNotes(track.id, notes.filter((n) => n.id !== id));

  const Tool = ({ children, onClick, active }: { children: React.ReactNode; onClick: () => void; active?: boolean }) => (
    <Button size="sm" variant={active ? "default" : "ghost"} className="h-7 px-2 text-[10px]" onClick={onClick}>
      {children}
    </Button>
  );

  return (
    <div className="space-y-1.5" onPointerUp={endDrag} onPointerLeave={endDrag}>
      {/* toolbar */}
      <div className="flex items-center overflow-x-auto whitespace-nowrap scrollbar-hide gap-1.5 rounded-sm border border-border bg-surface/60 p-1.5">
        <span className="label-xs px-1">GRID</span>
        {([["1/4", 4], ["1/8", 2], ["1/16", 1], ["1/32", 0.5]] as const).map(([l, v]) => (
          <Tool key={l} active={grid === v} onClick={() => setGrid(v)}>
            {l}
          </Tool>
        ))}
        <span className="label-xs px-1">LEN</span>
        {([["1/4", 4], ["1/8", 2], ["1/16", 1], ["1/32", 0.5]] as const).map(([l, v]) => (
          <Tool key={`L${l}`} active={len === v} onClick={() => setLen(v)}>
            {l}
          </Tool>
        ))}
        <Select value={String(bars)} onValueChange={(v) => setBars(Number(v))}>
          <SelectTrigger className="h-7 w-20 text-[10px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {[1, 2, 4, 8].map((b) => (
              <SelectItem key={b} value={String(b)}>
                {b} BAR{b > 1 ? "S" : ""}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={String(low)} onValueChange={(v) => setLow(Number(v))}>
          <SelectTrigger className="h-7 w-24 text-[10px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {[24, 36, 48, 60, 72].map((o) => (
              <SelectItem key={o} value={String(o)}>
                OCT {Math.floor(o / 12) - 1}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <span className="label-xs px-1">TRACK OCT</span>
        <Tool onClick={() => shiftTrackOctave(-1)}>−</Tool>
        <span className="w-10 text-center font-mono text-[10px] text-primary">
          {trackOct > 0 ? `+${trackOct}` : trackOct}
        </span>
        <Tool onClick={() => shiftTrackOctave(1)}>+</Tool>
      </div>


      <div className="flex items-center overflow-x-auto whitespace-nowrap scrollbar-hide gap-1.5 rounded-sm border border-border bg-surface/60 p-1.5">
        <Tool onClick={() => apply((n) => ({ ...n, step: Math.round(n.step / grid) * grid }))}>QUANTIZE</Tool>
        <Tool onClick={() => apply((n) => ({ ...n, step: n.step + (Math.round(n.step / grid) * grid - n.step) * 0.5 }))}>
          QUANT 50%
        </Tool>
        <Tool onClick={() => apply((n) => ({ ...n, pitch: n.pitch + 12 }))}>OCT +</Tool>
        <Tool onClick={() => apply((n) => ({ ...n, pitch: n.pitch - 12 }))}>OCT −</Tool>
        <Tool onClick={() => apply((n) => ({ ...n, pitch: n.pitch + 1 }))}>+1</Tool>
        <Tool onClick={() => apply((n) => ({ ...n, pitch: n.pitch - 1 }))}>−1</Tool>
        <Tool onClick={() => apply((n) => ({ ...n, velocity: Math.min(1, n.velocity + 0.1) }))}>VEL +</Tool>
        <Tool onClick={() => apply((n) => ({ ...n, velocity: Math.max(0.05, n.velocity - 0.1) }))}>VEL −</Tool>
        <Tool
          onClick={() =>
            apply((n) => ({
              ...n,
              step: Math.max(0, n.step + (Math.random() - 0.5) * 0.3),
              velocity: Math.min(1, Math.max(0.15, n.velocity + (Math.random() - 0.5) * 0.3)),
            }))
          }
        >
          HUMANIZE
        </Tool>
        <Tool
          onClick={() => {
            const sorted = [...notes].sort((a, b) => a.step - b.step);
            setNotes(
              track.id,
              notes.map((n) => {
                const i = sorted.findIndex((s) => s.id === n.id);
                const next = sorted[i + 1];
                return next ? { ...n, length: Math.max(grid, next.step - n.step) } : n;
              }),
            );
          }}
        >
          LEGATO
        </Tool>
        <Tool
          onClick={() => {
            const t = targets();
            if (!t.length) return;
            const end = Math.max(...t.map((n) => n.step + n.length));
            setNotes(track.id, [...notes, ...t.map((n) => ({ ...n, id: uid(), step: n.step + end }))]);
          }}
        >
          DUPLICATE
        </Tool>
        <Tool
          onClick={() => {
            const t = targets();
            if (!t.length) return;
            const max = Math.max(...t.map((n) => n.step + n.length));
            const min = Math.min(...t.map((n) => n.step));
            apply((n) => ({ ...n, step: min + (max - (n.step + n.length)) }));
          }}
        >
          REVERSE
        </Tool>
        <Tool onClick={() => apply((n) => ({ ...n, step: n.step * 2, length: n.length * 2 }))}>2× LONGER</Tool>
        <Tool onClick={() => apply((n) => ({ ...n, step: n.step / 2, length: Math.max(0.5, n.length / 2) }))}>2× FASTER</Tool>
        <Tool active={scaleLock} onClick={() => setScaleLock(!scaleLock)}>
          LOCK
        </Tool>
        <Select value={String(root)} onValueChange={(v) => setRoot(Number(v))}>
          <SelectTrigger className="h-7 w-16 text-[10px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {NOTE_NAMES.map((n, i) => (
              <SelectItem key={n} value={String(i)}>
                {n}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={scaleName} onValueChange={setScaleName}>
          <SelectTrigger className="h-7 w-28 text-[10px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {Object.keys(SCALES).map((s) => (
              <SelectItem key={s} value={s}>
                {s}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {scaleLock && (
          <Tool onClick={() => apply((n) => (inScale(n.pitch) ? n : { ...n, pitch: n.pitch - 1 }))}>FIT</Tool>
        )}
        <Tool onClick={() => setSel(notes.map((n) => n.id))}>SELECT ALL</Tool>
        <Tool onClick={() => setSel([])}>DESELECT</Tool>
        <Tool onClick={() => setNotes(track.id, sel.length ? notes.filter((n) => !sel.includes(n.id)) : [])}>
          {sel.length ? "DELETE SEL" : "CLEAR"}
        </Tool>
      </div>

      {/* editor */}
      <div className="flex overflow-hidden rounded-[2px] border border-border bg-background">
        <div className="w-16 shrink-0 border-r border-border bg-surface-2">
          {pitches.map((p) => (
            <button
              key={p}
              onClick={() => previewNote(track.id, p)}
              style={{ height: ROW_H }}
              className={`flex w-full items-center justify-end border-b border-background px-1 font-mono text-[8px] font-semibold ${
                 isBlack(p) ? "bg-background text-muted-foreground" : "bg-foreground text-background"
              }`}
            >
              {NOTE_NAMES[((p % 12) + 12) % 12]}
              {Math.floor(p / 12) - 1}
            </button>
          ))}
        </div>

        <div className="relative flex-1 overflow-hidden">
          <div
            ref={gridRef}
            className="relative select-none bg-background"
            style={{ height: ROWS * ROW_H }}
            onDoubleClick={addNote}
            onPointerMove={onMove}
          >
            {pitches.map((p, i) => (
              <div
                key={p}
                className="absolute inset-x-0 border-b border-border/25"
                style={{
                  top: i * ROW_H,
                  height: ROW_H,
                  background: isBlack(p) ? "color-mix(in oklab, var(--surface-2) 70%, transparent)" : "transparent",
                  opacity: scaleLock && !inScale(p) ? 0.35 : 1,
                }}
              />
            ))}
            {Array.from({ length: steps + 1 }).map((_, s) => (
              <div
                key={s}
                className="absolute top-0 bottom-0"
                style={{
                  left: `${(s / steps) * 100}%`,
                  width: 1,
                   background: s % 16 === 0 ? "var(--editor-grid-strong)" : s % 4 === 0 ? "var(--editor-grid)" : "color-mix(in oklab, var(--editor-grid) 35%, transparent)",
                }}
              />
            ))}
            {transport.playing && (
              <div
                className="pointer-events-none absolute top-0 bottom-0 w-px bg-[var(--neon)]"
                style={{ left: `${((transport.step % steps) / steps) * 100}%` }}
              />
            )}
            {notes.map((n) => {
              const rowIndex = pitches.indexOf(n.pitch);
              if (rowIndex < 0) return null;
              const selected = sel.includes(n.id);
              return (
                <div
                  key={n.id}
                  onPointerDown={(e) => onNoteDown(e, n, false)}
                  onContextMenu={(e) => {
                    e.preventDefault();
                    del(n.id);
                  }}
                  className="absolute rounded-[1px] border border-clip-midi-dark/60 bg-clip-midi shadow-sm"
                  style={{
                    left: `${(n.step / steps) * 100}%`,
                    width: `${(n.length / steps) * 100}%`,
                    top: rowIndex * ROW_H + 1,
                    height: ROW_H - 3,
                    opacity: 0.55 + n.velocity * 0.45,
                    outline: selected ? "1px solid var(--foreground)" : "none",
                    cursor: "grab",
                  }}
                  title={`${NOTE_NAMES[((n.pitch % 12) + 12) % 12]}${Math.floor(n.pitch / 12) - 1} · vel ${Math.round(n.velocity * 127)}`}
                >
                  <div
                    onPointerDown={(e) => onNoteDown(e, n, true)}
                     className="absolute inset-y-0 right-0 w-1.5 cursor-ew-resize bg-clip-midi-dark/35"
                  />
                </div>
              );
            })}
          </div>

          {/* velocity lane */}
          <div className="relative h-16 border-t border-border bg-surface/70">
            <span className="label-xs absolute top-0.5 left-1 z-10">VELOCITY</span>
            {notes.map((n) => (
              <div
                key={n.id}
                onPointerDown={(e) => {
                  e.preventDefault();
                  setSel([n.id]);
                  const el = e.currentTarget.parentElement!;
                  const r = el.getBoundingClientRect();
                  const set = (cy: number) =>
                    setNotes(
                      track.id,
                      (track.notes ?? []).map((x) =>
                        x.id === n.id ? { ...x, velocity: Math.min(1, Math.max(0.05, 1 - (cy - r.top) / r.height)) } : x,
                      ),
                    );
                  set(e.clientY);
                  const mv = (ev: PointerEvent) => set(ev.clientY);
                  const up = () => {
                    window.removeEventListener("pointermove", mv);
                    window.removeEventListener("pointerup", up);
                  };
                  window.addEventListener("pointermove", mv);
                  window.addEventListener("pointerup", up);
                }}
                 className="absolute bottom-0 w-1.5 cursor-ns-resize rounded-t-[1px] bg-clip-midi"
                style={{
                  left: `calc(${(n.step / steps) * 100}% )`,
                  height: `${n.velocity * 100}%`,
                   outline: sel.includes(n.id) ? "1px solid var(--foreground)" : "none",
                }}
              />
            ))}
          </div>
        </div>
      </div>

      <p className="label-xs">
        DOUBLE-CLICK TO DRAW · DRAG TO MOVE · DRAG RIGHT EDGE TO RESIZE · RIGHT-CLICK TO DELETE · SHIFT-CLICK TO MULTI-SELECT ·
        DRAG BARS IN VELOCITY LANE
      </p>
    </div>
  );
}
