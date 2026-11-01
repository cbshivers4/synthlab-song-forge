import { getPlayStep } from "@/lib/synclab/playhead";
import { useEffect, useRef, useState } from "react";
import { stepsPerBar, songSteps, stepSeconds } from "@/lib/synclab/timebase";
import { ArrowLeftToLine, ArrowRightToLine, ClipboardPaste, ListChecks, MousePointer2, Pencil, ScissorsLineDashed, SquareScissors, SquareSplitHorizontal, Waves, ChevronDown, Copy, Eye, Flag, Redo2, Undo2, Music2, Settings2, Trash2, Volume2, X, FolderOpen } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { useStudio } from "@/lib/synclab/store";
import { uid } from "@/lib/synclab/presets";
import type { EditTool } from "@/lib/synclab/store";
import { clipSeconds } from "@/lib/synclab/types";
import { clipCopyAfter } from "@/lib/synclab/workflow";
import { getEngine } from "@/lib/synclab/audio-engine";
import { parseMidiFile } from "@/lib/synclab/midi-file";
import { GRID_OPTIONS, RazorIcon, SNAP_OPTIONS, setCutFree, useCutFree } from "./shared";

export function EditToolbar() {
  const {
    setPanel,
    editTool,
    setEditTool,
    selectAll,
    splitAtPlayhead,
    selected,
    selectedIds,
    tracks,
    cutTrack,
    copyTrack,
    pasteTrack,
    pasteClip,
    clipClipboardName,
    removeTrack,
    clearTrackContent,
    clipboardName,
    undo,
    redo,
    transport,
    setTransport,
    addTrack,
    addClip,
    setNotes,
    updateTrack,
    select,
  } = useStudio();
  const audioInput = useRef<HTMLInputElement>(null);
  const midiInput = useRef<HTMLInputElement>(null);
  const snap = transport.snap ?? 1;

  const activeClip = selected?.clips?.find((c) => c.id === selected.activeClipId) ?? selected?.clips?.[0] ?? null;

  const writeActive = (patch: Partial<NonNullable<typeof activeClip>>) => {
    if (!selected || !activeClip) return;
    updateTrack(selected.id, {
      clips: (selected.clips ?? []).map((c) => (c.id === activeClip.id ? { ...c, ...patch } : c)),
    });
  };

  const nudge = (dir: -1 | 1) => {
    if (!activeClip) {
      toast("Pick a clip first", { description: "Click a clip on the timeline, then nudge it." });
      return;
    }
    const step = snap > 0 ? snap : 1;
    writeActive({ start: Math.max(0, (activeClip.start ?? 0) + dir * step) });
  };

  const [qStrength, setQStrength] = useState(100);
  const applyQuantize = () => {
    const notes = selected?.notes ?? [];
    if (!selected || notes.length === 0) {
      toast("Nothing to quantize", { description: "Select an instrument, sampler or MIDI track that has notes." });
      return;
    }
    const q = transport.quantize ?? 1;
    const k = qStrength / 100;
    setNotes(
      selected.id,
      notes.map((n) => {
        const target = Math.round(n.step / q) * q;
        const step = Math.max(0, n.step + (target - n.step) * k);
        const shift = step - n.step;
        return { ...n, step, ...(n.recordedEnd != null ? { recordedEnd: Math.max(step + 1, n.recordedEnd + Math.max(0, shift)) } : {}) };
      }),
    );
    toast.success(`Quantized ${notes.length} notes to ${GRID_OPTIONS().find((o) => o.value === q)?.label ?? q} at ${qStrength}%`);
  };
  const fineNudge = (dir: -1 | 1) => {
    if (!selected) return;
    const d = dir * 0.25;
    if ((selected.notes?.length ?? 0) > 0) {
      setNotes(
        selected.id,
        (selected.notes ?? []).map((n) => ({
          ...n,
          step: Math.max(0, n.step + d),
          ...(n.recordedEnd != null ? { recordedEnd: Math.max(0, n.recordedEnd + d) } : {}),
        })),
      );
      toast(dir < 0 ? "Notes nudged earlier" : "Notes nudged later");
    } else if (activeClip) {
      writeActive({ start: Math.max(0, (activeClip.start ?? 0) + d) });
      toast(dir < 0 ? "Clip nudged earlier" : "Clip nudged later");
    } else {
      toast("Nothing to nudge", { description: "Select a track with notes or a clip." });
    }
  };
  useEffect(() => {
    const onQ = () => applyQuantize();
    window.addEventListener("synclab:quantize", onQ);
    return () => window.removeEventListener("synclab:quantize", onQ);
  });

  const duplicateClip = () => {
    if (!selected || !activeClip) {
      toast("Pick a clip first", { description: "Click a clip on the timeline to duplicate it." });
      return;
    }
    addClip(selected.id, clipCopyAfter(activeClip, stepSeconds(transport.bpm), uid()));
  };

  const fade = (which: "in" | "out") => {
    if (!activeClip) {
      toast("Pick a clip first", { description: "Fades apply to the selected clip." });
      return;
    }
    const len = Math.min(1, clipSeconds(activeClip) / 4);
    writeActive(which === "in" ? { fadeIn: len } : { fadeOut: len });
    toast.success(`Fade ${which} set to ${len.toFixed(2)}s on ${activeClip.name}`);
  };

  /** Loads a WAV/MP3/AIFF file as a real waveform clip at the playhead on its own audio channel. */
  const importAudioClip = async (file: File) => {
    try {
      const engine = getEngine();
      await engine.init();
      const name = file.name.replace(/\.[^.]+$/, "").toUpperCase().slice(0, 18);
      const loaded = await engine.loadSampleFile(file, name);
      const id = addTrack("audio", name);
      addClip(id, {
        id: uid(),
        name,
        peaks: loaded.peaks,
        duration: loaded.duration,
        url: loaded.url,
        start: getPlayStep(),
        offset: 0,
        length: loaded.duration,
        gain: 1,
      });
      select(id);
      toast.success(`${file.name} on the timeline`, { description: "Drag it to move, pull the edges to trim." });
    } catch (error) {
      toast.error("Could not read that audio file", {
        description: error instanceof Error ? error.message : "Try a WAV, MP3 or AIFF file.",
      });
    }
  };

  /** Loads a .mid file; each part becomes a MIDI region you can see and edit on the timeline. */
  const importMidiClip = async (file: File) => {
    try {
      const parsed = parseMidiFile(await file.arrayBuffer());
      if (parsed.length === 0) throw new Error("That MIDI file has no notes.");
      let first = "";
      parsed.forEach((part) => {
        const id = addTrack("midi", (part.name || "MIDI").toUpperCase().slice(0, 18), "Deep Keys");
        setNotes(id, part.notes);
        if (!first) first = id;
      });
      if (first) select(first);
      toast.success(`${file.name} on the timeline`, {
        description: `${parsed.length} part${parsed.length === 1 ? "" : "s"} — double-click a region for the piano roll.`,
      });
    } catch (error) {
      toast.error("Could not read that MIDI file", {
        description: error instanceof Error ? error.message : "Export it again as a standard MIDI file.",
      });
    }
  };

  const cutFree = useCutFree();
  const ToolBtn = ({ tool, icon, label, keys, text }: { tool: EditTool; icon: React.ReactNode; label: string; keys: string; text?: string }) => (
    <Button
      size="sm"
      variant={editTool === tool ? "default" : "ghost"}
      className={`arrangement-tool h-8 shrink-0 gap-1 ${text ? "px-2" : "size-8 p-0"}`}
      aria-label={label}
      aria-pressed={editTool === tool}
      title={`${label} (${keys})`}
      onClick={() => setEditTool(tool)}
    >
      {icon}
      {text && <span className="tool-label hidden text-[10px] font-semibold tracking-wider sm:inline">{text}</span>}
    </Button>
  );

  const targets = selectedIds.length > 1 ? selectedIds : selected ? [selected.id] : [];

  return (
    <div className="timeline-edit-toolbar flex min-h-10 shrink-0 flex-wrap items-center gap-1 border-b border-border bg-surface-2 px-2 py-1">
      <ToolBtn tool="select" icon={<MousePointer2 className="size-3" />} label="Select" keys="V" />
      <Button size="sm" variant="ghost" className="size-8 shrink-0 p-0" aria-label="Select All" title="Select all channels (⌘A / Ctrl+A)" onClick={selectAll}>
        <ListChecks className="size-3.5" />
      </Button>
      <div className="mx-1 h-4 w-px bg-border" />
      <ToolBtn tool="draw" icon={<Pencil className="size-3" />} label="Draw" keys="B" />
      <ToolBtn tool="split" icon={<ScissorsLineDashed className="size-3" />} label="Split" keys="C" text="SPLIT" />
      <ToolBtn tool="razor" icon={<RazorIcon className="size-3" />} label="Razor" keys="R" />
      <Button size="sm" variant="ghost" className="arrangement-tool size-8 shrink-0 p-0" aria-label="Mute selected channels" aria-pressed={targets.length > 0 && targets.every((id) => tracks.find((t) => t.id === id)?.muted)} disabled={!targets.length} title="Mute selected channels" onClick={() => { const muted = targets.every((id) => tracks.find((t) => t.id === id)?.muted); targets.forEach((id) => updateTrack(id, { muted: !muted })); }}><Volume2 className="size-3.5" /></Button>
      {(editTool === "split" || editTool === "razor") && (
        <Button
          size="sm"
          variant="outline"
          className="h-6 gap-1 px-2 font-mono text-[10px]"
          aria-pressed={cutFree}
          title={cutFree ? "Cuts land exactly where you click (off grid). Tap to snap cuts to the grid. Hold Alt to flip once." : "Cuts snap to the grid. Tap to cut anywhere (off grid). Hold Alt to flip once."}
          onClick={() => setCutFree(!cutFree)}
        >
          CUT: {cutFree ? "FREE" : "GRID"}
        </Button>
      )}
      <div className="mx-1 h-4 w-px bg-border" />
      <Button size="sm" variant="ghost" className="size-8 shrink-0 p-0" aria-label="Undo" title="Undo (⌘Z / Ctrl+Z)" onClick={undo}>
        <Undo2 className="size-3.5" />
      </Button>
      <Button size="sm" variant="ghost" className="size-8 shrink-0 p-0" aria-label="Redo" title="Redo (⌘⇧Z / Ctrl+Y)" onClick={redo}>
        <Redo2 className="size-3.5" />
      </Button>
      <Button size="sm" variant="outline" className="h-8 shrink-0 gap-1 px-2 text-[10px]" aria-label="Open mixer" title="Mixer" onClick={() => setPanel("mixer")}><Settings2 className="size-3.5" />Mixer</Button>
      <Button size="sm" variant="ghost" className="arrangement-tool size-8 shrink-0 p-0" aria-label="Open sound library" title="Sound library" onClick={() => setPanel("browser")}><FolderOpen className="size-3.5" /></Button>
      <Button size="sm" variant="ghost" className="arrangement-tool size-8 shrink-0 p-0" aria-label="Open effects rack" title="Effects rack" onClick={() => setPanel("plugins")}><Settings2 className="size-3.5" /></Button>
      <div className="mx-1 h-4 w-px bg-border" />
      <Popover>
        <PopoverTrigger asChild>
          <Button size="sm" variant="ghost" className="h-6 gap-1 px-2 text-[10px]">Edit <ChevronDown className="size-3" /></Button>
        </PopoverTrigger>
        <PopoverContent align="start" className="timeline-quick-menu w-auto min-w-44 p-1.5">
          <div className="flex flex-col items-stretch gap-1 [&_button]:justify-start">
      <Button
        size="sm"
        variant="ghost"
        className="h-6 gap-1 px-2 text-[10px]"
        title="Split the selected channel's clip or notes at the playhead (S)"
        onClick={splitAtPlayhead}
      >
        <SquareSplitHorizontal className="size-3" /> Split at Playhead
      </Button>
      <Button
        size="sm"
        variant="ghost"
        className="h-6 gap-1 px-2 text-[10px]"
        disabled={targets.length === 0}
        title="Cut selection (⌘X / Ctrl+X)"
        onClick={() => targets.forEach((id) => cutTrack(id))}
      >
        <SquareScissors className="size-3" /> Cut
      </Button>
      <Button
        size="sm"
        variant="ghost"
        className="h-6 gap-1 px-2 text-[10px]"
        disabled={targets.length === 0}
        title="Copy selection (⌘C / Ctrl+C)"
        onClick={() => targets[0] && copyTrack(targets[0])}
      >
        <Copy className="size-3" /> Copy
      </Button>
      <Button
        size="sm"
        variant="ghost"
        className="h-6 gap-1 px-2 text-[10px]"
        disabled={!clipboardName && !clipClipboardName}
        title="Paste (⌘V / Ctrl+V)"
        onClick={() => clipClipboardName ? pasteClip(false, selected?.id) : pasteTrack(selected?.id)}
      >
        <ClipboardPaste className="size-3" /> Paste
      </Button>
      <Button
        size="sm"
        variant="ghost"
        className="h-6 gap-1 px-2 text-[10px] text-destructive"
        disabled={targets.length === 0}
        title="Clear the clips and notes on the selected channels — the channels themselves stay"
        onClick={(e) => { e.stopPropagation(); targets.forEach((id) => clearTrackContent(id)); }}
      >
        <Trash2 className="size-3" /> Clear{targets.length > 1 ? ` ${targets.length}` : ""}
      </Button>
          </div>
        </PopoverContent>
      </Popover>
      <Popover>
        <PopoverTrigger asChild>
          <Button size="sm" variant="ghost" className="h-6 gap-1 px-2 text-[10px]">Clip <ChevronDown className="size-3" /></Button>
        </PopoverTrigger>
        <PopoverContent align="start" className="timeline-quick-menu w-auto min-w-44 p-1.5">
          <div className="flex flex-col items-stretch gap-1 [&_button]:justify-start">
      <Button size="sm" variant="ghost" className="h-6 gap-1 px-2 text-[10px]" title="Nudge the selected clip left" onClick={() => nudge(-1)}>
        <ArrowLeftToLine className="size-3" />
      </Button>
      <Button size="sm" variant="ghost" className="h-6 gap-1 px-2 text-[10px]" title="Nudge the selected clip right" onClick={() => nudge(1)}>
        <ArrowRightToLine className="size-3" />
      </Button>
      <Button size="sm" variant="ghost" className="h-6 gap-1 px-2 text-[10px]" title="Duplicate the selected clip" onClick={duplicateClip}>
        <Copy className="size-3" /> Dup Clip
      </Button>
      <Button size="sm" variant="ghost" className="h-6 gap-1 px-2 text-[10px]" title="Fade in the selected clip" onClick={() => fade("in")}>
        Fade In
      </Button>
      <Button size="sm" variant="ghost" className="h-6 gap-1 px-2 text-[10px]" title="Fade out the selected clip" onClick={() => fade("out")}>
        Fade Out
      </Button>
          </div>
        </PopoverContent>
      </Popover>
      <Popover>
        <PopoverTrigger asChild>
          <Button size="sm" variant="ghost" className="h-6 gap-1 px-2 text-[10px]">Quantize <ChevronDown className="size-3" /></Button>
        </PopoverTrigger>
        <PopoverContent align="start" className="timeline-quick-menu w-auto min-w-44 p-1.5">
          <div className="grid grid-cols-[auto_auto] items-center gap-1 [&_button]:justify-start">
      <span className="label-xs shrink-0">QUANTIZE</span>
      <Select value={String(transport.quantize ?? 1)} onValueChange={(v) => setTransport({ quantize: Number(v) })}>
        <SelectTrigger aria-label="Quantize grid" className="h-6 w-[72px] shrink-0 font-mono text-[10px]" title="Grid that Quantize snaps notes to">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {GRID_OPTIONS().map((o) => (
            <SelectItem key={o.value} value={String(o.value)} className="font-mono text-[11px]">
              {o.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Select value={String(qStrength)} onValueChange={(v) => setQStrength(Number(v))}>
        <SelectTrigger aria-label="Quantize strength" className="h-6 w-[62px] shrink-0 font-mono text-[10px]" title="How far notes move toward the grid">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {[100, 75, 50, 25].map((v) => (
            <SelectItem key={v} value={String(v)} className="font-mono text-[11px]">{v}%</SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Button size="sm" variant="secondary" className="h-6 px-2 text-[10px]" title="Snap the selected track's notes to the grid (Q)" onClick={() => applyQuantize()}>
        Apply Q
      </Button>
      <Button size="sm" variant="ghost" className="h-6 px-1.5 text-[10px]" title="Nudge the selected track earlier by a 1/64 note" onClick={() => fineNudge(-1)}>
        ◀ Nudge
      </Button>
      <Button size="sm" variant="ghost" className="h-6 px-1.5 text-[10px]" title="Nudge the selected track later by a 1/64 note" onClick={() => fineNudge(1)}>
        Nudge ▶
      </Button>
          </div>
        </PopoverContent>
      </Popover>
      <Popover>
        <PopoverTrigger asChild>
          <Button size="sm" variant="ghost" className="h-6 gap-1 px-2 text-[10px]">Grid <ChevronDown className="size-3" /></Button>
        </PopoverTrigger>
        <PopoverContent align="start" className="timeline-quick-menu w-auto min-w-44 p-1.5">
          <div className="grid grid-cols-[auto_auto] items-center gap-1 [&_button]:justify-start">
      <span className="label-xs shrink-0">TIMEBASE</span>
      <Select value={transport.timebase ?? "bars"} onValueChange={(v) => setTransport({ timebase: v as "bars" | "seconds" })}>
        <SelectTrigger aria-label="Timeline timebase" className="h-6 w-[78px] shrink-0 font-mono text-[10px]" title="Show the playhead position in bars or in minutes and seconds">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="bars" className="font-mono text-[11px]">BARS</SelectItem>
          <SelectItem value="seconds" className="font-mono text-[11px]">SECONDS</SelectItem>
        </SelectContent>
      </Select>
      <span className="label-xs shrink-0">SNAP</span>
      <Select value={String(snap)} onValueChange={(v) => setTransport({ snap: Number(v) })}>
        <SelectTrigger aria-label="Timeline snap grid" className="h-6 w-[72px] shrink-0 font-mono text-[10px]" title="Snap grid for moving and trimming clips">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {SNAP_OPTIONS().map((o) => (
            <SelectItem key={o.value} value={String(o.value)} className="font-mono text-[11px]">
              {o.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Button
        size="sm"
        variant={transport.follow ? "default" : "ghost"}
        className="h-6 gap-1 px-2 text-[10px]"
        title="Follow the playhead while the song plays"
        onClick={() => setTransport({ follow: !transport.follow })}
      >
        <Eye className="size-3" /> Follow
      </Button>
          </div>
        </PopoverContent>
      </Popover>
      <Popover>
        <PopoverTrigger asChild>
          <Button size="sm" variant="ghost" className="h-6 gap-1 px-2 text-[10px]">Import <ChevronDown className="size-3" /></Button>
        </PopoverTrigger>
        <PopoverContent align="start" className="timeline-quick-menu w-auto min-w-44 p-1.5">
          <div className="flex flex-col items-stretch gap-1 [&_button]:justify-start">
      <Button
        size="sm"
        variant="ghost"
        className="h-6 gap-1 px-2 text-[10px]"
        title="Import a WAV, MP3 or AIFF file onto the timeline at the playhead"
        onClick={() => audioInput.current?.click()}
      >
        <Waves className="size-3" /> Import Wave
      </Button>
      <Button
        size="sm"
        variant="ghost"
        className="h-6 gap-1 px-2 text-[10px]"
        title="Import a MIDI file as editable regions"
        onClick={() => midiInput.current?.click()}
      >
        <Music2 className="size-3" /> Import MIDI
      </Button>
      <input
        ref={audioInput}
        type="file"
        accept="audio/*,.wav,.mp3,.aif,.aiff,.m4a,.ogg,.flac"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          e.target.value = "";
          if (file) void importAudioClip(file);
        }}
      />
      <input
        ref={midiInput}
        type="file"
        accept=".mid,.midi,audio/midi"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          e.target.value = "";
          if (file) void importMidiClip(file);
        }}
      />
          </div>
        </PopoverContent>
      </Popover>
      <span className="label-xs ml-auto hidden shrink-0 sm:inline">
        {selectedIds.length > 1 ? `${selectedIds.length} selected` : `${tracks.length} channels`}
      </span>
    </div>
  );
}

/**
 * Song length + export range. Shared by the desktop ruler menu and the phone
 * timeline tools menu, so the same controls exist on both layouts.
 */
export function TimelineOptionsPanel() {
  const { transport, setTransport } = useStudio();
  const bars = Math.max(1, transport.bars ?? 4);
  const total = songSteps(bars);
  const lo = transport.loopStart ?? 0;
  const hi = Math.max(lo + 1, transport.loopEnd ?? total);
  const exportOn = transport.exportStart != null && transport.exportEnd != null;

  const setBars = (next: number) => {
    const b = Math.min(512, Math.max(1, next));
    const steps = b * stepsPerBar();
    setTransport({
      bars: b,
      loopStart: Math.min(lo, steps - 1),
      loopEnd: Math.min(hi, steps),
      step: getPlayStep() % steps,
    });
  };

  return (
    <div className="space-y-3">
      <div>
        <div className="mb-1 font-mono text-[9px] uppercase tracking-wider text-muted-foreground">Song length</div>
        <div className="flex items-center gap-0.5 rounded-[3px] border border-border bg-background/70 px-0.5" title="Timeline length in bars">
          <button
            type="button"
            aria-label="Fewer bars"
            className="min-w-12 px-3 py-2 font-mono text-[15px] text-muted-foreground hover:text-foreground disabled:opacity-30"
            disabled={bars <= 1}
            onClick={() => setBars(bars - 1)}
          >
            −
          </button>
          <span className="min-w-16 flex-1 text-center font-mono text-[13px] text-primary">{bars} {bars === 1 ? "BAR" : "BARS"}</span>
          <button
            type="button"
            aria-label="More bars"
            className="min-w-12 px-3 py-2 font-mono text-[15px] text-muted-foreground hover:text-foreground disabled:opacity-30"
            disabled={bars >= 512}
            onClick={() => setBars(bars + 1)}
          >
            +
          </button>
        </div>
      </div>
      <div>
        <div className="mb-1 font-mono text-[9px] uppercase tracking-wider text-muted-foreground">Export range</div>
        <button
          type="button"
          aria-pressed={exportOn}
          title="Show export start/end flags — drag them on the ruler to choose what gets exported"
          onClick={() =>
            setTransport(exportOn ? { exportStart: null, exportEnd: null } : { exportStart: 0, exportEnd: total })
          }
          className={`flex w-full items-center gap-1.5 rounded-[3px] border px-2 py-2 font-mono text-[11px] uppercase tracking-wider ${
            exportOn
              ? "border-amber-400/70 bg-amber-400/15 text-amber-300"
              : "border-border bg-background/70 text-muted-foreground hover:text-foreground"
          }`}
        >
          <Flag className="size-3.5" /> {exportOn ? "Hide export flags" : "Show export flags"}
        </button>
        <p className="mt-1 font-mono text-[9px] leading-tight text-muted-foreground">Drag the amber flags on the ruler to choose what gets exported.</p>
      </div>
    </div>
  );
}
