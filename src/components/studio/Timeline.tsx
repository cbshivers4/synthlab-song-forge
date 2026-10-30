import { deleteSelectedPart, selectedPartBounds } from '@/lib/synclab/workflow';
import { boundedRegions, loopRegion } from "@/lib/synclab/recording-region";
import { timelineUsesWaveform } from "@/lib/synclab/timeline-content";
import { materialEnd, moveDrumPart, rightEdgeEdit, stretchDrumPart } from "@/lib/synclab/arrangement-edit";
import { Fragment, memo, useEffect, useMemo, useRef, useState, useSyncExternalStore, type CSSProperties } from "react";
import { createPortal } from "react-dom";
import { stepsPerBar, getBeatsPerBar, STEPS_PER_BEAT, songSteps, stepSeconds, positionLabel } from "@/lib/synclab/timebase";
import { notesInRegion, regionsOf, snapCut, deleteRegion } from "@/lib/synclab/note-cuts";
import { useIsMobile, useIsLandscapePhone } from "@/hooks/use-mobile";
import { PhonePages } from "./PhonePages";
import { WorkflowBar } from "./WorkflowBar";
import { NameEditDialog } from "./NameEditDialog";
import { recordingFollowScroll } from "@/lib/synclab/recording-display";
import {
  ArrowDownToLine,
  ArrowLeftToLine,
  ArrowRightToLine,
  ClipboardPaste,
  Grid3x3,
  Sliders,
  ListChecks,
  MousePointer2,
  Pencil,
  Scissors,
  ScissorsLineDashed,
  SquareScissors,
  SquareSplitHorizontal,
  Waves,
  ChevronDown,

  ChevronUp,
  Copy,
  Disc3,
  Download,
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
  Circle,
  Plus,
  Folder,
  FolderOpen,
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
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
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
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { clipFromLocalFile } from "@/lib/synclab/local-files";
import { openTrackSettings } from "@/components/studio/TrackSettingsDialog";
import { InsertRack } from "./Mixer";
import { EffectMenuItems } from "./EffectPicker";
import { availableEffects } from "@/lib/synclab/effect-catalog";
import { BUILT_IN_PLUGINS } from "@/lib/synclab/plugins";
import { SectionLane } from "./SectionLane";
import { useStudio } from "@/lib/synclab/store";
import { useApp } from "@/lib/synclab/app-state";
import { AddTrackMenu } from "@/components/studio/AddTrackMenu";
import { TrackSearch } from "@/components/studio/TrackSearch";

import { INSTRUMENTS, KIND_LABEL, uid } from "@/lib/synclab/presets";
import type { EditTool, PanelId } from "@/lib/synclab/store";
import type { AutomationLane, AutomationParam, AutomationPoint, BusId, MidiNote, Track, TrackFolder } from "@/lib/synclab/types";

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

const EMPTY_PEAKS: number[] = [0];
import { LevelBar } from "@/components/studio/LevelBar";
import { ClipEditor } from "@/components/studio/ClipEditor";
import { clipRate, clipSeconds } from "@/lib/synclab/types";
import { canvasPoint, canvasRect } from "@/lib/synclab/canvas-point";
import { getEngine } from "@/lib/synclab/audio-engine";
import { downloadBlob, encodeWav } from "@/lib/synclab/bounce";
import { freshCloudUrl } from "@/lib/synclab/cloud";
import { parseMidiFile } from "@/lib/synclab/midi-file";

import { TrackIcon, TrackStylePicker } from "@/components/studio/TrackStyle";
import { TrackNotes } from "@/components/studio/TrackNotes";

const INPUTS = ["Microphone", "Guitar / Line 1", "Keyboard / Line 2", "External Instrument", "MIDI Keyboard", "Internal", "Stereo File"];

/** Cutting overlay owns pointer targeting so clip drag handles cannot mask the tool. */
/** Free (off-grid) cutting toggle, shared by the toolbar and every lane; remembered on this device. */
const CUT_FREE_KEY = "synclab.cutFree";
let cutFreeValue = true;
const cutFreeListeners = new Set<() => void>();
if (typeof window !== "undefined") {
  try { cutFreeValue = window.localStorage.getItem(CUT_FREE_KEY) !== "0"; } catch { /* storage blocked */ }
}
export function setCutFree(v: boolean) {
  cutFreeValue = v;
  try { window.localStorage.setItem(CUT_FREE_KEY, v ? "1" : "0"); } catch { /* storage blocked */ }
  cutFreeListeners.forEach((l) => l());
}
export function useCutFree() {
  return useSyncExternalStore(
    (l) => { cutFreeListeners.add(l); return () => cutFreeListeners.delete(l); },
    () => cutFreeValue,
    () => true,
  );
}
/** The four synths a note track can load; the style test matches SynthEditor's panel styling. */
const SYNTH_CHOICES = [
  { style: "spec4", label: "Spec 4 Synth", preset: "Cybotron Lead" },
  { style: "acid", label: "Acid Bass (TD-3)", preset: "TD-3 Acid Saw" },
  { style: "poly", label: "Poly Synth", preset: "Poly Synth Brass" },
  { style: "modular", label: "Modular Tech Synth", preset: "Modular Tech Empty Rack" },
] as const;
const synthStyleOf = (t: Track) =>
  t.patch?.modular ? "modular"
  : t.patch?.name.startsWith("TD-3") || /ACID/i.test(t.name) ? "acid"
  : t.patch?.name.startsWith("Poly Synth") || /POLY/i.test(t.name) ? "poly"
  : "spec4";

/** Cut position in song steps: exact where you click when free (or Alt held on grid), otherwise on the snap grid. */
export function cutPosition(frac: number, total: number, grid: number, altKey: boolean) {
  const free = cutFreeValue !== altKey;
  return Math.max(0, Math.min(total, snapCut(frac * total, grid > 0 ? grid : 1, free)));
}
/** Lane grid sized to the real song: a strong line on every bar, a medium line on every quarter note, a faint line on every eighth note. */
export function laneGridBackground(bars: number) {
  const bar = 100 / Math.max(1, bars);
  const beat = bar / getBeatsPerBar();
  const eighth = beat / 2;
  return [
    `repeating-linear-gradient(to right, var(--grid-line-strong) 0 1px, transparent 1px ${bar}%)`,
    `repeating-linear-gradient(to right, var(--grid-line) 0 1px, transparent 1px ${beat}%)`,
    `repeating-linear-gradient(to right, var(--grid-line-faint, var(--grid-line)) 0 1px, transparent 1px ${eighth}%)`,
  ].join(", ");
}

function TimelineCutGuide({ tool, position, selected, total, grid }: { tool: "split" | "razor"; position: number; selected: boolean; total: number; grid: number }) {
  const lineRef = useRef<HTMLDivElement>(null);
  const iconRef = useRef<HTMLDivElement>(null);
  const showAtPointer = (e: React.PointerEvent<HTMLDivElement>) => {
    const rect = canvasRect(e.currentTarget);
    const pt = canvasPoint(e.clientX, e.clientY);
    const rawX = Math.max(0, Math.min(rect.width, pt.x - rect.left));
    // The guide shows exactly where the cut will land — snapped or free.
    const x = (cutPosition(rawX / Math.max(1, rect.width), total, grid, e.altKey) / Math.max(1, total)) * rect.width;
    const y = Math.max(4, Math.min(rect.height - 32, pt.y - rect.top + 10));
    const line = lineRef.current;
    const icon = iconRef.current;
    if (line) { line.style.left = `${x}px`; line.style.opacity = "1"; }
    if (icon) {
      icon.style.left = `${Math.max(0, Math.min(rect.width - 32, x + 10))}px`;
      icon.style.top = `${y}px`;
      icon.style.opacity = "1";
    }
  };
  return <div
    data-cut-tool={tool}
    className="absolute inset-0 z-30 cursor-none"
    onPointerEnter={showAtPointer}
    onPointerMove={showAtPointer}
    onPointerDown={showAtPointer}
    onPointerLeave={(e) => {
      if (e.pointerType === "touch") return;
      if (lineRef.current) lineRef.current.style.opacity = "0";
      if (iconRef.current) iconRef.current.style.opacity = "0";
    }}
  >
    <div ref={lineRef} data-cut-line className="pointer-events-none absolute inset-y-0 border-l-2 border-dashed border-primary" style={{ left: `${position * 100}%`, opacity: selected ? 1 : 0 }} />
    <div ref={iconRef} data-cut-icon className="pointer-events-none absolute top-2 flex size-8 items-center justify-center rounded-sm border border-primary bg-background text-foreground shadow-sm" style={{ left: `clamp(0px, ${position * 100}%, calc(100% - 32px))`, opacity: selected ? 1 : 0 }}>
      {tool === "split" ? <Scissors className="size-5" /> : <RazorIcon className="size-5" />}
    </div>
  </div>;
}

/** Audio lane: every clip sits at its own bar position and can be moved, trimmed and dragged between tracks. */
function Waveform({ track }: { track: Track }) {
  const { setActiveClip, removeClip, updateTrack, moveClipToNew, stretchClip, setTransport, transport, tracks, editTool } = useStudio();
  const cutting = editTool === "split" || editTool === "razor";
  const [editingId, setEditingId] = useState<string | null>(null);
  const clips = track.clips ?? [];
  const total = songSteps(transport.bars);
  const stepDur = stepSeconds(transport.bpm);
  const editing = clips.find((c) => c.id === editingId) ?? null;
  useEffect(() => {
    const edit = (event: Event) => {
      const id: unknown = (event as CustomEvent).detail;
      if (typeof id === "string" && clips.some((clip) => clip.id === id)) setEditingId(id);
    };
    window.addEventListener("synclab:edit-clip", edit);
    return () => window.removeEventListener("synclab:edit-clip", edit);
  }, [clips]);
  const tracksLive = useRef(tracks);
  tracksLive.current = tracks;

  const writeClip = (clipId: string, patch: Partial<(typeof clips)[number]>) =>
    updateTrack(track.id, { clips: clips.map((c) => (c.id === clipId ? { ...c, ...patch } : c)) });

  const beginDrag = (
    e: React.PointerEvent,
    clip: (typeof clips)[number],
    mode: "move" | "trim-left" | "trim-right",
  ) => {
    if (e.button !== 0) return;
    e.stopPropagation();
    e.preventDefault();
    const lane = (e.currentTarget as HTMLElement).closest("[data-lane]") as HTMLElement | null;
    if (!lane) return;
    const rect = canvasRect(lane);
    const perStep = rect.width / total;
    const startPt = canvasPoint(e.clientX, e.clientY);
    const x0 = startPt.x;
    const orig = {
      start: clip.start ?? 0,
      offset: clip.offset ?? 0,
      length: clip.length ?? clip.duration,
    };
    const el = e.currentTarget as HTMLElement;
    el.setPointerCapture(e.pointerId);

    const grid = transport.snap ?? 1;
    const y0 = startPt.y;
    const viewport = lane.closest<HTMLElement>("#timeline-scroll");
    const newChannel = viewport?.querySelector<HTMLElement>("[data-new-channel-drop]");
    const initialScrollLeft = viewport?.scrollLeft ?? 0;
    let pointerX = x0;
    let pointerY = y0;
    let dragged = false;
    let edgeEdit: ReturnType<typeof rightEdgeEdit> | null = null;
    const clipElement = el.closest<HTMLElement>(".arrangement-clip");
    const originalWidth = clipElement?.style.width ?? "";
    const overNewChannel = (x: number, y: number) => {
      if (!newChannel || !viewport) return false;
      const bounds = canvasRect(newChannel);
      const visible = canvasRect(viewport);
      return x >= visible.left && x <= visible.right && y >= Math.max(bounds.top, visible.top) && y <= Math.min(bounds.bottom, visible.bottom);
    };
    const highlight = () => {
      const over = dragged && mode === "move" && overNewChannel(pointerX, pointerY);
      newChannel?.classList.toggle("ring-2", over);
      newChannel?.classList.toggle("ring-primary", over);
      newChannel?.classList.toggle("bg-primary/10", over);
    };
    const edgeScroll = window.setInterval(() => {
      if (!dragged || !viewport) return;
      const bounds = canvasRect(viewport);
      const dx = pointerX > bounds.right - 32 ? 18 : pointerX < bounds.left + 32 ? -18 : 0;
      if (dx) viewport.scrollLeft += dx;
      if (mode !== "move") return;
      if (pointerX < bounds.left || pointerX > bounds.right) return;
      const dy = pointerY > bounds.bottom - 48 ? 18 : pointerY < bounds.top + 48 ? -18 : 0;
      if (dy) viewport.scrollTop += dy;
      highlight();
    }, 50);
    const clearDrag = () => {
      window.clearInterval(edgeScroll);
      newChannel?.classList.remove("ring-2", "ring-primary", "bg-primary/10");
      if (el.hasPointerCapture(e.pointerId)) el.releasePointerCapture(e.pointerId);
    };
    const onMove = (ev: PointerEvent) => {
      const pt = canvasPoint(ev.clientX, ev.clientY);
      if (!dragged && Math.hypot(pt.x - x0, pt.y - y0) < 5) return;
      dragged = true;
      pointerX = pt.x;
      pointerY = pt.y;
      highlight();
      if (mode === "move") {
        el.style.transform = `translateY(${pt.y - y0}px)`;
        el.style.zIndex = "50";
      }
      const raw = (pt.x - x0 + (viewport?.scrollLeft ?? initialScrollLeft) - initialScrollLeft) / Math.max(1, perStep);
      const dSteps = grid > 0 ? Math.round(raw / grid) * grid : Math.round(raw * 100) / 100;
      if (mode === "move") {
        const next = orig.start + dSteps;
        writeClip(clip.id, {
          start: Math.max(0, Math.min(total - 1, grid > 0 ? Math.round(next / grid) * grid : next)),
        });
      } else if (mode === "trim-right") {
        // Snap the clip end to whole bars so you choose how many bars it lasts (Shift = fine).
        // Clip length/offset are source-file seconds, so convert through the playback rate.
        const bar = stepsPerBar() * stepDur;
        edgeEdit = rightEdgeEdit(clip, dSteps * stepDur, bar, ev.shiftKey, track.kind === "drum");
        if (clipElement) {
          clipElement.dataset["bars"] = `${+(edgeEdit.seconds / bar).toFixed(2)} BARS${edgeEdit.stretch ? " · STRETCH" : ""}`;
          clipElement.style.width = `${edgeEdit.seconds / stepDur * perStep}px`;
        }
      } else {
        const rate = clipRate(clip);
        const bar = stepsPerBar() * stepDur;
        const rawDelta = dSteps * stepDur;
        const want = ev.shiftKey ? rawDelta : Math.round(rawDelta / bar) * bar;
        const delta = Math.max(-orig.offset / rate, Math.min((orig.length - 0.05) / rate, want));
        (el.closest(".arrangement-clip") as HTMLElement | null ?? el).dataset["bars"] = `${+((orig.length - delta * rate) / rate / bar).toFixed(2)} BARS`;
        writeClip(clip.id, {
          offset: orig.offset + delta * rate,
          length: orig.length - delta * rate,
          start: Math.max(0, orig.start + Math.round(delta / stepDur)),
        });
      }
    };

    const onUp = (ev: PointerEvent) => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      window.removeEventListener("pointercancel", onCancel);
      clearDrag();
      delete (el.closest(".arrangement-clip") as HTMLElement | null ?? el).dataset["bars"];
      if (mode === "trim-right") {
        if (clipElement) clipElement.style.width = originalWidth;
        if (edgeEdit) {
          const neededBars = Math.ceil((orig.start + edgeEdit.seconds / stepDur) / stepsPerBar());
          if (neededBars > transport.bars) setTransport({ bars: neededBars });
          if (edgeEdit.stretch) void stretchClip(track.id, clip.id, edgeEdit.stretch);
          else writeClip(clip.id, { length: edgeEdit.length });
        }
        return;
      }
      if (mode !== "move") return;
      el.style.transform = "";
      el.style.zIndex = "";
      if (!dragged) return;
      const upPt = canvasPoint(ev.clientX, ev.clientY);
      if (overNewChannel(upPt.x, upPt.y)) {
        moveClipToNew(track.id, clip.id, orig.start);
        toast.success(`${clip.name} moved to a new channel`);
        requestAnimationFrame(() => { if (viewport) viewport.scrollTop = viewport.scrollHeight; });
        return;
      }
      let targetId: string | undefined;
      // The dragged clip floats over the destination. Hit-test lane bounds,
      // not the floating source element or the captured pointer target.
      for (const lane of document.querySelectorAll<HTMLElement>("[data-lane-track]")) {
        const bounds = canvasRect(lane);
        if (upPt.x >= bounds.left && upPt.x <= bounds.right && upPt.y >= bounds.top && upPt.y <= bounds.bottom) {
          targetId = lane.dataset["laneTrack"];
          break;
        }
      }
      if (!targetId || targetId === track.id) return;
      const all = tracksLive.current;
      const dest = all.find((t) => t.id === targetId);
      const src = all.find((t) => t.id === track.id);
      const moved = src?.clips?.find((c) => c.id === clip.id);
      if (!dest || !src || !moved) return;
      const destIsNotes = dest.kind === "drum" || dest.kind === "instrument" || dest.kind === "midi" || dest.kind === "sampler";
      // The take leaves nothing behind: notes and drum hits recorded under it go too.
      const a = orig.start;
      const b = a + clipSeconds(moved) / stepDur;
      const leftClips = (src.clips ?? []).filter((c) => c.id !== clip.id);
      updateTrack(src.id, {
        clips: leftClips, activeClipId: undefined,
        ...(src.notes?.length ? { notes: deleteRegion(src.notes, [a, b]) } : {}),
        ...(src.kind === "drum" && src.pads ? { pads: src.pads.map((pad) => ({ ...pad, steps: pad.steps.map((v, i) => {
          const len = Math.max(1, pad.steps.length);
          const first = i + Math.max(0, Math.ceil((a - i) / len)) * len;
          return first < b ? 0 : v;
        }) })) } : {}),
        ...(leftClips.length ? {} : { printedAudio: false }),
      });
      // Note tracks switch to WAVE so the moved audio actually plays there.
      updateTrack(dest.id, { clips: [...(dest.clips ?? []), moved], activeClipId: moved.id, ...(destIsNotes ? { printedAudio: true } : {}) });
      setActiveClip(dest.id, moved.id);
      toast.success(`${moved.name} moved to ${dest.name}`);
    };

    const onCancel = () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      window.removeEventListener("pointercancel", onCancel);
      clearDrag();
      if (clipElement) clipElement.style.width = originalWidth;
      if (dragged) writeClip(clip.id, orig);
      el.style.transform = "";
      el.style.zIndex = "";
      delete (el.closest(".arrangement-clip") as HTMLElement | null ?? el).dataset["bars"];
    };
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    window.addEventListener("pointercancel", onCancel);
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
        const peaks = clip.peaks.length > 0 ? clip.peaks : EMPTY_PEAKS;
        return (
          <div
            key={clip.id}
            data-audio-clip={clip.id}
            data-selected={active}
            data-cutting={cutting}
            className="arrangement-clip group absolute inset-y-1 flex touch-none flex-col overflow-hidden rounded-[2px] border transition-colors"
            style={{ left: `${left}%`, width: `max(0px, calc(${width}% - 2px))` }}
            onPointerDown={(e) => {
              setActiveClip(track.id, clip.id);
              beginDrag(e, clip, "move");
            }}
            onClick={(e) => e.stopPropagation()}
            onDoubleClick={(e) => {
              e.stopPropagation();
              setEditingId(clip.id);
            }}
            title={`${clip.name} — drag to move, pull the edges to trim, double-click to edit`}
          >
            <div className="arrangement-clip-name flex h-[17px] shrink-0 cursor-grab items-center gap-1 px-1.5 active:cursor-grabbing">
              <span className="min-w-0 flex-1 truncate font-mono text-[9px] font-semibold">{clip.name}</span>
              <span className="ml-auto shrink-0 font-mono text-[8px] opacity-70">{length.toFixed(1)}s</span>
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

            </div>
            {active && <PartMenu label={clip.name} onDelete={() => removeClip(track.id, clip.id)} />}

            <div className="min-h-0 w-full flex-1 px-1 pb-1">
              <WaveformView peaks={peaks} color="var(--arrangement-wave)" grid={false} label={`${clip.name} waveform`} />
            </div>

            <div
              onPointerDown={(e) => beginDrag(e, clip, "trim-left")}
              title="Drag to shorten the start by whole bars (Shift for fine)"
              className="arrangement-trim arrangement-trim-left absolute inset-y-0 left-0 z-30 w-3 cursor-ew-resize touch-none"
            />
            <div
              onPointerDown={(e) => beginDrag(e, clip, "trim-right")}
              role="slider" aria-label={`Resize or stretch ${clip.name}`} aria-valuenow={length} aria-valuemin={0.05}
              title="Drag to resize; extends past source end with pitch-preserving stretch (Shift for fine)"
              className="arrangement-trim arrangement-trim-right absolute inset-y-0 right-0 z-30 w-3 cursor-ew-resize touch-none"
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
  const { setPanel, select, transport, updateTrack } = useStudio();
  const notes = track.notes ?? [];
  const cuts = track.cuts ?? [];
  /** Drag the pattern to any grid position: every note shifts by the same
   *  snapped step delta, so the whole part lands on a measure/beat line. */
  const beginPatternDrag = (e: React.PointerEvent) => {
    e.stopPropagation();
    e.preventDefault();
    const lane = (e.currentTarget as HTMLElement).closest("[data-lane]") as HTMLElement | null;
    if (!lane) return;
    const rect = canvasRect(lane);
    const perStep = rect.width / total;
    const x0 = canvasPoint(e.clientX, e.clientY).x;
    const grid = transport.snap ?? 1;
    const orig = notes.map((n) => ({ id: n.id, step: n.step, recordedEnd: n.recordedEnd }));
    const el = e.currentTarget as HTMLElement;
    el.setPointerCapture(e.pointerId);
    const onMove = (ev: PointerEvent) => {
      const raw = (canvasPoint(ev.clientX, ev.clientY).x - x0) / Math.max(1, perStep);
      let d = grid > 0 ? Math.round(raw / grid) * grid : Math.round(raw * 100) / 100;
      const minStep = Math.min(...orig.map((o) => o.step));
      if (minStep + d < 0) d = -minStep;
      updateTrack(track.id, {
        notes: (track.notes ?? []).map((n) => {
          const o = orig.find((x) => x.id === n.id);
          if (!o) return n;
          return {
            ...n,
            step: Math.max(0, o.step + d),
            ...(o.recordedEnd != null ? { recordedEnd: Math.max(0, o.recordedEnd + d) } : {}),
          };
        }),
      });
    };
    const onUp = () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      el.style.transform = "";
    };
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
  };
  // the pattern loops for the whole song, so draw every repeat where it is heard
  const total = songSteps(transport.bars);
  const patLen = Math.max(stepsPerBar(), track.steps || stepsPerBar());
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
  const bounds: [number, number] = [Math.min(...notes.map(n => n.recordedEnd != null ? n.step : 0)), Math.max(...notes.map(n => n.recordedEnd ?? total))];
  return <>{boundedRegions(regionsOf(cuts, total), bounds).map(([a, b]) => {
    const regionNotes = cuts.length > 0 ? notesInRegion(notes, [a, b]) : notes;
    if (regionNotes.length === 0) return null;
    const active = track.activeRegion != null && track.activeRegion >= a - 0.001 && track.activeRegion < b - 0.001;
    return <div key={a}
      data-note-region={active ? "active" : "part"}
      data-selected={active}
      className="arrangement-clip arrangement-midi absolute inset-y-1 flex cursor-grab flex-col overflow-hidden rounded-[2px] border active:cursor-grabbing"
      style={{ left: `${a / total * 100}%`, width: `calc(${(b - a) / total * 100}% - 1px)` }}
      onPointerDown={(e) => {
        updateTrack(track.id, { activeRegion: a });
        select(track.id);
        beginPatternDrag(e);
      }}
      onClick={(e) => e.stopPropagation()}
      onDoubleClick={() => { select(track.id); setPanel("piano"); }}
      title={`${track.name} — double-click to edit notes`}
    >
      <div className="arrangement-clip-name flex h-[17px] shrink-0 items-center gap-1 px-1.5">
        <Piano className="size-2.5 shrink-0" />
        <span className="min-w-0 flex-1 truncate font-mono text-[9px] font-semibold">{track.name}</span>

      </div>
      {active && <PartMenu label={`${track.name} part`} onDelete={() => { const patch = deleteSelectedPart(track, transport.bpm, transport.bars, transport.loop ? loopRegion(transport) : undefined); if (patch) updateTrack(track.id, patch); toast.success("Part deleted"); }} />}
      <div className="relative min-h-0 flex-1">
        {Array.from({ length: rows }).map((_, r) => <div key={r} className="arrangement-note-grid absolute inset-x-0 border-t" style={{ top: `${r / rows * 100}%` }} />)}
        {Array.from({ length: reps }).flatMap((_, rep) => regionNotes.map((n) => {
          if (n.recordedEnd != null && rep > 0) return null;
          const at = n.recordedEnd != null ? n.step : rep * patLen + (n.step % patLen);
          const end = at + Math.min(n.length, n.recordedEnd != null ? n.recordedEnd - at : patLen - (n.step % patLen), total - at);
          if (at >= b || end <= a) return null;
          const from = Math.max(a, at);
          const to = Math.min(b, end);
          return <div key={`${n.id}-${rep}`} className="arrangement-note absolute rounded-[1px]"
            title={`${NOTE_NAMES[n.pitch % 12]}${Math.floor(n.pitch / 12) - 1}`}
            style={{ left: `${(from - a) / (b - a) * 100}%`, width: `${Math.max(0.3, (to - from) / (b - a) * 100 - 0.1)}%`, top: `${(1 - (n.pitch - lo) / span) * 82 + 4}%`, height: "6%", opacity: 0.5 + (n.velocity ?? 0.8) * 0.35 }} />;
        }))}
      </div>
      {active && <><span aria-hidden="true" className="arrangement-region-handle left-0" /><span aria-hidden="true" className="arrangement-region-handle right-0" /></>}
    </div>;
  })}</>;

}

/** Hit-envelope view of a drum pattern: every programmed hit draws a decaying
 *  transient sized by its velocity. It reflects the real pattern; recorded audio
 *  (WAVE) shows the true rendered waveform. */
const DrumHitWave = memo(function DrumHitWave({ pads, steps, total, tone = "text-clip-drum" }: { pads: { steps: number[] }[]; steps: number; total: number; tone?: string }) {
  const path = useMemo(() => {
    const res = 6;
    const n = Math.max(2, total * res);
    const env = new Float32Array(n);
    for (let at = 0; at < total; at++) {
      const i = at % Math.max(1, steps);
      let hit = 0;
      for (const p of pads) hit += p.steps[i] ?? 0;
      if (hit <= 0) continue;
      const amp = Math.min(1, 0.35 + hit * 0.4);
      for (let k = 0; k < res * 3 && at * res + k < n; k++) env[at * res + k] = Math.max(env[at * res + k]!, amp * Math.exp(-k / (res * 0.9)) * (0.85 + 0.15 * Math.sin(k * 2.7)));
    }
    const x = (i: number) => ((i / (n - 1)) * 1000).toFixed(1);
    const top = Array.from(env, (v, i) => `${x(i)},${(50 - Math.max(0.6, v * 46)).toFixed(1)}`);
    const bot = Array.from(env, (v, i) => `${x(i)},${(50 + Math.max(0.6, v * 46)).toFixed(1)}`).reverse();
    return `M ${top.join(" L ")} L ${bot.join(" L ")} Z`;
  }, [pads, steps, total]);
  return (
    <svg viewBox="0 0 1000 100" preserveAspectRatio="none" className={`absolute inset-0 h-full w-full ${tone}`} role="img" aria-label="Drum pattern hit envelope">
      <path d={path} fill="currentColor" fillOpacity="0.7" />
      <line x1="0" y1="50" x2="1000" y2="50" stroke="currentColor" strokeOpacity="0.3" strokeWidth="0.5" />
    </svg>
  );
});

/** Shows the track's level after its VCA so moving the VCA fader is visible on the track. */
function VcaLevel({ track }: { track: Track }) {
  const { vcas } = useStudio();
  const st = track.vca ? vcas[track.vca] : undefined;
  const eff = Math.min(1, track.volume * (st ? (st.muted ? 0 : st.volume) : 1));
  return (
    <div className="flex w-14 flex-col gap-0.5" title={`Level after VCA ${track.vca}`} aria-label={`Level after VCA ${track.vca}`}>
      <div className="h-1.5 rounded-sm bg-surface-2"><div className="h-full rounded-sm bg-primary transition-[width] duration-75" style={{ width: `${eff * 100}%` }} /></div>
      <span className="font-mono text-[8px] leading-none text-primary">VCA {track.vca} {eff > 0 ? `${(20 * Math.log10(eff)).toFixed(1)} dB` : "-∞"}</span>
    </div>
  );
}

function DrumClip({ track }: { track: Track }) {
  const { setPanel, select, transport, updateTrack } = useStudio();
  /** Drag the pattern along the grid: every pad's hits rotate by the same
   *  snapped step amount, so the whole beat shifts to a new grid position. */
  const beginPatternDrag = (e: React.PointerEvent) => {
    e.stopPropagation();
    e.preventDefault();
    const lane = (e.currentTarget as HTMLElement).closest("[data-lane]") as HTMLElement | null;
    if (!lane) return;
    const rect = canvasRect(lane);
    const perStep = rect.width / songSteps(transport.bars);
    const x0 = canvasPoint(e.clientX, e.clientY).x;
    const grid = transport.snap ?? 1;
    const orig = (track.pads ?? []).map((p) => ({ id: p.id, steps: [...p.steps] }));
    const len = orig[0]?.steps.length ?? 16;
    let applied = 0;
    const onMove = (ev: PointerEvent) => {
      const raw = (canvasPoint(ev.clientX, ev.clientY).x - x0) / Math.max(1, perStep);
      const d = grid > 0 ? Math.round(raw / grid) * grid : Math.round(raw);
      if (d === applied) return;
      applied = d;
      const shift = ((d % len) + len) % len;
      updateTrack(track.id, {
        pads: (track.pads ?? []).map((p) => {
          const o = orig.find((x) => x.id === p.id);
          if (!o) return p;
          return { ...p, steps: o.steps.map((_, i) => o.steps[(i - shift + len) % len] ?? 0) };
        }),
      });
    };
    const onUp = () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
    };
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
  };
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
  const cuts = track.cuts ?? [];
  const bounds = track.patternRegion ?? (transport.loop ? loopRegion(transport) : [0, total] as [number, number]);
  /** Drag one beat part like a synth take; it snaps to the grid and clicks onto neighbouring parts' edges. */
  const beginPartDrag = (e: React.PointerEvent, a: number, b: number) => {
    e.stopPropagation();
    if (e.button !== 0) return;
    e.preventDefault(); // no native drag or text selection, which would swallow the move
    const lane = (e.currentTarget as HTMLElement).closest("[data-lane]") as HTMLElement | null;
    if (!lane) return;
    const perStep = canvasRect(lane).width / Math.max(1, total);
    const x0 = canvasPoint(e.clientX, e.clientY).x;
    const grid = transport.snap && transport.snap > 0 ? transport.snap : 1;
    const bar = stepsPerBar();
    const others = boundedRegions(regionsOf(cuts, total), bounds)
      .filter(([x, y]) => (x !== a || y !== b) && track.pads?.some((p) => p.steps.slice(Math.floor(x), Math.ceil(y)).some((v) => v > 0)));
    const edges = others.flatMap(([x, y]) => [y, x - (b - a)]);
    let to = a;
    const target = e.currentTarget as HTMLElement;
    try { target.setPointerCapture(e.pointerId); } catch { /* pointer already released */ }
    const onMove = (ev: PointerEvent) => {
      const raw = a + (canvasPoint(ev.clientX, ev.clientY).x - x0) / Math.max(0.0001, perStep);
      const near = edges.reduce<number | null>((best, edge) => Math.abs(edge - raw) <= bar / 4 && (best == null || Math.abs(edge - raw) < Math.abs(best - raw)) ? edge : best, null);
      let next = Math.max(0, near ?? Math.round(raw / grid) * grid);
      // Never drop a part on top of another one: butt it against the closest free edge instead.
      if (others.some(([x, y]) => next < y && next + (b - a) > x)) {
        const free = edges.filter((edge) => edge >= 0 && !others.some(([x, y]) => edge < y - 0.001 && edge + (b - a) > x + 0.001));
        if (free.length) next = free.reduce((best, edge) => Math.abs(edge - raw) < Math.abs(best - raw) ? edge : best);
      }
      to = next;
      if (target) target.style.transform = `translateX(${(to - a) * perStep}px)`;
    };
    const onUp = () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      window.removeEventListener("pointercancel", onUp);
      target.style.transform = "";
      if (Math.abs(to - a) < 0.5) return;
      updateTrack(track.id, moveDrumPart(track, a, b, to));
    };
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    window.addEventListener("pointercancel", onUp);
  };
  /** Drag a beat part's right edge to stretch it: its hits spread out (or squeeze in) to fill the new length. */
  const beginPartStretch = (e: React.PointerEvent, a: number, b: number) => {
    e.stopPropagation();
    if (e.button !== 0) return;
    e.preventDefault();
    const handle = e.currentTarget as HTMLElement;
    const block = handle.parentElement;
    const lane = handle.closest("[data-lane]") as HTMLElement | null;
    if (!lane || !block) return;
    const perStep = canvasRect(lane).width / Math.max(1, total);
    const x0 = canvasPoint(e.clientX, e.clientY).x;
    const grid = transport.snap && transport.snap > 0 ? transport.snap : 1;
    const nextStart = boundedRegions(regionsOf(cuts, total), bounds)
      .filter(([x, y]) => x >= b - 0.001 && track.pads?.some((p) => p.steps.slice(Math.floor(x), Math.ceil(y)).some((v) => v > 0)))
      .reduce((m, [x]) => Math.min(m, x), total);
    const maxLen = Math.max(1, nextStart - a);
    let len = b - a;
    const originalWidth = block.style.width;
    try { handle.setPointerCapture(e.pointerId); } catch { /* pointer already released */ }
    const onMove = (ev: PointerEvent) => {
      const raw = b - a + (canvasPoint(ev.clientX, ev.clientY).x - x0) / Math.max(0.0001, perStep);
      len = Math.max(grid, Math.min(maxLen, Math.round(raw / grid) * grid));
      block.style.width = `${len * perStep - 1}px`;
      block.dataset["bars"] = `${+(len / stepsPerBar()).toFixed(2)} BARS · STRETCH`;
    };
    const onUp = () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      window.removeEventListener("pointercancel", onUp);
      block.style.width = originalWidth;
      delete block.dataset["bars"];
      if (Math.abs(len - (b - a)) < 0.5) return;
      updateTrack(track.id, stretchDrumPart(track, a, b, len));
      toast.success(`Beat part stretched to ${+(len / stepsPerBar()).toFixed(2)} bars`);
    };
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    window.addEventListener("pointercancel", onUp);
  };
  {
    // Cut beat: each part is its own block that can be selected and deleted, like a DAW part.
    return <>{boundedRegions(regionsOf(cuts, total), bounds).map(([a, b]) => {
      const lo = Math.floor(a), hi = Math.ceil(b);
      const part = pads.map((p) => ({ steps: Array.from({ length: hi - lo }, (_, i) => p.steps[(lo + i) % Math.max(1, steps)] ?? 0) }));
      const hits = part.reduce((n, p) => n + p.steps.filter((v) => v > 0).length, 0);
      if (hits === 0) return null;
      const active = track.activeRegion != null && track.activeRegion >= a - 0.001 && track.activeRegion < b - 0.001;
      return (
        <div key={a} data-selected={active} data-note-region={active ? "active" : "part"}
          className="arrangement-clip absolute inset-y-1 flex flex-col overflow-hidden rounded-[2px] border"
          onPointerDown={(e) => { updateTrack(track.id, { activeRegion: a }); select(track.id); beginPartDrag(e, a, b); }}
          onClick={(e) => e.stopPropagation()}
          onDoubleClick={() => { select(track.id); setPanel("drums"); }}
          style={{ left: `${a / total * 100}%`, width: `calc(${(b - a) / total * 100}% - 1px)`, cursor: "grab", touchAction: "none" }}
          title={`${track.name} beat part — drag to move, double-click to open the drum machine`}>
          <div className="arrangement-clip-name flex h-[17px] shrink-0 items-center gap-1 px-1.5">
            <Disc3 className="size-2.5 shrink-0" />
            <span className="min-w-0 flex-1 truncate font-mono text-[9px] font-semibold">{track.name} · {hits} HITS</span>

          </div>
          {active && <PartMenu label={`${track.name} beat part`} onDelete={() => { const patch = deleteSelectedPart(track, transport.bpm, transport.bars, transport.loop ? loopRegion(transport) : undefined); if (patch) updateTrack(track.id, patch);
                toast.success("Beat part deleted"); }} />}
          <div className="relative min-h-0 flex-1"><DrumHitWave pads={part} steps={hi - lo} total={hi - lo} tone="text-[var(--arrangement-ink)]" /></div>
          <div
            onPointerDown={(e) => beginPartStretch(e, a, b)}
            onClick={(e) => e.stopPropagation()}
            role="slider" aria-label={`Stretch ${track.name} beat part`} aria-valuenow={b - a} aria-valuemin={1}
            title="Drag to stretch this beat part — its hits spread out to fill the new length"
            className="arrangement-trim arrangement-trim-right absolute inset-y-0 right-0 z-30 w-3 cursor-ew-resize touch-none"
          />
        </div>
      );
    })}</>;
  }
  const hits = pads.reduce((n, p) => n + p.steps.filter((s) => s > 0).length, 0);
  return (
    <div
      className="absolute inset-y-2 left-1 right-1 cursor-grab overflow-hidden rounded-[3px] border border-clip-drum/30 bg-clip-drum/10 shadow-sm transition-colors hover:bg-clip-drum/15 active:cursor-grabbing"
      onPointerDown={beginPatternDrag}
      title="Drag to shift this beat along the grid — double-click to open the drum machine"
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
        <DrumHitWave pads={pads} steps={steps} total={total} />
      </div>
    </div>
  );
}

/** The take you are capturing right now: a red region that grows from the punch-in
 *  point and draws the incoming microphone level live. */
// Classic DAW-style take region: a plain red block that grows from the record
// start to the playhead. No live waveform — the real waveform appears when the take is finished.
function RecordingClip({ track }: { track: Track }) {
  const { transport } = useStudio();
  const total = songSteps(transport.bars);
  const startRef = useRef(transport.step ?? 0);
  const start = startRef.current;
  const now = transport.step ?? start;
  const length = Math.max(1, (now >= start ? now - start : total - start) + 1);
  const left = (start / total) * 100;
  const width = Math.min(100 - left, (length / total) * 100);

  return (
    <div
      className="pointer-events-none absolute inset-y-1 z-10 overflow-hidden rounded-[3px] border border-destructive bg-destructive/30"
      style={{ left: `${left}%`, width: `${Math.max(1.5, width)}%` }}
      aria-label={`Recording on ${track.name}`}
    >
      <span className="block truncate bg-destructive px-1.5 py-[1px] font-mono text-[9px] font-semibold text-destructive-foreground">{track.name}</span>
    </div>
  );
}

function Lane({ track }: { track: Track }) {
  const isMidi = track.kind === "instrument" || track.kind === "midi" || track.kind === "sampler";
  const live = track.recording ? <RecordingClip track={track} /> : null;
  // Keep the same editable material beneath the non-interactive incoming-take
  // indicator, so recording never replaces the arrangement with a locked view.
  if ((track.kind === "instrument" || track.kind === "midi" || track.kind === "sampler" || track.kind === "drum") && (track.clips?.length ?? 0) > 0)
    return (
      <>
        {timelineUsesWaveform(track) ? <Waveform track={track} /> : track.kind === "drum" ? <DrumClip track={track} /> : <MidiClip track={track} />}
        {live}
      </>
    );
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
  | { type: "tool"; kind: Track["kind"]; name: string; preset?: string }
  | { type: "localfile"; id: string; name: string };

export const readDrag = (e: React.DragEvent): DragPayload | null => {
  const raw = e.dataTransfer.getData("application/synclab") || e.dataTransfer.getData("text/plain");
  if (!raw) return null;
  try {
    const v = JSON.parse(raw) as DragPayload;
    return v?.type === "instrument" || v?.type === "plugin" || v?.type === "tool" || v?.type === "localfile" ? v : null;
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

function TrackRow({ track, index, headerWidth, setHeaderWidth }: { track: Track; index: number; headerWidth: number; setHeaderWidth: (width: number) => void }) {
  const isMobile = useIsMobile();
  const { selectedId, selectedIds, select, toggleSelectId, updateTrack, removeTrack, duplicateTrack, moveTrack, moveTrackToIndex, moveTrackToNew, setPanel, changeInstrument, installedPlugins, addPlugin, editTool, splitClipAt, razorAt, toggleStep, toggleAutomationLane, copyTrack, cutTrack, pasteTrack, clipboardName, copyClip, cutClip, pasteClip, clipClipboardName, clearTrackContent, folders, addFolder, assignTrackFolder, swapTake, stretchClip } =
    useStudio();
  const { transport, setNotes, loadSample, fxChains, tracks: allTracks } = useStudio();
  const fileStudio = useStudio();
  const advanced = useApp().mode === "advanced";

  const [renaming, setRenaming] = useState(false);
  const [renameName, setRenameName] = useState(track.name);
  const beginRename = () => { setRenameName(track.name); setRenaming(true); };
  const [confirm, setConfirm] = useState(false);
  const [dropping, setDropping] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [makingFile, setMakingFile] = useState(false);
  const [pastePosition, setPastePosition] = useState<number | null>(null);
  const clipTapRef = useRef<{ x: number; y: number } | null>(null);
  const hasClipboard = Boolean(clipboardName || clipClipboardName);
  const pasteAt = (step?: number) => {
    if (clipClipboardName) pasteClip(false, track.id, step);
    else pasteTrack(track.id, step);
  };
  /** One tap opens the track menu; a second tap within 300 ms opens the drum roll or piano roll instead. */
  const tapTimerRef = useRef<number | null>(null);
  const openRoll = () => {
    select(track.id);
    if (track.kind === "drum") setPanel("drums");
    else if (track.kind === "instrument" || track.kind === "midi") setPanel("piano");
    else openEditor();
  };
  const selectForEditing = () => {
    select(track.id);
    setPastePosition(null);
    if (tapTimerRef.current !== null) {
      window.clearTimeout(tapTimerRef.current);
      tapTimerRef.current = null;
      setMenuOpen(false);
      openRoll();
      return;
    }
    tapTimerRef.current = window.setTimeout(() => { tapTimerRef.current = null; setMenuOpen(true); }, 300);
  };
  const gestureRef = useRef<{ x: number; y: number; timer: number | null; moved: boolean } | null>(null);
  const suppressClickRef = useRef(false);
  const isSelected = selectedId === track.id || selectedIds.includes(track.id);

  const clips = track.clips ?? [];
  const activeClip = clips.find((c) => c.id === track.activeClipId);
  const fileClip = activeClip ?? (clips.length === 1 ? clips[0] : undefined);
  const hasFileSource = Boolean(fileClip || track.sampler);
  const makeAudioFile = async (channels: 1 | 2) => {
    if (makingFile || !hasFileSource) return;
    setMakingFile(true);
    try {
      const engine = getEngine();
      engine.init();
      let source = track.sampler ? { ...track.sampler } : null;
      let name = track.sampler?.name ?? track.name;
      if (fileClip) {
        const url = fileClip.cloudPath ? await freshCloudUrl(fileClip.cloudPath) : fileClip.url;
        if (!url || !(fileClip.duration > 0)) throw new Error("Select a loaded audio clip first.");
        const offset = Math.max(0, fileClip.offset ?? 0);
        const length = Math.min(fileClip.length ?? fileClip.duration, fileClip.duration - offset);
        if (length <= 0) throw new Error("The selected clip has no audio in its trim range.");
        source = {
          name: fileClip.name, url, duration: fileClip.duration, peaks: fileClip.peaks,
          start: fileClip.reverse ? 1 - (offset + length) / fileClip.duration : offset / fileClip.duration,
          end: fileClip.reverse ? 1 - offset / fileClip.duration : (offset + length) / fileClip.duration,
          gain: fileClip.gain ?? 1, pitch: 12 * Math.log2(clipRate(fileClip)),
          rootNote: 60, loop: false, reverse: fileClip.reverse ?? false, oneShot: true,
          attack: 0, release: 0, fadeIn: fileClip.fadeIn ?? 0, fadeOut: fileClip.fadeOut ?? 0,
        };
        name = fileClip.name;
      } else if (source?.cloudPath) source.url = await freshCloudUrl(source.cloudPath);
      if (!source?.url) throw new Error("Load a sample or select an audio clip first.");
      // Conversion must never change the live engine's tempo or routing.
      if (source.syncToBpm && source.sampleBpm) {
        source.pitch += 12 * Math.log2(transport.bpm / source.sampleBpm);
        source.syncToBpm = false;
      }
      const audio = await engine.renderSample(source);
      if (!audio) throw new Error("This audio could not be decoded. Try a WAV or MP3 source.");
      const safeName = name.replace(/[^\w\-. ]+/g, "").trim() || "SYNCLAB audio";
      downloadBlob(encodeWav(audio, channels), `${safeName}-${channels === 1 ? "mono" : "stereo"}.wav`);
      toast.success(`${channels === 1 ? "Mono" : "Stereo"} WAV created`);
    } catch (error) {
      toast.error("Could not make audio file", { description: error instanceof Error ? error.message : String(error) });
    } finally { setMakingFile(false); }
  };
  const playFrac = Math.min(0.98, Math.max(0.02, ((transport.step ?? 0) % 16) / 16));

  const editorPanel: PanelId =
    track.kind === "drum" ? "drums"
    : track.kind === "sampler" ? "sampler"
    : track.kind === "instrument" || track.kind === "midi" ? "synth"
    : null;
  const editorLabel =
    track.kind === "drum" ? "Open drum machine"
    : track.kind === "sampler" ? "Open sampler"
    : "Open instrument";
  const openTrackEditor = (id: string = track.id) => {
    if (!editorPanel) return;
    select(id);
    setPanel(editorPanel);
    // Run again after the menu closes so no row click can swap in the piano roll.
    window.setTimeout(() => { select(id); setPanel(editorPanel); }, 0);
  };
  const synthTracks = fileStudio.tracks.filter((t) => t.kind === "instrument" || t.kind === "midi");

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
        if (op === "quantize") {
          const q = transport.quantize ?? 1;
          return { ...n, step: Math.round(n.step / q) * q };
        }
        const pitch = Math.min(120, Math.max(0, n.pitch + (op === "up" ? 12 : -12)));
        return { ...n, pitch };
      }),
    );
    toast.success(op === "quantize" ? "Notes quantized" : "Notes transposed");
  };


  const onDrop = (e: React.DragEvent) => {
    setDropping(false);
    const movedId = e.dataTransfer.getData("application/x-synclab-track");
    if (movedId) {
      e.preventDefault();
      e.stopPropagation();
      const from = allTracks.findIndex((t) => t.id === movedId);
      if (from < 0 || movedId === track.id) return;
      const delta = index - from;
      for (let k = 0; k < Math.abs(delta); k++) moveTrack(movedId, delta < 0 ? -1 : 1);
      toast(`Track moved to position ${index + 1}`);
      return;
    }
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
    if (payload.type === "localfile") {
      void (async () => {
        try {
          const clip = await clipFromLocalFile(payload.id, transport.step);
          if (track.kind === "audio") {
            fileStudio.addClip(track.id, clip);
            select(track.id);
          } else {
            const id = fileStudio.addTrack("audio", clip.name);
            if (id) fileStudio.addClip(id, clip);
          }
          toast.success(`${payload.name} on the timeline`, { description: track.kind === "audio" ? `Added to ${track.name} at the playhead` : "Placed on a new audio track" });
        } catch (err) {
          toast.error("Could not read that audio file", { description: err instanceof Error ? err.message : undefined });
        }
      })();
      return;
    }
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
    const def = availableEffects(installedPlugins).find((d) => d.id === payload.defId);
    if (def) {
      addPlugin(track.id, def);
      select(track.id);
      setPanel("plugins");
    }
  };

  const openEditor = () => {
    select(track.id);
    setPanel(track.kind === "drum" ? "drums" : track.kind === "audio" ? "mixer" : track.kind === "sampler" ? "sampler" : "synth");
  };

  const startPhoneGesture = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!isMobile || e.pointerType === "mouse") return;
    const target = e.target as HTMLElement;
    if (target.closest("button,input,textarea,select,[role='slider'],[role='combobox'],[contenteditable]")) return;
    const gesture = { ...canvasPoint(e.clientX, e.clientY), timer: null as number | null, moved: false };
    gesture.timer = window.setTimeout(() => {
      suppressClickRef.current = true;
      select(track.id);
      setMenuOpen(true);
      navigator.vibrate?.(18);
    }, 550);
    gestureRef.current = gesture;
  };

  const movePhoneGesture = (e: React.PointerEvent<HTMLDivElement>) => {
    const gesture = gestureRef.current;
    if (!gesture) return;
    const gpt = canvasPoint(e.clientX, e.clientY);
    if (Math.hypot(gpt.x - gesture.x, gpt.y - gesture.y) > 12) {
      gesture.moved = true;
      if (gesture.timer) window.clearTimeout(gesture.timer);
      gesture.timer = null;
    }
  };

  const endPhoneGesture = (e: React.PointerEvent<HTMLDivElement>) => {
    const gesture = gestureRef.current;
    if (!gesture) return;
    if (gesture.timer) window.clearTimeout(gesture.timer);
    const ept = canvasPoint(e.clientX, e.clientY);
    const dx = ept.x - gesture.x;
    const dy = ept.y - gesture.y;
    gestureRef.current = null;
    if (Math.max(Math.abs(dx), Math.abs(dy)) < 52) return;
    suppressClickRef.current = true;
    select(track.id);
    if (Math.abs(dx) > Math.abs(dy)) {
      if (dx > 0) {
        updateTrack(track.id, { muted: !track.muted });
        toast(track.muted ? `${track.name} unmuted` : `${track.name} muted`);
      } else {
        updateTrack(track.id, { solo: !track.solo });
        toast(track.solo ? `${track.name} solo off` : `${track.name} soloed`);
      }
    } else {
      const direction: -1 | 1 = dy < 0 ? -1 : 1;
      moveTrack(track.id, direction);
      toast(`${track.name} moved ${direction < 0 ? "up" : "down"}`);
    }
    navigator.vibrate?.(12);
  };

  useEffect(() => () => {
    const timer = gestureRef.current?.timer;
    if (timer) window.clearTimeout(timer);
  }, []);

  /** Drag the strip under a lane to make that track taller or shorter. */
  const resizeHeight = (e: React.PointerEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const y0 = canvasPoint(e.clientX, e.clientY).y;
    const row = e.currentTarget.parentElement;
    if (!row) return;
    const h0 = canvasRect(row).height;
    let height = h0;
    const onMove = (ev: PointerEvent) => {
      height = Math.max(132, Math.min(600, h0 + canvasPoint(ev.clientX, ev.clientY).y - y0));
      row.style.height = `${height}px`;
    };
    const onUp = () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      window.removeEventListener("pointercancel", onUp);
      updateTrack(track.id, { height });
    };
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    window.addEventListener("pointercancel", onUp);
  };
  const resizeWidth = (e: React.PointerEvent) => {
    e.preventDefault(); e.stopPropagation();
    const x0 = canvasPoint(e.clientX, e.clientY).x;
    const move = (ev: PointerEvent) => setHeaderWidth(Math.max(220, Math.min(600, headerWidth + canvasPoint(ev.clientX, ev.clientY).x - x0)));
    const up = () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
      window.removeEventListener("pointercancel", up);
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
    window.addEventListener("pointercancel", up);
  };

  /** Touch reorder: drag the ⋮⋮ handle over another track and drop it there. */
  const startReorderDrag = (e: React.PointerEvent) => {
    if (e.pointerType === "mouse") return; // desktop keeps the HTML5 drag above
    e.preventDefault();
    e.stopPropagation();
    const from = index;
    const rowAt = (clientY: number) => {
      const rows = Array.from(document.querySelectorAll<HTMLElement>("[data-track-row]"));
      return rows.findIndex((row) => {
        const r = canvasRect(row);
        return clientY >= r.top && clientY < r.bottom;
      });
    };
    const move = (ev: PointerEvent) => {
      const target = rowAt(canvasPoint(ev.clientX, ev.clientY).y);
      document.querySelectorAll<HTMLElement>("[data-track-row]").forEach((row, i) => {
        row.classList.toggle("track-drop-target", i === target);
      });
    };
    const up = (ev: PointerEvent) => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
      window.removeEventListener("pointercancel", up);
      document.querySelectorAll<HTMLElement>(".track-drop-target").forEach((row) => row.classList.remove("track-drop-target"));
      const target = rowAt(canvasPoint(ev.clientX, ev.clientY).y);
      if (target < 0 || target === from) return;
      moveTrackToIndex(track.id, target);
      toast(`${track.name} moved to position ${target + 1}`);
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
    window.addEventListener("pointercancel", up);
  };

  return (
    <div className="border-b border-border/80">
    <div
      className={`relative flex items-stretch transition-colors ${isSelected ? "track-selected bg-foreground/10" : "hover:bg-surface/50"} ${track.hidden ? "opacity-40" : ""} ${dropping ? "ring-1 ring-primary ring-inset" : ""}`}
      data-track-row={track.id}
      style={{ height: Math.max(132, track.height ?? 140) }}
      onPointerDownCapture={(e) => {
        const target = e.target as HTMLElement;
        clipTapRef.current = target.closest(".arrangement-clip") && !target.closest("button,[role='slider'],[role='menu']")
          ? canvasPoint(e.clientX, e.clientY) : null;
      }}
      onPointerUpCapture={(e) => {
        const start = clipTapRef.current;
        clipTapRef.current = null;
        if (!start || editTool !== "select") return;
        const end = canvasPoint(e.clientX, e.clientY);
        if (Math.hypot(end.x - start.x, end.y - start.y) > 6) return;
        // Finish the existing part-selection handler before opening its editor/menu.
        window.setTimeout(selectForEditing, 0);
      }}
      onClick={(e) => {
        if (!e.currentTarget.contains(e.target as Node)) return;
        if (suppressClickRef.current) {
          suppressClickRef.current = false;
          return;
        }
        if (e.metaKey || e.ctrlKey) {
          toggleSelectId(track.id);
          return;
        }
        // Clicks from the track menu arrive through a portal; they act on their own and never jump to the piano roll.
        if (!e.currentTarget.contains(e.target as Node)) return;
        const target = e.target as HTMLElement;
        if (!target.closest("button,input,textarea,select,[role='slider'],[role='combobox'],[role='menuitem'],[role='menu'],[data-cut-tool]")) selectForEditing();
      }}
      onContextMenu={(e) => {
        e.preventDefault();
        select(track.id);
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
        className="track-touch-header relative min-w-0 w-[calc(var(--timeline-header-width)_-_4px)] shrink-0 space-y-1 border-r border-border bg-surface px-2 py-1.5"
        onPointerDown={startPhoneGesture}
        onPointerMove={movePhoneGesture}
        onPointerUp={endPhoneGesture}
        onPointerCancel={() => {
          const timer = gestureRef.current?.timer;
          if (timer) window.clearTimeout(timer);
          gestureRef.current = null;
        }}
        onContextMenu={(e) => isMobile && e.preventDefault()}
        onClick={(e) => {
          // Synth channels select the note editor; their instrument opens only by an explicit action.
          if (e.metaKey || e.ctrlKey) return;
          // Menu clicks bubble here through React portals (Clear track, Open instrument…) — they must never open the piano roll.
          if (!e.currentTarget.contains(e.target as Node)) return;
          const el = e.target as HTMLElement;
          if (el.closest("button,input,[role='slider'],[role='combobox'],[role='menuitem'],[role='menu']")) return;
          e.stopPropagation();
          selectForEditing();
        }}
      >
        <div className="flex min-w-0 items-center gap-1">
          <input
            type="checkbox"
            checked={isSelected}
            onClick={(e) => e.stopPropagation()}
            onChange={() => toggleSelectId(track.id)}
            title={`Select ${track.name}`}
            aria-label={`Select ${track.name}`}
            className="size-3.5 shrink-0 cursor-pointer accent-primary"
          />
          <span
            draggable
            onDragStart={(e) => {
              e.dataTransfer.setData("application/x-synclab-track", track.id);
              e.dataTransfer.effectAllowed = "move";
            }}
            onPointerDown={startReorderDrag}
            onClick={(e) => e.stopPropagation()}
            className="cursor-grab touch-none select-none px-0.5 text-muted-foreground hover:text-foreground active:cursor-grabbing"
            title="Drag to move this track above or below another track"
            aria-label={`Drag to reorder ${track.name}`}
          >⋮⋮</span>
          <TrackStylePicker track={track}>
            <button
              type="button"
              onClick={(e) => e.stopPropagation()}
              title={`${track.name} — pick colour and icon`}
              aria-label={`${track.name} colour and icon`}
              className="flex size-6 shrink-0 items-center justify-center rounded-md border transition-colors hover:bg-muted"
              style={{
                borderColor: `color-mix(in oklab, ${track.color} 60%, transparent)`,
                background: `color-mix(in oklab, ${track.color} 16%, transparent)`,
              }}
            >
              <TrackIcon track={track} className="size-5" />
            </button>
          </TrackStylePicker>
          {renaming && !isMobile ? (
            <Input
              autoFocus
              defaultValue={track.name}
              className="h-7 min-w-0 flex-1 text-xs"
              onBlur={(e) => {
                updateTrack(track.id, { name: e.target.value.toUpperCase() });
                setRenaming(false);
              }}
              onKeyDown={(e) => e.key === "Enter" && (e.target as HTMLInputElement).blur()}
            />
          ) : (
            <Button variant="ghost" className="h-6 min-w-0 flex-1 justify-start px-0 py-0 text-left font-display text-[11px] font-semibold" title={track.name} onClick={(e) => {
              e.stopPropagation();
              selectForEditing();
            }}>
              <span className="truncate">{index + 1}. {track.name}</span>
            </Button>
          )}
          {editorPanel && (
            <Button
              size="icon"
              variant="ghost"
              className="size-6 shrink-0 touch-manipulation"
              aria-label={editorLabel}
              title={editorLabel}
              onClick={(e) => { e.stopPropagation(); openTrackEditor(); }}
            >
              {track.kind === "drum" ? <Disc3 className="size-3.5" /> : track.kind === "sampler" ? <Music2 className="size-3.5" /> : track.kind === "ai-vocal" ? <Mic className="size-3.5" /> : <Sliders className="size-3.5" />}
            </Button>
          )}
          <TrackNotes track={track} className="ml-auto" />
          <DropdownMenu open={menuOpen} onOpenChange={setMenuOpen}>
            <DropdownMenuTrigger asChild>
              <Button size="icon" variant="ghost" className="channel-menu-trigger size-6 shrink-0 touch-manipulation" aria-label="Track menu" title={`${track.name} channel menu`} onPointerDown={(e) => e.stopPropagation()} onClick={(e) => e.stopPropagation()}>
                <MoreVertical className="size-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="timeline-channel-menu min-w-56">
              <DropdownMenuLabel>{track.name}</DropdownMenuLabel>
              <DropdownMenuItem onClick={() => {
                if (track.kind === "instrument" || track.kind === "midi") { select(track.id); setPanel("piano"); }
                else if (activeClip) { select(track.id); fileStudio.setActiveClip(track.id, activeClip.id); window.dispatchEvent(new CustomEvent("synclab:edit-clip", { detail: activeClip.id })); }
                else if (editorPanel) openTrackEditor();
                else openTrackSettings(track.id);
              }}><Pencil className="size-4" /> Edit</DropdownMenuItem>
              <DropdownMenuItem disabled={!hasFileSource || makingFile} onClick={() => void makeAudioFile(1)}><Download className="size-4" /> Make mono file (WAV)</DropdownMenuItem>
              <DropdownMenuItem disabled={!hasFileSource || makingFile} onClick={() => void makeAudioFile(2)}><Download className="size-4" /> Make stereo file (WAV)</DropdownMenuItem>
              <DropdownMenuItem onClick={() => activeClip ? copyClip(track.id, activeClip.id) : copyTrack(track.id)}><Copy className="size-4" /> Copy</DropdownMenuItem>
              <DropdownMenuItem onClick={() => activeClip ? cutClip(track.id, activeClip.id) : cutTrack(track.id)}><Scissors className="size-4" /> Cut</DropdownMenuItem>
              {pastePosition !== null && <DropdownMenuItem disabled={!hasClipboard} onClick={() => pasteAt(pastePosition)}><ClipboardPaste className="size-4" /> Paste here · {positionLabel(pastePosition)}</DropdownMenuItem>}
              <DropdownMenuItem disabled={!hasClipboard} onClick={() => pasteAt()}><ClipboardPaste className="size-4" /> Paste at playhead</DropdownMenuItem>
              <DropdownMenuItem disabled={!hasClipboard} onClick={() => {
                if (clipClipboardName) pasteClip(true, track.id);
                else pasteTrack(track.id, Math.ceil(materialEnd(track, stepSeconds(fileStudio.transport.bpm), fileStudio.transport.loop ? loopRegion(fileStudio.transport)[1] : songSteps(fileStudio.transport.bars))));
              }}><ClipboardPaste className="size-4" /> Paste at end</DropdownMenuItem>
              <DropdownMenuItem disabled={!selectedPartBounds(track, fileStudio.transport.bpm, fileStudio.transport.bars, fileStudio.transport.loop ? loopRegion(fileStudio.transport) : undefined)} onClick={() => {
                if (activeClip) fileStudio.removeClip(track.id, activeClip.id);
                else {
                  const patch = deleteSelectedPart(track, fileStudio.transport.bpm, fileStudio.transport.bars, fileStudio.transport.loop ? loopRegion(fileStudio.transport) : undefined);
                  if (patch) updateTrack(track.id, patch);
                }
              }}><Trash2 className="size-4" /> Delete selected part</DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={beginRename}>Rename</DropdownMenuItem>
              <EffectMenuItems effects={availableEffects(installedPlugins)} onAdd={def => { addPlugin(track.id, def); toast.success(`${def.name} added to ${track.name}`); }} />
              <DropdownMenuLabel className="text-[10px] text-muted-foreground">Audio file{makingFile ? " · creating…" : fileClip ? ` · ${fileClip.name}` : track.sampler ? " · sample" : " · select an audio clip"}</DropdownMenuLabel>
              {editorPanel === "synth" && (
                <DropdownMenuSub><DropdownMenuSubTrigger><Sliders className="size-4" /> Open instrument</DropdownMenuSubTrigger><DropdownMenuSubContent className="min-w-60">
                  <DropdownMenuLabel className="text-[10px] tracking-widest text-muted-foreground">CHOOSE A SYNTH FOR THIS TRACK</DropdownMenuLabel>
                  {SYNTH_CHOICES.map((s) => {
                    const current = synthStyleOf(track) === s.style;
                    return (
                      <DropdownMenuItem
                        key={s.style}
                        onClick={(e) => {
                          e.stopPropagation();
                          if (!current) {
                            // Load the chosen synth on this track; its notes stay, only the sound changes.
                            changeInstrument(track.id, s.preset);
                            updateTrack(track.id, { name: s.label.replace(/\s*\(.*\)$/, "").toUpperCase() });
                            toast.success(`${s.label} loaded on ${track.name}`, { description: "Your notes are kept — only the sound changed. Undo brings the old synth back." });
                          }
                          openTrackEditor(track.id);
                        }}
                      >
                        <Sliders className="size-4" /> {current ? `Open ${s.label}` : s.label}
                        {current && <span className="ml-auto font-mono text-[10px] text-primary">CURRENT</span>}
                      </DropdownMenuItem>
                    );
                  })}
                  {synthTracks.length > 1 && (
                    <>
                      <DropdownMenuSeparator />
                      <DropdownMenuLabel className="text-[10px] tracking-widest text-muted-foreground">OTHER SYNTH TRACKS</DropdownMenuLabel>
                      {synthTracks.filter((t) => t.id !== track.id).map((t) => (
                        <DropdownMenuItem key={t.id} onClick={(e) => { e.stopPropagation(); openTrackEditor(t.id); }}>
                          <Sliders className="size-4" /> {t.name} <span className="ml-auto font-mono text-[10px] text-muted-foreground">{SYNTH_CHOICES.find((s) => s.style === synthStyleOf(t))?.label}</span>
                        </DropdownMenuItem>
                      ))}
                    </>
                  )}
                </DropdownMenuSubContent></DropdownMenuSub>
              )}
              {editorPanel && editorPanel !== "synth" && (
                <DropdownMenuItem onClick={() => openTrackEditor()}>
                  {track.kind === "drum" ? <Disc3 className="size-4" /> : track.kind === "sampler" ? <Music2 className="size-4" /> : track.kind === "ai-vocal" ? <Mic className="size-4" /> : <Piano className="size-4" />}
                  {editorLabel}
                </DropdownMenuItem>
              )}
              <DropdownMenuItem onClick={() => duplicateTrack(track.id)}>
                <Copy className="size-4" /> Duplicate track
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => moveTrackToNew(track.id)}>
                <ArrowDownToLine className="size-4" /> Move to a new track
              </DropdownMenuItem>
              <DropdownMenuSub><DropdownMenuSubTrigger>Clip display</DropdownMenuSubTrigger><DropdownMenuSubContent>
                <DropdownMenuItem onClick={() => updateTrack(track.id, { clipView: undefined })}>
                  <span className="w-4">{!track.clipView ? "✓" : ""}</span>Automatic
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => updateTrack(track.id, { clipView: "wave" })}>
                  <Waves className="size-4" /> Waveform
                  {track.clipView === "wave" && <span className="ml-auto font-mono text-[10px] text-primary">✓</span>}
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => updateTrack(track.id, { clipView: "notes" })}>
                  <Music2 className="size-4" /> MIDI notes
                  {track.clipView === "notes" && <span className="ml-auto font-mono text-[10px] text-primary">✓</span>}
                </DropdownMenuItem>
              </DropdownMenuSubContent></DropdownMenuSub>
              <DropdownMenuSub><DropdownMenuSubTrigger>Clipboard &amp; arrange</DropdownMenuSubTrigger><DropdownMenuSubContent>
              <DropdownMenuItem onClick={() => cutTrack(track.id)}>
                <Scissors className="size-4" /> Cut track
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => copyTrack(track.id)}>
                <Copy className="size-4" /> Copy track
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => pasteTrack(track.id)}>
                <ClipboardPaste className="size-4" /> Paste track{clipboardName ? ` (${clipboardName})` : ""}
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => pasteTrack(track.id, Math.ceil(materialEnd(track, stepSeconds(fileStudio.transport.bpm), fileStudio.transport.loop ? loopRegion(fileStudio.transport)[1] : songSteps(fileStudio.transport.bars))))}>
                <ClipboardPaste className="size-4" /> Paste track at end
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => updateTrack(track.id, { frozen: !track.frozen })}>
                <Snowflake className="size-4" /> {track.frozen ? "Unfreeze" : "Freeze"}
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => updateTrack(track.id, { hidden: !track.hidden })}>
                {track.hidden ? <Eye className="size-4" /> : <EyeOff className="size-4" />}
                {track.hidden ? "Show" : "Hide"}
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => moveTrack(track.id, -1)}><ChevronUp className="size-4" /> Move up</DropdownMenuItem>
              <DropdownMenuItem onClick={() => moveTrack(track.id, 1)}><ChevronDown className="size-4" /> Move down</DropdownMenuItem>
              </DropdownMenuSubContent></DropdownMenuSub>
              <DropdownMenuItem onClick={() => { select(track.id); openTrackSettings(track.id); }}>
                <Settings2 className="size-4" /> Track settings
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuSub><DropdownMenuSubTrigger>VCA group{track.vca ? ` (${track.vca})` : ""}</DropdownMenuSubTrigger><DropdownMenuSubContent>
                <DropdownMenuItem onClick={() => updateTrack(track.id, { vca: undefined })}>{!track.vca ? "● " : ""}None</DropdownMenuItem>
                {(["A", "B", "C", "D"] as const).map((id) => (
                  <DropdownMenuItem key={id} onClick={() => updateTrack(track.id, { vca: id })}>{track.vca === id ? "● " : ""}VCA {id}</DropdownMenuItem>
                ))}
              </DropdownMenuSubContent></DropdownMenuSub>
              <DropdownMenuSub><DropdownMenuSubTrigger>Send to bus</DropdownMenuSubTrigger><DropdownMenuSubContent>
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
              </DropdownMenuSubContent></DropdownMenuSub>
              <DropdownMenuSub><DropdownMenuSubTrigger>MIDI channel{track.midiChannel ? ` (${track.midiChannel})` : ""}</DropdownMenuSubTrigger><DropdownMenuSubContent>
                <DropdownMenuItem onClick={() => updateTrack(track.id, { midiChannel: undefined })}>
                  <span className="w-4">{track.midiChannel == null ? "✓" : ""}</span>All channels
                </DropdownMenuItem>
                {Array.from({ length: 16 }, (_, i) => i + 1).map((ch) => (
                  <DropdownMenuItem key={ch} onClick={() => updateTrack(track.id, { midiChannel: ch })}>
                    <span className="w-4">{track.midiChannel === ch ? "✓" : ""}</span>Channel {ch}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuSubContent></DropdownMenuSub>
              <DropdownMenuSub><DropdownMenuSubTrigger>Octave{track.octave ? ` (${track.octave > 0 ? "+" : ""}${track.octave})` : ""}</DropdownMenuSubTrigger><DropdownMenuSubContent>
                {[-3, -2, -1, 0, 1, 2, 3].map((o) => (
                  <DropdownMenuItem key={o} onClick={() => updateTrack(track.id, { octave: o === 0 ? undefined : o })}>
                    <span className="w-4">{(track.octave ?? 0) === o ? "✓" : ""}</span>{o === 0 ? "None" : `${o > 0 ? "+" : ""}${o} octave${Math.abs(o) > 1 ? "s" : ""}`}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuSubContent></DropdownMenuSub>
              <DropdownMenuSub><DropdownMenuSubTrigger>Move to folder{track.folderId ? ` (${folders.find((f) => f.id === track.folderId)?.name ?? ""})` : ""}</DropdownMenuSubTrigger><DropdownMenuSubContent>
                <DropdownMenuItem onClick={() => assignTrackFolder(track.id, null)}>
                  <span className="w-4">{!track.folderId ? "✓" : ""}</span>No folder
                </DropdownMenuItem>
                {folders.map((f) => (
                  <DropdownMenuItem key={f.id} onClick={() => assignTrackFolder(track.id, f.id)}>
                    <span className="w-4">{track.folderId === f.id ? "✓" : ""}</span>
                    <span className="mr-1.5 inline-block size-2 rounded-full" style={{ background: f.color }} />
                    {f.name}
                  </DropdownMenuItem>
                ))}
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => assignTrackFolder(track.id, addFolder())}>
                  <Plus className="size-4" /> New folder with this track
                </DropdownMenuItem>
              </DropdownMenuSubContent></DropdownMenuSub>
              <DropdownMenuSeparator />
              {(
                <DropdownMenuSub><DropdownMenuSubTrigger>Automation</DropdownMenuSubTrigger><DropdownMenuSubContent>
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
                </DropdownMenuSubContent></DropdownMenuSub>
              )}
              <DropdownMenuSub><DropdownMenuSubTrigger>Clip &amp; note editing</DropdownMenuSubTrigger><DropdownMenuSubContent>
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
                  {activeClip.url && (
                    <DropdownMenuSub><DropdownMenuSubTrigger>Time-stretch (keep pitch)</DropdownMenuSubTrigger><DropdownMenuSubContent>
                      {(() => {
                        const stepDur = 60 / (transport.bpm || 120) / 4;
                        const cur = (activeClip.length ?? activeClip.duration) / clipRate(activeClip);
                        const barSec = stepDur * stepsPerBar();
                        const bars = Math.max(1, Math.round(cur / barSec));
                        return (
                          <DropdownMenuItem onClick={() => void stretchClip(track.id, activeClip.id, (bars * barSec) / cur)}>
                            Fit to {bars} bar{bars === 1 ? "" : "s"} at {transport.bpm} BPM
                          </DropdownMenuItem>
                        );
                      })()}
                      <DropdownMenuSeparator />
                      {[0.5, 0.75, 0.9, 1.1, 1.25, 1.5, 2].map((f) => (
                        <DropdownMenuItem key={f} onClick={() => void stretchClip(track.id, activeClip.id, f)}>
                          {f < 1 ? "Shorter" : "Longer"} — {Math.round(f * 100)}%
                        </DropdownMenuItem>
                      ))}
                    </DropdownMenuSubContent></DropdownMenuSub>
                  )}
                  <DropdownMenuSub><DropdownMenuSubTrigger>Takes ({(activeClip.alts?.length ?? 0) + 1})</DropdownMenuSubTrigger><DropdownMenuSubContent>
                    <DropdownMenuItem disabled><span className="w-4">✓</span>{activeClip.name} (playing)</DropdownMenuItem>
                    {(activeClip.alts ?? []).map((a, i) => (
                      <DropdownMenuItem key={a.id} onClick={() => swapTake(track.id, activeClip.id, i)}>
                        <span className="w-4" />{a.name}
                      </DropdownMenuItem>
                    ))}
                    {!activeClip.alts?.length && (
                      <DropdownMenuItem disabled>Record again over this clip to add takes</DropdownMenuItem>
                    )}
                  </DropdownMenuSubContent></DropdownMenuSub>
                  <DropdownMenuItem onClick={duplicateClip}>
                    <Copy className="size-4" /> Duplicate clip
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => activeClip && copyClip(track.id, activeClip.id)}>
                    <Copy className="size-4" /> Copy clip
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => activeClip && cutClip(track.id, activeClip.id)}>
                    <Scissors className="size-4" /> Cut clip
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => pasteClip(false, track.id)} disabled={!clipClipboardName}>
                    <ClipboardPaste className="size-4" /> Paste clip at playhead{clipClipboardName ? ` (${clipClipboardName})` : ""}
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => pasteClip(true, track.id)} disabled={!clipClipboardName}>
                    <ClipboardPaste className="size-4" /> Paste clip at end of track{clipClipboardName ? ` (${clipClipboardName})` : ""}
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
                        <Grid3x3 className="size-4" /> Quantize notes {GRID_OPTIONS().find((o) => o.value === (transport.quantize ?? 1))?.label ?? ""}
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

              </DropdownMenuSubContent></DropdownMenuSub>
              {track.patch && (
                <DropdownMenuSub><DropdownMenuSubTrigger>Swap instrument</DropdownMenuSubTrigger><DropdownMenuSubContent>
                  {INSTRUMENTS.flatMap((g) => g.items).map((name) => (
                    <DropdownMenuItem key={name} onClick={() => changeInstrument(track.id, name)}>
                      <Repeat className="size-4" /> {name}
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuSubContent></DropdownMenuSub>
              )}
              <DropdownMenuSeparator />
              <DropdownMenuItem
                disabled={(track.clips?.length ?? 0) === 0 && (track.notes?.length ?? 0) === 0 && !track.pads?.some((p) => p.steps.some((s) => s > 0))}
                onClick={(e) => { e.stopPropagation(); clearTrackContent(track.id); }}
                onSelect={(e) => e.stopPropagation()}
              >
                <Eraser className="size-4" /> Clear track contents
              </DropdownMenuItem>
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

        <div onClick={(e) => e.stopPropagation()} className={isMobile ? "timeline-track-actions flex max-w-full touch-pan-x items-center gap-1 overflow-x-auto overscroll-x-contain pb-1 [&>button]:h-12 [&>button]:shrink-0" : "flex items-center gap-1"}>
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
          {track.kind !== "ai-vocal" && (
            <Button
              size="sm"
              variant={track.recording || (track.armed && fileStudio.transport.recording) ? "destructive" : "ghost"}
              className={`h-6 px-2 text-[10px] ${isMobile ? "-order-2" : ""}`}
              aria-label={fileStudio.transport.recording || fileStudio.transport.countInLeft != null ? `Stop recording ${track.name}` : `Record on ${track.name}`}
              title="Record on this track: arms it, counts in, then records from the playhead. Press again (or STOP) to finish."
              onClick={() => {
                if (fileStudio.transport.recording || fileStudio.transport.countInLeft != null) {
                  fileStudio.toggleRecord();
                  return;
                }
                fileStudio.select(track.id);
                if (!track.armed) updateTrack(track.id, { armed: true });
                window.setTimeout(() => fileStudio.toggleRecord(), 60);
              }}
            >
              <Circle className="size-2.5 fill-current" /> REC
            </Button>
          )}
          {<DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                size="sm"
                variant={(track.automation?.length ?? 0) > 0 ? "secondary" : "ghost"}
                className={`h-7 gap-1 px-2 text-[9px] font-semibold sm:h-6 ${isMobile ? "-order-1" : ""}`}
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
          {isMobile && <TrackFxMenu track={track} />}
          {track.vca && <span className="ml-auto rounded-sm border border-primary/60 px-1 font-mono text-[9px] text-primary" title={`Volume also controlled by VCA ${track.vca} in the mixer`}>VCA {track.vca}</span>}
        </div>

        <div className="flex items-center gap-2">
          <span className="shrink-0 font-mono text-[9px] text-muted-foreground">{KIND_LABEL[track.kind]}</span>
          {!isMobile && <Select value={track.input} onValueChange={(v) => updateTrack(track.id, { input: v })}>
            <SelectTrigger className="h-7 min-w-0 flex-1 text-[11px]">
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
          {track.vca && <VcaLevel track={track} />}
        </div>

        <div role="separator" aria-label={`Resize ${track.name} channel width`} aria-orientation="vertical" aria-valuemin={220} aria-valuemax={600} aria-valuenow={headerWidth} tabIndex={0}
          className="timeline-width-handle absolute inset-y-0 right-0 z-50 w-2 cursor-ew-resize touch-none hover:bg-primary/40 focus-visible:bg-primary/40"
          title="Drag to resize channel width" onPointerDown={resizeWidth} onClick={(e) => e.stopPropagation()}
          onKeyDown={(e) => { if (e.key === "ArrowLeft" || e.key === "ArrowRight") { e.preventDefault(); e.stopPropagation(); setHeaderWidth(Math.max(220, Math.min(600, headerWidth + (e.key === "ArrowRight" ? 16 : -16)))); } }} />
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
          editTool === "draw"
            ? "cursor-crosshair"
            : editTool === "split"
              ? "cursor-none"
              : editTool === "razor"
                ? "cursor-none"
                : ""
        }`}
        style={{
          backgroundImage: laneGridBackground(transport.bars),
          // Clips, waveforms and notes take the track's own colour.
          "--clip-audio": track.color, "--color-clip-audio": track.color,
          "--clip-midi": track.color, "--color-clip-midi": track.color,
          "--clip-drum": track.color, "--color-clip-drum": track.color,
        } as CSSProperties}
        title={
          editTool === "draw"
            ? "Draw tool — click to write a note or drum hit"
            : editTool === "split"
              ? "Split tool — click a clip, wave or note to cut it there"
              : editTool === "razor"
                ? "Razor tool — click inside a clip, wave or note to slice it exactly where you click"
                : undefined
        }
        onClick={(e) => {
          if (editTool === "select") {
            if (!e.currentTarget.contains(e.target as Node)) return;
            e.stopPropagation();
            const rect = canvasRect(e.currentTarget);
            const point = canvasPoint(e.clientX, e.clientY);
            const grid = transport.snap ?? 1;
            const raw = Math.max(0, Math.min(1, (point.x - rect.left) / Math.max(1, rect.width))) * songSteps(transport.bars);
            select(track.id);
            setPastePosition(grid > 0 ? Math.round(raw / grid) * grid : raw);
            // With copied material, empty space chooses a paste destination even on synth channels.
            if (!hasClipboard && (track.kind === "instrument" || track.kind === "midi")) {
              setPanel("piano");
              window.setTimeout(() => window.dispatchEvent(new CustomEvent("synclab:selected-track-menu", { detail: track.id })), 0);
            } else setMenuOpen(true);
            return;
          }
          if (editTool === "split" || editTool === "razor") {
            e.stopPropagation();
            select(track.id);
          }
          const r = canvasRect(e.currentTarget);
          const tapPt = canvasPoint(e.clientX, e.clientY);
          const frac = Math.min(0.99, Math.max(0, (tapPt.x - r.left) / r.width));
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
          // Split and razor cut audio clips, recorded waves and written notes where the guide line sits —
          // exactly at the pointer when FREE (off grid), or on the snap grid when GRID is on (Alt flips it).
          const total = songSteps(transport.bars);
          const exact = Math.max(0, Math.min(1, (tapPt.x - r.left) / r.width));
          razorAt(track.id, cutPosition(exact, total, transport.snap ?? 1, e.altKey));
          return;
        }}
      >
        {transport.loop && (() => {
          const total = songSteps(transport.bars);
          const lo = transport.loopStart ?? 0;
          const hi = Math.max(lo + 1, transport.loopEnd ?? total);
          return (
            <div
              className="pointer-events-none absolute inset-y-0 z-0 border-x border-primary/25 bg-primary/[0.06]"
              style={{ left: `${(lo / total) * 100}%`, width: `${((hi - lo) / total) * 100}%` }}
            />
          );
        })()}
        <Lane track={track} />
        {(editTool === "split" || editTool === "razor") && <TimelineCutGuide
          tool={editTool}
          position={Math.min(0.99, Math.max(0, (transport.step ?? 0) / songSteps(transport.bars)))}
          selected={isSelected}
          total={songSteps(transport.bars)}
          grid={transport.snap ?? 1}
        />}
      </div>


      <div
        onPointerDown={resizeHeight}
        onClick={(e) => e.stopPropagation()}
        role="separator" aria-label={`Resize ${track.name} track height`} aria-orientation="horizontal" tabIndex={0}
        aria-valuemin={132} aria-valuemax={600} aria-valuenow={Math.max(132, track.height ?? 140)}
        onKeyDown={(e) => { if (e.key === "ArrowUp" || e.key === "ArrowDown") { e.preventDefault(); e.stopPropagation(); updateTrack(track.id, { height: Math.max(132, Math.min(600, (track.height ?? 140) + (e.key === "ArrowDown" ? 16 : -16))) }); } }}
        title="Drag to change this track's height"
        className="timeline-height-handle absolute inset-x-0 bottom-0 z-40 h-2 cursor-ns-resize touch-none hover:bg-primary/40 focus-visible:bg-primary/40"
      />

      {isMobile && <NameEditDialog open={renaming} title="Rename channel" label="Instrument / channel name" value={renameName}
        onChange={setRenameName} onClose={() => setRenaming(false)} onSave={() => {
          updateTrack(track.id, { name: renameName.trim().toUpperCase() }); setRenaming(false);
        }} />}
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

      {
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
      <div className="flex w-[calc(var(--timeline-header-width)_-_4px)] shrink-0 flex-wrap items-center gap-1 border-r border-border bg-surface/60 px-2 py-1">
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
        style={{ backgroundImage: laneGridBackground(transport.bars) }}
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

/** Grid values in steps (1 step = a 1/16 note). */
const GRID_OPTIONS = () => [
  { label: "1/32", value: 0.5 },
  { label: "1/16", value: 1 },
  { label: "1/8", value: 2 },
  { label: "1/4", value: 4 },
  { label: "1/2", value: 8 },
  { label: "BAR", value: stepsPerBar() },
];
const SNAP_OPTIONS = () => [{ label: "OFF", value: 0 }, ...GRID_OPTIONS().slice(1)];

/** Razor-blade tool icon (lucide stroke style) — distinct from the scissors. */
function RazorIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      <path d="M8 2h8l3 3v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V5z" />
      <path d="M10 2v3h4V2" />
      <path d="M12 10.5a2 2 0 0 0-2 2v1a2 2 0 0 0 4 0v-1a2 2 0 0 0-2-2z" />
    </svg>
  );
}

function EditToolbar() {
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

/** Density-aware measure numbering for the ruler: keeps bar labels readable
 *  past 100+ bars by numbering every Nth bar (snapped to 1/2/5/10/25/50/100)
 *  based on real pixels per bar, with ticks for the bars in between. */
function BarNumbering({ gridRef, bars }: { gridRef: React.RefObject<HTMLDivElement | null>; bars: number }) {
  const [gridW, setGridW] = useState(0);
  useEffect(() => {
    const el = gridRef.current;
    if (!el) return;
    const update = () => setGridW(el.clientWidth);
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, [gridRef]);

  const bpb = getBeatsPerBar();
  const beats = Math.max(1, bars) * bpb;
  const pxPerBar = gridW > 0 ? gridW / Math.max(1, bars) : 0;
  // ~56px keeps up to 5-digit numbers from colliding; snap to a musical step.
  const need = pxPerBar > 0 ? Math.ceil(56 / pxPerBar) : 1;
  const step = [1, 2, 5, 10, 25, 50, 100, 250, 500].find((s) => s >= need) ?? need;
  const showBeats = pxPerBar === 0 || pxPerBar >= 18;

  return (
    <div className="grid w-full" style={{ gridTemplateColumns: `repeat(${beats},minmax(0,1fr))` }}>
      {Array.from({ length: beats }).map((_, i) => {
        const isBar = i % bpb === 0;
        const bar = i / bpb;
        const labeled = isBar && bar % step === 0;
        return (
          <div
            key={i}
            className={`relative py-1 pl-[14px] font-mono leading-none ${labeled ? "text-[10px]" : "text-[9px]"}`}
          >
            {/* measure-bar tick: tall line on the bar, short line on each beat */}
            <span
              aria-hidden="true"
              className={`absolute bottom-0 left-0 w-px ${isBar ? "inset-y-0 bg-foreground/60" : "h-2.5 bg-foreground/35"}`}
            />
            {labeled ? (
              <span className="inline-block rounded-[2px] bg-surface-2/80 px-1 py-0.5 font-medium text-foreground/85">
                {bar + 1}
              </span>
            ) : isBar ? (
              <span className="text-muted-foreground/45">{pxPerBar >= 10 ? "·" : ""}</span>
            ) : (
              showBeats ? <span className="text-muted-foreground/25">·</span> : null
            )}
          </div>
        );
      })}
    </div>
  );
}

/**
 * Song length + export range. Shared by the desktop ruler menu and the phone
 * timeline tools menu, so the same controls exist on both layouts.
 */
function TimelineOptionsPanel() {
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
      step: transport.step % steps,
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

function Ruler() {
  const { transport, setTransport } = useStudio();
  const isMobile = useIsMobile();
  const gridRef = useRef<HTMLDivElement>(null);
  const bars = Math.max(1, transport.bars ?? 4);
  const total = bars * stepsPerBar();
  const lo = transport.loopStart ?? 0;
  const hi = Math.max(lo + 1, transport.loopEnd ?? total);
  const exportOn = transport.exportStart != null && transport.exportEnd != null;
  const exLo = exportOn ? Math.min(transport.exportStart!, transport.exportEnd! - 1) : 0;
  const exHi = exportOn ? Math.max(transport.exportEnd!, exLo + 1) : total;


  const stepFromX = (clientX: number, clientY: number) => {
    const el = gridRef.current;
    if (!el) return 0;
    const r = canvasRect(el);
    return Math.min(total, Math.max(0, Math.round(((canvasPoint(clientX, clientY).x - r.left) / r.width) * total)));
  };

  // Drag on empty ruler space to draw a loop region. A plain click (no drag)
  // leaves the existing region alone and just moves the playhead.
  const startDrag = (e: React.PointerEvent) => {
    if (e.button !== 0) return;
    e.preventDefault();
    const s = stepFromX(e.clientX, e.clientY);
    let moved = false;
    const move = (ev: PointerEvent) => {
      const end = stepFromX(ev.clientX, ev.clientY);
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
    const from = stepFromX(e.clientX, e.clientY);
    const len = hi - lo;
    const move = (ev: PointerEvent) => {
      const s = stepFromX(ev.clientX, ev.clientY);
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
      const s = stepFromX(ev.clientX, ev.clientY);
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
      <div className="relative z-20 flex w-[var(--timeline-header-width)] shrink-0 flex-col justify-center gap-1 border-r border-border bg-surface-2 px-2 py-1 sm:px-3" style={{ transform: "translateX(var(--timeline-scroll-x, 0px))" }}>
        <div className="flex items-center gap-2">
          <span className="font-display text-[11px] font-semibold tracking-[0.2em]">TIMELINE</span>
          <span className="label-xs ml-auto">
            {(transport.timebase ?? "bars") === "seconds"
              ? (() => { const t = transport.step * stepSeconds(transport.bpm); return `${Math.floor(t / 60)}:${(t % 60).toFixed(2).padStart(5, "0")}`; })()
              : positionLabel(transport.step)}
          </span>
        </div>
        <div className="flex items-center gap-1.5">
        {/* song length + export flags: menu on desktop, timeline tools menu on phones */}
        {(
          <Popover>
            <PopoverTrigger asChild>
              <button
                type="button"
                aria-label="Timeline options"
                title="Song length and export range"
                className="flex items-center gap-1 rounded-[3px] border border-border bg-background/70 px-1.5 py-0.5 font-mono text-[9px] uppercase tracking-wider text-muted-foreground hover:text-foreground"
              >
                <Settings2 className="size-3" /> {bars} {bars === 1 ? "bar" : "bars"}
                {exportOn && <Flag className="size-3 text-amber-300" />}
              </button>
            </PopoverTrigger>
            <PopoverContent align="start" className="w-60 space-y-3 p-3">
              <div className="label-xs">Timeline options</div>
              <TimelineOptionsPanel />
            </PopoverContent>
          </Popover>
        )}

        </div>
      </div>
      <div
        ref={gridRef}
        onPointerDown={startDrag}
        title="Drag on the ruler to set the loop region"
        className="relative flex flex-1 cursor-ew-resize select-none"
      >
        {/* one column per beat; every fourth column starts a new bar.
            Numbering is density-aware: once bars get narrow, only every Nth
            bar keeps a number (small ticks between) so labels never overlap. */}
        <BarNumbering gridRef={gridRef} bars={bars} />


        {/* dim outside the loop */}
        {transport.loop && (
          <>
            <div className="pointer-events-none absolute inset-y-0 left-0 bg-background/60" style={{ width: `${(lo / total) * 100}%` }} />
            <div className="pointer-events-none absolute inset-y-0 right-0 bg-background/60" style={{ width: `${((total - hi) / total) * 100}%` }} />
            {/* loop band — drag it to move the whole region */}
            <div
              onPointerDown={dragLoop("band")}
              aria-label="Move loop range"
              title={`Loop bar ${Math.floor(lo / stepsPerBar()) + 1} to ${Math.floor(hi / stepsPerBar()) + 1} — drag to move`}
              className="absolute inset-y-0 z-10 cursor-grab touch-none border-x-2 border-y border-primary bg-primary/35 active:cursor-grabbing"
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
                  title={`Loop ${which} — drag or use arrow keys (bar ${Math.floor(p / stepsPerBar()) + 1})`}
                  className="absolute top-0 z-20 flex h-full w-6 cursor-ew-resize touch-none flex-col items-center outline-none focus-visible:ring-1 focus-visible:ring-primary"
                  style={{ left: `calc(${(p / total) * 100}% - 12px)` }}
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
                  title={`Export ${which} — drag to move (bar ${Math.floor(p / stepsPerBar()) + 1})`}
                  className="absolute top-0 z-20 flex h-full w-5 cursor-ew-resize touch-none flex-col items-center"
                  style={{ left: `calc(${(p / total) * 100}% - 10px)` }}
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

        <div
          className="pointer-events-none absolute top-0 z-30 h-full"
          style={{ left: `${(transport.step / total) * 100}%` }}
        >
          {/* grab the line anywhere along the ruler to move the playhead */}
          <div
            role="slider"
            aria-label="Playhead — drag to move"
            aria-valuemin={0}
            aria-valuemax={total - 1}
            aria-valuenow={transport.step}
            tabIndex={0}
            className="playhead-grip pointer-events-auto absolute left-1/2 top-0 h-full w-6 -translate-x-1/2"
            title="Drag to move the playhead"
            onKeyDown={(e) => {
              const d = e.key === "ArrowLeft" ? -1 : e.key === "ArrowRight" ? 1 : 0;
              if (!d) return;
              e.preventDefault();
              setTransport({ step: Math.max(0, Math.min(total - 1, transport.step + d)) });
            }}
            onPointerDown={(e) => {
              e.preventDefault();
              e.stopPropagation();
              const move = (ev: PointerEvent) => setTransport({ step: Math.min(total - 1, stepFromX(ev.clientX, ev.clientY)) });
              const up = () => {
                window.removeEventListener("pointermove", move);
                window.removeEventListener("pointerup", up);
              };
              window.addEventListener("pointermove", move);
              window.addEventListener("pointerup", up);
            }}
          />
          <div
            className="playhead-head pointer-events-none absolute left-1/2 top-0 h-0 w-0 -translate-x-1/2 border-x-[7px] border-x-transparent"
            style={{ borderTopWidth: 10 }}
          />
          <div className="playhead-line pointer-events-none absolute bottom-0 left-1/2 top-2 w-[2px] -translate-x-1/2" />
        </div>
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
  }, [scrollRef, zoom, transport.bars]);

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
          className="playhead-line absolute inset-y-0 w-[2px]"
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

/** Collapsible folder header row grouping tracks, like Logic/FL track folders. */
function FolderRow({
  folder,
  count,
  onToggle,
  onRename,
  onUngroup,
}: {
  folder: TrackFolder;
  count: number;
  onToggle: () => void;
  onRename: (name: string) => void;
  onUngroup: () => void;
}) {
  const [renaming, setRenaming] = useState(false);
  const [draft, setDraft] = useState(folder.name);
  return (
    <div className="flex border-b border-border bg-surface-2/60">
      <div
        className="relative z-20 flex w-[var(--timeline-header-width)] shrink-0 items-center gap-1.5 border-r border-border px-2 py-1 sm:px-3"
        style={{ transform: "translateX(var(--timeline-scroll-x, 0px))" }}
      >
        <button
          type="button"
          onClick={onToggle}
          title={folder.collapsed ? `Open ${folder.name} (${count} tracks hidden)` : `Collapse ${folder.name}`}
          aria-label={folder.collapsed ? `Open folder ${folder.name}` : `Collapse folder ${folder.name}`}
          className="flex items-center gap-1.5 text-muted-foreground hover:text-foreground"
        >
          {folder.collapsed ? <Folder className="size-3.5" /> : <FolderOpen className="size-3.5" />}
          <ChevronDown className={`size-3 transition-transform ${folder.collapsed ? "-rotate-90" : ""}`} />
        </button>
        <span className="size-2 rounded-full" style={{ background: folder.color }} />
        {renaming ? (
          <input
            autoFocus
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onBlur={() => {
              onRename(draft);
              setRenaming(false);
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter") e.currentTarget.blur();
              if (e.key === "Escape") setRenaming(false);
            }}
            className="w-24 bg-transparent font-mono text-[10px] uppercase text-foreground outline-none"
          />
        ) : (
          <button
            type="button"
            onDoubleClick={() => {
              setDraft(folder.name);
              setRenaming(true);
            }}
            title="Double-click to rename this folder"
            className="truncate font-display text-[10px] font-semibold uppercase tracking-widest"
            style={{ color: folder.color }}
          >
            {folder.name}
          </button>
        )}
        <span className="font-mono text-[9px] text-muted-foreground">
          {count} track{count === 1 ? "" : "s"}
        </span>
        <button
          type="button"
          onClick={onUngroup}
          title="Ungroup — the tracks stay, the folder goes"
          className="ml-auto text-muted-foreground hover:text-destructive"
          aria-label={`Ungroup folder ${folder.name}`}
        >
          <X className="size-3" />
        </button>
      </div>
      <div className="flex-1" style={{ background: `color-mix(in oklab, ${folder.color} 8%, transparent)` }} />
    </div>
  );
}

export function Timeline({ phonePaged = false, desktopStyle = false, resizeHandlesVisible = true, pageScroll = false }: { phonePaged?: boolean; desktopStyle?: boolean; resizeHandlesVisible?: boolean; pageScroll?: boolean }) {
  const { tracks, transport, addTrack, addClip, setPanel, loadSample, folders, renameFolder, removeFolder, toggleFolderCollapsed, setTransport, moveTrackToIndex, selectBoxed } = useStudio();
  // Shift/Ctrl + mouse drag over the lanes boxes clips across channels
  const [clipBox, setClipBox] = useState<{ x0: number; y0: number; x1: number; y1: number } | null>(null);
  const clipBoxRef = useRef<{ x: number; y: number; add: boolean; active: boolean } | null>(null);
  const onBoxDown = (e: React.PointerEvent) => {
    if (e.pointerType !== "mouse" || e.button !== 0 || !(e.shiftKey || e.ctrlKey || e.metaKey)) return;
    const target = e.target as HTMLElement;
    if (!target.closest("[data-lane]") || target.closest("button,input,[role='slider']")) return;
    // Shift on a clip stays the fine-drag modifier; Ctrl/Cmd boxes from anywhere
    if (!(e.ctrlKey || e.metaKey) && target.closest(".arrangement-clip")) return;
    e.preventDefault();
    e.stopPropagation();
    clipBoxRef.current = { x: e.clientX, y: e.clientY, add: true, active: false };
    const move = (ev: PointerEvent) => {
      const b = clipBoxRef.current;
      if (!b) return;
      if (!b.active && Math.hypot(ev.clientX - b.x, ev.clientY - b.y) < 5) return;
      b.active = true;
      setClipBox({ x0: Math.min(b.x, ev.clientX), y0: Math.min(b.y, ev.clientY), x1: Math.max(b.x, ev.clientX), y1: Math.max(b.y, ev.clientY) });
    };
    const up = (ev: PointerEvent) => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
      const b = clipBoxRef.current;
      clipBoxRef.current = null;
      setClipBox(null);
      if (!b?.active) return;
      const box = { l: Math.min(b.x, ev.clientX), r: Math.max(b.x, ev.clientX), t: Math.min(b.y, ev.clientY), btm: Math.max(b.y, ev.clientY) };
      const hit = (r: DOMRect) => r.left < box.r && r.right > box.l && r.top < box.btm && r.bottom > box.t;
      const picks: { trackId: string; clipId?: string }[] = [];
      for (const lane of document.querySelectorAll<HTMLElement>("[data-lane-track]")) {
        if (!hit(lane.getBoundingClientRect())) continue;
        const clip = [...lane.querySelectorAll<HTMLElement>("[data-audio-clip]")].find((c) => hit(c.getBoundingClientRect()));
        const content = clip || [...lane.querySelectorAll<HTMLElement>(".arrangement-clip")].find((c) => hit(c.getBoundingClientRect()));
        if (!content) continue;
        const trackId = lane.dataset["laneTrack"];
        const clipId = clip?.dataset["audioClip"];
        if (trackId) picks.push(clipId ? { trackId, clipId } : { trackId });
      }
      selectBoxed(picks, b.add);
      // swallow the click that follows the drag so it doesn't toggle a channel
      const swallow = (ce: MouseEvent) => { ce.stopPropagation(); ce.preventDefault(); };
      window.addEventListener("click", swallow, { capture: true, once: true });
      window.setTimeout(() => window.removeEventListener("click", swallow, { capture: true }), 50);
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
  };
  const phone = useIsLandscapePhone();
  const totalSteps = songSteps(transport.bars);
  const [over, setOver] = useState(false);
  const [zoom, setZoom] = useState(1);
  const [headerWidth, setHeaderWidth] = useState(294);
  const widthLoaded = useRef(false);
  useEffect(() => {
    try { const saved = Number(localStorage.getItem("synclab.timeline.headerWidth")); if (saved >= 220 && saved <= 600) setHeaderWidth(saved); } catch { /* storage unavailable */ }
    widthLoaded.current = true;
  }, []);
  useEffect(() => { if (widthLoaded.current) { try { localStorage.setItem("synclab.timeline.headerWidth", String(headerWidth)); } catch { /* storage unavailable */ } } }, [headerWidth]);
  const scrollRef = useRef<HTMLDivElement>(null);
  const timelineHeaderRef = useRef<HTMLDivElement>(null);
  const rowsRef = useRef<HTMLDivElement>(null);
  const shownTracks = tracks;

  // Grabbing the white playhead line inside the track lanes moves song position.
  const stepFromRowsX = (clientX: number, clientY: number) => {
    const el = rowsRef.current;
    if (!el) return transport.step;
    const r = canvasRect(el);
    const headerW = parseFloat(getComputedStyle(el).getPropertyValue("--timeline-header-width")) || 0;
    const lane = Math.max(1, r.width - headerW);
    return Math.min(totalSteps - 1, Math.max(0, Math.round(((canvasPoint(clientX, clientY).x - r.left - headerW) / lane) * totalSteps)));
  };
  const dragSongPlayhead = (e: React.PointerEvent) => {
    if (e.pointerType === "mouse" && e.button !== 0) return;
    e.preventDefault();
    e.stopPropagation();
    setTransport({ step: stepFromRowsX(e.clientX, e.clientY) });
    const move = (ev: PointerEvent) => setTransport({ step: stepFromRowsX(ev.clientX, ev.clientY) });
    const up = () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
  };

  // The ruler and song parts live above the vertically scrolling tracks, but
  // must share their horizontal coordinate system when the overview pans.
  useEffect(() => {
    const viewport = scrollRef.current;
    const header = timelineHeaderRef.current;
    const arrangement = viewport?.firstElementChild;
    if (!viewport || !header || !(arrangement instanceof HTMLElement)) return;
    const sync = () => {
      // Use the layout width, not the rotated phone canvas's screen-space height.
      header.style.width = `${arrangement.offsetWidth}px`;
      header.style.transform = `translateX(${-viewport.scrollLeft}px)`;
      header.style.setProperty("--timeline-scroll-x", `${viewport.scrollLeft}px`);
    };
    sync();
    viewport.addEventListener("scroll", sync, { passive: true });
    const observer = new ResizeObserver(sync);
    observer.observe(viewport);
    observer.observe(arrangement);
    return () => {
      viewport.removeEventListener("scroll", sync);
      observer.disconnect();
    };
  }, [zoom]);

  // keeps the playhead in view while the song plays, when FOLLOW is on
  useEffect(() => {
    if ((!transport.follow && !(phone && transport.recording)) || !transport.playing) return;
    const el = scrollRef.current;
    if (!el || el.scrollWidth <= el.clientWidth) return;
    const left = recordingFollowScroll(transport.step, totalSteps, el.scrollWidth, headerWidth, el.clientWidth, el.scrollLeft);
    if (left !== el.scrollLeft) el.scrollTo({ left, behavior: "instant" });
  }, [transport.follow, transport.playing, transport.recording, transport.step, totalSteps, phone, headerWidth]);
  return (
    <section data-desktop-style={desktopStyle} data-page-scroll={pageScroll} data-resize-handles={resizeHandlesVisible} style={{ "--timeline-header-width": `${headerWidth}px` } as CSSProperties} className={`arrangement-timeline mobile-timeline relative flex min-w-0 flex-col border-x border-b border-border bg-background/60 ${pageScroll ? "" : "min-h-[210px] flex-1 overflow-hidden"}`}>
      <WorkflowBar />
      {phonePaged ? <div className="phone-timeline-heading grid h-14 shrink-0 grid-cols-[minmax(0,1fr)_auto] items-center gap-2 border-b border-border bg-surface/50 px-3"><TrackSearch /><div className="flex gap-1"><Popover><PopoverTrigger asChild><Button variant="outline" className="h-12 gap-1.5 px-3 font-display text-xs font-semibold tracking-wide" aria-label="Timeline quick tools"><Settings2 className="size-4" /> TOOLS</Button></PopoverTrigger><PopoverContent className="phone-edit-menu flex h-[min(80dvh,440px)] w-[min(90vw,720px)] flex-col overflow-hidden p-0"><div className="shrink-0 border-b border-border px-3 py-2.5 font-display text-sm font-semibold">Timeline tools</div><PhonePages name="Timeline tools"><div className="p-1"><h3 className="px-2 pb-1 pt-1 font-mono text-[10px] uppercase tracking-widest text-muted-foreground">Song length &amp; export</h3><div className="px-2 pb-2"><TimelineOptionsPanel /></div><h3 className="px-2 pb-1 pt-1 font-mono text-[10px] uppercase tracking-widest text-muted-foreground">Edit &amp; arrange</h3><EditToolbar /><h3 className="border-t border-border px-2 pb-1 pt-2 font-mono text-[10px] uppercase tracking-widest text-muted-foreground">Song parts</h3><SectionLane /></div></PhonePages></PopoverContent></Popover><AddTrackMenu size="sm" /></div></div> : <EditToolbar />}
      <div className="shrink-0 overflow-hidden">
        <div ref={timelineHeaderRef} className="min-w-[720px] sm:min-w-0">
          <Ruler />
          {!phonePaged && <SectionLane />}
        </div>
      </div>
      {clipBox && <div aria-hidden className="pointer-events-none fixed z-50 border border-primary bg-primary/15" style={{ left: clipBox.x0, top: clipBox.y0, width: clipBox.x1 - clipBox.x0, height: clipBox.y1 - clipBox.y0 }} />}
      <div id="timeline-scroll" ref={scrollRef} onPointerDownCapture={onBoxDown} aria-label="Horizontal timeline" className={`relative overflow-auto overscroll-x-contain ${pageScroll ? "" : "min-h-0 flex-1"}`}>
        <div className="min-w-[720px]" style={{ width: `max(${zoom * 100}%, ${transport.bars * (phone ? 96 * zoom : 32) + headerWidth}px)` }}>
        {/* SYNCLAB watermark, low and centred in the empty workspace */}
        <div className="pointer-events-none sticky top-[68%] z-0 h-0" aria-hidden="true">
          <img
            src={synclabLogo}
            alt=""
            className="absolute left-1/2 top-0 w-[min(360px,38%)] -translate-x-[calc(50%-147px)] -translate-y-1/2 select-none opacity-[0.06]"
          />
        </div>
        <div ref={rowsRef} className="relative" data-timeline-track-rows>
        {shownTracks.map((t) => {
          const i = tracks.indexOf(t);
          const folder = t.folderId ? folders.find((f) => f.id === t.folderId) : undefined;
          const firstInFolder = folder && !tracks.slice(0, i).some((x) => x.folderId === folder.id);
          if (folder?.collapsed && !firstInFolder) return null;
          return (
            <Fragment key={t.id}>
              {firstInFolder && folder && (
                <FolderRow
                  folder={folder}
                  count={tracks.filter((x) => x.folderId === folder.id).length}
                  onToggle={() => toggleFolderCollapsed(folder.id)}
                  onRename={(name) => renameFolder(folder.id, name)}
                  onUngroup={() => removeFolder(folder.id)}
                />
              )}
              {!folder?.collapsed && <TrackRow track={t} index={i} headerWidth={headerWidth} setHeaderWidth={setHeaderWidth} />}
            </Fragment>
          );
        })}
        <div
          className="pointer-events-none absolute inset-y-0 z-30 -translate-x-1/2"
          style={{ left: `calc(var(--timeline-header-width) + (100% - var(--timeline-header-width)) * ${(transport.step % totalSteps) / totalSteps})` }}
        >
          <div
            data-timeline-playhead
            className="playhead-line absolute inset-y-0 left-1/2 w-[2px] -translate-x-1/2"
            aria-hidden="true"
          />
          <div
            data-playhead-drag
            role="slider"
            aria-label="Playhead — drag to move"
            aria-valuemin={0}
            aria-valuemax={totalSteps - 1}
            aria-valuenow={transport.step % totalSteps}
            tabIndex={0}
            title="Drag to move the playhead"
            className="playhead-grip pointer-events-auto absolute inset-y-0 left-1/2 w-5 -translate-x-1/2"
            onPointerDown={dragSongPlayhead}
            onKeyDown={(e) => {
              const d = e.key === "ArrowLeft" ? -1 : e.key === "ArrowRight" ? 1 : 0;
              if (!d) return;
              e.preventDefault();
              setTransport({ step: Math.max(0, Math.min(totalSteps - 1, (transport.step % totalSteps) + d)) });
            }}
          />
        </div>
        </div>
        <div data-new-channel-drop className="min-h-28 transition-colors">
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
            const movedId = e.dataTransfer.getData("application/x-synclab-track");
            if (movedId) {
              e.preventDefault();
              moveTrackToIndex(movedId, Math.max(0, tracks.length - 1));
              toast(`Track moved to position ${tracks.length}`);
              return;
            }
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
            if (payload.type === "localfile") {
              void clipFromLocalFile(payload.id, transport.step)
                .then((clip) => {
                  const id = addTrack("audio", clip.name);
                  if (id) addClip(id, clip);
                  toast.success(`${payload.name} on the timeline`, { description: "Placed on a new audio track at the playhead" });
                })
                .catch((err) => toast.error("Could not read that audio file", { description: err instanceof Error ? err.message : undefined }));
              return;
            }
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
        </div>

        {transport.exportStart != null && transport.exportEnd != null && (
          <div
            className="pointer-events-none absolute inset-y-0 border-x border-amber-400/30 bg-amber-400/[0.05]"
            style={{
              left: `calc(var(--timeline-header-width) + (100% - var(--timeline-header-width)) * ${Math.min(transport.exportStart, transport.exportEnd - 1) / totalSteps})`,
              width: `calc((100% - var(--timeline-header-width)) * ${(Math.max(transport.exportEnd, transport.exportStart + 1) - Math.min(transport.exportStart, transport.exportEnd - 1)) / totalSteps})`,
            }}
          />
        )}
        </div>
      </div>
      {!phonePaged && <TimelineOverview scrollRef={scrollRef} zoom={zoom} setZoom={setZoom} />}
    </section>
  );
}

/** Phone timeline: add effects and EQ to this channel from the track header. */
function TrackFxMenu({ track }: { track: Track }) {
  const { addPlugin, removePlugin, togglePluginBypass, setPluginParam, installedPlugins } = useStudio();
  const eq = track.plugins?.find((p) => p.kind === "eq");
  const count = track.plugins?.length ?? 0;
  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          title={`Effects and EQ for ${track.name}`}
          className={`flex h-12 shrink-0 items-center gap-1 rounded-sm border px-3 font-mono text-[10px] uppercase tracking-wider ${
            count > 0 ? "border-primary/60 bg-primary/15 text-primary" : "border-border bg-surface text-foreground"
          }`}
        >
          FX
          {count > 0 && (
            <span className="min-w-3 rounded-sm bg-primary px-0.5 text-center text-[8px] text-primary-foreground">{count}</span>
          )}
        </button>
      </PopoverTrigger>
      <PopoverContent
        align="start"
        className="max-h-[70vh] w-[min(92vw,360px)] overflow-y-auto p-3"
        onInteractOutside={(e) => { if ((e.target as HTMLElement | null)?.closest?.("[role=dialog]")) e.preventDefault(); }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-2 flex items-center justify-between gap-2">
          <span className="truncate font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
            {track.name} — effects & EQ
          </span>
          <button
            type="button"
            disabled={!!eq}
            title={eq ? `${track.name} already has a Channel EQ` : `Add a 3-band EQ to ${track.name}`}
            onClick={() => {
              const def = installedPlugins.find((d) => d.kind === "eq") ?? BUILT_IN_PLUGINS.find((d) => d.kind === "eq");
              if (def) addPlugin(track.id, def);
            }}
            className={`shrink-0 rounded-sm border px-2 py-1 font-mono text-[9px] uppercase tracking-wider disabled:opacity-70 ${
              eq ? "border-primary/60 text-primary" : "border-border text-foreground hover:text-primary"
            }`}
          >
            {eq ? "EQ on" : "+ EQ"}
          </button>
        </div>
        <InsertRack
          title={`${track.name} — inserts`}
          midiId={track.id}
          list={track.plugins ?? []}
          onAdd={(def) => addPlugin(track.id, def)}
          onRemove={(id) => removePlugin(track.id, id)}
          onBypass={(id) => togglePluginBypass(track.id, id)}
          onParam={(id, p, v) => setPluginParam(track.id, id, p, v)}
        />
      </PopoverContent>
    </Popover>
  );
}

/** Selecting a clip/part pops up this small menu instead of a permanent delete button. */
function PartMenu({ label, onDelete }: { label: string; onDelete: () => void }) {
  const anchor = useRef<HTMLSpanElement>(null);
  const menu = useRef<HTMLDivElement>(null);
  const [position, setPosition] = useState<{ left: number; top: number } | null>(null);
  useEffect(() => {
    const clip = anchor.current?.closest(".arrangement-clip");
    if (!clip) return;
    const open = () => {
      const rect = clip.getBoundingClientRect();
      setPosition({ left: Math.max(4, Math.min(window.innerWidth - 100, rect.left + 4)), top: Math.max(4, Math.min(window.innerHeight - 48, rect.top + 20)) });
    };
    open();
    clip.addEventListener("click", open);
    const dismiss = (event: PointerEvent) => {
      if (event.target instanceof Node && menu.current?.contains(event.target)) return;
      setPosition(null);
    };
    const close = () => setPosition(null);
    window.addEventListener("pointerdown", dismiss, true);
    window.addEventListener("scroll", close, true);
    return () => { clip.removeEventListener("click", open); window.removeEventListener("pointerdown", dismiss, true); window.removeEventListener("scroll", close, true); };
  }, []);
  return <>
    <span ref={anchor} />
    {position && createPortal(<div ref={menu} role="menu" aria-label={`${label} actions`}
      style={position}
      className="fixed z-50 flex flex-col rounded-md border border-border bg-popover p-0.5 text-popover-foreground shadow-lg"
      onPointerDown={(e) => e.stopPropagation()} onClick={(e) => e.stopPropagation()}>
      <Button type="button" role="menuitem" variant="ghost" size="sm" onClick={() => { setPosition(null); onDelete(); }}
        className="gap-1.5 font-mono text-[10px] font-semibold hover:bg-destructive hover:text-destructive-foreground">
        <Trash2 className="size-3" /> Delete
      </Button>
    </div>, document.body)}
  </>;
}
