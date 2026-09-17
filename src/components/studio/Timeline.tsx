import { useRef, useState } from "react";
import {
  ArrowLeftToLine,
  ArrowRightToLine,
  ClipboardPaste,
  Grid3x3,
  ListChecks,
  MousePointer2,
  Pencil,
  Scissors,
  Waves,
  ChevronDown,

  ChevronUp,
  Copy,
  Disc3,
  Eye,
  EyeOff,
  Headphones,
  Mic,
  MoreVertical,
  Repeat,
  Music2,
  Piano,
  Settings2,
  Snowflake,
  Trash2,
  Volume2,
  VolumeX,
} from "lucide-react";
import synclabLogoAsset from "@/assets/synclab-logo-neon.jpg.asset.json";
const synclabLogo = synclabLogoAsset.url;
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Slider } from "@/components/ui/slider";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { useStudio } from "@/lib/synclab/store";
import { AddTrackMenu } from "@/components/studio/AddTrackMenu";

import { INSTRUMENTS, KIND_LABEL, uid } from "@/lib/synclab/presets";
import type { EditTool } from "@/lib/synclab/store";
import type { MidiNote, Track } from "@/lib/synclab/types";
import { WaveformView } from "@/components/studio/WaveformView";

const KindIcon = ({ kind }: { kind: Track["kind"] }) =>
  kind === "drum" ? (
    <Disc3 className="size-3.5" />
  ) : kind === "audio" ? (
    <Mic className="size-3.5" />
  ) : kind === "midi" ? (
    <Piano className="size-3.5" />
  ) : (
    <Music2 className="size-3.5" />
  );

const INPUTS = ["Microphone", "Guitar / Line 1", "Keyboard / Line 2", "External Instrument", "MIDI Keyboard", "Internal", "Stereo File"];

function Waveform({ track }: { track: Track }) {
  const { setActiveClip, removeClip } = useStudio();
  const clips = track.clips ?? [];
  const active = clips.find((c) => c.id === track.activeClipId) ?? clips[clips.length - 1];
  if (!active) return null;

  const peaks = active.peaks.length > 0 ? active.peaks : [0];


  return (
    <div
      className="group absolute inset-y-2 left-1 right-1 flex flex-col overflow-hidden rounded-[3px] border border-clip-audio/30 bg-clip-audio/10 shadow-sm transition-colors hover:bg-clip-audio/15"
    >
      <div className="flex h-[17px] shrink-0 items-center gap-1 bg-clip-audio/10 px-1.5">
        <span className="truncate font-mono text-[9px] font-semibold text-clip-audio/80">
          {active.name}
        </span>
        <span className="ml-auto shrink-0 font-mono text-[8px] text-clip-audio/55">{active.duration.toFixed(1)}s</span>
        <div className="flex shrink-0 items-center gap-1">
          {clips.map((c) => (
            <button
              key={c.id}
              onClick={(e) => {
                e.stopPropagation();
                setActiveClip(track.id, c.id);
              }}
              onDoubleClick={() => removeClip(track.id, c.id)}
              title="Click to choose take, double-click to delete"
              aria-label={`Select take ${c.name}`}
              className="size-[6px] rounded-full border"
              style={{
                borderColor: "var(--clip-audio)",
                background: c.id === active.id ? "var(--clip-audio)" : "transparent",
              }}
            />
          ))}
        </div>
      </div>

      <div className="min-h-0 w-full flex-1 px-1 pb-1">
        <WaveformView peaks={peaks} color="var(--clip-audio)" label={`${active.name} waveform`} />
      </div>

    </div>
  );
}


const NOTE_NAMES = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];

function MidiClip({ track }: { track: Track }) {
  const { setPanel, select } = useStudio();
  const notes = track.notes ?? [];
  if (notes.length === 0)
    return (
      <div className="absolute inset-y-1 left-0 right-1 flex items-center justify-center rounded-[3px] border border-dashed border-border">
        <span className="label-xs">NO MIDI — OPEN PIANO ROLL TO DRAW NOTES</span>
      </div>
    );
  const pitches = notes.map((n) => n.pitch);
  const lo = Math.min(...pitches) - 2;
  const hi = Math.max(...pitches) + 2;
  const span = Math.max(6, hi - lo);
  const rows = 12;
  return (
    <div
      className="absolute inset-y-2 left-1 right-1 overflow-hidden rounded-[3px] border border-clip-midi/30 bg-clip-midi/10 shadow-sm transition-colors hover:bg-clip-midi/15"
      onDoubleClick={() => {
        select(track.id);
        setPanel("piano");
      }}
    >
      <div
        className="flex h-[17px] items-center gap-1 bg-clip-midi/10 px-1.5"
      >
        <Piano className="size-2.5" />
        <span className="truncate font-mono text-[9px] font-semibold text-clip-midi/75">
          {track.instrument ?? "MIDI"} · {notes.length} NOTES ·{" "}
          {NOTE_NAMES[Math.min(...pitches) % 12]}
          {Math.floor(Math.min(...pitches) / 12) - 1}
        </span>
      </div>
      <div className="relative flex-1" style={{ height: "calc(100% - 17px)" }}>
        {Array.from({ length: rows }).map((_, r) => (
          <div
            key={r}
            className="absolute left-0 right-0 border-t border-clip-midi/5"
            style={{ top: `${(r / rows) * 100}%` }}
          />
        ))}
        {notes.map((n) => (
          <div
            key={n.id}
            className="absolute rounded-full bg-clip-midi/55"
            title={`${NOTE_NAMES[n.pitch % 12]}${Math.floor(n.pitch / 12) - 1}`}
            style={{
              left: `${((n.step % 16) / 16) * 100}%`,
              width: `${(Math.max(1, n.length) / 16) * 100 - 0.4}%`,
              top: `${(1 - (n.pitch - lo) / span) * 82 + 4}%`,
              height: "6%",
              opacity: 0.5 + (n.velocity ?? 0.8) * 0.35,
            }}
          />
        ))}
      </div>
    </div>
  );
}

function DrumClip({ track }: { track: Track }) {
  const { setPanel, select } = useStudio();
  const pads = (track.pads ?? []).filter((p) => p.steps.some((s) => s > 0));
  if (pads.length === 0)
    return (
      <div className="absolute inset-y-1 left-0 right-1 flex items-center justify-center rounded-[3px] border border-dashed border-border">
        <span className="label-xs">NO PATTERN — OPEN DRUM MACHINE TO PROGRAM BEATS</span>
      </div>
    );
  const shown = pads.slice(0, 8);
  const steps = track.pads?.[0]?.steps.length ?? 16;
  const hits = pads.reduce((n, p) => n + p.steps.filter((s) => s > 0).length, 0);
  return (
    <div
      className="absolute inset-y-2 left-1 right-1 overflow-hidden rounded-[3px] border border-clip-drum/30 bg-clip-drum/10 shadow-sm transition-colors hover:bg-clip-drum/15"
      onDoubleClick={() => {
        select(track.id);
        setPanel("drums");
      }}
    >
      <div
        className="flex h-[17px] items-center gap-1 bg-clip-drum/10 px-1.5"
      >
        <Disc3 className="size-2.5" />
        <span className="truncate font-mono text-[9px] font-semibold text-clip-drum/75">
          DRUM PATTERN · {hits} HITS · {shown.map((p) => p.name).slice(0, 4).join(" / ")}
        </span>
      </div>
      <div className="relative flex-1" style={{ height: "calc(100% - 17px)" }}>
        {shown.map((_, r) => (
          <div
            key={r}
            className="absolute left-0 right-0 border-t border-clip-drum/5"
            style={{ top: `${(r / shown.length) * 100}%` }}
          />
        ))}
        {shown.flatMap((p, r) =>
          p.steps.slice(0, steps).map((vel, i) =>
            vel > 0 ? (
              <div
                key={`${p.id}-${i}`}
                 className="absolute rounded-full bg-clip-drum/60"
                title={`${p.name} · step ${i + 1}`}
                style={{
                  left: `${(i / steps) * 100}%`,
                  width: `${100 / steps - 0.4}%`,
                  top: `${(r / shown.length) * 100 + 100 / shown.length * 0.18}%`,
                  height: `${Math.max(8, (100 / shown.length) * 0.42)}%`,
                  opacity: 0.4 + vel * 0.45,
                }}
              />
            ) : null,
          ),
        )}
      </div>
    </div>
  );
}

function Lane({ track }: { track: Track }) {
  const isMidi = track.kind === "instrument" || track.kind === "midi" || track.kind === "sampler";
  if (track.kind === "drum") return <DrumClip track={track} />;
  if (!isMidi && (track.clips?.length ?? 0) > 0) return <Waveform track={track} />;
  if (track.recording)
    return (
      <div className="absolute inset-y-1 left-0 right-1 flex items-center justify-center rounded-[3px] border border-destructive/60 bg-destructive/10">
        <span className="animate-pulse font-mono text-[11px] text-destructive">● RECORDING INPUT…</span>
      </div>
    );
  if (isMidi) return <MidiClip track={track} />;
  if (track.kind === "audio" || track.kind === "ai-vocal")
    return (
      <div className="absolute inset-y-1 left-0 right-1 flex items-center justify-center rounded-[3px] border border-dashed border-border">
        <span className="label-xs">NO AUDIO — ARM ● REC TO CAPTURE A WAVEFORM</span>
      </div>
    );
  const cells = Array.from({ length: 16 });
  const active = (i: number) => {
    if (track.kind === "drum") return track.pads?.some((p) => (p.steps[i] ?? 0) > 0) ?? false;
    return track.notes?.some((n) => i >= n.step % 16 && i < (n.step % 16) + n.length) ?? false;
  };
  return (
    <div className="absolute inset-y-1 left-0 right-1 grid grid-cols-[repeat(16,minmax(0,1fr))]">
      {cells.map((_, i) => (
        <div key={i} className="px-[1px] py-[1px]">
          {active(i) ? (
            <div
              className="h-full rounded-[2px]"
              style={{
                background: `color-mix(in oklab, ${track.color} 70%, transparent)`,
                boxShadow: `inset 0 1px 0 color-mix(in oklab, ${track.color} 90%, white)`,
              }}
            />
          ) : (
            <div className="h-full" />
          )}
        </div>
      ))}
    </div>
  );
}

export type DragPayload =
  | { type: "instrument"; name: string; preset: string }
  | { type: "plugin"; defId: string }
  | { type: "tool"; kind: Track["kind"]; name: string; preset?: string };

export const readDrag = (e: React.DragEvent): DragPayload | null => {
  const raw = e.dataTransfer.getData("application/synclab") || e.dataTransfer.getData("text/plain");
  if (!raw) return null;
  try {
    const v = JSON.parse(raw) as DragPayload;
    return v?.type === "instrument" || v?.type === "plugin" || v?.type === "tool" ? v : null;
  } catch {
    return null;
  }
};

function TrackRow({ track, index }: { track: Track; index: number }) {
  const { selectedId, selectedIds, select, toggleSelectId, updateTrack, removeTrack, duplicateTrack, moveTrack, setPanel, changeInstrument, installedPlugins, addPlugin, editTool, splitClipAt, toggleStep } =
    useStudio();
  const { transport, setNotes, loadSample } = useStudio();
  const [renaming, setRenaming] = useState(false);
  const [confirm, setConfirm] = useState(false);
  const [dropping, setDropping] = useState(false);
  const isSelected = selectedId === track.id || selectedIds.includes(track.id);

  const clips = track.clips ?? [];
  const activeClip = clips.find((c) => c.id === track.activeClipId) ?? clips[clips.length - 1];
  const playFrac = Math.min(0.98, Math.max(0.02, ((transport.step ?? 0) % 16) / 16));

  const writeClips = (next: typeof clips, activeId?: string) =>
    updateTrack(track.id, activeId ? { clips: next, activeClipId: activeId } : { clips: next });

  const splitClip = () => {
    if (!activeClip) return;
    splitClipAt(track.id, playFrac);
  };

  const trimClip = (side: "left" | "right") => {
    if (!activeClip) return;
    const cut = Math.max(1, Math.round(activeClip.peaks.length * playFrac));
    const peaks = side === "left" ? activeClip.peaks.slice(cut) : activeClip.peaks.slice(0, cut);
    const duration = activeClip.duration * (side === "left" ? 1 - playFrac : playFrac);
    writeClips(clips.map((c) => (c.id === activeClip.id ? { ...c, peaks, duration } : c)));
    toast.success(side === "left" ? "Start trimmed" : "End trimmed");
  };

  const clipOp = (op: "reverse" | "normalize" | "fade") => {
    if (!activeClip) return;
    let peaks = [...activeClip.peaks];
    if (op === "reverse") peaks.reverse();
    if (op === "normalize") {
      const max = Math.max(0.0001, ...peaks);
      peaks = peaks.map((p) => Math.min(1, p / max));
    }
    if (op === "fade") {
      const n = peaks.length;
      const f = Math.max(1, Math.round(n * 0.12));
      peaks = peaks.map((p, i) => {
        const inG = Math.min(1, i / f);
        const outG = Math.min(1, (n - 1 - i) / f);
        return p * Math.min(inG, outG);
      });
    }
    writeClips(clips.map((c) => (c.id === activeClip.id ? { ...c, peaks } : c)));
    toast.success(op === "reverse" ? "Clip reversed" : op === "normalize" ? "Clip normalized" : "Fades applied");
  };

  const duplicateClip = () => {
    if (!activeClip) return;
    const copy = { ...activeClip, id: `${activeClip.id}-copy${Date.now()}`, name: `${activeClip.name} COPY` };
    writeClips([...clips, copy], copy.id);
    toast.success("Clip duplicated");
  };

  const deleteActiveClip = () => {
    if (!activeClip) return;
    writeClips(clips.filter((c) => c.id !== activeClip.id));
    toast.success("Clip deleted");
  };

  const noteOp = (op: "quantize" | "up" | "down" | "double" | "clear") => {
    const notes = track.notes ?? [];
    if (op === "clear") {
      setNotes(track.id, []);
      toast.success("Notes cleared");
      return;
    }
    if (op === "double") {
      const span = Math.max(...notes.map((n) => n.step + n.length), 1);
      setNotes(track.id, [
        ...notes,
        ...notes.map((n, i) => ({ ...n, id: `${n.id}-d${i}${Date.now()}`, step: n.step + span })),
      ]);
      toast.success("Notes repeated");
      return;
    }
    setNotes(
      track.id,
      notes.map((n) => {
        if (op === "quantize") return { ...n, step: Math.round(n.step) };
        const pitch = Math.min(120, Math.max(0, n.pitch + (op === "up" ? 12 : -12)));
        return { ...n, pitch };
      }),
    );
    toast.success(op === "quantize" ? "Notes quantized" : "Notes transposed");
  };


  const onDrop = (e: React.DragEvent) => {
    setDropping(false);
    const file = e.dataTransfer.files?.[0];
    if (file && (file.type.startsWith("audio") || /\.(mp3|wav|wave|aif|aiff|m4a|aac|ogg|flac|webm)$/i.test(file.name))) {
      e.preventDefault();
      e.stopPropagation();
      if (track.kind !== "sampler") {
        toast("Drop audio files on a sampler channel", { description: "Or drop below the tracks to create one." });
        return;
      }
      select(track.id);
      setPanel("sampler");
      void loadSample(track.id, file);
      return;
    }
    const payload = readDrag(e);
    if (!payload) return;
    e.preventDefault();
    e.stopPropagation();
    if (payload.type === "instrument") {
      if (track.patch) {
        changeInstrument(track.id, payload.preset);
        select(track.id);
        setPanel("synth");
        toast.success(`${payload.name} loaded on ${track.name}`, { description: "MIDI notes kept" });
      } else {
        toast("Drop instruments on an instrument channel", { description: "Or drop below the tracks to create a new one." });
      }
      return;
    }
    if (payload.type === "tool") {
      toast("Drop tools below the tracks", { description: "That area creates a new channel for the tool." });
      return;
    }
    const def = installedPlugins.find((d) => d.id === payload.defId);
    if (def) {
      addPlugin(track.id, def);
      select(track.id);
      setPanel("plugins");
    }
  };

  const openEditor = () => {
    select(track.id);
    setPanel(track.kind === "drum" ? "drums" : track.kind === "audio" ? "mixer" : "synth");
  };

  return (
    <div
      className={`flex items-stretch border-b border-border/80 transition-colors ${isSelected ? "bg-surface-2/40" : "hover:bg-surface/50"} ${track.hidden ? "opacity-40" : ""} ${dropping ? "ring-1 ring-primary ring-inset" : ""}`}
      onClick={(e) => {
        if (e.metaKey || e.ctrlKey) toggleSelectId(track.id);
        else select(track.id);
      }}
      onDragOver={(e) => {
        e.preventDefault();
        setDropping(true);
      }}
      onDragLeave={() => setDropping(false)}
      onDrop={onDrop}
    >
      <div className="w-1 shrink-0" style={{ background: track.color, opacity: isSelected ? 1 : 0.65 }} />
      <div className="w-[240px] shrink-0 space-y-1 border-r border-border bg-surface px-2 py-1.5">
        <div className="flex items-center gap-1.5">
          <span className="text-primary">
            <KindIcon kind={track.kind} />
          </span>
          {renaming ? (
            <Input
              autoFocus
              defaultValue={track.name}
              className="h-7 text-xs"
              onBlur={(e) => {
                updateTrack(track.id, { name: e.target.value.toUpperCase() });
                setRenaming(false);
              }}
              onKeyDown={(e) => e.key === "Enter" && (e.target as HTMLInputElement).blur()}
            />
          ) : (
            <button className="font-display text-sm font-semibold" onDoubleClick={() => setRenaming(true)}>
              {index + 1}. {track.name}
            </button>
          )}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button size="icon" variant="ghost" className="ml-auto size-6" aria-label="Track menu">
                <MoreVertical className="size-3.5" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => setRenaming(true)}>Rename</DropdownMenuItem>
              <DropdownMenuItem onClick={() => duplicateTrack(track.id)}>
                <Copy className="size-4" /> Duplicate track
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => updateTrack(track.id, { frozen: !track.frozen })}>
                <Snowflake className="size-4" /> {track.frozen ? "Unfreeze" : "Freeze"}
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => updateTrack(track.id, { hidden: !track.hidden })}>
                {track.hidden ? <Eye className="size-4" /> : <EyeOff className="size-4" />}
                {track.hidden ? "Show" : "Hide"}
              </DropdownMenuItem>
              <DropdownMenuItem onClick={openEditor}>
                <Settings2 className="size-4" /> Track settings
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuLabel className="label-xs">Edit</DropdownMenuLabel>
              {activeClip && (
                <>
                  <DropdownMenuItem onClick={splitClip}>
                    <Scissors className="size-4" /> Split at playhead
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => trimClip("left")}>
                    <ArrowRightToLine className="size-4" /> Trim start to playhead
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => trimClip("right")}>
                    <ArrowLeftToLine className="size-4" /> Trim end to playhead
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => clipOp("reverse")}>
                    <Repeat className="size-4" /> Reverse clip
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => clipOp("normalize")}>
                    <Volume2 className="size-4" /> Normalize clip
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => clipOp("fade")}>
                    <Waves className="size-4" /> Fade in / out
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={duplicateClip}>
                    <Copy className="size-4" /> Duplicate clip
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={deleteActiveClip}>
                    <Trash2 className="size-4" /> Delete clip
                  </DropdownMenuItem>
                </>
              )}
              {track.kind !== "audio" && (
                <>
                  <DropdownMenuItem
                    onClick={() => {
                      select(track.id);
                      setPanel("piano");
                    }}
                  >
                    <Piano className="size-4" /> Edit in piano roll
                  </DropdownMenuItem>
                  {(track.notes?.length ?? 0) > 0 && (
                    <>
                      <DropdownMenuItem onClick={() => noteOp("quantize")}>
                        <Grid3x3 className="size-4" /> Quantize notes 1/16
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => noteOp("up")}>
                        <ChevronUp className="size-4" /> Transpose +12
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => noteOp("down")}>
                        <ChevronDown className="size-4" /> Transpose −12
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => noteOp("double")}>
                        <Copy className="size-4" /> Double notes (repeat)
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => noteOp("clear")}>
                        <Trash2 className="size-4" /> Clear all notes
                      </DropdownMenuItem>
                    </>
                  )}
                </>
              )}

              {track.patch && (
                <>
                  <DropdownMenuSeparator />
                  <DropdownMenuLabel className="label-xs">Swap instrument (keeps MIDI)</DropdownMenuLabel>
                  {INSTRUMENTS.flatMap((g) => g.items).map((name) => (
                    <DropdownMenuItem key={name} onClick={() => changeInstrument(track.id, name)}>
                      <Repeat className="size-4" /> {name}
                    </DropdownMenuItem>
                  ))}
                </>
              )}
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => moveTrack(track.id, -1)}>
                <ChevronUp className="size-4" /> Move up
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => moveTrack(track.id, 1)}>
                <ChevronDown className="size-4" /> Move down
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem

                onClick={() =>
                  (track.clips?.length ?? 0) > 0 || (track.notes?.length ?? 0) > 0
                    ? setConfirm(true)
                    : removeTrack(track.id)
                }
              >
                <Trash2 className="size-4" /> Delete track
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        <div className="flex items-center gap-1">
          <Button
            size="sm"
            variant={track.muted ? "secondary" : "ghost"}
            className="h-6 px-2 text-[10px]"
            onClick={() => updateTrack(track.id, { muted: !track.muted })}
          >
            {track.muted ? <VolumeX className="size-3" /> : <Volume2 className="size-3" />} M
          </Button>
          <Button
            size="sm"
            variant={track.solo ? "default" : "ghost"}
            className="h-6 px-2 text-[10px]"
            onClick={() => updateTrack(track.id, { solo: !track.solo })}
          >
            <Headphones className="size-3" /> S
          </Button>
          <Button
            size="sm"
            variant={track.armed ? "destructive" : "ghost"}
            className="h-6 px-2 text-[10px]"
            onClick={() => updateTrack(track.id, { armed: !track.armed })}
          >
            ● REC
          </Button>
          <span className="label-xs ml-auto">{KIND_LABEL[track.kind]}</span>
        </div>

        <div className="flex items-center gap-2">
          <Select value={track.input} onValueChange={(v) => updateTrack(track.id, { input: v })}>
            <SelectTrigger className="h-7 flex-1 text-[11px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {INPUTS.map((i) => (
                <SelectItem key={i} value={i} className="text-xs">
                  {i}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Slider
            className="w-16"
            value={[track.volume]}
            min={0}
            max={1}
            step={0.01}
            onValueChange={([v = 0]) => updateTrack(track.id, { volume: v })}
          />
        </div>
      </div>

      <div
        className={`lane-grid relative min-h-[92px] flex-1 bg-background/70 ${
          editTool === "draw" ? "cursor-crosshair" : editTool === "split" ? "cursor-col-resize" : ""
        }`}
        title={
          editTool === "draw"
            ? "Draw tool — click to write a note or drum hit"
            : editTool === "split"
              ? "Split tool — click a clip to cut it there"
              : undefined
        }
        onClick={(e) => {
          if (editTool === "select") return;
          const r = e.currentTarget.getBoundingClientRect();
          const frac = Math.min(0.99, Math.max(0, (e.clientX - r.left) / r.width));
          const step = Math.floor(frac * 16);
          if (editTool === "draw") {
            if (track.kind === "instrument" || track.kind === "midi" || track.kind === "sampler") {
              const notes = track.notes ?? [];
              const existing = notes.find((n) => n.step % 16 === step);
              if (existing) {
                setNotes(track.id, notes.filter((n) => n.id !== existing.id));
              } else {
                const note: MidiNote = { id: uid(), step, length: 1, pitch: 60, velocity: 0.9 };
                setNotes(track.id, [...notes, note]);
              }
            } else if (track.kind === "drum") {
              const pad = track.pads?.[0];
              if (pad) toggleStep(track.id, pad.id, step);
              else toast("No pads on this drum channel", { description: "Open the drum machine and add a pad first." });
            } else {
              toast("Draw works on note and drum channels", { description: "Audio channels are recorded, not drawn." });
            }
            return;
          }
          // split tool
          if (track.kind === "audio" || track.kind === "ai-vocal") {
            if ((track.clips?.length ?? 0) === 0) {
              toast("Nothing to split", { description: "Record audio on this channel first." });
              return;
            }
            splitClipAt(track.id, frac);
          } else {
            toast("Split audio clips with a click", { description: "For note channels, park the playhead and press S." });
          }
        }}
      >
        <Lane track={track} />
      </div>


      <AlertDialog open={confirm} onOpenChange={setConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete {track.name}?</AlertDialogTitle>
            <AlertDialogDescription>
              This track contains recorded material. Deleting it removes the audio and notes permanently.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Keep track</AlertDialogCancel>
            <AlertDialogAction onClick={() => removeTrack(track.id)}>Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function EditToolbar() {
  const {
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
    removeTrack,
    clipboardName,
  } = useStudio();

  const ToolBtn = ({ tool, icon, label, keys }: { tool: EditTool; icon: React.ReactNode; label: string; keys: string }) => (
    <Button
      size="sm"
      variant={editTool === tool ? "default" : "ghost"}
      className="h-6 gap-1 px-2 text-[10px]"
      title={`${label} (${keys})`}
      onClick={() => setEditTool(tool)}
    >
      {icon} {label}
    </Button>
  );

  const targets = selectedIds.length > 1 ? selectedIds : selected ? [selected.id] : [];

  return (
    <div className="flex items-center gap-1 border-b border-border bg-surface-2/60 px-2 py-1">
      <ToolBtn tool="select" icon={<MousePointer2 className="size-3" />} label="Select" keys="V" />
      <ToolBtn tool="draw" icon={<Pencil className="size-3" />} label="Draw" keys="B" />
      <ToolBtn tool="split" icon={<Scissors className="size-3" />} label="Split" keys="C" />
      <div className="mx-1 h-4 w-px bg-border" />
      <Button size="sm" variant="ghost" className="h-6 gap-1 px-2 text-[10px]" title="Select all channels (⌘A / Ctrl+A)" onClick={selectAll}>
        <ListChecks className="size-3" /> All
      </Button>
      <Button
        size="sm"
        variant="ghost"
        className="h-6 gap-1 px-2 text-[10px]"
        title="Split the selected channel's clip or notes at the playhead (S)"
        onClick={splitAtPlayhead}
      >
        <Scissors className="size-3" /> Split at Playhead
      </Button>
      <div className="mx-1 h-4 w-px bg-border" />
      <Button
        size="sm"
        variant="ghost"
        className="h-6 gap-1 px-2 text-[10px]"
        disabled={targets.length === 0}
        title="Cut selection (⌘X / Ctrl+X)"
        onClick={() => targets.forEach((id) => cutTrack(id))}
      >
        <Scissors className="size-3" /> Cut
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
        disabled={!clipboardName}
        title="Paste (⌘V / Ctrl+V)"
        onClick={pasteTrack}
      >
        <ClipboardPaste className="size-3" /> Paste
      </Button>
      <Button
        size="sm"
        variant="ghost"
        className="h-6 gap-1 px-2 text-[10px] text-destructive"
        disabled={targets.length === 0}
        title="Delete selection (Del)"
        onClick={() => targets.forEach((id) => removeTrack(id))}
      >
        <Trash2 className="size-3" /> Delete{targets.length > 1 ? ` ${targets.length}` : ""}
      </Button>
      <span className="label-xs ml-auto hidden sm:inline">
        {selectedIds.length > 1 ? `${selectedIds.length} selected` : `${tracks.length} channels`}
      </span>
    </div>
  );
}

function Ruler() {
  const { transport, setTransport } = useStudio();
  const gridRef = useRef<HTMLDivElement>(null);
  const bars = Math.max(1, transport.bars ?? 4);
  const total = bars * 4;
  const lo = transport.loopStart ?? 0;
  const hi = Math.max(lo + 1, transport.loopEnd ?? total);

  const setBars = (next: number) => {
    const b = Math.min(64, Math.max(1, next));
    const steps = b * 4;
    setTransport({
      bars: b,
      loopStart: Math.min(lo, steps - 1),
      loopEnd: Math.min(hi, steps),
      step: transport.step % steps,
    });
  };

  const stepFromX = (clientX: number) => {
    const el = gridRef.current;
    if (!el) return 0;
    const r = el.getBoundingClientRect();
    return Math.min(total, Math.max(0, Math.round(((clientX - r.left) / r.width) * total)));
  };

  const startDrag = (e: React.PointerEvent) => {
    e.preventDefault();
    const s = stepFromX(e.clientX);
    let end = s;
    setTransport({ loopStart: s, loopEnd: Math.min(total, s + 4), loop: true });
    const move = (ev: PointerEvent) => {
      end = stepFromX(ev.clientX);
      setTransport({ loopStart: Math.min(s, end), loopEnd: Math.max(Math.min(s, end) + 1, Math.max(s, end)) });
    };
    const up = () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
  };

  return (
    <div className="sticky top-0 z-10 flex border-b border-border bg-surface-2/70 backdrop-blur">
      <div className="flex w-[244px] shrink-0 items-center gap-2 border-r border-border px-3 py-1">
        <span className="font-display text-[11px] font-semibold tracking-[0.2em]">TIMELINE</span>
        <span className="label-xs ml-auto">
          {String(Math.floor(transport.step / 4) + 1).padStart(2, "0")}.{(transport.step % 4) + 1}
        </span>
        {/* bar count control */}
        <div className="flex items-center gap-0.5 rounded-[3px] border border-border bg-background/70 px-0.5" title="Timeline length in bars">
          <button
            type="button"
            aria-label="Fewer bars"
            className="px-1 font-mono text-[11px] text-muted-foreground hover:text-foreground disabled:opacity-30"
            disabled={bars <= 1}
            onClick={() => setBars(bars - 1)}
          >
            −
          </button>
          <span className="min-w-11 text-center font-mono text-[10px] text-primary">{bars} {bars === 1 ? "BAR" : "BARS"}</span>
          <button
            type="button"
            aria-label="More bars"
            className="px-1 font-mono text-[11px] text-muted-foreground hover:text-foreground disabled:opacity-30"
            disabled={bars >= 64}
            onClick={() => setBars(bars + 1)}
          >
            +
          </button>
        </div>
      </div>
      <div
        ref={gridRef}
        onPointerDown={startDrag}
        title="Drag on the ruler to set the loop region"
        className="relative flex flex-1 cursor-ew-resize select-none"
      >
        <div className="grid w-full" style={{ gridTemplateColumns: `repeat(${total},minmax(0,1fr))` }}>
          {Array.from({ length: total }).map((_, i) => (
            <div
              key={i}
              className={`border-l py-1 pl-1 font-mono text-[9px] ${
                i % 4 === 0 ? "border-border text-foreground/70" : "border-border/30 text-muted-foreground/50"
              }`}
            >
              {i % 4 === 0 ? `${i / 4 + 1}` : "·"}
            </div>
          ))}
        </div>

        {/* dim outside the loop */}
        {transport.loop && (
          <>
            <div className="pointer-events-none absolute inset-y-0 left-0 bg-background/60" style={{ width: `${(lo / total) * 100}%` }} />
            <div className="pointer-events-none absolute inset-y-0 right-0 bg-background/60" style={{ width: `${((total - hi) / total) * 100}%` }} />
            {/* loop band */}
            <div
              className="pointer-events-none absolute inset-y-0 border-x border-primary/70 bg-primary/15"
              style={{ left: `${(lo / total) * 100}%`, width: `${((hi - lo) / total) * 100}%` }}
            />
            {/* markers */}
            {[lo, hi].map((p, idx) => (
              <div key={idx} className="pointer-events-none absolute top-0" style={{ left: `calc(${(p / total) * 100}% - 4px)` }}>
                <div
                  className="h-0 w-0 border-x-4 border-x-transparent"
                  style={{ borderTop: "7px solid var(--primary)" }}
                />
              </div>
            ))}
          </>
        )}

        {transport.playing && (
          <div
            className="pointer-events-none absolute top-0 h-full w-[2px] bg-primary"
            style={{ left: `${(transport.step / total) * 100}%` }}
          />
        )}
      </div>
    </div>
  );
}

export function Timeline() {
  const { tracks, transport, addTrack, setPanel, loadSample } = useStudio();
  const [over, setOver] = useState(false);
  return (
    <section className="relative flex min-h-0 flex-1 flex-col overflow-hidden border-x border-b border-border bg-background/60">
      <EditToolbar />
      <Ruler />
      <div className="relative min-h-0 flex-1 overflow-y-auto">
        {/* SYNCLAB watermark centered over the rhythm grid */}
        <div className="pointer-events-none sticky top-1/2 z-0 h-0" aria-hidden="true">
          <img
            src={synclabLogo}
            alt=""
            className="absolute left-1/2 top-0 w-[min(420px,45%)] -translate-x-[calc(50%-122px)] -translate-y-1/2 select-none opacity-[0.08]"
          />
        </div>
        {tracks.map((t, i) => (
          <TrackRow key={t.id} track={t} index={i} />
        ))}
        <div className="flex items-center gap-3 px-2 pt-2">
          <AddTrackMenu size="sm" />
          <span className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
            {tracks.length} tracks
          </span>
        </div>
        <div
          className={`m-2 rounded-[3px] border border-dashed px-3 py-3 text-center font-mono text-[10px] tracking-widest uppercase transition-colors ${
            over ? "border-primary bg-primary/10 text-primary" : "border-border/70 text-muted-foreground"
          }`}
          onDragOver={(e) => {
            e.preventDefault();
            setOver(true);
          }}
          onDragLeave={() => setOver(false)}
          onDrop={(e) => {
            setOver(false);
            const file = e.dataTransfer.files?.[0];
            if (file && (file.type.startsWith("audio") || /\.(mp3|wav|wave|aif|aiff|m4a|aac|ogg|flac|webm)$/i.test(file.name))) {
              e.preventDefault();
              const id = addTrack("sampler", file.name.replace(/\.[^.]+$/, "").toUpperCase().slice(0, 16));
              setPanel("sampler");
              void loadSample(id, file);
              return;
            }
            const payload = readDrag(e);
            if (!payload) return;
            e.preventDefault();
            if (payload.type === "instrument") {
              addTrack("instrument", payload.name.toUpperCase(), payload.preset);
              toast.success(`${payload.name} added as a new channel`);
              return;
            }
            if (payload.type === "tool") {
              addTrack(payload.kind, payload.name.toUpperCase(), payload.preset);
              toast.success(`${payload.name} added as a new channel`);
            }
          }}
        >
          drag a tool or instrument here or press + ADD TRACK
        </div>

        {transport.loop && (
          <div
            className="pointer-events-none absolute inset-y-0 border-x border-primary/25 bg-primary/[0.04]"
            style={{
              left: `calc(244px + (100% - 244px) * ${(transport.loopStart ?? 0) / totalSteps})`,
              width: `calc((100% - 244px) * ${(Math.max((transport.loopStart ?? 0) + 1, transport.loopEnd ?? totalSteps) - (transport.loopStart ?? 0)) / totalSteps})`,
            }}
          />
        )}
        {transport.playing && (
          <div
            className="pointer-events-none absolute top-0 bottom-0 w-[1.5px] bg-primary/80"
            style={{ left: `calc(244px + (100% - 244px) * ${transport.step / totalSteps})` }}
          />
        )}
      </div>
    </section>
  );
}
