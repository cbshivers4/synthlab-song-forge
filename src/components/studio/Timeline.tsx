import { TimelineVScrollbar } from "./timeline/VScrollbar";
import { getPlayStep, subscribePlayStep } from "@/lib/synclab/playhead";
import { Fragment, useEffect, useRef, useState, type CSSProperties } from "react";
import { songSteps } from "@/lib/synclab/timebase";
import { useIsLandscapePhone } from "@/hooks/use-mobile";
import { PhonePages } from "./PhonePages";
import { WorkflowBar } from "./WorkflowBar";
import { recordingFollowScroll } from "@/lib/synclab/recording-display";
import { Settings2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { toast } from "sonner";
import { clipFromLocalFile } from "@/lib/synclab/local-files";
import { SectionLane } from "./SectionLane";
import { useStudio } from "@/lib/synclab/store";
import { AddTrackMenu } from "@/components/studio/AddTrackMenu";
import { TrackSearch } from "@/components/studio/TrackSearch";
import type { Track } from "@/lib/synclab/types";
import { canvasPoint, canvasRect } from "@/lib/synclab/canvas-point";
import { EditToolbar, TimelineOptionsPanel } from "./timeline/EditToolbar";
import { Ruler, SongPlayhead, TimelineOverview } from "./timeline/Ruler";
import { FolderRow, TrackRow } from "./timeline/TrackRow";
import { readDrag, synclabLogo } from "./timeline/shared";
import { zoomAround } from "./timeline/drop-position";

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
  // Arrangement zoom is remembered on this device.
  const zoomLoaded = useRef(false);
  useEffect(() => {
    try { const z = Number(localStorage.getItem("synclab.timeline.zoom")); if (z >= 1 && z <= 8) setZoom(z); } catch { /* storage unavailable */ }
    zoomLoaded.current = true;
  }, []);
  useEffect(() => {
    if (!zoomLoaded.current) return;
    try { localStorage.setItem("synclab.timeline.zoom", String(zoom)); } catch { /* storage unavailable */ }
  }, [zoom]);
  const zoomRef = useRef(zoom);
  zoomRef.current = zoom;
  // Ctrl/Cmd + wheel (and trackpad pinch, which arrives as Ctrl + wheel) zooms around the pointer,
  // keeping the bar under the mouse in place. Plain wheel still scrolls.
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      if (!e.ctrlKey && !e.metaKey) return;
      e.preventDefault();
      const next = zoomAround(zoomRef.current, e.deltaY);
      if (next === zoomRef.current) return;
      const rect = el.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const frac = (el.scrollLeft + x) / Math.max(1, el.scrollWidth);
      setZoom(next);
      requestAnimationFrame(() => { el.scrollLeft = frac * el.scrollWidth - x; });
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, []);
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
    if (!el) return getPlayStep();
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
    const follow = () => {
      const el = scrollRef.current;
      if (!el || el.scrollWidth <= el.clientWidth) return;
      const left = recordingFollowScroll(getPlayStep(), totalSteps, el.scrollWidth, headerWidth, el.clientWidth, el.scrollLeft);
      if (left !== el.scrollLeft) el.scrollTo({ left, behavior: "instant" });
    };
    follow();
    return subscribePlayStep(follow);
  }, [transport.follow, transport.playing, transport.recording, totalSteps, phone, headerWidth]);
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
        <SongPlayhead totalSteps={totalSteps} onDragStart={dragSongPlayhead} onMove={(step) => setTransport({ step })} />
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
              void clipFromLocalFile(payload.id, getPlayStep())
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
      {phone && <TimelineVScrollbar scrollRef={scrollRef} />}
    </section>
  );
}
