import type { CSSProperties } from "react";
import { getPlayStep, usePlayStep } from "@/lib/synclab/playhead";
import { deleteSelectedPart } from '@/lib/synclab/workflow';
import { boundedRegions, loopRegion } from "@/lib/synclab/recording-region";
import { timelineUsesWaveform } from "@/lib/synclab/timeline-content";
import { drumPartRoom, moveDrumPart, rightEdgeEdit, stretchDrumPart, trimDrumPart } from "@/lib/synclab/arrangement-edit";
import { useEffect, useRef, useState } from "react";
import { stepsPerBar, songSteps, stepSeconds } from "@/lib/synclab/timebase";
import { notesInRegion, regionsOf, deleteRegion, moveNoteRegion, regionRoom, trimNoteRegion, unrollNotes } from "@/lib/synclab/note-cuts";
import { Copy, Disc3, Piano } from "lucide-react";
import { toast } from "sonner";
import { useStudio } from "@/lib/synclab/store";
import { uid } from "@/lib/synclab/presets";
import type { Track } from "@/lib/synclab/types";
import { WaveformView } from "@/components/studio/WaveformView";
import { ClipEditor } from "@/components/studio/ClipEditor";
import { clipRate, clipSeconds } from "@/lib/synclab/types";
import { canvasPoint, canvasRect } from "@/lib/synclab/canvas-point";
import { DrumHitWave, EMPTY_PEAKS, NOTE_NAMES, PartMenu } from "./shared";

/** Audio lane: every clip sits at its own bar position and can be moved, trimmed and dragged between tracks. */
export function Waveform({ track }: { track: Track }) {
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
            style={{ left: `${left}%`, width: `max(0px, calc(${width}% - 2px))`, ...(clip.color ? { "--clip-audio": clip.color, "--color-clip-audio": clip.color } : {}) } as CSSProperties}
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
                    clips: [...clips, { ...clip, id: uid(), name: `${clip.name} COPY`, start: start + steps }],
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
  /** Notes and cut marks as parts: a looping pattern is written out across the song first. */
  const asParts = () => {
    const unrolled = cuts.length === 0 && patLen < total;
    return { notes: unrolled ? unrollNotes(notes, patLen, total) : notes, extra: unrolled ? { steps: total } : {} };
  };
  const snapDelta = (raw: number) => {
    const grid = transport.snap ?? 1;
    return grid > 0 ? Math.round(raw / grid) * grid : Math.round(raw * 100) / 100;
  };
  /** Drag one part (between cut marks) along the timeline: only its notes move. */
  const beginRegionDrag = (e: React.PointerEvent, a: number, b: number) => {
    e.stopPropagation();
    if (e.button !== 0) return;
    e.preventDefault();
    const el = e.currentTarget as HTMLElement;
    const lane = el.closest("[data-lane]") as HTMLElement | null;
    if (!lane) return;
    const perStep = canvasRect(lane).width / Math.max(1, total);
    const x0 = canvasPoint(e.clientX, e.clientY).x;
    const [lo, hi] = regionRoom(notes, cuts, total, [a, b]);
    let d = 0;
    try { el.setPointerCapture(e.pointerId); } catch { /* released */ }
    const onMove = (ev: PointerEvent) => {
      d = Math.max(lo - a, Math.min(hi - b, snapDelta((canvasPoint(ev.clientX, ev.clientY).x - x0) / Math.max(0.0001, perStep))));
      el.style.transform = `translateX(${d * perStep}px)`;
    };
    const onUp = () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      window.removeEventListener("pointercancel", onUp);
      el.style.transform = "";
      if (Math.abs(d) < 0.001) return;
      const r = moveNoteRegion(track.notes ?? [], track.cuts, total, [a, b], d);
      updateTrack(track.id, { notes: r.notes, cuts: r.cuts, activeRegion: r.activeRegion });
    };
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    window.addEventListener("pointercancel", onUp);
  };
  /** Pull a part's left or right edge: trims notes off (Undo restores them) or opens empty room. */
  const beginRegionTrim = (e: React.PointerEvent, a: number, b: number, side: "left" | "right") => {
    e.stopPropagation();
    if (e.button !== 0) return;
    e.preventDefault();
    const handle = e.currentTarget as HTMLElement;
    const block = handle.parentElement;
    const lane = handle.closest("[data-lane]") as HTMLElement | null;
    if (!lane || !block) return;
    const perStep = canvasRect(lane).width / Math.max(1, total);
    const x0 = canvasPoint(e.clientX, e.clientY).x;
    const parts = asParts();
    const [lo, hi] = regionRoom(parts.notes, cuts.length ? cuts : undefined, total, [a, b]);
    let na = a, nb = b;
    const style0 = { left: block.style.left, width: block.style.width };
    try { handle.setPointerCapture(e.pointerId); } catch { /* released */ }
    const onMove = (ev: PointerEvent) => {
      const d = snapDelta((canvasPoint(ev.clientX, ev.clientY).x - x0) / Math.max(0.0001, perStep));
      if (side === "left") na = Math.max(lo, Math.min(b - 0.25, a + d));
      else nb = Math.min(hi, Math.max(a + 0.25, b + d));
      block.style.left = `${(na / total) * 100}%`;
      block.style.width = `calc(${((nb - na) / total) * 100}% - 1px)`;
    };
    const onUp = () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      window.removeEventListener("pointercancel", onUp);
      block.style.left = style0.left;
      block.style.width = style0.width;
      if (Math.abs(na - a) < 0.001 && Math.abs(nb - b) < 0.001) return;
      const r = trimNoteRegion(parts.notes, cuts.length ? cuts : [a, b].filter((c) => c > 0 && c < total), total, [a, b], na, nb);
      updateTrack(track.id, { ...parts.extra, notes: r.notes, cuts: r.cuts, activeRegion: r.activeRegion });
    };
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    window.addEventListener("pointercancel", onUp);
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
        // A part between cut marks moves on its own; an uncut pattern moves as a whole.
        if (cuts.length > 0) beginRegionDrag(e, a, b);
        else beginPatternDrag(e);
      }}
      onClick={(e) => e.stopPropagation()}
      onDoubleClick={() => { select(track.id); setPanel("piano"); }}
      title={`${track.name} — drag to move, pull the edges to trim, double-click to edit notes`}
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
      <div onPointerDown={(e) => beginRegionTrim(e, a, b, "left")} onClick={(e) => e.stopPropagation()}
        role="slider" aria-label={`Trim start of ${track.name} part`} aria-valuenow={a} aria-valuemin={0} aria-valuemax={total}
        title="Drag to trim or extend the start of this part"
        className="arrangement-trim arrangement-trim-left absolute inset-y-0 left-0 z-30 w-3 cursor-ew-resize touch-none" />
      <div onPointerDown={(e) => beginRegionTrim(e, a, b, "right")} onClick={(e) => e.stopPropagation()}
        role="slider" aria-label={`Trim end of ${track.name} part`} aria-valuenow={b} aria-valuemin={0} aria-valuemax={total}
        title="Drag to trim or extend the end of this part"
        className="arrangement-trim arrangement-trim-right absolute inset-y-0 right-0 z-30 w-3 cursor-ew-resize touch-none" />
    </div>;
  })}</>;

}

/** Shows the track's level after its VCA so moving the VCA fader is visible on the track. */
export function VcaLevel({ track }: { track: Track }) {
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
  /** Pull a beat part's left edge (or Alt + right edge) to trim it: hits keep their places, trimmed hits are removed. */
  const beginPartTrim = (e: React.PointerEvent, a: number, b: number, side: "left" | "right") => {
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
    const [lo, hi] = drumPartRoom(track, boundedRegions(regionsOf(cuts, total), bounds), a, b, total);
    let na = a, nb = b;
    const style0 = { left: block.style.left, width: block.style.width };
    try { handle.setPointerCapture(e.pointerId); } catch { /* released */ }
    const onMove = (ev: PointerEvent) => {
      const d = Math.round((canvasPoint(ev.clientX, ev.clientY).x - x0) / Math.max(0.0001, perStep) / grid) * grid;
      if (side === "left") na = Math.max(lo, Math.min(b - 1, a + d));
      else nb = Math.min(hi, Math.max(a + 1, b + d));
      block.style.left = `${(na / total) * 100}%`;
      block.style.width = `calc(${((nb - na) / total) * 100}% - 1px)`;
    };
    const onUp = () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      window.removeEventListener("pointercancel", onUp);
      block.style.left = style0.left;
      block.style.width = style0.width;
      if (na === a && nb === b) return;
      updateTrack(track.id, trimDrumPart(track, a, b, na, nb));
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
          title={`${track.name} beat part — drag to move, pull the left edge to trim, the right edge to stretch (Alt + right edge trims), double-click to open the drum machine`}>
          <div className="arrangement-clip-name flex h-[17px] shrink-0 items-center gap-1 px-1.5">
            <Disc3 className="size-2.5 shrink-0" />
            <span className="min-w-0 flex-1 truncate font-mono text-[9px] font-semibold">{track.name} · {hits} HITS</span>

          </div>
          {active && <PartMenu label={`${track.name} beat part`} onDelete={() => { const patch = deleteSelectedPart(track, transport.bpm, transport.bars, transport.loop ? loopRegion(transport) : undefined); if (patch) updateTrack(track.id, patch);
                toast.success("Beat part deleted"); }} />}
          <div className="relative min-h-0 flex-1"><DrumHitWave pads={part} steps={hi - lo} total={hi - lo} tone="text-[var(--arrangement-ink)]" /></div>
          <div
            onPointerDown={(e) => beginPartTrim(e, a, b, "left")}
            onClick={(e) => e.stopPropagation()}
            role="slider" aria-label={`Trim start of ${track.name} beat part`} aria-valuenow={a} aria-valuemin={0}
            title="Drag to trim or extend the start of this beat part"
            className="arrangement-trim arrangement-trim-left absolute inset-y-0 left-0 z-30 w-3 cursor-ew-resize touch-none"
          />
          <div
            onPointerDown={(e) => (e.altKey ? beginPartTrim(e, a, b, "right") : beginPartStretch(e, a, b))}
            onClick={(e) => e.stopPropagation()}
            role="slider" aria-label={`Stretch ${track.name} beat part`} aria-valuenow={b - a} aria-valuemin={1}
            title="Drag to stretch this beat part — its hits spread out to fill the new length. Hold Alt while dragging to trim instead."
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
  const liveStep = usePlayStep();
  const startRef = useRef(getPlayStep());
  const start = startRef.current;
  const now = liveStep;
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

export function Lane({ track }: { track: Track }) {
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
