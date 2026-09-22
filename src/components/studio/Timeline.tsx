import { useEffect, useRef, useState } from "react";
import { STEPS_PER_BAR, STEPS_PER_BEAT, songSteps, stepSeconds, positionLabel } from "@/lib/synclab/timebase";
import { useIsMobile } from "@/hooks/use-mobile";
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
  Eraser,
  Eye,
  Flag,
  EyeOff,
  Headphones,
  Mic,
  Lock,
  LockOpen,
  MoreVertical,
  Redo2,
  Repeat,
  Undo2,
  Music2,
  Piano,
  Settings2,
  Snowflake,
  Trash2,
  Volume2,
  VolumeX,
  X,
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
import { SectionLane } from "./SectionLane";
import { useStudio } from "@/lib/synclab/store";
import { useApp } from "@/lib/synclab/app-state";
import { AddTrackMenu } from "@/components/studio/AddTrackMenu";

import { INSTRUMENTS, KIND_LABEL, uid } from "@/lib/synclab/presets";
import type { EditTool } from "@/lib/synclab/store";
import type { AutomationLane, AutomationParam, AutomationPoint, BusId, MidiNote, Track } from "@/lib/synclab/types";

const CORE_LANE_LABEL: Record<Exclude<AutomationParam, `plugin:${string}:${string}`>, string> = {
  volume: "VOLUME",
  pan: "PAN",
  sendReverb: "REVERB SEND",
  sendDelay: "DELAY SEND",
};
const laneLabel = (track: Track, param: AutomationParam) => {
  if (!param.startsWith("plugin:")) return CORE_LANE_LABEL[param as keyof typeof CORE_LANE_LABEL];
  const [, pluginId, paramId] = param.split(":");
  const plugin = (track.plugins ?? []).find((item) => item.id === pluginId);
  const control = plugin?.params.find((item) => item.id === paramId);
  return `${plugin?.name ?? "DEVICE"} · ${control?.name ?? paramId ?? "CONTROL"}`.toUpperCase();
};

let automationClipboard: { duration: number; points: AutomationPoint[] } | null = null;
import { WaveformView } from "@/components/studio/WaveformView";
import { LevelBar } from "@/components/studio/LevelBar";
import { ClipEditor } from "@/components/studio/ClipEditor";
import { clipSeconds } from "@/lib/synclab/types";
import { getEngine } from "@/lib/synclab/audio-engine";
import { parseMidiFile } from "@/lib/synclab/midi-file";

import { TrackIcon, TrackStylePicker } from "@/components/studio/TrackStyle";
import { TrackNotes } from "@/components/studio/TrackNotes";

const INPUTS = ["Microphone", "Guitar / Line 1", "Keyboard / Line 2", "External Instrument", "MIDI Keyboard", "Internal", "Stereo File"];

/** Audio lane: every clip sits at its own bar position and can be moved, trimmed and dragged between tracks. */
function Waveform({ track }: { track: Track }) {
  const { setActiveClip, removeClip, updateTrack, transport, tracks } = useStudio();
  const [editingId, setEditingId] = useState<string | null>(null);
  const clips = track.clips ?? [];
  const total = songSteps(transport.bars);
  const stepDur = stepSeconds(transport.bpm);
  const editing = clips.find((c) => c.id === editingId) ?? null;

  const writeClip = (clipId: string, patch: Partial<(typeof clips)[number]>) =>
    updateTrack(track.id, { clips: clips.map((c) => (c.id === clipId ? { ...c, ...patch } : c)) });

  const beginDrag = (
    e: React.PointerEvent,
    clip: (typeof clips)[number],
    mode: "move" | "trim-left" | "trim-right",
  ) => {
    e.stopPropagation();
    e.preventDefault();
    const lane = (e.currentTarget as HTMLElement).closest("[data-lane]") as HTMLElement | null;
    if (!lane) return;
    const rect = lane.getBoundingClientRect();
    const perStep = rect.width / total;
    const x0 = e.clientX;
    const orig = {
      start: clip.start ?? 0,
      offset: clip.offset ?? 0,
      length: clip.length ?? clip.duration,
    };
    const el = e.currentTarget as HTMLElement;
    el.setPointerCapture(e.pointerId);

    const grid = transport.snap ?? 1;
    const onMove = (ev: PointerEvent) => {
      const raw = (ev.clientX - x0) / Math.max(1, perStep);
      const dSteps = grid > 0 ? Math.round(raw / grid) * grid : Math.round(raw * 100) / 100;
      if (mode === "move") {
        const next = orig.start + dSteps;
        writeClip(clip.id, {
          start: Math.max(0, Math.min(total - 1, grid > 0 ? Math.round(next / grid) * grid : next)),
        });
      } else if (mode === "trim-right") {
        const len = Math.max(0.05, Math.min(clip.duration - orig.offset, orig.length + dSteps * stepDur));
        writeClip(clip.id, { length: len });
      } else {
        const delta = Math.max(-orig.offset, Math.min(orig.length - 0.05, dSteps * stepDur));
        writeClip(clip.id, {
          offset: orig.offset + delta,
          length: orig.length - delta,
          start: Math.max(0, orig.start + Math.round(delta / stepDur)),
        });
      }
    };

    const onUp = (ev: PointerEvent) => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      if (mode !== "move") return;
      const under = document.elementFromPoint(ev.clientX, ev.clientY) as HTMLElement | null;
      const targetLane = under?.closest("[data-lane-track]") as HTMLElement | null;
      const targetId = targetLane?.dataset["laneTrack"];
      if (!targetId || targetId === track.id) return;
      const dest = tracks.find((t) => t.id === targetId);
      if (!dest || dest.kind === "drum" || dest.kind === "instrument" || dest.kind === "midi") {
        toast("Clips move between audio channels", { description: "Drop it on an audio or vocal channel." });
        return;
      }
      const moved = clips.find((c) => c.id === clip.id);
      if (!moved) return;
      updateTrack(track.id, { clips: clips.filter((c) => c.id !== clip.id) });
      updateTrack(dest.id, { clips: [...(dest.clips ?? []), moved], activeClipId: moved.id });
      toast.success(`${moved.name} moved to ${dest.name}`);
    };

    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
  };

  if (clips.length === 0) return null;

  return (
    <>
      {clips.map((clip) => {
        const start = clip.start ?? 0;
        const length = clipSeconds(clip);
        const steps = Math.max(1, length / stepDur);
        const left = (start / total) * 100;
        const width = Math.min(100 - left, (steps / total) * 100);
        const active = clip.id === track.activeClipId;
        const peaks = clip.peaks.length > 0 ? clip.peaks : [0];
        return (
          <div
            key={clip.id}
            className={`group absolute inset-y-2 flex flex-col overflow-hidden rounded-[3px] border bg-clip-audio/10 shadow-sm transition-colors hover:bg-clip-audio/15 ${
              active
                ? "border-foreground ring-2 ring-inset ring-foreground"
                : "border-clip-audio/30 hover:border-foreground/40"
            }`}
            style={{ left: `${left}%`, width: `${Math.max(2, width)}%` }}
            onPointerDown={(e) => {
              setActiveClip(track.id, clip.id);
              beginDrag(e, clip, "move");
            }}
            onDoubleClick={(e) => {
              e.stopPropagation();
              setEditingId(clip.id);
            }}
            title={`${clip.name} — drag to move, pull the edges to trim, double-click to edit`}
          >
            <div className="flex h-[17px] shrink-0 cursor-grab items-center gap-1 bg-clip-audio/10 px-1.5 active:cursor-grabbing">
              <span className="truncate font-mono text-[9px] font-semibold text-clip-audio/80">{clip.name}</span>
              <span className="ml-auto shrink-0 font-mono text-[8px] text-clip-audio/55">{length.toFixed(1)}s</span>
              <button
                onPointerDown={(e) => e.stopPropagation()}
                onClick={(e) => {
                  e.stopPropagation();
                  updateTrack(track.id, {
                    clips: [...clips, { ...clip, id: uid(), name: `${clip.name} COPY`, start: start + Math.round(steps) }],
                  });
                }}
                title="Duplicate clip"
                aria-label={`Duplicate ${clip.name}`}
                className="hidden shrink-0 text-clip-audio/70 hover:text-foreground group-hover:block"
              >
                <Copy className="size-3" />
              </button>
              <button
                onPointerDown={(e) => e.stopPropagation()}
                onClick={(e) => {
                  e.stopPropagation();
                  removeClip(track.id, clip.id);
                }}
                title="Delete clip"
                aria-label={`Delete ${clip.name}`}
                className="hidden shrink-0 text-clip-audio/70 hover:text-destructive group-hover:block"
              >
                <Trash2 className="size-3" />
              </button>
            </div>

            <div className="min-h-0 w-full flex-1 px-1 pb-1">
              <WaveformView peaks={peaks} color="var(--clip-audio)" label={`${clip.name} waveform`} />
            </div>

            <div
              onPointerDown={(e) => beginDrag(e, clip, "trim-left")}
              title="Trim the start"
              className="absolute inset-y-0 left-0 w-1.5 cursor-ew-resize bg-clip-audio/0 hover:bg-clip-audio/60"
            />
            <div
              onPointerDown={(e) => beginDrag(e, clip, "trim-right")}
              title="Trim the end"
              className="absolute inset-y-0 right-0 w-1.5 cursor-ew-resize bg-clip-audio/0 hover:bg-clip-audio/60"
            />
          </div>
        );
      })}
      {editing && <ClipEditor track={track} clip={editing} onClose={() => setEditingId(null)} />}
    </>
  );
}


const NOTE_NAMES = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];

function MidiClip({ track }: { track: Track }) {
  const { setPanel, select, transport } = useStudio();
  const notes = track.notes ?? [];
  // the pattern loops for the whole song, so draw every repeat where it is heard
  const total = songSteps(transport.bars);
  const patLen = Math.max(STEPS_PER_BAR, track.steps || STEPS_PER_BAR);
  const reps = Math.max(1, Math.ceil(total / patLen));
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
        {Array.from({ length: reps }).flatMap((_, rep) =>
          notes.map((n) => {
            const at = rep * patLen + (n.step % patLen);
            if (at >= total) return null;
            return (
          <div
            key={`${n.id}-${rep}`}
            className="absolute rounded-full bg-clip-midi/55"
            title={`${NOTE_NAMES[n.pitch % 12]}${Math.floor(n.pitch / 12) - 1}`}
            style={{
              left: `${(at / total) * 100}%`,
              width: `${Math.max(0.3, (Math.max(1, n.length) / total) * 100 - 0.1)}%`,
              top: `${(1 - (n.pitch - lo) / span) * 82 + 4}%`,
              height: "6%",
              opacity: 0.5 + (n.velocity ?? 0.8) * 0.35,
            }}
          />
            );
          }),
        )}
      </div>
    </div>
  );
}

function DrumClip({ track }: { track: Track }) {
  const { setPanel, select, transport } = useStudio();
  const total = songSteps(transport.bars);
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
        {Array.from({ length: Math.max(1, Math.ceil(total / Math.max(1, steps))) }).flatMap((_, rep) =>
          shown.flatMap((p, r) =>
          p.steps.slice(0, steps).map((vel, i) => {
            const at = rep * steps + i;
            return vel > 0 && at < total ? (
              <div
                key={`${p.id}-${rep}-${i}`}
                 className="absolute rounded-full bg-clip-drum/60"
                title={`${p.name} · step ${i + 1}`}
                style={{
                  left: `${(at / total) * 100}%`,
                  width: `${Math.max(0.3, 100 / total - 0.1)}%`,
                  top: `${(r / shown.length) * 100 + 100 / shown.length * 0.18}%`,
                  height: `${Math.max(8, (100 / shown.length) * 0.42)}%`,
                  opacity: 0.4 + vel * 0.45,
                }}
              />
            ) : null;
          }),
          ),
        )}
      </div>
    </div>
  );
}

/** The take you are capturing right now: a red region that grows from the punch-in
 *  point and draws the incoming microphone level live. */
function RecordingClip({ track }: { track: Track }) {
  const { transport } = useStudio();
  const total = songSteps(transport.bars);
  const startRef = useRef(transport.step ?? 0);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const peaksRef = useRef<number[]>([]);
  const isNote = track.kind === "instrument" || track.kind === "midi" || track.kind === "drum";

  useEffect(() => {
    if (isNote) return;
    const engine = getEngine();
    let raf = 0;
    const draw = () => {
      raf = requestAnimationFrame(draw);
      peaksRef.current.push(engine.inputLevel());
      if (peaksRef.current.length > 2000) peaksRef.current.shift();
      const canvas = canvasRef.current;
      const g = canvas?.getContext("2d");
      if (!canvas || !g) return;
      const w = (canvas.width = Math.max(2, canvas.clientWidth * 2));
      const h = (canvas.height = Math.max(2, canvas.clientHeight * 2));
      g.clearRect(0, 0, w, h);
      const peaks = peaksRef.current;
      const style = getComputedStyle(canvas);
      g.fillStyle = style.color;
      const step = Math.max(1, Math.ceil(peaks.length / Math.max(1, w / 2)));
      for (let i = 0, x = 0; i < peaks.length; i += step, x += 2) {
        const v = Math.min(1, peaks[i] ?? 0);
        const bh = Math.max(2, v * h * 0.92);
        g.fillRect(x, (h - bh) / 2, 1.6, bh);
      }
    };
    draw();
    return () => cancelAnimationFrame(raf);
  }, [isNote]);

  const start = startRef.current;
  const now = transport.step ?? start;
  const length = Math.max(1, (now >= start ? now - start : total - start) + 1);
  const left = (start / total) * 100;
  const width = Math.min(100 - left, (length / total) * 100);

  return (
    <div
      className="pointer-events-none absolute inset-y-1 z-10 flex flex-col overflow-hidden rounded-[3px] border-2 border-destructive bg-destructive/15"
      style={{ left: `${left}%`, width: `${Math.max(1.5, width)}%` }}
    >
      <div className="flex shrink-0 items-center gap-1 bg-destructive/25 px-1.5 py-[1px]">
        <span className="size-1.5 animate-pulse rounded-full bg-destructive" />
        <span className="font-mono text-[9px] font-semibold text-destructive">RECORDING</span>
      </div>
      {track.kind === "drum" ? (
        <div className="relative min-h-0 w-full flex-1" aria-label="Drum hits being recorded" role="img">
          {(track.pads ?? []).flatMap((pad, row, arr) => {
            const padLen = pad.steps.length || track.steps || 16;
            const hits: React.ReactNode[] = [];
            for (let s = start; s <= now; s++) {
              if ((pad.steps[s % padLen] ?? 0) <= 0) continue;
              const l = ((s - start) / Math.max(1, length)) * 100;
              hits.push(
                <div
                  key={`${pad.id}-${s}`}
                  className="absolute rounded-[2px] bg-destructive"
                  style={{
                    left: `${l}%`,
                    width: `${Math.max(2, (1 / Math.max(1, length)) * 100)}%`,
                    top: `${(row / Math.max(1, arr.length)) * 100}%`,
                    height: `${Math.max(8, 100 / Math.max(1, arr.length) - 2)}%`,
                  }}
                />,
              );
            }
            return hits;
          })}
        </div>
      ) : isNote ? (
        <div className="relative min-h-0 w-full flex-1" aria-label="Notes being recorded" role="img">
          {(track.notes ?? [])
            .filter((n) => n.step >= start && n.step <= now)
            .map((n) => {
              const span = Math.max(1, length);
              const l = ((n.step - start) / span) * 100;
              const w = Math.max(3, ((n.length || 1) / span) * 100);
              const top = Math.min(92, Math.max(0, 100 - ((n.pitch - 36) / 48) * 100));
              return (
                <div
                  key={n.id}
                  className="absolute h-[8%] min-h-[3px] rounded-[2px] bg-destructive"
                  style={{ left: `${l}%`, width: `${Math.min(100 - l, w)}%`, top: `${top}%` }}
                />
              );
            })}
        </div>
      ) : (
        <canvas ref={canvasRef} className="min-h-0 w-full flex-1 text-destructive" aria-label="Incoming recording waveform" role="img" />
      )}
    </div>
  );
}

function Lane({ track }: { track: Track }) {
  const isMidi = track.kind === "instrument" || track.kind === "midi" || track.kind === "sampler";
  const live = track.recording ? <RecordingClip track={track} /> : null;
  if (track.kind === "drum")
    return (
      <>
        <DrumClip track={track} />
        {live}
      </>
    );
  if (!isMidi && (track.clips?.length ?? 0) > 0)
    return (
      <>
        <Waveform track={track} />
        {live}
      </>
    );
  if (isMidi)
    return (
      <>
        <MidiClip track={track} />
        {live}
      </>
    );
  if (track.kind === "audio" || track.kind === "ai-vocal")
    return (
      <>
        {!live && (
          <div className="absolute inset-y-1 left-0 right-1 flex items-center justify-center rounded-[3px] border border-dashed border-border">
            <span className="label-xs">NO AUDIO — ARM ● REC TO CAPTURE A WAVEFORM</span>
          </div>
        )}
        {live}
      </>
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

const TRACK_BUSES: { id: BusId; label: string }[] = [
  { id: "drums", label: "Drums bus" },
  { id: "vocals", label: "Vocals bus" },
  { id: "instruments", label: "Instruments bus" },
  { id: "synths", label: "Synths bus" },
  { id: "fx", label: "FX bus" },
  { id: "master", label: "Master (direct)" },
];

function TrackRow({ track, index }: { track: Track; index: number }) {
  const isMobile = useIsMobile();
  const { selectedId, selectedIds, select, toggleSelectId, updateTrack, removeTrack, duplicateTrack, moveTrack, setPanel, changeInstrument, installedPlugins, addPlugin, editTool, splitClipAt, toggleStep, toggleAutomationLane, copyTrack, cutTrack, pasteTrack, clipboardName } =
    useStudio();
  const { transport, setNotes, loadSample, fxChains } = useStudio();
  const advanced = useApp().mode === "advanced";

  const [renaming, setRenaming] = useState(false);
  const [confirm, setConfirm] = useState(false);
  const [dropping, setDropping] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
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

  /** Drag the strip under a lane to make that track taller or shorter. */
  const resizeHeight = (e: React.PointerEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const y0 = e.clientY;
    const h0 = track.height ?? 104;
    const onMove = (ev: PointerEvent) =>
      updateTrack(track.id, { height: Math.max(64, Math.min(420, h0 + (ev.clientY - y0))) });
    const onUp = () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
    };
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
  };

  return (
    <div className="border-b border-border/80">
    <div
      className={`relative flex items-stretch transition-colors ${isSelected ? "bg-surface-2/40 ring-1 ring-inset ring-foreground/80" : "hover:bg-surface/50"} ${track.hidden ? "opacity-40" : ""} ${dropping ? "ring-1 ring-primary ring-inset" : ""}`}
      style={{ height: track.height ?? undefined }}
      onClick={(e) => {
        if (e.metaKey || e.ctrlKey) {
          toggleSelectId(track.id);
          return;
        }
        select(track.id);
        // Selecting a track opens its edit menu (cut, copy, clip tools…).
        const el = e.target as HTMLElement;
        if (el.closest("button,input,textarea,select,[role='slider'],[role='combobox'],[contenteditable]")) return;
        setMenuOpen(true);
      }}
      onDragOver={(e) => {
        e.preventDefault();
        setDropping(true);
      }}
      onDragLeave={() => setDropping(false)}
      onDrop={onDrop}
    >
      <div className="w-1 shrink-0" style={{ background: track.color, opacity: isSelected ? 1 : 0.65 }} />
      <div
        className="w-[168px] shrink-0 space-y-1 border-r border-border bg-surface px-2 py-1.5 sm:w-[240px]"
        onClick={(e) => {
          // Selecting a channel from its header opens its edit menu.
          if (e.metaKey || e.ctrlKey) return;
          const el = e.target as HTMLElement;
          if (el.closest("button,input,[role='slider'],[role='combobox']")) return;
          select(track.id);
          setMenuOpen(true);
        }}
      >
        <div className="flex items-center gap-1.5">
          <TrackStylePicker track={track}>
            <button
              type="button"
              onClick={(e) => e.stopPropagation()}
              title={`${track.name} — pick colour and icon`}
              aria-label={`${track.name} colour and icon`}
              className="flex size-9 shrink-0 items-center justify-center rounded-md border transition-colors hover:bg-white/5"
              style={{
                borderColor: `color-mix(in oklab, ${track.color} 60%, transparent)`,
                background: `color-mix(in oklab, ${track.color} 16%, transparent)`,
              }}
            >
              <TrackIcon track={track} className="size-5" />
            </button>
          </TrackStylePicker>
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
            <button className="font-display text-sm font-semibold truncate" onDoubleClick={() => setRenaming(true)}>
              {index + 1}. {track.name}
            </button>
          )}
          <TrackNotes track={track} className="ml-auto" />
          <DropdownMenu open={menuOpen} onOpenChange={setMenuOpen}>
            <DropdownMenuTrigger asChild>
              <Button size="icon" variant="ghost" className="size-10 touch-manipulation sm:size-6" aria-label="Track menu">
                <MoreVertical className="size-3.5" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => setRenaming(true)}>Rename</DropdownMenuItem>
              <DropdownMenuItem onClick={() => duplicateTrack(track.id)}>
                <Copy className="size-4" /> Duplicate track
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => cutTrack(track.id)}>
                <Scissors className="size-4" /> Cut track
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => copyTrack(track.id)}>
                <Copy className="size-4" /> Copy track
              </DropdownMenuItem>
              <DropdownMenuItem onClick={pasteTrack}>
                <ClipboardPaste className="size-4" /> Paste track{clipboardName ? ` (${clipboardName})` : ""}
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
              <DropdownMenuLabel className="label-xs">Send track to bus</DropdownMenuLabel>
              {TRACK_BUSES.map((b) => {
                const fx = fxChains[`bus:${b.id}`] ?? [];
                return (
                  <DropdownMenuItem key={b.id} onClick={() => updateTrack(track.id, { bus: b.id })}>
                    <span className="w-4">{track.bus === b.id ? "✓" : ""}</span>
                    <span className="truncate">
                      {b.label}
                      {fx.length > 0 ? ` · ${fx.map((p) => p.name).join(", ")}` : " · no effects"}
                    </span>
                  </DropdownMenuItem>
                );
              })}
              <DropdownMenuItem
                onClick={() => {
                  select(track.id);
                  setPanel("mixer");
                }}
              >
                <Settings2 className="size-4" /> Edit bus effects in mixer
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuLabel className="label-xs">Automation</DropdownMenuLabel>
              {(["volume", "pan", "sendReverb", "sendDelay"] as AutomationParam[]).map((param) => (
                <DropdownMenuItem key={param} onClick={() => toggleAutomationLane(track.id, param)}>
                  {(track.automation ?? []).some((l) => l.param === param) ? "Hide" : "Show"} {laneLabel(track, param).toLowerCase()} lane
                </DropdownMenuItem>
              ))}
              {(track.plugins ?? []).filter((plugin) => !plugin.bypass).flatMap((plugin) =>
                plugin.params.filter((param) => !param.id.startsWith("s") || plugin.kind !== "stepfilter").map((param) => {
                  const automationParam = `plugin:${plugin.id}:${param.id}` as AutomationParam;
                  return (
                    <DropdownMenuItem key={automationParam} onClick={() => toggleAutomationLane(track.id, automationParam)}>
                      {(track.automation ?? []).some((lane) => lane.param === automationParam) ? "Hide" : "Show"} {plugin.name} · {param.name}
                    </DropdownMenuItem>
                  );
                }),
              )}
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
            title={
              track.armed
                ? "Armed — the microphone meter is live. Press record on the transport to capture it."
                : "Arm this channel to monitor the microphone"
            }
            onClick={() => updateTrack(track.id, { armed: !track.armed })}
          >
            ● ARM
          </Button>
          {advanced && <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                size="sm"
                variant={(track.automation?.length ?? 0) > 0 ? "secondary" : "ghost"}
                className="h-7 gap-1 px-2 text-[9px] font-semibold sm:h-6"
                aria-label={`Automation lanes for ${track.name}`}
                title="Show or hide automation lanes"
              >
                <Waves className="size-3" /> AUTO
                {(track.automation?.length ?? 0) > 0 && (
                  <span className="min-w-3 rounded-sm bg-primary px-0.5 text-[8px] text-primary-foreground">
                    {track.automation?.length}
                  </span>
                )}
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="min-w-56">
              <DropdownMenuLabel className="label-xs">Show automation lane</DropdownMenuLabel>
              {(["volume", "pan", "sendReverb", "sendDelay"] as AutomationParam[]).map((param) => {
                const visible = (track.automation ?? []).some((lane) => lane.param === param);
                return (
                  <DropdownMenuItem key={param} onClick={() => toggleAutomationLane(track.id, param)}>
                    <span className={`size-2 rounded-full ${visible ? "bg-primary" : "border border-muted-foreground"}`} />
                    {laneLabel(track, param)}
                    <span className="ml-auto text-[9px] text-muted-foreground">{visible ? "HIDE" : "SHOW"}</span>
                  </DropdownMenuItem>
                );
              })}
              {(track.plugins ?? []).some((plugin) => !plugin.bypass) && <DropdownMenuSeparator />}
              {(track.plugins ?? []).filter((plugin) => !plugin.bypass).flatMap((plugin) =>
                plugin.params.filter((param) => !param.id.startsWith("s") || plugin.kind !== "stepfilter").map((param) => {
                  const automationParam = `plugin:${plugin.id}:${param.id}` as AutomationParam;
                  const visible = (track.automation ?? []).some((lane) => lane.param === automationParam);
                  return (
                    <DropdownMenuItem key={automationParam} onClick={() => toggleAutomationLane(track.id, automationParam)}>
                      <span className={`size-2 rounded-full ${visible ? "bg-primary" : "border border-muted-foreground"}`} />
                      <span className="truncate">{plugin.name} · {param.name}</span>
                      <span className="ml-auto text-[9px] text-muted-foreground">{visible ? "HIDE" : "SHOW"}</span>
                    </DropdownMenuItem>
                  );
                }),
              )}
            </DropdownMenuContent>
          </DropdownMenu>}
          {!isMobile && <span className="label-xs ml-auto whitespace-nowrap">{KIND_LABEL[track.kind]}</span>}
        </div>

        <div className="flex items-center gap-2">
          {!isMobile && <Select value={track.input} onValueChange={(v) => updateTrack(track.id, { input: v })}>
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
          </Select>}
          <Slider
            className="w-16"
            value={[track.volume]}
            min={0}
            max={1}
            step={0.01}
            onValueChange={([v = 0]) => updateTrack(track.id, { volume: v })}
          />
        </div>

        <LevelBar
          id={track.id}
          color={track.color}
          source={
            (track.armed || track.recording) &&
            (track.kind === "audio" || track.kind === "ai-vocal" || track.kind === "sampler")
              ? "input"
              : "output"
          }
          {...(track.armed || track.recording ? { label: "IN" } : {})}
        />
      </div>

      <div
        data-lane
        data-lane-track={track.id}
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


      <div
        onPointerDown={resizeHeight}
        title="Drag to change this track's height"
        className="absolute inset-x-0 bottom-0 z-10 h-1.5 cursor-ns-resize hover:bg-primary/40"
      />

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

      {advanced &&
        (track.automation ?? []).map((lane) => <AutomationRow key={lane.param} track={track} lane={lane} />)}

    </div>
  );
}

/** One automation lane under a track: click to add a point, drag points, double-click to remove. */
function AutomationRow({ track, lane }: { track: Track; lane: AutomationLane }) {
  const {
    transport,
    setAutomationPoints,
    setAutomationMode,
    setAutomationLaneLock,
    toggleAutomationLane,
    previewAutomation,
    undoAutomationEdit,
    redoAutomationEdit,
    automationHistory,
  } = useStudio();
  const locked = lane.locked ?? false;
  const [selectedPoint, setSelectedPoint] = useState<number | null>(null);
  /** live readout that follows the pointer while a point, curve or region is being edited */
  const [liveEdit, setLiveEdit] = useState<{ x: number; y: number; text: string } | null>(null);
  const liveTimer = useRef<number | null>(null);
  const flashReadout = (text: string, x = 50, y = 12) => {
    setLiveEdit({ x, y, text });
    if (liveTimer.current) window.clearTimeout(liveTimer.current);
    liveTimer.current = window.setTimeout(() => setLiveEdit(null), 900);
  };
  const [gridSnap, setGridSnap] = useState<0 | 0.25 | 0.5 | 1>(1);
  const [valueSnap, setValueSnap] = useState<0 | 0.02 | 0.05 | 0.1>(0);
  const total = songSteps(transport.bars);
  const regionStart = Math.max(0, Math.min(total, transport.loopStart ?? 0));
  const regionEnd = Math.max(regionStart + 1, Math.min(total, transport.loopEnd ?? total));
  const regionDuration = regionEnd - regionStart;
  const bipolar = lane.param === "pan";
  const [, pluginId, paramId] = lane.param.startsWith("plugin:") ? lane.param.split(":") : [];
  const control = (track.plugins ?? []).find((item) => item.id === pluginId)?.params.find((item) => item.id === paramId);
  const logarithmic = control?.unit === "Hz" && (control.min ?? 0) > 0;
  const discrete = control ? ["root", "scale", "chord", "inversion", "range", "mode", "steps"].includes(control.id) : false;
  const snapStep = (step: number) => {
    const clamped = Math.max(0, Math.min(total, step));
    return gridSnap === 0 ? clamped : Math.round(clamped / gridSnap) * gridSnap;
  };
  const snapValue = (value: number) => {
    const clamped = Math.max(bipolar ? -1 : 0, Math.min(1, value));
    if (discrete && control) return normalizeValue(Math.round(scaleValue(clamped)));
    return valueSnap === 0 ? clamped : Math.round(clamped / valueSnap) * valueSnap;
  };
  const scaleValue = (normalized: number) => {
    if (!control) return normalized;
    const scaled = logarithmic
      ? control.min * Math.pow(control.max / control.min, normalized)
      : control.min + (control.max - control.min) * normalized;
    return discrete ? Math.round(scaled) : scaled;
  };
  const normalizeValue = (scaled: number) => {
    if (!control) return Math.max(bipolar ? -1 : 0, Math.min(1, scaled));
    const clamped = Math.max(control.min, Math.min(control.max, scaled));
    return logarithmic
      ? Math.log(clamped / control.min) / Math.log(control.max / control.min)
      : (clamped - control.min) / (control.max - control.min || 1);
  };
  const formatValue = (normalized: number) => {
    const value = scaleValue(normalized);
    const digits = discrete ? 0 : Math.abs(value) >= 100 ? 0 : Math.abs(value) >= 10 ? 1 : 2;
    return `${value.toFixed(digits)}${control?.unit ? ` ${control.unit}` : ""}`;
  };
  const shapeT = (t: number, curve = 0) => curve >= 0
    ? Math.pow(t, 1 + curve * 3)
    : 1 - Math.pow(1 - t, 1 - curve * 3);
  const toValue = (yFrac: number) => {
    const v = 1 - Math.min(1, Math.max(0, yFrac));
    return bipolar ? v * 2 - 1 : v;
  };
  const toY = (v: number) => (bipolar ? 1 - (v + 1) / 2 : 1 - v);

  const addPoint = (e: React.MouseEvent<HTMLDivElement>) => {
    if (locked) {
      toast("Lane is locked — click the lock to edit");
      return;
    }
    const rect = e.currentTarget.getBoundingClientRect();
    const step = snapStep(((e.clientX - rect.left) / rect.width) * total);
    const value = snapValue(toValue((e.clientY - rect.top) / rect.height));
    setAutomationPoints(track.id, lane.param, [
      ...lane.points.filter((p) => p.step !== step),
      { step: Math.max(0, Math.min(total, step)), value },
    ], "Add point");
    previewAutomation(track.id, lane.param, value);
    flashReadout(`${formatValue(value)} @ ${step}`, ((e.clientX - rect.left) / rect.width) * 100, ((e.clientY - rect.top) / rect.height) * 100);
  };

  const dragPoint = (e: React.PointerEvent, index: number) => {
    e.stopPropagation();
    setSelectedPoint(index);
    if (locked) return;
    const row = (e.currentTarget as HTMLElement).closest("[data-auto-row]") as HTMLElement | null;
    if (!row) return;
    const rect = row.getBoundingClientRect();
    const onMove = (ev: PointerEvent) => {
      const step = snapStep(((ev.clientX - rect.left) / rect.width) * total);
      const value = snapValue(toValue((ev.clientY - rect.top) / rect.height));
      setAutomationPoints(
        track.id,
        lane.param,
        lane.points.map((p, i) => (i === index ? { step, value } : p)),
        "Move point",
      );
      // hear the parameter move under the finger and show the exact value
      previewAutomation(track.id, lane.param, value);
      setLiveEdit({
        x: ((ev.clientX - rect.left) / rect.width) * 100,
        y: ((ev.clientY - rect.top) / rect.height) * 100,
        text: `${formatValue(value)} @ ${step}`,
      });
    };
    const onUp = () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      flashReadout(`${formatValue(lane.points[index]?.value ?? 0)}`);
    };
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
  };

  const dragCurve = (e: React.PointerEvent, index: number) => {
    e.stopPropagation();
    if (locked) return;
    const row = (e.currentTarget as HTMLElement).closest("[data-auto-row]") as HTMLElement | null;
    const rect = row?.getBoundingClientRect();
    const startY = e.clientY;
    const original = lane.points[index]?.curve ?? 0;
    const onMove = (ev: PointerEvent) => {
      const curve = Math.max(-1, Math.min(1, original + (startY - ev.clientY) / 36));
      setAutomationPoints(track.id, lane.param, lane.points.map((point, i) => i === index ? { ...point, curve } : point), "Shape curve");
      const from = lane.points[index];
      const to = lane.points[index + 1];
      if (from && to) {
        // preview the midpoint of the shaped segment so the bend is audible
        const mid = from.value + (to.value - from.value) * shapeT(0.5, curve);
        previewAutomation(track.id, lane.param, mid);
        setLiveEdit({
          x: rect ? ((ev.clientX - rect.left) / rect.width) * 100 : 50,
          y: rect ? ((ev.clientY - rect.top) / rect.height) * 100 : 12,
          text: `CURVE ${Math.round(curve * 100)}% · ${formatValue(mid)}`,
        });
      }
    };
    const onUp = () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      flashReadout(`CURVE ${Math.round((lane.points[index]?.curve ?? 0) * 100)}%`);
    };
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
  };

  /** after a region edit, audition the first affected value and show what changed */
  const previewRegionEdit = (points: AutomationPoint[], text: string) => {
    const first = points[0];
    if (first) previewAutomation(track.id, lane.param, first.value);
    flashReadout(first ? `${text} · ${formatValue(first.value)}` : text);
  };

  const copyRegion = () => {
    const points = lane.points
      .filter((point) => point.step >= regionStart && point.step <= regionEnd)
      .map((point) => ({ ...point, step: point.step - regionStart }));
    if (points.length === 0) {
      toast("No automation in the loop region");
      return;
    }
    automationClipboard = { duration: regionDuration, points };
    toast(`Copied ${points.length} automation point${points.length === 1 ? "" : "s"}`);
  };

  const pasteRegion = () => {
    if (locked) {
      toast("Lane is locked — click the lock to edit");
      return;
    }
    if (!automationClipboard) {
      toast("Automation clipboard is empty");
      return;
    }
    const origin = snapStep(transport.step);
    const pasted = automationClipboard.points
      .map((point) => ({ ...point, step: snapStep(origin + point.step), value: snapValue(point.value) }))
      .filter((point, index, all) => all.findIndex((candidate) => candidate.step === point.step) === index);
    const occupied = new Set(pasted.map((point) => point.step));
    setAutomationPoints(track.id, lane.param, [...lane.points.filter((point) => !occupied.has(point.step)), ...pasted], "Paste region");
    setSelectedPoint(null);
    previewRegionEdit(pasted, `PASTED ${pasted.length} @ ${origin}`);
    toast(`Pasted automation at step ${origin}`);
  };

  const duplicateRegion = () => {
    if (locked) {
      toast("Lane is locked — click the lock to edit");
      return;
    }
    const source = lane.points.filter((point) => point.step >= regionStart && point.step <= regionEnd);
    if (source.length === 0) {
      toast("No automation in the loop region");
      return;
    }
    const duplicated = source
      .map((point) => ({ ...point, step: snapStep(point.step + regionDuration), value: snapValue(point.value) }))
      .filter((point) => point.step <= total);
    if (duplicated.length === 0) {
      toast("No room after this region", { description: "Extend the timeline or move the loop region left." });
      return;
    }
    const occupied = new Set(duplicated.map((point) => point.step));
    setAutomationPoints(track.id, lane.param, [...lane.points.filter((point) => !occupied.has(point.step)), ...duplicated], "Duplicate region");
    setSelectedPoint(null);
    previewRegionEdit(duplicated, `DUPLICATED ${duplicated.length}`);
    toast(`Duplicated automation to steps ${regionEnd}–${Math.min(total, regionEnd + regionDuration)}`);
  };

  const deleteRegion = () => {
    if (locked) {
      toast("Lane is locked — click the lock to edit");
      return;
    }
    const remaining = lane.points.filter((point) => point.step < regionStart || point.step > regionEnd);
    if (remaining.length === lane.points.length) {
      toast("No automation in the loop region");
      return;
    }
    setAutomationPoints(track.id, lane.param, remaining, "Delete region");
    setSelectedPoint(null);
    previewRegionEdit(remaining, `DELETED ${lane.points.length - remaining.length}`);
  };

  const handleRegionShortcut = (event: React.KeyboardEvent<HTMLDivElement>) => {
    const target = event.target as HTMLElement;
    if (target.matches("input, textarea, select") || target.isContentEditable) return;
    const command = event.metaKey || event.ctrlKey;
    const key = event.key.toLowerCase();
    if (command && key === "z") {
      event.preventDefault();
      if (event.shiftKey) redoAutomationEdit(track.id, lane.param);
      else undoAutomationEdit(track.id, lane.param);
    } else if (command && key === "y") {
      event.preventDefault();
      redoAutomationEdit(track.id, lane.param);
    } else if (command && key === "c") {
      event.preventDefault();
      copyRegion();
    } else if (command && key === "v") {
      event.preventDefault();
      pasteRegion();
    } else if (command && key === "d") {
      event.preventDefault();
      duplicateRegion();
    } else if (event.key === "Delete" || event.key === "Backspace") {
      event.preventDefault();
      deleteRegion();
    }
  };

  const label = laneLabel(track, lane.param);
  const pts = lane.points;
  const selected = selectedPoint === null ? undefined : pts[selectedPoint];
  const curvePoints = pts.flatMap((point, index) => {
    const next = pts[index + 1];
    if (!next) return [`${(point.step / total) * 100},${toY(point.value) * 100}`];
    return Array.from({ length: 13 }, (_, sample) => {
      const t = sample / 12;
      const shaped = shapeT(t, point.curve ?? 0);
      const step = point.step + (next.step - point.step) * t;
      const value = point.value + (next.value - point.value) * shaped;
      return `${(step / total) * 100},${toY(value) * 100}`;
    });
  });
  const modes: AutomationLane["mode"][] = ["off", "read", "write", "touch", "latch"];
  const nextMode = () => setAutomationMode(track.id, lane.param, modes[(modes.indexOf(lane.mode) + 1) % modes.length] ?? "off");
  const history = automationHistory(track.id, lane.param);
  const recordingMode = transport.playing && (lane.mode === "write" || lane.mode === "touch" || lane.mode === "latch");

  return (
    <div
      className="flex items-stretch border-t border-border/50 bg-background/40 focus-within:ring-1 focus-within:ring-inset focus-within:ring-primary/70"
      tabIndex={0}
      onKeyDown={handleRegionShortcut}
      aria-label={`${label} automation lane. Command or Control Z undoes and Shift Z redoes lane edits, C copies the loop region, V pastes at the playhead, D duplicates, and Delete removes it.`}
    >
      <div className="w-1 shrink-0" style={{ background: track.color, opacity: 0.4 }} />
      <div className="flex w-[168px] shrink-0 flex-wrap items-center gap-1 border-r border-border bg-surface/60 px-2 py-1 sm:w-[240px]">
        <span className="min-w-0 flex-1 truncate font-mono text-[9px] tracking-[0.15em] text-muted-foreground">AUTO · {label}</span>
        <button
          onClick={() => setAutomationLaneLock(track.id, lane.param, !locked)}
          title={locked ? "Unlock this lane for editing" : "Lock this lane against accidental edits"}
          aria-label={locked ? `Unlock ${label} automation` : `Lock ${label} automation`}
          aria-pressed={locked}
          className={`rounded-[3px] px-1.5 py-0.5 font-mono text-[8px] tracking-widest ${
            locked ? "bg-amber-500/25 text-amber-400" : "bg-surface-2 text-muted-foreground hover:text-foreground"
          }`}
        >
          {locked ? <Lock className="size-2.5" /> : <LockOpen className="size-2.5" />}
        </button>
        <button
          onClick={nextMode}
          disabled={locked}
          title={locked ? "Unlock this lane to change the mode" : "Cycle automation mode: Off, Read, Write, Touch, Latch"}
          aria-label={`${label} automation mode ${lane.mode}. Click for next mode.`}
          className={`ml-auto rounded-[3px] px-1.5 py-0.5 font-mono text-[8px] tracking-widest ${
            locked ? "bg-surface-2 text-muted-foreground/50" :
            recordingMode
              ? "animate-pulse bg-destructive text-destructive-foreground"
              : lane.mode === "read"
                ? "bg-primary/20 text-primary"
                : lane.mode === "write" || lane.mode === "touch" || lane.mode === "latch"
                  ? "bg-destructive/20 text-destructive"
                  : "bg-surface-2 text-muted-foreground"
          }`}
        >
          {lane.mode.toUpperCase()}
        </button>
        <button
          onClick={() => setAutomationPoints(track.id, lane.param, [], "Clear lane")}
          disabled={locked}
          title={locked ? "Unlock this lane to clear the curve" : "Clear this curve"}
          aria-label={`Clear ${label} automation`}
          className="text-muted-foreground hover:text-foreground disabled:opacity-40 disabled:hover:text-muted-foreground"
        >
          <Eraser className="size-3" />
        </button>
        <button
          onClick={() => toggleAutomationLane(track.id, lane.param)}
          title="Hide this lane"
          aria-label={`Hide ${label} automation`}
          className="text-muted-foreground hover:text-destructive"
        >
          <X className="size-3" />
        </button>
        <div className="flex w-full items-center gap-0.5 border-t border-border/50 pt-1">
          <span className="mr-auto font-mono text-[7px] text-muted-foreground">REGION {regionStart}–{regionEnd}</span>
          <Button type="button" variant="ghost" size="icon" className="size-5 disabled:opacity-40" disabled={locked || !history.canUndo} onClick={() => undoAutomationEdit(track.id, lane.param)} title={history.canUndo ? `Undo ${history.undoLabel} on this lane (⌘/Ctrl+Z)` : "Nothing to undo on this lane"} aria-label={`Undo ${label} automation edit`}>
            <Undo2 className="size-3" />
          </Button>
          <Button type="button" variant="ghost" size="icon" className="size-5 disabled:opacity-40" disabled={locked || !history.canRedo} onClick={() => redoAutomationEdit(track.id, lane.param)} title={history.canRedo ? `Redo ${history.redoLabel} on this lane (⌘/Ctrl+Shift+Z)` : "Nothing to redo on this lane"} aria-label={`Redo ${label} automation edit`}>
            <Redo2 className="size-3" />
          </Button>
          <Button type="button" variant="ghost" size="icon" className="size-5" onClick={copyRegion} title="Copy automation in loop region (⌘/Ctrl+C)" aria-label={`Copy ${label} region`}>
            <Copy className="size-3" />
          </Button>
          <Button type="button" variant="ghost" size="icon" className="size-5 disabled:opacity-40" disabled={locked} onClick={pasteRegion} title={locked ? "Unlock this lane to paste" : "Paste automation at playhead (⌘/Ctrl+V)"} aria-label={`Paste ${label} at playhead`}>
            <ClipboardPaste className="size-3" />
          </Button>
          <Button type="button" variant="ghost" size="icon" className="size-5 disabled:opacity-40" disabled={locked} onClick={duplicateRegion} title={locked ? "Unlock this lane to duplicate" : "Duplicate automation after loop region (⌘/Ctrl+D)"} aria-label={`Duplicate ${label} region`}>
            <Repeat className="size-3" />
          </Button>
          <Button type="button" variant="ghost" size="icon" className="size-5 text-destructive disabled:opacity-40 disabled:hover:text-destructive" disabled={locked} onClick={deleteRegion} title={locked ? "Unlock this lane to delete" : "Delete automation in loop region (Delete/Backspace)"} aria-label={`Delete ${label} region`}>
            <Trash2 className="size-3" />
          </Button>
        </div>
        <div className="flex w-full items-center gap-1 border-t border-border/50 pt-1 font-mono text-[7px]">
          <span className="text-muted-foreground">SNAP</span>
          <Button
            type="button"
            variant={gridSnap === 0 ? "ghost" : "secondary"}
            size="sm"
            className="h-5 px-1.5 text-[7px]"
            onClick={() => setGridSnap(gridSnap === 0 ? 0.25 : gridSnap === 0.25 ? 0.5 : gridSnap === 0.5 ? 1 : 0)}
            title="Cycle time snapping: Off, 1/4 beat, 1/2 beat, 1 beat"
            aria-label={`Time grid snap ${gridSnap === 0 ? "off" : `${gridSnap} beat`}`}
          >
            GRID {gridSnap === 0 ? "OFF" : gridSnap === 0.25 ? "¼" : gridSnap === 0.5 ? "½" : "1"}
          </Button>
          <Button
            type="button"
            variant={valueSnap === 0 && !discrete ? "ghost" : "secondary"}
            size="sm"
            className="h-5 px-1.5 text-[7px]"
            onClick={() => !discrete && setValueSnap(valueSnap === 0 ? 0.02 : valueSnap === 0.02 ? 0.05 : valueSnap === 0.05 ? 0.1 : 0)}
            title={discrete ? "Values snap to valid parameter choices" : "Cycle value snapping: Off, Fine, Medium, Coarse"}
            aria-label={`Value snap ${discrete ? "parameter steps" : valueSnap === 0 ? "off" : valueSnap === 0.02 ? "fine" : valueSnap === 0.05 ? "medium" : "coarse"}`}
          >
            VALUE {discrete ? "PARAM" : valueSnap === 0 ? "OFF" : valueSnap === 0.02 ? "FINE" : valueSnap === 0.05 ? "MED" : "COARSE"}
          </Button>
        </div>
        {selected && (
          <div className="flex w-full items-center gap-1 font-mono text-[8px]" onClick={(event) => event.stopPropagation()}>
            <label className="text-muted-foreground">STEP</label>
            <Input
              aria-label="Automation point step"
              className="h-5 w-12 px-1 text-[9px]"
              type="number"
              min={0}
              max={total}
              disabled={locked}
              value={selected.step}
              onChange={(event) => setAutomationPoints(track.id, lane.param, pts.map((point, index) => index === selectedPoint ? { ...point, step: snapStep(Number(event.target.value)) } : point), "Edit step")}
            />
            <label className="text-muted-foreground">VALUE</label>
            <Input
              aria-label="Automation point value"
              className="h-5 min-w-0 flex-1 px-1 text-[9px]"
              type="number"
              step={discrete ? 1 : "any"}
              min={control?.min}
              max={control?.max}
              disabled={locked}
              value={scaleValue(selected.value)}
              onChange={(event) => setAutomationPoints(track.id, lane.param, pts.map((point, index) => index === selectedPoint ? { ...point, value: snapValue(normalizeValue(Number(event.target.value))) } : point), "Edit value")}
            />
          </div>
        )}
      </div>
      <div
        data-auto-row
        onClick={addPoint}
        title={locked ? "This lane is locked — click the lock in the lane header to edit" : "Click to add a point, drag a point to shape it, double-click a point to delete"}
        className={`lane-grid relative h-[72px] flex-1 bg-background/70 ${locked ? "cursor-default" : "cursor-crosshair"}`}
      >
        <svg className="pointer-events-none absolute inset-0 size-full" preserveAspectRatio="none" viewBox="0 0 100 100">
          {pts.length > 1 && (
            <polyline
              points={curvePoints.join(" ")}
              fill="none"
              stroke="var(--primary)"
              strokeWidth={1}
              vectorEffect="non-scaling-stroke"
            />
          )}
        </svg>
        {pts.map((p, i) => (
          <button
            key={`${p.step}-${i}`}
            onPointerDown={(e) => dragPoint(e, i)}
            onClick={(e) => e.stopPropagation()}
            onDoubleClick={(e) => {
              e.stopPropagation();
              if (locked) {
                toast("Lane is locked — click the lock to edit");
                return;
              }
              setAutomationPoints(track.id, lane.param, pts.filter((_, j) => j !== i), "Delete point");
            }}
            aria-label={`${label} point at step ${p.step}, ${formatValue(p.value)}`}
            title={`${formatValue(p.value)} · curve ${Math.round((p.curve ?? 0) * 100)}%`}
            className={`absolute size-2 -translate-x-1/2 -translate-y-1/2 rounded-full ring-2 ring-background ${selectedPoint === i ? "bg-foreground" : "bg-primary"}`}
            style={{ left: `${(p.step / total) * 100}%`, top: `${toY(p.value) * 100}%` }}
          />
        ))}
        {pts.slice(0, -1).map((point, index) => {
          const next = pts[index + 1];
          if (!next) return null;
          const shaped = shapeT(0.5, point.curve ?? 0);
          const value = point.value + (next.value - point.value) * shaped;
          return (
            <button
              key={`curve-${point.step}-${index}`}
              type="button"
              onPointerDown={(event) => dragCurve(event, index)}
              onDoubleClick={(event) => {
                event.stopPropagation();
                if (locked) {
                  toast("Lane is locked — click the lock to edit");
                  return;
                }
                setAutomationPoints(track.id, lane.param, pts.map((item, i) => i === index ? { ...item, curve: 0 } : item), "Reset curve");
              }}
              onClick={(event) => event.stopPropagation()}
              aria-label={`Shape curve after step ${point.step}`}
              title="Drag vertically to bend curve · double-click for linear"
              className="absolute size-2 -translate-x-1/2 -translate-y-1/2 rotate-45 border border-primary bg-background"
              style={{ left: `${(((point.step + next.step) / 2) / total) * 100}%`, top: `${toY(value) * 100}%` }}
            />
          );
        })}
        {selected && (
          <div className="pointer-events-none absolute bottom-1 right-2 font-mono text-[8px] text-muted-foreground">
            {formatValue(selected.value)} · CURVE {Math.round((selected.curve ?? 0) * 100)}%
          </div>
        )}
        {liveEdit && (
          <>
            <div
              className="pointer-events-none absolute top-0 h-full w-px bg-primary/60"
              style={{ left: `${Math.max(0, Math.min(100, liveEdit.x))}%` }}
            />
            <div
              aria-live="polite"
              className="pointer-events-none absolute z-10 -translate-x-1/2 -translate-y-[150%] whitespace-nowrap rounded bg-primary px-1.5 py-0.5 font-mono text-[9px] text-primary-foreground shadow"
              style={{ left: `${Math.max(6, Math.min(94, liveEdit.x))}%`, top: `${Math.max(12, Math.min(96, liveEdit.y))}%` }}
            >
              {liveEdit.text}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

const SNAP_OPTIONS: { label: string; value: number }[] = [
  { label: "OFF", value: 0 },
  { label: "1/4", value: 1 },
  { label: "1/2 BAR", value: 2 },
  { label: "BAR", value: 4 },
];

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

  const duplicateClip = () => {
    if (!selected || !activeClip) {
      toast("Pick a clip first", { description: "Click a clip on the timeline to duplicate it." });
      return;
    }
    const stepDur = stepSeconds(transport.bpm);
    const steps = Math.max(1, Math.round(clipSeconds(activeClip) / stepDur));
    addClip(selected.id, { ...activeClip, id: uid(), name: `${activeClip.name} COPY`, start: (activeClip.start ?? 0) + steps });
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
        start: transport.step,
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
    <div className="flex min-h-11 items-center gap-1 overflow-x-auto border-b border-border bg-surface-2/60 px-2 py-1 [scrollbar-width:none]">
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
      <div className="mx-1 h-4 w-px bg-border" />
      <Button size="sm" variant="ghost" className="h-6 gap-1 px-2 text-[10px]" title="Undo (⌘Z / Ctrl+Z)" onClick={undo}>
        <Undo2 className="size-3" /> Undo
      </Button>
      <Button size="sm" variant="ghost" className="h-6 gap-1 px-2 text-[10px]" title="Redo (⌘⇧Z / Ctrl+Y)" onClick={redo}>
        <Redo2 className="size-3" /> Redo
      </Button>
      <div className="mx-1 h-4 w-px bg-border" />
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
      <div className="mx-1 h-4 w-px bg-border" />
      <span className="label-xs shrink-0">SNAP</span>
      <Select value={String(snap)} onValueChange={(v) => setTransport({ snap: Number(v) })}>
        <SelectTrigger className="h-6 w-[88px] shrink-0 font-mono text-[10px]" title="Snap grid for moving and trimming clips">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {SNAP_OPTIONS.map((o) => (
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
      <div className="mx-1 h-4 w-px bg-border" />
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
      <span className="label-xs ml-auto hidden shrink-0 sm:inline">
        {selectedIds.length > 1 ? `${selectedIds.length} selected` : `${tracks.length} channels`}
      </span>
    </div>
  );
}

function Ruler() {
  const { transport, setTransport } = useStudio();
  const gridRef = useRef<HTMLDivElement>(null);
  const bars = Math.max(1, transport.bars ?? 4);
  const total = bars * STEPS_PER_BAR;
  const lo = transport.loopStart ?? 0;
  const hi = Math.max(lo + 1, transport.loopEnd ?? total);
  const exportOn = transport.exportStart != null && transport.exportEnd != null;
  const exLo = exportOn ? Math.min(transport.exportStart!, transport.exportEnd! - 1) : 0;
  const exHi = exportOn ? Math.max(transport.exportEnd!, exLo + 1) : total;

  const setBars = (next: number) => {
    const b = Math.min(512, Math.max(1, next));
    const steps = b * STEPS_PER_BAR;
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

  // Drag on empty ruler space to draw a loop region. A plain click (no drag)
  // leaves the existing region alone and just moves the playhead.
  const startDrag = (e: React.PointerEvent) => {
    if (e.button !== 0) return;
    e.preventDefault();
    const s = stepFromX(e.clientX);
    let moved = false;
    const move = (ev: PointerEvent) => {
      const end = stepFromX(ev.clientX);
      if (!moved && end === s) return;
      moved = true;
      const a = Math.min(s, end);
      const b = Math.max(s, end);
      setTransport({ loopStart: a, loopEnd: Math.max(a + 1, b), loop: true });
    };
    const up = () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
      if (!moved) setTransport({ step: Math.min(total - 1, s) });
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
  };

  /** Drag a loop marker, or the whole band when grabbing between them. */
  const dragLoop = (which: "start" | "end" | "band") => (e: React.PointerEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const from = stepFromX(e.clientX);
    const len = hi - lo;
    const move = (ev: PointerEvent) => {
      const s = stepFromX(ev.clientX);
      if (which === "start") setTransport({ loopStart: Math.max(0, Math.min(s, hi - 1)), loop: true });
      else if (which === "end") setTransport({ loopEnd: Math.min(total, Math.max(s, lo + 1)), loop: true });
      else {
        const shift = s - from;
        const start = Math.max(0, Math.min(total - len, lo + shift));
        setTransport({ loopStart: start, loopEnd: start + len, loop: true });
      }
    };
    const up = () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
  };


  const dragFlag = (which: "start" | "end") => (e: React.PointerEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const move = (ev: PointerEvent) => {
      const s = stepFromX(ev.clientX);
      if (which === "start") setTransport({ exportStart: Math.min(s, exHi - 1) });
      else setTransport({ exportEnd: Math.max(s, exLo + 1) });
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
      <div className="flex w-[172px] shrink-0 flex-col justify-center gap-1 border-r border-border px-2 py-1 sm:w-[244px] sm:px-3">
        <div className="flex items-center gap-2">
          <span className="font-display text-[11px] font-semibold tracking-[0.2em]">TIMELINE</span>
          <span className="label-xs ml-auto">
            {positionLabel(transport.step)}
          </span>
        </div>
        <div className="flex items-center gap-1.5">
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
            disabled={bars >= 512}
            onClick={() => setBars(bars + 1)}
          >
            +
          </button>
        </div>
        {/* export range flags toggle */}
        <button
          type="button"
          aria-pressed={exportOn}
          title="Show export start/end flags — drag them on the ruler to choose what gets exported"
          onClick={() =>
            setTransport(exportOn ? { exportStart: null, exportEnd: null } : { exportStart: 0, exportEnd: total })
          }
          className={`flex items-center gap-1 rounded-[3px] border px-1.5 py-0.5 font-mono text-[9px] uppercase tracking-wider ${
            exportOn
              ? "border-amber-400/70 bg-amber-400/15 text-amber-300"
              : "border-border bg-background/70 text-muted-foreground hover:text-foreground"
          }`}
        >
          <Flag className="size-3" /> Export
        </button>
        </div>
      </div>
      <div
        ref={gridRef}
        onPointerDown={startDrag}
        title="Drag on the ruler to set the loop region"
        className="relative flex flex-1 cursor-ew-resize select-none"
      >
        {/* one column per beat; every fourth column starts a new bar */}
        <div className="grid w-full" style={{ gridTemplateColumns: `repeat(${bars * 4},minmax(0,1fr))` }}>
          {Array.from({ length: bars * 4 }).map((_, i) => (
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
            {/* loop band — drag it to move the whole region */}
            <div
              onPointerDown={dragLoop("band")}
              title={`Loop bar ${Math.floor(lo / 4) + 1} to ${Math.floor(hi / 4) + 1} — drag to move`}
              className="absolute inset-y-0 z-10 cursor-grab touch-none border-x border-primary/70 bg-primary/15 active:cursor-grabbing"
              style={{ left: `${(lo / total) * 100}%`, width: `${((hi - lo) / total) * 100}%` }}
            />
            {/* draggable loop markers */}
            {(["start", "end"] as const).map((which) => {
              const p = which === "start" ? lo : hi;
              return (
                <div
                  key={which}
                  role="slider"
                  aria-label={which === "start" ? "Loop start" : "Loop end"}
                  aria-valuenow={p}
                  aria-valuemin={0}
                  aria-valuemax={total}
                  tabIndex={0}
                  onPointerDown={dragLoop(which)}
                  onKeyDown={(ev) => {
                    const d = ev.key === "ArrowLeft" ? -1 : ev.key === "ArrowRight" ? 1 : 0;
                    if (!d) return;
                    ev.preventDefault();
                    if (which === "start") setTransport({ loopStart: Math.max(0, Math.min(lo + d, hi - 1)), loop: true });
                    else setTransport({ loopEnd: Math.min(total, Math.max(hi + d, lo + 1)), loop: true });
                  }}
                  title={`Loop ${which} — drag or use arrow keys (bar ${Math.floor(p / 4) + 1})`}
                  className="absolute top-0 z-20 flex h-full w-4 cursor-ew-resize touch-none flex-col items-center outline-none focus-visible:ring-1 focus-visible:ring-primary"
                  style={{ left: `calc(${(p / total) * 100}% - 8px)` }}
                >
                  <div className="h-0 w-0 border-x-[6px] border-x-transparent" style={{ borderTop: "9px solid var(--primary)" }} />
                  <div className="w-[2px] flex-1 bg-primary/80" />
                </div>
              );
            })}

          </>
        )}

        {/* export range: amber band + draggable flags */}
        {exportOn && (
          <>
            <div
              className="pointer-events-none absolute inset-y-0 border-x border-amber-400/70 bg-amber-400/10"
              style={{ left: `${(exLo / total) * 100}%`, width: `${((exHi - exLo) / total) * 100}%` }}
            />
            {(["start", "end"] as const).map((which) => {
              const p = which === "start" ? exLo : exHi;
              return (
                <div
                  key={which}
                  role="slider"
                  aria-label={which === "start" ? "Export start flag" : "Export end flag"}
                  aria-valuenow={p}
                  onPointerDown={dragFlag(which)}
                  title={`Export ${which} — drag to move (bar ${Math.floor(p / 4) + 1})`}
                  className="absolute top-0 z-20 flex h-full w-3 cursor-ew-resize touch-none flex-col items-center"
                  style={{ left: `calc(${(p / total) * 100}% - 6px)` }}
                >
                  <div
                    className="h-0 w-0 border-x-[6px] border-x-transparent"
                    style={{ borderTop: "9px solid rgb(251 191 36)" }}
                  />
                  <div className="w-[2px] flex-1 bg-amber-400/80" />
                </div>
              );
            })}
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

/**
 * Overview strip under the arrangement: the whole song at a glance with a
 * draggable viewport. Dragging it scrolls the timeline; the +/− buttons widen
 * the arrangement so bars get more room without changing anything you hear.
 */
function TimelineOverview({
  scrollRef,
  zoom,
  setZoom,
}: {
  scrollRef: React.RefObject<HTMLDivElement | null>;
  zoom: number;
  setZoom: (z: number) => void;
}) {
  const { transport } = useStudio();
  const total = songSteps(transport.bars);
  const [view, setView] = useState({ left: 0, width: 1 });
  const barRef = useRef<HTMLDivElement>(null);

  // mirror the arrangement's scroll position into the little viewport box
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const read = () => {
      const w = el.scrollWidth || 1;
      setView({ left: el.scrollLeft / w, width: Math.min(1, el.clientWidth / w) });
    };
    read();
    el.addEventListener("scroll", read, { passive: true });
    const ro = new ResizeObserver(read);
    ro.observe(el);
    return () => {
      el.removeEventListener("scroll", read);
      ro.disconnect();
    };
  }, [scrollRef, zoom]);

  const scrollTo = (clientX: number) => {
    const bar = barRef.current;
    const el = scrollRef.current;
    if (!bar || !el) return;
    const r = bar.getBoundingClientRect();
    const frac = Math.min(1, Math.max(0, (clientX - r.left) / r.width));
    el.scrollLeft = Math.max(0, frac * el.scrollWidth - el.clientWidth / 2);
  };

  const drag = (e: React.PointerEvent) => {
    e.preventDefault();
    scrollTo(e.clientX);
    const move = (ev: PointerEvent) => scrollTo(ev.clientX);
    const up = () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
  };

  const loopFrom = (transport.loopStart ?? 0) / total;
  const loopTo = Math.max((transport.loopStart ?? 0) + 1, transport.loopEnd ?? total) / total;

  return (
    <div className="flex shrink-0 items-center gap-2 border-t border-border bg-surface-2/60 px-2 py-1">
      <span className="hidden font-mono text-[9px] uppercase tracking-widest text-muted-foreground sm:inline">
        Overview
      </span>
      <div
        ref={barRef}
        onPointerDown={drag}
        role="scrollbar"
        aria-label="Timeline overview — drag to scroll the arrangement"
        aria-controls="timeline-scroll"
        aria-orientation="horizontal"
        aria-valuenow={Math.round(view.left * 100)}
        tabIndex={0}
        className="relative h-6 flex-1 cursor-grab touch-none overflow-hidden rounded-[3px] border border-border bg-background active:cursor-grabbing"
      >
        {/* bar ticks */}
        {Array.from({ length: Math.max(1, transport.bars) }).map((_, i) => (
          <span
            key={i}
            className="absolute inset-y-0 w-px bg-border/60"
            style={{ left: `${(i / Math.max(1, transport.bars)) * 100}%` }}
          />
        ))}
        {transport.loop && (
          <span
            className="absolute inset-y-0 bg-primary/15"
            style={{ left: `${loopFrom * 100}%`, width: `${Math.max(1, (loopTo - loopFrom) * 100)}%` }}
          />
        )}
        {/* playhead */}
        <span
          className="absolute inset-y-0 w-px bg-primary"
          style={{ left: `${((transport.step % total) / total) * 100}%` }}
        />
        {/* viewport */}
        <span
          className="absolute inset-y-0 rounded-[2px] border border-primary/70 bg-primary/10"
          style={{ left: `${view.left * 100}%`, width: `${Math.max(4, view.width * 100)}%` }}
        />
      </div>
      <div className="flex items-center gap-1">
        <button
          className="h-5 w-5 rounded-[3px] border border-border font-mono text-[11px] leading-none text-muted-foreground hover:text-foreground"
          onClick={() => setZoom(Math.max(1, Math.round((zoom - 0.5) * 2) / 2))}
          aria-label="Zoom out the arrangement"
          title="Zoom out"
        >
          −
        </button>
        <span className="w-8 text-center font-mono text-[9px] text-muted-foreground">{zoom.toFixed(1)}×</span>
        <button
          className="h-5 w-5 rounded-[3px] border border-border font-mono text-[11px] leading-none text-muted-foreground hover:text-foreground"
          onClick={() => setZoom(Math.min(8, Math.round((zoom + 0.5) * 2) / 2))}
          aria-label="Zoom in on the arrangement"
          title="Zoom in"
        >
          +
        </button>
      </div>
    </div>
  );
}

export function Timeline() {
  const { tracks, transport, addTrack, setPanel, loadSample } = useStudio();
  const totalSteps = songSteps(transport.bars);
  const [over, setOver] = useState(false);
  const [zoom, setZoom] = useState(1);
  const scrollRef = useRef<HTMLDivElement>(null);

  // keeps the playhead in view while the song plays, when FOLLOW is on
  useEffect(() => {
    if (!transport.follow || !transport.playing) return;
    const el = scrollRef.current;
    if (!el || el.scrollWidth <= el.clientWidth) return;
    const x = (transport.step / totalSteps) * el.scrollWidth;
    if (x < el.scrollLeft + 80 || x > el.scrollLeft + el.clientWidth - 80) {
      el.scrollTo({ left: Math.max(0, x - el.clientWidth / 2), behavior: "smooth" });
    }
  }, [transport.follow, transport.playing, transport.step, totalSteps]);
  return (
    <section className="relative flex min-h-0 flex-1 flex-col overflow-hidden border-x border-b border-border bg-background/60">
      <EditToolbar />
      <Ruler />
      <SectionLane />
      <div id="timeline-scroll" ref={scrollRef} className="relative min-h-0 flex-1 overflow-auto">
        <div className="min-w-[720px] sm:min-w-0" style={{ width: `${zoom * 100}%` }}>
        {/* SYNCLAB watermark, low and centred in the empty workspace */}
        <div className="pointer-events-none sticky top-[68%] z-0 h-0" aria-hidden="true">
          <img
            src={synclabLogo}
            alt=""
            className="absolute left-1/2 top-0 w-[min(360px,38%)] -translate-x-[calc(50%-122px)] -translate-y-1/2 select-none opacity-[0.06]"
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
        {transport.exportStart != null && transport.exportEnd != null && (
          <div
            className="pointer-events-none absolute inset-y-0 border-x border-amber-400/30 bg-amber-400/[0.05]"
            style={{
              left: `calc(244px + (100% - 244px) * ${Math.min(transport.exportStart, transport.exportEnd - 1) / totalSteps})`,
              width: `calc((100% - 244px) * ${(Math.max(transport.exportEnd, transport.exportStart + 1) - Math.min(transport.exportStart, transport.exportEnd - 1)) / totalSteps})`,
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
      </div>
    </section>
  );
}
