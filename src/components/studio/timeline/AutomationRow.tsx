import { getPlayStep } from "@/lib/synclab/playhead";
import { useRef, useState } from "react";
import { songSteps } from "@/lib/synclab/timebase";
import { deleteRegion } from "@/lib/synclab/note-cuts";
import { ClipboardPaste, Copy, Eraser, Lock, LockOpen, Redo2, Repeat, Undo2, Trash2, X } from "lucide-react";
import { Lane } from "./clips";
import { laneGridBackground, laneLabel } from "./shared";

let automationClipboard: { duration: number; points: AutomationPoint[] } | null = null;
import { WaveformView } from "@/components/studio/WaveformView";

/** One automation lane under a track: click to add a point, drag points, double-click to remove. */
export function AutomationRow({ track, lane }: { track: Track; lane: AutomationLane }) {
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
    const origin = snapStep(getPlayStep());
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
