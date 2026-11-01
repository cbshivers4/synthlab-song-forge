import { getPlayStep } from "@/lib/synclab/playhead";
import { deleteSelectedPart, selectedPartBounds } from '@/lib/synclab/workflow';
import { loopRegion } from "@/lib/synclab/recording-region";
import { materialEnd } from "@/lib/synclab/arrangement-edit";
import { useEffect, useRef, useState, type CSSProperties } from "react";
import { stepsPerBar, songSteps, stepSeconds, positionLabel } from "@/lib/synclab/timebase";
import { useIsMobile } from "@/hooks/use-mobile";
import { NameEditDialog } from "../NameEditDialog";
import { ArrowDownToLine, ArrowLeftToLine, ArrowRightToLine, ClipboardPaste, Grid3x3, Sliders, Pencil, Scissors, Waves, ChevronDown, ChevronUp, Copy, Disc3, Download, Eraser, Eye, EyeOff, Headphones, Mic, MoreVertical, Repeat, Music2, Piano, Settings2, Snowflake, Trash2, Volume2, VolumeX, X, Circle, Plus, Folder, FolderOpen } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Slider } from "@/components/ui/slider";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuSub, DropdownMenuSubContent, DropdownMenuSubTrigger, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { clipFromFile, clipFromLocalFile } from "@/lib/synclab/local-files";
import { snapDropStep } from "./drop-position";
import { openTrackSettings } from "@/components/studio/TrackSettingsDialog";
import { InsertRack } from "../mixer/InsertRack";
import { EffectMenuItems } from "../EffectPicker";
import { availableEffects } from "@/lib/synclab/effect-catalog";
import { BUILT_IN_PLUGINS } from "@/lib/synclab/plugins";
import { useStudio } from "@/lib/synclab/store";
import { useApp } from "@/lib/synclab/app-state";
import { INSTRUMENTS, KIND_LABEL, uid } from "@/lib/synclab/presets";
import type { PanelId } from "@/lib/synclab/store";
import type { AutomationParam, MidiNote, Track, TrackFolder } from "@/lib/synclab/types";
import { LevelBar } from "@/components/studio/LevelBar";
import { clipRate } from "@/lib/synclab/types";
import { canvasPoint, canvasRect } from "@/lib/synclab/canvas-point";
import { getEngine } from "@/lib/synclab/audio-engine";
import { downloadBlob, encodeWav } from "@/lib/synclab/bounce";
import { freshCloudUrl } from "@/lib/synclab/cloud";
import { TrackIcon, TrackStylePicker } from "@/components/studio/TrackStyle";
import { TrackNotes } from "@/components/studio/TrackNotes";
import { AutomationRow } from "./AutomationRow";
import { Lane, VcaLevel, Waveform } from "./clips";
import { GRID_OPTIONS, INPUTS, SYNTH_CHOICES, TRACK_BUSES, TimelineCutGuide, cutPosition, laneGridBackground, laneLabel, readDrag, synthStyleOf } from "./shared";

export function TrackRow({ track, index, headerWidth, setHeaderWidth }: { track: Track; index: number; headerWidth: number; setHeaderWidth: (width: number) => void }) {
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
  // Read when the action runs, so the track row doesn't re-render on every playback step.
  const playFracNow = () => Math.min(0.98, Math.max(0.02, (getPlayStep() % 16) / 16));

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
    splitClipAt(track.id, playFracNow());
  };

  const trimClip = (side: "left" | "right") => {
    if (!activeClip) return;
    const playFrac = playFracNow();
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


  /** Song step under a drop on this row's lane (snapped to the grid); the playhead when dropped on the header. */
  const dropStep = (e: React.DragEvent) => {
    const lane = (e.currentTarget as HTMLElement).querySelector<HTMLElement>("[data-lane]");
    if (!lane) return getPlayStep();
    const rect = canvasRect(lane);
    const x = canvasPoint(e.clientX, e.clientY).x;
    if (x < rect.left || x > rect.right) return getPlayStep();
    return snapDropStep((x - rect.left) / Math.max(1, rect.width), songSteps(transport.bars), transport.snap ?? 1);
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
        // Audio files land as waveform clips exactly where they're dropped (snapped to the grid):
        // on this audio channel, or on a new audio channel when dropped on an instrument/drum lane.
        const at = dropStep(e);
        void (async () => {
          try {
            const clip = await clipFromFile(file, at);
            if (track.kind === "audio" || track.kind === "ai-vocal") {
              fileStudio.addClip(track.id, clip);
              select(track.id);
            } else {
              const id = fileStudio.addTrack("audio", clip.name);
              if (id) fileStudio.addClip(id, clip);
            }
            toast.success(`${file.name} on the timeline`, { description: `${track.kind === "audio" || track.kind === "ai-vocal" ? `On ${track.name}` : "On a new audio track"} at ${positionLabel(at)}` });
          } catch (err) {
            toast.error("Could not read that audio file", { description: err instanceof Error ? err.message : undefined });
          }
        })();
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
          const clip = await clipFromLocalFile(payload.id, dropStep(e));
          if (track.kind === "audio") {
            fileStudio.addClip(track.id, clip);
            select(track.id);
          } else {
            const id = fileStudio.addTrack("audio", clip.name);
            if (id) fileStudio.addClip(id, clip);
          }
          toast.success(`${payload.name} on the timeline`, { description: track.kind === "audio" ? `Added to ${track.name} where you dropped it` : "Placed on a new audio track where you dropped it" });
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
              return;
            }
            // Single tap opens the track menu; a second tap within 300 ms opens the drum roll / editor instead.
            if (tapTimerRef.current !== null) {
              window.clearTimeout(tapTimerRef.current);
              tapTimerRef.current = null;
              setMenuOpen(false);
              openRoll();
              return;
            }
            tapTimerRef.current = window.setTimeout(() => { tapTimerRef.current = null; setMenuOpen(true); }, 300);
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

/** Collapsible folder header row grouping tracks, like Logic/FL track folders. */
export function FolderRow({
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
