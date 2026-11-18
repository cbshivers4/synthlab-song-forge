import { getPlayStep, usePlayStep } from "@/lib/synclab/playhead";
import { ClipboardPaste, Copy, CopyPlus, MousePointer2, Pencil, Scissors, Trash2, Undo2, Redo2, ZoomIn, ZoomOut, ChevronLeft, ChevronRight, ArrowLeft, ArrowRight, ArrowUp, ArrowDown, X } from "lucide-react";
import { duplicatePianoNotes, movePianoNotes, pastePianoNotes } from "@/lib/synclab/piano-edit";
import { capturedNote, loopRegion } from "@/lib/synclab/recording-region";
import { canvasPoint } from "@/lib/synclab/canvas-point";
import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { keysSnapshot, subscribeKeys } from "@/lib/synclab/active-keys";

const NO_KEYS: number[] = [];
import { stepsPerBar } from "@/lib/synclab/timebase";
import { useIsMobile } from "@/hooks/use-mobile";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { Popover, PopoverAnchor, PopoverContent } from "@/components/ui/popover";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useStudio } from "@/lib/synclab/store";
import { uid } from "@/lib/synclab/presets";
import type { MidiNote, Track } from "@/lib/synclab/types";

// Map the visible bounds, including native scroll offsets, into the sideways canvas.
const editorRect = (el: HTMLElement) => {
  const r = el.getBoundingClientRect();
  const a = canvasPoint(r.left, r.top), b = canvasPoint(r.right, r.bottom);
  return { left: Math.min(a.x,b.x), top: Math.min(a.y,b.y), width: Math.abs(b.x-a.x), height: Math.abs(b.y-a.y) };
};

const NOTE_NAMES = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];
const isBlack = (p: number) => [1, 3, 6, 8, 10].includes(((p % 12) + 12) % 12);
const ROWS = 24;
let noteClipboard: MidiNote[] = [];

const SCALES: Record<string, number[]> = {
  Minor: [0, 2, 3, 5, 7, 8, 10],
  Major: [0, 2, 4, 5, 7, 9, 11],
  Dorian: [0, 2, 3, 5, 7, 9, 10],
  Phrygian: [0, 1, 3, 5, 7, 8, 10],
  "Minor Pent": [0, 3, 5, 7, 10],
  Chromatic: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11],
};

type Drag =
  | { mode: "move"; id: string; startX: number; startY: number; step: number; pitch: number; ids: string[]; notes: MidiNote[] }
  | { mode: "resize"; id: string; startX: number; length: number }
  | null;

export function PianoRoll({ track }: { track: Track }) {
  const isMobile = useIsMobile();
  const { setNotes, previewNote, transport, setTransport, setStepCount, updateTrack, undo, redo, canUndo, canRedo, copyTrack, cutTrack, pasteTrack, clipboardName } = useStudio();
  const litKeys = useSyncExternalStore(subscribeKeys, keysSnapshot, () => NO_KEYS);
  const ROW_H = isMobile ? 28 : 22;
  const [mode, setMode] = useState<"draw" | "select" | "erase">("draw");
  const [multi, setMulti] = useState(false);
  const [zoom, setZoom] = useState(1);
  const [cursor, setCursor] = useState(() => getPlayStep());
  const [clipboardCount, setClipboardCount] = useState(noteClipboard.length);
  const suppressClick = useRef(false);
  const [low, setLow] = useState(48);
  const [grid, setGrid] = useState(1); // steps per snap
  const [len, setLen] = useState(1);
  const [bars, setBars] = useState(() => Math.max(1, Math.round((track.steps || stepsPerBar()) / stepsPerBar())));
  const [scaleLock, setScaleLock] = useState(false);
  const [root, setRoot] = useState(0);
  const [scaleName, setScaleName] = useState("Minor");
  const [sel, setSel] = useState<string[]>([]);
  const [noteMenu, setNoteMenu] = useState(false);
  const [trackMenu, setTrackMenu] = useState(true);
  const trackAnchor = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    const open = (e: Event) => { if ((e as CustomEvent<string>).detail === track.id) setTrackMenu(true); };
    window.addEventListener('synclab:selected-track-menu', open);
    return () => window.removeEventListener('synclab:selected-track-menu', open);
  }, [track.id]);
  const noteElement = useRef<HTMLElement | null>(null);
  /** Where the note menu opens when it isn't attached to one note (after a box selection or a right-click). */
  const menuPoint = useRef<{ x: number; y: number } | null>(null);
  const noteAnchor = useRef({ getBoundingClientRect: () => menuPoint.current ? new DOMRect(menuPoint.current.x, menuPoint.current.y, 1, 1) : noteElement.current?.getBoundingClientRect() ?? new DOMRect() });
  const openMenuAt = (x: number, y: number) => { menuPoint.current = { x, y }; noteElement.current = null; setNoteMenu(true); };
  const openMenuOnNote = (el: HTMLElement) => { menuPoint.current = null; noteElement.current = el; setNoteMenu(true); };
  const noteMoved = useRef(false);
  const toggleOff = useRef<string | null>(null);
  const [trackOct, setTrackOct] = useState(0);
  const gridRef = useRef<HTMLDivElement | null>(null);
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const [scrollPosition, setScrollPosition] = useState(0);
  const [scrollMax, setScrollMax] = useState(0);
  const drag = useRef<Drag>(null);
  const marq = useRef<{ x: number; y: number; active: boolean; add?: boolean } | null>(null);
  const [marquee, setMarquee] = useState<{ x0: number; y0: number; x1: number; y1: number } | null>(null);

  const steps = bars * stepsPerBar();
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const measure = () => { setScrollMax(Math.max(0, el.scrollWidth - el.clientWidth)); setScrollPosition(el.scrollLeft); };
    const observer = new ResizeObserver(measure);
    observer.observe(el);
    if (el.firstElementChild) observer.observe(el.firstElementChild);
    measure();
    return () => observer.disconnect();
  }, [steps, zoom]);
  const scrollTo = (value: number) => {
    const el = scrollRef.current;
    if (el) el.scrollLeft = Math.max(0, Math.min(scrollMax, value));
  };
  const placeCursor = (e: React.PointerEvent<HTMLDivElement>) => {
    const r = editorRect(e.currentTarget);
    const pt = canvasPoint(e.clientX, e.clientY);
    const step = Math.min(steps - grid, Math.max(0, Math.floor((pt.x - r.left) / r.width * steps / grid) * grid));
    setCursor(step);
    if (!transport.playing && !transport.recording) setTransport({ step });
  };

  // the piano roll page length IS the track's loop length, so what you draw is
  // exactly what the timeline plays back
  useEffect(() => {
    if (track.steps !== steps) setStepCount(track.id, steps);
  }, [steps, track.id, track.steps, setStepCount]);

  // drawing past the end grows the loop instead of silently dropping the notes
  useEffect(() => {
    const end = Math.max(0, ...(track.notes ?? []).map((n) => n.step + Math.max(1, n.length)));
    const needed = Math.max(1, Math.ceil(end / stepsPerBar()));
    if (needed > bars) setBars(needed);
  }, [track.notes, bars]);
  const notes = track.notes ?? [];

  // when the roll opens on a track that already has notes, center the visible
  // pitch range on those notes instead of leaving the user staring at empty rows
  useEffect(() => {
    if (notes.length === 0) return;
    const avg = notes.reduce((a, n) => a + n.pitch, 0) / notes.length;
    // put the notes near the top of the window, then scroll the panel to them
    setLow(Math.max(12, Math.min(96, Math.round(avg - ROWS + 6))));
    requestAnimationFrame(() => {
      gridRef.current?.querySelector("[data-note]")?.scrollIntoView({ block: "center" });
    });
    // only on open / track change — not on every note edit
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [track.id]);
  const pitches = Array.from({ length: ROWS }, (_, i) => low + ROWS - 1 - i);
  const scale = SCALES[scaleName] ?? SCALES["Minor"] ?? [];
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
    const r = editorRect(el);
    const pt = canvasPoint(e.clientX, e.clientY);
    const x = ((pt.x - r.left) / r.width) * steps;
    const row = Math.floor((pt.y - r.top) / ROW_H);
    const pitch = pitches[Math.min(ROWS - 1, Math.max(0, row))] ?? low;
    return { step: Math.max(0, Math.floor(x / grid) * grid), pitch, rawX: x };
  };

  const addNote = (e: React.MouseEvent) => {
    if (suppressClick.current) { suppressClick.current = false; return; }
    const p = posFromEvent(e);
    if (!p) return;
    if (scaleLock && !inScale(p.pitch)) return;
    setCursor(p.step);
    if (mode !== "draw") { if (!multi && !e.shiftKey && !e.ctrlKey && !e.metaKey) setSel([]); return; }
    if (notes.some(n => n.pitch === p.pitch && n.step === p.step)) return;
    const n = capturedNote({ id: uid(), pitch: p.pitch, step: p.step, length: len, velocity: 0.85 }, loopRegion(transport));
    if (!n) return;
    setNotes(track.id, [...notes, n]);
    setSel([n.id]);
    previewNote(track.id, p.pitch, 0.35, false);
  };

  const onNoteDown = (e: React.PointerEvent, n: MidiNote, resize: boolean) => {
    e.stopPropagation();
    e.preventDefault();
    noteMoved.current = resize;
    setNoteMenu(false);
    if (mode === "erase") { del(n.id); return; }
    // Multi-select / Shift / Ctrl: pressing a note adds it to the group (or, if it was already
    // picked, takes it out on release) — but dragging moves the whole group instead.
    const adding = (multi || e.shiftKey || e.ctrlKey || e.metaKey) && !resize;
    const picked = sel.includes(n.id);
    toggleOff.current = adding && picked ? n.id : null;
    e.currentTarget.setPointerCapture(e.pointerId);
    const ids = adding ? (picked ? sel : [...sel, n.id]) : picked ? sel : [n.id];
    setSel(ids);
    setCursor(n.step);
    const pt = canvasPoint(e.clientX, e.clientY);
    drag.current = resize
      ? { mode: "resize", id: n.id, startX: pt.x, length: n.length }
      : { mode: "move", id: n.id, startX: pt.x, startY: pt.y, step: n.step, pitch: n.pitch, ids, notes: structuredClone(notes) };

  };

  const onMove = (e: React.PointerEvent) => {
    const el = gridRef.current;
    if (!el) return;
    const pt = canvasPoint(e.clientX, e.clientY);
    // marquee select: pressed on empty grid and dragged
    const m = marq.current;
    if (m && !drag.current) {
      const r = editorRect(el);
      const x = pt.x - r.left;
      const y = pt.y - r.top;
      if (m.active || Math.hypot(x - m.x, y - m.y) > 4) {
        m.active = true;
        setMarquee({ x0: Math.min(m.x, x), y0: Math.min(m.y, y), x1: Math.max(m.x, x), y1: Math.max(m.y, y) });
      }
      return;
    }
    const d = drag.current;
    if (!d) return;
    if (Math.hypot(pt.x - d.startX, pt.y - (d.mode === 'move' ? d.startY : pt.y)) > 4) noteMoved.current = true;
    const stepPx = editorRect(el).width / steps;
    if (d.mode === "resize") {
      const nl = Math.max(grid, snap(d.length + (pt.x - d.startX) / stepPx) || grid);
      setNotes(track.id, notes.map((n) => (n.id === d.id ? capturedNote({ ...n, length: nl }, loopRegion(transport)) ?? n : n)));
    } else {
      const ds = Math.round((pt.x - d.startX) / stepPx / grid) * grid;
      const dp = -Math.round((pt.y - d.startY) / ROW_H);
      setNotes(track.id, movePianoNotes(d.notes, d.ids, ds, dp, loopRegion(transport)));
    }
  };

  const endDrag = (e?: React.PointerEvent) => {
    const off = toggleOff.current;
    toggleOff.current = null;
    if (off && drag.current && !noteMoved.current) setSel(s => s.filter(id => id !== off));
    drag.current = null;
    const m = marq.current;
    marq.current = null;
    if (m?.active && marquee) {
      suppressClick.current = true;
      const el = gridRef.current;
      if (el) {
        const r = editorRect(el);
        const stepPx = r.width / steps;
        const s0 = marquee.x0 / stepPx;
        const s1 = marquee.x1 / stepPx;
        const pTop = pitches[Math.min(ROWS - 1, Math.max(0, Math.floor(marquee.y0 / ROW_H)))] ?? low;
        const pBot = pitches[Math.min(ROWS - 1, Math.max(0, Math.floor(marquee.y1 / ROW_H)))] ?? low;
        const boxed = notes.filter((n) => n.step < s1 && n.step + n.length > s0 && n.pitch <= pTop && n.pitch >= pBot).map((n) => n.id);
        const next = m.add ? [...new Set([...sel, ...boxed])] : boxed;
        setSel(next);
        // A finished box selection opens the note menu beside the pointer.
        if (next.length && e) openMenuAt(e.clientX, e.clientY);
      }
    }
    setMarquee(null);
  };

  const del = (id: string) => { setNotes(track.id, notes.filter(n => n.id !== id)); setSel(s => s.filter(x => x !== id)); };
  const deleteSelected = () => { if (!sel.length) return; setNotes(track.id, notes.filter(n => !sel.includes(n.id))); setSel([]); };
  const copySelected = (cut = false) => {
    if (!sel.length) return;
    noteClipboard = structuredClone(notes.filter(n => sel.includes(n.id)));
    setClipboardCount(noteClipboard.length);
    if (cut) deleteSelected();
  };
  const duplicate = () => {
    const copies = duplicatePianoNotes(notes, sel, loopRegion(transport));
    if (!copies.length) return;
    setNotes(track.id, [...notes, ...copies]);
    setSel(copies.map(n => n.id));
  };
  const nudge = (stepsBy: number, semis: number) => { if (sel.length) setNotes(track.id, movePianoNotes(notes, sel, stepsBy, semis, loopRegion(transport))); };
  const paste = () => {
    const pasted = pastePianoNotes(noteClipboard, cursor, loopRegion(transport));
    if (!pasted.length) return;
    setNotes(track.id, [...notes, ...pasted]);
    setSel(pasted.map(n => n.id));
  };
  const handleKey = (e: React.KeyboardEvent) => {
    if (e.defaultPrevented || e.nativeEvent.isComposing) return;
    if ((e.target as HTMLElement).closest('input, select, textarea, [role="combobox"], [role="slider"]')) return;
    const mod = e.ctrlKey || e.metaKey;
    const key = e.key.toLowerCase();
    const claim = () => { e.preventDefault(); e.stopPropagation(); };
    if (mod && ['a','c','x','v','z','y'].includes(key)) {
      claim();
      if (key === 'a') setSel(notes.map(n => n.id));
      if (key === 'c') copySelected();
      if (key === 'x') copySelected(true);
      if (key === 'v') paste();
      if (key === 'z') e.shiftKey ? redo() : undo();
      if (key === 'y') redo();
    } else if (key === 'delete' || key === 'backspace') { claim(); deleteSelected(); }
    else if (key.startsWith('arrow') && sel.length) {
      claim();
      setNotes(track.id, movePianoNotes(notes, sel, key === 'arrowleft' ? -grid : key === 'arrowright' ? grid : 0, key === 'arrowup' ? 1 : key === 'arrowdown' ? -1 : 0, loopRegion(transport)));
    }
  };

  const Tool = ({ children, onClick, active }: { children: React.ReactNode; onClick: () => void; active?: boolean }) => (
    <Button size="sm" variant={active ? "default" : "ghost"} className="h-9 shrink-0 px-2 text-[11px]" onClick={onClick}>
      {children}
    </Button>
  );

  return (
    <div className="piano-roll space-y-1.5 outline-none" tabIndex={0} aria-label="Piano roll note editor" onKeyDown={handleKey} onPointerDownCapture={e => { if (!(e.target as HTMLElement).closest('button,input,[role="combobox"]')) e.currentTarget.focus({ preventScroll: true }); }} onPointerUp={endDrag} onPointerCancel={endDrag}>
      <Popover open={trackMenu} onOpenChange={setTrackMenu}>
        <PopoverAnchor virtualRef={trackAnchor} />
        <PopoverContent aria-label="Selected track actions" className="w-56 space-y-1 p-2" onOpenAutoFocus={e => e.preventDefault()} onCloseAutoFocus={e => e.preventDefault()} onPointerDown={e => e.stopPropagation()} onClick={e => e.stopPropagation()}>
          <div className="border-b border-border px-2 py-1 font-mono text-xs">{track.name}</div>
          <Button variant="ghost" className="h-10 w-full justify-start gap-2 text-xs" onClick={() => setTrackMenu(false)}><Pencil className="size-4" />Edit notes</Button>
          <Button variant="ghost" className="h-10 w-full justify-start gap-2 text-xs" onClick={() => { copyTrack(track.id); setTrackMenu(false); }}><Copy className="size-4" />Copy track content</Button>
          <Button variant="ghost" className="h-10 w-full justify-start gap-2 text-xs" onClick={() => { cutTrack(track.id); setTrackMenu(false); }}><Scissors className="size-4" />Cut track content</Button>
          <Button variant="ghost" className="h-10 w-full justify-start gap-2 text-xs" disabled={!clipboardName} onClick={() => { pasteTrack(track.id); setTrackMenu(false); }}><ClipboardPaste className="size-4" />Paste at playhead</Button>
        </PopoverContent>
      </Popover>
      <div ref={trackAnchor} />
      <Popover open={noteMenu} onOpenChange={setNoteMenu}>
        <PopoverAnchor virtualRef={noteAnchor} />
        <PopoverContent aria-label="Selected note actions" className="w-56 space-y-1 p-2" onOpenAutoFocus={e => e.preventDefault()} onCloseAutoFocus={e => e.preventDefault()} onPointerDown={e => e.stopPropagation()} onClick={e => e.stopPropagation()}>
          <div className="border-b border-border px-2 py-1 font-mono text-xs">{sel.length ? `${sel.length} note${sel.length === 1 ? '' : 's'} selected` : 'No notes selected'} · Step {cursor + 1}</div>
          {([
            { label: 'Copy', icon: Copy, run: () => copySelected(), disabled: !sel.length, keys: '⌘C' },
            { label: 'Cut', icon: Scissors, run: () => copySelected(true), disabled: !sel.length, keys: '⌘X' },
            { label: 'Paste at cursor', icon: ClipboardPaste, run: paste, disabled: !clipboardCount, keys: '⌘V' },
            { label: 'Duplicate after', icon: CopyPlus, run: duplicate, disabled: !sel.length, keys: '' },
          ] as const).map(action => <Button key={action.label} variant="ghost" className="h-9 w-full justify-start gap-2 text-xs" disabled={action.disabled} onClick={() => { action.run(); setNoteMenu(false); }}><action.icon className="size-4" />{action.label}{action.keys && <span className="ml-auto font-mono text-[10px] text-muted-foreground">{action.keys}</span>}</Button>)}
          <div className="border-t border-border px-2 pt-2 font-mono text-[10px] uppercase tracking-wider text-muted-foreground">Move notes</div>
          <div className="grid grid-cols-4 gap-1 px-1" role="group" aria-label="Move selected notes">
            <Button variant="outline" size="sm" className="h-9" disabled={!sel.length} aria-label="Move earlier" title="Earlier (one grid step)" onClick={() => nudge(-grid, 0)}><ArrowLeft className="size-4" /></Button>
            <Button variant="outline" size="sm" className="h-9" disabled={!sel.length} aria-label="Move later" title="Later (one grid step)" onClick={() => nudge(grid, 0)}><ArrowRight className="size-4" /></Button>
            <Button variant="outline" size="sm" className="h-9" disabled={!sel.length} aria-label="Move up a semitone" title="Up a semitone" onClick={() => nudge(0, 1)}><ArrowUp className="size-4" /></Button>
            <Button variant="outline" size="sm" className="h-9" disabled={!sel.length} aria-label="Move down a semitone" title="Down a semitone" onClick={() => nudge(0, -1)}><ArrowDown className="size-4" /></Button>
            <Button variant="outline" size="sm" className="col-span-2 h-9 text-[11px]" disabled={!sel.length} onClick={() => nudge(0, 12)}>Octave +</Button>
            <Button variant="outline" size="sm" className="col-span-2 h-9 text-[11px]" disabled={!sel.length} onClick={() => nudge(0, -12)}>Octave −</Button>
          </div>
          <p className="px-2 text-[10px] leading-snug text-muted-foreground">Or drag any selected note — the whole group moves.</p>
          <div className="border-t border-border pt-1" />
          <Button variant="ghost" className="h-9 w-full justify-start gap-2 text-xs" disabled={!notes.length} onClick={() => setSel(notes.map(n => n.id))}><MousePointer2 className="size-4" />Select all<span className="ml-auto font-mono text-[10px] text-muted-foreground">⌘A</span></Button>
          <Button variant="ghost" className="h-9 w-full justify-start gap-2 text-xs" disabled={!sel.length} onClick={() => { setSel([]); setNoteMenu(false); }}><X className="size-4" />Unselect</Button>
          <Button variant="ghost" className="h-9 w-full justify-start gap-2 text-xs text-destructive" disabled={!sel.length} onClick={() => { deleteSelected(); setNoteMenu(false); }}><Trash2 className="size-4" />Delete notes<span className="ml-auto font-mono text-[10px] text-muted-foreground">Del</span></Button>
        </PopoverContent>
      </Popover>
      <div className="sticky top-0 z-20 flex flex-wrap items-center gap-1 border-b border-border bg-surface-2 p-1" role="toolbar" aria-label="Note editing">
        {([{ id: 'draw', icon: Pencil, label: 'Draw notes' }, { id: 'select', icon: MousePointer2, label: 'Select notes' }, { id: 'erase', icon: Trash2, label: 'Erase notes' }] as const).map(tool => <Button key={tool.id} variant={mode === tool.id ? 'default' : 'outline'} size="icon" className="size-10 shrink-0" aria-label={tool.label} title={tool.label} aria-pressed={mode === tool.id} onClick={() => setMode(tool.id)}><tool.icon className="size-4" /></Button>)}
        <Button variant={multi ? 'default' : 'outline'} className="h-10" aria-pressed={multi} onClick={() => { setMode('select'); setMulti(!multi); }}>Multi-select</Button>
        <div className="mx-1 h-6 border-l border-border" />
        {([{ id: 'copy', icon: Copy, label: 'COPY', title: 'Copy selected notes', disabled: !sel.length, run: () => copySelected() }, { id: 'cut', icon: Scissors, label: 'CUT', title: 'Cut selected notes', disabled: !sel.length, run: () => copySelected(true) }, { id: 'paste', icon: ClipboardPaste, label: 'PASTE', title: 'Paste notes at cursor', disabled: !clipboardCount, run: paste }, { id: 'del', icon: Trash2, label: 'DELETE', title: 'Delete selected notes', disabled: !sel.length, run: deleteSelected, danger: true }] as const).map(b => (
          <Button key={b.id} variant="outline" size="icon" className={`h-10 w-auto gap-1 px-2 text-[10px] font-semibold shrink-0${'danger' in b && b.danger ? ' text-destructive' : ''}`} aria-label={b.title} title={b.title} disabled={b.disabled} onClick={b.run}>
            <b.icon className="size-4" />
            {b.label}
          </Button>
        ))}
        <span className="px-1 font-mono text-xs text-muted-foreground">{sel.length} selected · Step {cursor + 1}</span>
        <span className="hidden whitespace-nowrap px-1 font-mono text-[10px] text-muted-foreground md:inline" aria-live="polite">{sel.length > 1 ? 'Drag any picked note to move the group · arrow keys nudge' : 'Drag across empty space to pick a group of notes'}</span>
        <Button variant="ghost" size="icon" className="size-10" aria-label="Undo note edit" disabled={!canUndo} onClick={undo}><Undo2 className="size-4" /></Button>
        <Button variant="ghost" size="icon" className="size-10" aria-label="Redo note edit" disabled={!canRedo} onClick={redo}><Redo2 className="size-4" /></Button>
        <Button variant="ghost" size="icon" className="size-10" aria-label="Zoom out notes" disabled={zoom <= 1} onClick={() => setZoom(z => Math.max(1,z / 2))}><ZoomOut className="size-4" /></Button>
        <Button variant="ghost" size="icon" className="size-10" aria-label="Zoom in notes" disabled={zoom >= 4} onClick={() => setZoom(z => Math.min(4,z * 2))}><ZoomIn className="size-4" /></Button>
      </div>
      {track.clips?.length ? (
        <div className="flex items-center justify-between gap-2 border-b border-border px-2 py-1 text-xs text-muted-foreground">
          <span>{track.printedAudio ? "Recorded waveform is playing; notes remain editable here." : "Notes are playing; this track also holds a recorded waveform."}</span>
          <Button size="sm" variant="secondary" onClick={() => updateTrack(track.id, { printedAudio: !track.printedAudio })}>{track.printedAudio ? "PLAY NOTES" : "PLAY WAVE"}</Button>
        </div>
      ) : null}
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
        <Tool
          onClick={() => {
            if (!notes.length) return;
            setNotes(track.id, []);
            setSel([]);
          }}
        >
          CLEAR ALL NOTES
        </Tool>
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
        <Tool onClick={deleteSelected}>
          {"DELETE SEL"}
        </Tool>
      </div>

      {/* extra writing tools */}
      <div className="flex items-center overflow-x-auto whitespace-nowrap scrollbar-hide gap-1.5 rounded-sm border border-border bg-surface/60 p-1.5">
        <span className="label-xs px-1">TOOLS</span>
        <Tool
          onClick={() => {
            const t = targets();
            if (!t.length) return;
            const up = (p: number, deg: number) => {
              let x = p;
              let left = deg;
              while (left > 0) {
                x += 1;
                if (!scaleLock || inScale(x)) left -= 1;
                if (x - p > 24) break;
              }
              return x;
            };
            setNotes(track.id, [
              ...notes,
              ...t.flatMap((n) => [
                { ...n, id: uid(), pitch: up(n.pitch, 3) },
                { ...n, id: uid(), pitch: up(n.pitch, 7) },
              ]),
            ]);
          }}
        >
          CHORD
        </Tool>
        <Tool
          onClick={() => {
            const t = [...targets()].sort((a, b) => a.pitch - b.pitch);
            if (t.length < 2) return;
            const start = Math.min(...t.map((n) => n.step));
            const ids = new Map(t.map((n, i) => [n.id, start + i * grid]));
            setNotes(
              track.id,
              notes.map((n) => (ids.has(n.id) ? { ...n, step: ids.get(n.id) ?? n.step, length: grid } : n)),
            );
          }}
        >
          ARPEGGIATE
        </Tool>
        <Tool
          onClick={() => {
            const t = targets();
            if (!t.length) return;
            const lowest = Math.min(...t.map((n) => n.pitch));
            const highest = Math.max(...t.map((n) => n.pitch));
            apply((n) => ({ ...n, pitch: lowest + (highest - n.pitch) }));
          }}
        >
          INVERT
        </Tool>
        <Tool onClick={() => apply((n) => ({ ...n, step: Math.max(0, n.step - grid) }))}>NUDGE ←</Tool>
        <Tool onClick={() => apply((n) => ({ ...n, step: n.step + grid }))}>NUDGE →</Tool>
        <Tool
          onClick={() => {
            const t = [...targets()].sort((a, b) => a.pitch - b.pitch);
            if (!t.length) return;
            const off = new Map(t.map((n, i) => [n.id, i * 0.12]));
            setNotes(track.id, notes.map((n) => (off.has(n.id) ? { ...n, step: n.step + (off.get(n.id) ?? 0) } : n)));
          }}
        >
          STRUM
        </Tool>
        <Tool
          onClick={() => {
            const t = targets();
            if (!t.length) return;
            const min = Math.min(...t.map((n) => n.step));
            const max = Math.max(...t.map((n) => n.step)) || 1;
            apply((n) => ({
              ...n,
              velocity: Math.min(1, Math.max(0.1, 0.35 + ((n.step - min) / Math.max(1, max - min)) * 0.6)),
            }));
          }}
        >
          VEL RAMP
        </Tool>
        <Tool onClick={() => apply((n) => ({ ...n, velocity: 0.85 }))}>FIXED VEL</Tool>
        <Tool
          onClick={() => {
            const t = targets();
            if (!t.length) return;
            setNotes(track.id, [
              ...notes,
              ...t.map((n) => ({ ...n, id: uid(), step: n.step + grid, velocity: Math.max(0.1, n.velocity * 0.55) })),
            ]);
          }}
        >
          ECHO
        </Tool>
        <Tool
          onClick={() => {
            const t = targets();
            if (!t.length) return;
            setNotes(track.id, [
              ...notes,
              ...t.map((n) => ({ ...n, id: uid(), step: Math.max(0, n.step - 0.25), velocity: Math.max(0.1, n.velocity * 0.5), length: Math.max(0.25, n.length / 2) })),
            ]);
          }}
        >
          FLAM
        </Tool>
        <Tool onClick={() => apply((n) => ({ ...n, length: Math.max(0.25, n.length * 0.5) }))}>STACCATO</Tool>
        <Tool
          onClick={() => {
            // strum: spread notes that start together, low to high, like a guitar downstroke
            const t = targets();
            const off = new Map<string, number>();
            const groups = new Map<number, MidiNote[]>();
            t.forEach((n) => groups.set(Math.floor(n.step), [...(groups.get(Math.floor(n.step)) ?? []), n]));
            groups.forEach((g, st) => g.sort((a, b) => a.pitch - b.pitch).forEach((n, i) => off.set(n.id, st + Math.min(0.9, i * 0.15))));
            setNotes(track.id, notes.map((n) => (off.has(n.id) ? { ...n, step: off.get(n.id) ?? n.step } : n)));
          }}
        >
          STRUM ↑
        </Tool>
        <Tool
          onClick={() => {
            const t = targets();
            const off = new Map<string, number>();
            const groups = new Map<number, MidiNote[]>();
            t.forEach((n) => groups.set(Math.floor(n.step), [...(groups.get(Math.floor(n.step)) ?? []), n]));
            groups.forEach((g, st) => g.sort((a, b) => b.pitch - a.pitch).forEach((n, i) => off.set(n.id, st + Math.min(0.9, i * 0.15))));
            setNotes(track.id, notes.map((n) => (off.has(n.id) ? { ...n, step: off.get(n.id) ?? n.step } : n)));
          }}
        >
          STRUM ↓
        </Tool>
      </div>

      {/* editor */}
      <div className="sticky top-0 z-20 flex h-10 items-center gap-3 border border-border bg-surface-2 px-2" aria-label="Piano roll horizontal navigation">
        <Button variant="outline" size="icon" className="size-8 shrink-0" aria-label="Scroll notes left" title="Scroll notes left" disabled={scrollPosition <= 0} onClick={() => scrollTo(scrollPosition - (scrollRef.current?.clientWidth ?? 200) / 2)}><ChevronLeft className="size-4" /></Button>
        <Slider aria-label="Horizontal note scroll" value={[scrollPosition]} min={0} max={Math.max(1, scrollMax)} step={1} disabled={!scrollMax} onValueChange={values => scrollTo(values[0] ?? 0)} className="min-w-0 flex-1" />
        <Button variant="outline" size="icon" className="size-8 shrink-0" aria-label="Scroll notes right" title="Scroll notes right" disabled={scrollPosition >= scrollMax} onClick={() => scrollTo(scrollPosition + (scrollRef.current?.clientWidth ?? 200) / 2)}><ChevronRight className="size-4" /></Button>
      </div>
      <div className="flex overflow-hidden rounded-[2px] border border-border bg-background">
        <div className="w-16 shrink-0 border-r border-border bg-surface-2">
          <div className="flex h-9 items-center justify-center border-b border-border font-mono text-[10px] text-muted-foreground">BAR</div>
          {pitches.map((p) => (
            <button
              key={p}
              onClick={() => previewNote(track.id, p)}
              style={{ height: ROW_H }}
              className={`flex w-full items-center justify-end border-b border-background px-1 font-mono text-[8px] font-semibold transition-colors duration-75 ${
                litKeys.includes(p)
                  ? "bg-primary text-primary-foreground shadow-[inset_0_0_8px_var(--primary)]"
                  : isBlack(p) ? "bg-background text-muted-foreground" : "bg-foreground text-background"
              }`}
            >
              {NOTE_NAMES[((p % 12) + 12) % 12]}
              {Math.floor(p / 12) - 1}
            </button>
          ))}
        </div>

        <div ref={scrollRef} aria-label="Scrollable piano notes" className="relative min-w-0 flex-1 overflow-x-scroll" onScroll={e => setScrollPosition(e.currentTarget.scrollLeft)}>
          <div style={{ width: `${zoom * 100}%`, minWidth: steps * (isMobile ? 28 : 20) }}> 
          <div role="slider" tabIndex={0} aria-label="Playhead" title="Playhead: playback starts here and Paste puts notes here. Drag or tap to move it." aria-valuemin={1} aria-valuemax={steps} aria-valuenow={cursor + 1} aria-valuetext={`Bar ${Math.floor(cursor / stepsPerBar()) + 1}, step ${cursor + 1}`} className="relative h-9 touch-none select-none border-b border-border bg-surface-2 focus-visible:ring-2 focus-visible:ring-ring"
            onPointerDown={e => { e.preventDefault(); e.currentTarget.setPointerCapture(e.pointerId); placeCursor(e); }}
            onPointerMove={e => { if (e.currentTarget.hasPointerCapture(e.pointerId)) placeCursor(e); }}
            onKeyDown={e => { if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return; e.preventDefault(); e.stopPropagation(); const step = Math.max(0, Math.min(steps - grid, cursor + (e.key === 'ArrowRight' ? grid : -grid))); setCursor(step); if (!transport.playing && !transport.recording) setTransport({ step }); }}>
            {Array.from({ length: steps }, (_, s) => s % 4 === 0 ? <span key={s} className="pointer-events-none absolute inset-y-0 border-l border-border pl-1 pt-1 font-mono text-[10px] text-muted-foreground" style={{ left: `${s / steps * 100}%` }}>{s % stepsPerBar() === 0 ? Math.floor(s / stepsPerBar()) + 1 : '·'}</span> : null)}
            <span className="pointer-events-none absolute inset-y-0 z-10 border-l-2 border-[var(--playhead)]" style={{ left: `${cursor / steps * 100}%` }}><span className="absolute -left-1.5 top-0 h-3 w-3 bg-[var(--playhead)] [clip-path:polygon(0_0,100%_0,50%_100%)]" /></span>
          </div>
          <div
            ref={gridRef}
            className="relative select-none bg-background"
            style={{ height: ROWS * ROW_H }}
            onClick={addNote}
            onContextMenu={(e) => {
              // Right-click empty grid: the note menu (paste here, select all, or act on the selection).
              e.preventDefault();
              const p = posFromEvent(e);
              if (p) setCursor(p.step);
              openMenuAt(e.clientX, e.clientY);
            }}
            onPointerDown={(e) => {
              // the mouse can box-select in any mode; touch keeps Select mode for it
              if (mode !== "select" && !(e.pointerType === "mouse" && mode === "draw")) return;
              if (e.button !== 0) return;
              e.currentTarget.setPointerCapture(e.pointerId);
              const r = editorRect(e.currentTarget);
              const pt = canvasPoint(e.clientX, e.clientY);
              marq.current = { x: pt.x - r.left, y: pt.y - r.top, active: false, add: e.shiftKey || e.ctrlKey || e.metaKey };
            }}
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
                   background: s % stepsPerBar() === 0 ? "var(--editor-grid-strong)" : s % 4 === 0 ? "var(--editor-grid)" : "color-mix(in oklab, var(--editor-grid) 35%, transparent)",
                }}
              />
            ))}
            <PianoPlayhead visible={transport.playing || transport.recording} steps={steps} />
            <div aria-hidden="true" className="pointer-events-none absolute inset-y-0 z-20 w-[2px] bg-[var(--playhead)]" style={{ left: `${cursor / steps * 100}%` }} />
            {marquee && (
              <div
                className="pointer-events-none absolute z-10 border border-primary bg-primary/15"
                style={{ left: marquee.x0, top: marquee.y0, width: marquee.x1 - marquee.x0, height: marquee.y1 - marquee.y0 }}
              />
            )}
            {notes.map((n) => {
              const rowIndex = pitches.indexOf(n.pitch);
              if (rowIndex < 0) return null;
              const selected = sel.includes(n.id);
              return (
                <div
                  key={n.id}
                  data-note={n.id}
                  data-selected={selected}
                  role="button" aria-label={`${NOTE_NAMES[n.pitch % 12]}${Math.floor(n.pitch / 12) - 1} note at step ${n.step + 1}`} aria-pressed={selected}
                  onClick={e => { e.stopPropagation(); if (mode === 'erase' || noteMoved.current || multi || e.shiftKey || e.ctrlKey || e.metaKey) return; openMenuOnNote(e.currentTarget); }}
                  onPointerDown={(e) => onNoteDown(e, n, false)}
                  onContextMenu={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    setSel(sel.includes(n.id) ? sel : [n.id]);
                    setCursor(n.step);
                    openMenuAt(e.clientX, e.clientY);
                  }}
                  className="absolute touch-none rounded-[1px] border border-clip-midi-dark/60 bg-clip-midi shadow-sm"
                  style={{
                    left: `${(n.step / steps) * 100}%`,
                    width: `${(n.length / steps) * 100}%`,
                    top: rowIndex * ROW_H + 1,
                    height: ROW_H - 3,
                    minWidth: 14,
                    opacity: 0.55 + n.velocity * 0.45,
                    outline: selected ? "1px solid var(--foreground)" : "none",
                    cursor: "grab",
                  }}
                  title={`${NOTE_NAMES[((n.pitch % 12) + 12) % 12]}${Math.floor(n.pitch / 12) - 1} · vel ${Math.round(n.velocity * 127)}`}
                >
                  <div
                    onPointerDown={(e) => onNoteDown(e, n, true)}
                     className="absolute inset-y-0 right-0 w-2 cursor-ew-resize touch-none bg-clip-midi-dark/35"
                  />

                </div>
              );
            })}
          </div>

          {/* pitch-bend & mod-wheel lanes: click or drag to draw, right-click a point to delete */}
          {(["bendLane", "modLane"] as const).map((key) => {
            const pts = track[key] ?? [];
            const bipolar = key === "bendLane";
            const draw = (e: React.PointerEvent<HTMLDivElement>) => {
              e.preventDefault();
              const r = editorRect(e.currentTarget);
              let cur = [...(track[key] ?? [])];
              const put = (cx: number, cy: number) => {
                const step = Math.max(0, Math.min(steps - 1, Math.floor(((cx - r.left) / r.width) * steps)));
                const y = Math.min(1, Math.max(0, 1 - (cy - r.top) / r.height));
                const value = bipolar ? Math.round((y * 2 - 1) * 20) / 20 : Math.round(y * 20) / 20;
                cur = [...cur.filter((p) => p.step !== step), { step, value }].sort((a, b) => a.step - b.step);
                updateTrack(track.id, { [key]: cur });
              };
              const initial = canvasPoint(e.clientX, e.clientY);
              put(initial.x, initial.y);
              const mv = (ev: PointerEvent) => { const pt = canvasPoint(ev.clientX, ev.clientY); put(pt.x, pt.y); };
              const up = () => { window.removeEventListener("pointermove", mv); window.removeEventListener("pointerup", up); };
              window.addEventListener("pointermove", mv);
              window.addEventListener("pointerup", up);
            };
            return (
              <div key={key} className="relative h-12 touch-none border-t border-border bg-surface/70" onPointerDown={draw}
                title={bipolar ? "Pitch bend: draw up/down (±2 semitones). Right-click a point to remove it." : "Mod wheel: draw vibrato depth. Right-click a point to remove it."}>
                <span className="label-xs pointer-events-none absolute top-0.5 left-1 z-10">{bipolar ? "PITCH BEND" : "MOD WHEEL"}</span>
                {pts.length > 0 && (
                  <button type="button" onPointerDown={(e) => e.stopPropagation()} onClick={() => updateTrack(track.id, { [key]: undefined })}
                    className="label-xs absolute top-0.5 right-1 z-10 text-muted-foreground hover:text-destructive">CLEAR</button>
                )}
                {bipolar && <div className="pointer-events-none absolute inset-x-0 top-1/2 h-px bg-border" />}
                {pts.map((p) => (
                  <div key={p.step}
                    onContextMenu={(e) => { e.preventDefault(); updateTrack(track.id, { [key]: pts.filter((x) => x.step !== p.step) }); }}
                    onPointerDown={(e) => { if (e.button === 2) e.stopPropagation(); }}
                    className="absolute w-1.5 rounded-[1px] bg-primary"
                    style={{
                      left: `${(p.step / steps) * 100}%`,
                      ...(bipolar
                        ? p.value >= 0 ? { bottom: "50%", height: `${p.value * 50}%` } : { top: "50%", height: `${-p.value * 50}%` }
                        : { bottom: 0, height: `${p.value * 100}%` }),
                      minHeight: 2,
                    }} />
                ))}
              </div>
            );
          })}

          {/* velocity lane */}
          <div className="relative h-16 border-t border-border bg-surface/70">
            <span className="label-xs absolute top-0.5 left-1 z-10">VELOCITY</span>
            {notes.map((n) => (
              <div
                key={n.id}
                onPointerDown={(e) => {
                  e.preventDefault();
                  setSel([n.id]);
                  const el = e.currentTarget.parentElement;
                  if (!el) return;
                  const r = editorRect(el);
                  const set = (cy: number) =>
                    setNotes(
                      track.id,
                      (track.notes ?? []).map((x) =>
                        x.id === n.id ? { ...x, velocity: Math.min(1, Math.max(0.05, 1 - (cy - r.top) / r.height)) } : x,
                      ),
                    );
                  set(canvasPoint(e.clientX,e.clientY).y);
                  const mv = (ev: PointerEvent) => set(canvasPoint(ev.clientX,ev.clientY).y);
                  const up = () => {
                    window.removeEventListener("pointermove", mv);
                    window.removeEventListener("pointerup", up);
                  };
                  window.addEventListener("pointermove", mv);
                  window.addEventListener("pointerup", up);
                }}
                 className="absolute bottom-0 w-2.5 cursor-ns-resize touch-none rounded-t-[1px] bg-clip-midi"
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
      </div>

    </div>
  );
}

/** The moving playhead line; only it re-renders each step, not the whole piano roll. */
function PianoPlayhead({ visible, steps }: { visible: boolean; steps: number }) {
  const step = usePlayStep();
  return (
    <div
      className={`playhead-line pointer-events-none absolute top-0 bottom-0 z-20 w-[2px] ${visible ? "" : "hidden"}`}
      style={{ left: `${((step % steps) / steps) * 100}%` }}
    />
  );
}
