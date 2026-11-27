import { TimelineVScrollbar } from "./timeline/VScrollbar";
import { TimelineHScrollbar } from "./timeline/HScrollbar";
import { HEADER_WIDTH, clampHeaderWidth } from "./timeline/header-width";
import { getPlayStep, subscribePlayStep } from "@/lib/synclab/playhead";
import { Fragment, useCallback, useEffect, useRef, useState, type CSSProperties } from "react";
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
import { mergePaintSelection, paintTrackRange } from "@/lib/synclab/track-paint";
import { EditToolbar, TimelineOptionsPanel } from "./timeline/EditToolbar";
import { Ruler, SongPlayhead, TimelineOverview } from "./timeline/Ruler";
import { FolderRow, TrackRow } from "./timeline/TrackRow";
import { SelectionMenu } from "./timeline/SelectionMenu";
import { readDrag, synclabLogo } from "./timeline/shared";
import { zoomAround } from "./timeline/drop-position";
import { useColorPrefs } from "@/lib/synclab/color-prefs";

/** A plain (no modifier) mouse drag draws the selection box only from empty space: an empty part of a
 *  lane with the Select tool, or the empty area under the last track — never from a block, a control or
 *  the channel-name column, which keep their own drags. */
function boxStartsPlain(target: HTMLElement, editTool: string): boolean {
  if (editTool !== "select") return false;
  if (
    target.closest(
      "button,input,textarea,select,a,[role='slider'],[role='menu'],[role='menuitem'],[role='separator'],[draggable='true'],[contenteditable]",
    )
  )
    return false;
  if (target.closest(".arrangement-clip,[data-audio-clip]")) return false;
  return Boolean(target.closest("[data-lane]") || target.closest("[data-new-channel-drop]"));
}

/** A press on the lane of one of the picked tracks (blocks included), but not on its controls. */
function pressOnPickedLane(target: HTMLElement, picked: string[]): boolean {
  if (
    target.closest(
      "button,input,textarea,select,a,[role='slider'],[role='menu'],[role='menuitem'],[role='separator'],[contenteditable],[data-trim-handle]",
    )
  )
    return false;
  const id = target.closest<HTMLElement>("[data-lane-track]")?.dataset["laneTrack"];
  return Boolean(id && picked.includes(id));
}

/** Pop-ups and the menu bar act on the timeline selection, so pressing them must not clear it. */
const KEEP_SELECTION =
  "[data-radix-popper-content-wrapper],[role='menu'],[role='menubar'],[role='dialog'],[role='alertdialog'],[role='listbox'],[data-sonner-toaster],.app-menu,[data-keep-timeline-selection]";

export function Timeline({
  phonePaged = false,
  desktopStyle = false,
  resizeHandlesVisible = true,
  pageScroll = false,
  compactPhone = false,
}: {
  phonePaged?: boolean;
  desktopStyle?: boolean;
  resizeHandlesVisible?: boolean;
  pageScroll?: boolean;
  compactPhone?: boolean;
}) {
  const {
    tracks,
    transport,
    addTrack,
    addClip,
    setPanel,
    loadSample,
    folders,
    renameFolder,
    removeFolder,
    toggleFolderCollapsed,
    setTransport,
    moveTrackToIndex,
    selectBoxed,
    clearTimelineSelection,
    selectedIds,
    paintSelectIds,
    editTool,
  } = useStudio();
  // Pop-up with Copy / Cut / Paste where a selection ends (box drag, name drag, or a press on picked tracks).
  const [selMenu, setSelMenu] = useState<{ x: number; y: number } | null>(null);
  const closeSelMenu = useCallback(() => setSelMenu(null), []);
  const logoPrefs = useColorPrefs();
  // Mouse drag a box over the lanes to highlight blocks across channels (Studio Pro style):
  // a plain drag starts on empty lane space or the empty area under the tracks and replaces the
  // highlight; Shift/Ctrl/⌘ add to it, and Ctrl/⌘ may start on a block too.
  const [clipBox, setClipBox] = useState<{ x0: number; y0: number; x1: number; y1: number } | null>(
    null,
  );
  const clipBoxRef = useRef<{
    x: number;
    y: number;
    add: boolean;
    active: boolean;
    menu?: boolean;
  } | null>(null);
  const onBoxDown = (e: React.PointerEvent) => {
    if (e.pointerType !== "mouse") return;
    const target = e.target as HTMLElement;
    const modifier = e.shiftKey || e.ctrlKey || e.metaKey;
    // With several tracks picked, pressing on one of their blocks/lanes keeps the group: a click opens the
    // selection menu instead of collapsing to that one channel; a drag draws a new box.
    const onPicked =
      !modifier &&
      editTool === "select" &&
      selectedIds.length > 1 &&
      pressOnPickedLane(target, selectedIds);
    if (onPicked && e.button === 2) {
      e.stopPropagation();
      return;
    }
    if (e.button !== 0) return;
    const plain = onPicked || boxStartsPlain(target, editTool);
    if (!plain && !modifier) return;
    if (onPicked) e.stopPropagation();
    if (!plain) {
      if (!target.closest("[data-lane]") || target.closest("button,input,[role='slider']")) return;
      // Shift on a clip stays the fine-drag modifier; Ctrl/Cmd boxes from anywhere
      if (!(e.ctrlKey || e.metaKey) && target.closest(".arrangement-clip")) return;
      e.preventDefault();
      e.stopPropagation();
    }
    const sc = scrollRef.current;
    // Start point is kept in scrolled-content terms so the box stays anchored while the tracks scroll.
    clipBoxRef.current = {
      x: e.clientX + (sc?.scrollLeft ?? 0),
      y: e.clientY + (sc?.scrollTop ?? 0),
      add: modifier,
      active: false,
      menu: onPicked,
    };
    let last = { x: e.clientX, y: e.clientY };
    let raf = 0;
    const draw = () => {
      const b = clipBoxRef.current;
      if (!b || !b.active) return;
      const sx = b.x - (sc?.scrollLeft ?? 0),
        sy = b.y - (sc?.scrollTop ?? 0);
      setClipBox({
        x0: Math.min(sx, last.x),
        y0: Math.min(sy, last.y),
        x1: Math.max(sx, last.x),
        y1: Math.max(sy, last.y),
      });
    };
    // Near the top/bottom (or left/right) edge of the tracks, keep scrolling while the box is held there.
    const edgeScroll = () => {
      raf = 0;
      const b = clipBoxRef.current;
      if (!b?.active || !sc) return;
      const r = sc.getBoundingClientRect();
      const EDGE = 48;
      const speed = (d: number) => Math.ceil(((EDGE - Math.max(0, d)) / EDGE) * 18);
      let dy = 0,
        dx = 0;
      if (last.y < r.top + EDGE) dy = -speed(last.y - r.top);
      else if (last.y > r.bottom - EDGE) dy = speed(r.bottom - last.y);
      if (last.x > r.right - EDGE) dx = speed(r.right - last.x);
      else if (last.x < r.left + headerWidth + EDGE && sc.scrollLeft > 0)
        dx = -speed(last.x - r.left - headerWidth);
      if (!dx && !dy) return;
      const before = [sc.scrollLeft, sc.scrollTop];
      sc.scrollBy(dx, dy);
      if (sc.scrollLeft === before[0] && sc.scrollTop === before[1]) return;
      draw();
      raf = requestAnimationFrame(edgeScroll);
    };
    const move = (ev: PointerEvent) => {
      const b = clipBoxRef.current;
      if (!b) return;
      last = { x: ev.clientX, y: ev.clientY };
      if (
        !b.active &&
        Math.hypot(
          ev.clientX + (sc?.scrollLeft ?? 0) - b.x,
          ev.clientY + (sc?.scrollTop ?? 0) - b.y,
        ) < 5
      )
        return;
      if (!b.active) document.body.style.userSelect = "none";
      b.active = true;
      draw();
      if (!raf) raf = requestAnimationFrame(edgeScroll);
    };
    const up = (ev: PointerEvent) => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
      window.removeEventListener("pointercancel", up);
      if (raf) cancelAnimationFrame(raf);
      const b0 = clipBoxRef.current;
      clipBoxRef.current = null;
      setClipBox(null);
      const swallowClick = () => {
        const swallow = (ce: MouseEvent) => {
          ce.stopPropagation();
          ce.preventDefault();
        };
        window.addEventListener("click", swallow, { capture: true, once: true });
        window.setTimeout(
          () => window.removeEventListener("click", swallow, { capture: true }),
          50,
        );
      };
      if (!b0?.active) {
        // A plain click on picked tracks: keep them and offer Copy / Cut / Paste right there.
        if (b0?.menu) {
          swallowClick();
          setSelMenu({ x: ev.clientX, y: ev.clientY });
        }
        return;
      }
      document.body.style.userSelect = "";
      const b = { ...b0, x: b0.x - (sc?.scrollLeft ?? 0), y: b0.y - (sc?.scrollTop ?? 0) };
      const box = {
        l: Math.min(b.x, ev.clientX),
        r: Math.max(b.x, ev.clientX),
        t: Math.min(b.y, ev.clientY),
        btm: Math.max(b.y, ev.clientY),
      };
      const hit = (r: DOMRect) =>
        r.left < box.r && r.right > box.l && r.top < box.btm && r.bottom > box.t;
      const picks: { trackId: string; clipId?: string; span?: [number, number] }[] = [];
      for (const lane of document.querySelectorAll<HTMLElement>("[data-lane-track]")) {
        if (!hit(lane.getBoundingClientRect())) continue;
        const clip = [...lane.querySelectorAll<HTMLElement>("[data-audio-clip]")].find((c) =>
          hit(c.getBoundingClientRect()),
        );
        // Every block the box touches on this channel: Copy/Cut take exactly those bars, nothing more.
        const blocks = [...lane.querySelectorAll<HTMLElement>(".arrangement-clip")].filter((c) =>
          hit(c.getBoundingClientRect()),
        );
        if (!clip && !blocks.length) continue;
        const trackId = lane.dataset["laneTrack"];
        const clipId = clip?.dataset["audioClip"];
        const edges = blocks.flatMap((c) => {
          const a = Number(c.dataset["partStart"]),
            z = Number(c.dataset["partEnd"]);
          return c.dataset["partStart"] != null && Number.isFinite(a) && Number.isFinite(z) && z > a
            ? [[a, z] as const]
            : [];
        });
        const span: [number, number] | undefined = edges.length
          ? [Math.min(...edges.map((e) => e[0])), Math.max(...edges.map((e) => e[1]))]
          : undefined;
        if (trackId)
          picks.push({ trackId, ...(clipId ? { clipId } : {}), ...(span ? { span } : {}) });
      }
      // A plain box starts a fresh highlight, like a DAW; modifiers add to what's picked.
      if (!b.add) clearTimelineSelection();
      selectBoxed(picks, b.add);
      if (picks.length) setSelMenu({ x: ev.clientX, y: ev.clientY });
      // swallow the click that follows the drag so it doesn't toggle a channel
      swallowClick();
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
    window.addEventListener("pointercancel", up);
  };
  // A press anywhere outside the timeline drops its highlighted clips/parts. Menus, dialogs and the
  // menu bar are excluded so Edit → Cut/Delete still act on the selection they were opened for.
  const sectionRef = useRef<HTMLElement>(null);
  const clearRef = useRef(clearTimelineSelection);
  clearRef.current = clearTimelineSelection;
  useEffect(() => {
    const onDown = (e: PointerEvent) => {
      const target = e.target;
      const section = sectionRef.current;
      if (!(target instanceof Element) || !section) return;
      if (target === document.documentElement || target === document.body) {
        // An open menu blocks the page, so the press lands on <body>: judge it by where it was.
        const r = section.getBoundingClientRect();
        if (
          e.clientX >= r.left &&
          e.clientX <= r.right &&
          e.clientY >= r.top &&
          e.clientY <= r.bottom
        )
          return;
        clearRef.current();
        return;
      }
      if (section.contains(target)) return;
      if (target.closest(KEEP_SELECTION)) return;
      clearRef.current();
    };
    window.addEventListener("pointerdown", onDown, true);
    return () => window.removeEventListener("pointerdown", onDown, true);
  }, []);
  const phone = useIsLandscapePhone();
  const totalSteps = songSteps(transport.bars);
  const [over, setOver] = useState(false);
  const [zoom, setZoom] = useState(1);
  // Arrangement zoom is remembered on this device.
  const zoomLoaded = useRef(false);
  useEffect(() => {
    try {
      const z = Number(localStorage.getItem("synclab.timeline.zoom"));
      if (z >= 1 && z <= 8) setZoom(z);
    } catch {
      /* storage unavailable */
    }
    zoomLoaded.current = true;
  }, []);
  useEffect(() => {
    if (!zoomLoaded.current) return;
    try {
      localStorage.setItem("synclab.timeline.zoom", String(zoom));
    } catch {
      /* storage unavailable */
    }
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
      requestAnimationFrame(() => {
        el.scrollLeft = frac * el.scrollWidth - x;
      });
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, []);
  // Track-name column width: remembered on this device, separately for phone and desktop.
  const widthPrefs = phone ? HEADER_WIDTH.phone : HEADER_WIDTH.desktop;
  const [headerWidth, setHeaderWidthRaw] = useState<number>(HEADER_WIDTH.desktop.initial);
  const setHeaderWidth = (width: number) => setHeaderWidthRaw(clampHeaderWidth(width, phone));
  const widthKey = useRef<string | null>(null);
  useEffect(() => {
    let width: number = widthPrefs.initial;
    try {
      const saved = Number(localStorage.getItem(widthPrefs.key));
      if (saved >= widthPrefs.min && saved <= widthPrefs.max) width = saved;
    } catch {
      /* storage unavailable */
    }
    widthKey.current = null;
    setHeaderWidthRaw(width);
  }, [widthPrefs]);
  useEffect(() => {
    // Skip the pass that just loaded the saved width.
    if (widthKey.current !== widthPrefs.key) {
      widthKey.current = widthPrefs.key;
      return;
    }
    try {
      localStorage.setItem(widthPrefs.key, String(headerWidth));
    } catch {
      /* storage unavailable */
    }
  }, [headerWidth, widthPrefs]);
  const scrollRef = useRef<HTMLDivElement>(null);
  const timelineHeaderRef = useRef<HTMLDivElement>(null);
  const rowsRef = useRef<HTMLDivElement>(null);
  const shownTracks = tracks;

  // Press in the channel-name column and drag: every channel you pass over is highlighted,
  // so COPY / CUT / PASTE take that whole group. A native capture listener is used because
  // channel-name buttons (colour picker, rename) stop pointer events before React sees them.
  const paintRef = useRef<{
    anchor: string;
    base: string[];
    add: boolean;
    x: number;
    y: number;
    moved: boolean;
  } | null>(null);
  const paintStateRef = useRef({ selectedIds, paintSelectIds });
  paintStateRef.current = { selectedIds, paintSelectIds };
  useEffect(() => {
    const el = rowsRef.current;
    if (!el) return;
    const rows = () => Array.from(el.querySelectorAll<HTMLElement>("[data-track-row]"));
    const rowAt = (clientX: number, clientY: number) => {
      const pt = canvasPoint(clientX, clientY);
      return rows().find((r) => {
        const rect = canvasRect(r);
        return pt.y >= rect.top && pt.y < rect.bottom;
      });
    };
    const onDown = (e: PointerEvent) => {
      if (e.pointerType !== "mouse" || e.button !== 0) return;
      const target = e.target as HTMLElement;
      // The rename box, sliders and the ⋮⋮ reorder handle keep their own pointer use; the tick box may start a drag.
      if (
        target.closest(
          "input:not([type='checkbox']),[draggable='true'],[role='slider'],[role='combobox'],[contenteditable]",
        )
      )
        return;
      const row = rowAt(e.clientX, e.clientY);
      if (!row) return;
      const anchor = row.dataset["trackRow"];
      if (!anchor) return;
      // Only from the channel-name column: drags in the lanes keep their own meaning.
      const headerW =
        parseFloat(getComputedStyle(el).getPropertyValue("--timeline-header-width")) || 0;
      const pt = canvasPoint(e.clientX, e.clientY);
      if (headerW > 0 && pt.x > canvasRect(row).left + Math.max(24, headerW - 6)) return;
      const { selectedIds: current, paintSelectIds: paint } = paintStateRef.current;
      const add = e.ctrlKey || e.metaKey || e.shiftKey;
      const ids = rows()
        .map((r) => r.dataset["trackRow"])
        .filter((id): id is string => Boolean(id));
      paintRef.current = {
        anchor,
        base: add ? current : [],
        add,
        x: e.clientX,
        y: e.clientY,
        moved: false,
      };
      let lastPaint = { x: e.clientX, y: e.clientY };
      document.body.style.userSelect = "none";
      const move = (ev: PointerEvent) => {
        const p = paintRef.current;
        if (!p) return;
        if (!p.moved && Math.hypot(ev.clientX - p.x, ev.clientY - p.y) < 5) return;
        const overId = rowAt(ev.clientX, ev.clientY)?.dataset["trackRow"];
        if (!overId) return;
        const run = paintTrackRange(ids, p.anchor, overId);
        if (!run.length) return;
        p.moved = true;
        paint(mergePaintSelection(p.base, run, p.add), p.anchor);
      };
      const up = (ev: PointerEvent) => {
        lastPaint = { x: ev.clientX, y: ev.clientY };
        window.removeEventListener("pointermove", move);
        window.removeEventListener("pointerup", up);
        window.removeEventListener("pointercancel", up);
        document.body.style.userSelect = "";
        const p = paintRef.current;
        paintRef.current = null;
        if (!p?.moved) return;
        setSelMenu({ x: lastPaint.x, y: lastPaint.y });
        // Swallow the click the drag ends on so it can't open a channel menu or collapse the highlight.
        const swallow = (ce: MouseEvent) => {
          ce.stopPropagation();
          ce.preventDefault();
        };
        window.addEventListener("click", swallow, { capture: true, once: true });
        window.setTimeout(
          () => window.removeEventListener("click", swallow, { capture: true }),
          50,
        );
      };
      window.addEventListener("pointermove", move);
      window.addEventListener("pointerup", up);
      window.addEventListener("pointercancel", up);
    };
    // Right-click on any picked track opens the selection menu instead of collapsing to one channel.
    const onContext = (e: MouseEvent) => {
      const { selectedIds: current } = paintStateRef.current;
      if (current.length < 2) return;
      const id = (e.target as HTMLElement).closest<HTMLElement>("[data-track-row]")?.dataset[
        "trackRow"
      ];
      if (!id || !current.includes(id)) return;
      e.preventDefault();
      e.stopPropagation();
      setSelMenu({ x: e.clientX, y: e.clientY });
    };
    el.addEventListener("pointerdown", onDown, true);
    el.addEventListener("contextmenu", onContext, true);
    return () => {
      el.removeEventListener("pointerdown", onDown, true);
      el.removeEventListener("contextmenu", onContext, true);
    };
  }, []);

  // Grabbing the white playhead line inside the track lanes moves song position.
  const stepFromRowsX = (clientX: number, clientY: number) => {
    const el = rowsRef.current;
    if (!el) return getPlayStep();
    const r = canvasRect(el);
    const headerW =
      parseFloat(getComputedStyle(el).getPropertyValue("--timeline-header-width")) || 0;
    const lane = Math.max(1, r.width - headerW);
    return Math.min(
      totalSteps - 1,
      Math.max(
        0,
        Math.round(((canvasPoint(clientX, clientY).x - r.left - headerW) / lane) * totalSteps),
      ),
    );
  };
  const dragSongPlayhead = (e: React.PointerEvent) => {
    if (e.pointerType === "mouse" && e.button !== 0) return;
    e.preventDefault();
    e.stopPropagation();
    setTransport({ step: stepFromRowsX(e.clientX, e.clientY) });
    const move = (ev: PointerEvent) =>
      setTransport({ step: stepFromRowsX(ev.clientX, ev.clientY) });
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
      // Rows use it to keep the playhead from drawing over the pinned track names.
      viewport.style.setProperty("--timeline-scroll-x", `${viewport.scrollLeft}px`);
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
      const left = recordingFollowScroll(
        getPlayStep(),
        totalSteps,
        el.scrollWidth,
        headerWidth,
        el.clientWidth,
        el.scrollLeft,
      );
      if (left !== el.scrollLeft) el.scrollTo({ left, behavior: "instant" });
    };
    follow();
    return subscribePlayStep(follow);
  }, [transport.follow, transport.playing, transport.recording, totalSteps, phone, headerWidth]);
  return (
    <section
      ref={sectionRef}
      data-desktop-style={desktopStyle}
      data-page-scroll={pageScroll}
      data-resize-handles={resizeHandlesVisible}
      style={{ "--timeline-header-width": `${headerWidth}px` } as CSSProperties}
      className={`arrangement-timeline mobile-timeline relative flex min-w-0 flex-col border-x border-b border-border bg-background/60 ${pageScroll ? "" : "min-h-[210px] flex-1 overflow-hidden"}`}
    >
      {!compactPhone && <WorkflowBar />}
      {compactPhone ? null : phonePaged ? (
        <div className="phone-timeline-heading grid h-14 shrink-0 grid-cols-[minmax(0,1fr)_auto] items-center gap-2 border-b border-border bg-surface/50 px-3">
          <TrackSearch />
          <div className="flex gap-1">
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  className="h-12 gap-1.5 px-3 font-display text-xs font-semibold tracking-wide"
                  aria-label="Timeline quick tools"
                >
                  <Settings2 className="size-4" /> TOOLS
                </Button>
              </PopoverTrigger>
              <PopoverContent className="phone-edit-menu flex h-[min(80dvh,440px)] w-[min(90vw,720px)] flex-col overflow-hidden p-0">
                <div className="shrink-0 border-b border-border px-3 py-2.5 font-display text-sm font-semibold">
                  Timeline tools
                </div>
                <PhonePages name="Timeline tools">
                  <div className="p-1">
                    <h3 className="px-2 pb-1 pt-1 font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
                      Song length &amp; export
                    </h3>
                    <div className="px-2 pb-2">
                      <TimelineOptionsPanel />
                    </div>
                    <h3 className="px-2 pb-1 pt-1 font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
                      Edit &amp; arrange
                    </h3>
                    <EditToolbar />
                    <h3 className="border-t border-border px-2 pb-1 pt-2 font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
                      Song parts
                    </h3>
                    <SectionLane />
                  </div>
                </PhonePages>
              </PopoverContent>
            </Popover>
            <AddTrackMenu size="sm" />
          </div>
        </div>
      ) : (
        <EditToolbar />
      )}
      <div className="shrink-0 overflow-hidden">
        <div ref={timelineHeaderRef} className="min-w-[720px] sm:min-w-0">
          <Ruler />
          {!phonePaged && !compactPhone && <SectionLane />}
        </div>
      </div>
      {selMenu && <SelectionMenu at={selMenu} onClose={closeSelMenu} />}
      {clipBox && (
        <div
          aria-hidden
          className="pointer-events-none fixed z-50 border border-primary bg-primary/15"
          style={{
            left: clipBox.x0,
            top: clipBox.y0,
            width: clipBox.x1 - clipBox.x0,
            height: clipBox.y1 - clipBox.y0,
          }}
        />
      )}
      <div
        id="timeline-scroll"
        ref={scrollRef}
        onPointerDownCapture={onBoxDown}
        aria-label="Horizontal timeline"
        className={`relative overflow-auto overscroll-x-contain ${pageScroll ? "" : "min-h-0 flex-1"}`}
      >
        <div
          className="min-w-[720px]"
          style={{
            width: `max(${zoom * 100}%, ${transport.bars * (phone ? 96 * zoom : 32) + headerWidth}px)`,
          }}
        >
          {/* SYNCLAB watermark, low and centred in the empty workspace */}
          <div className="pointer-events-none sticky top-[68%] z-0 h-0" aria-hidden="true">
            {logoPrefs.logoMode === "custom" ? (
              <div
                data-timeline-logo="custom"
                className="absolute left-1/2 top-0 aspect-square w-[min(360px,38%)] -translate-x-[calc(50%-147px)] -translate-y-1/2 select-none"
                style={
                  {
                    background: logoPrefs.logoColor,
                    opacity: logoPrefs.logoStrength,
                    maskImage: `url(${synclabLogo})`,
                    WebkitMaskImage: `url(${synclabLogo})`,
                    maskMode: "luminance",
                    WebkitMaskSourceType: "luminance",
                    maskSize: "contain",
                    WebkitMaskSize: "contain",
                    maskRepeat: "no-repeat",
                    WebkitMaskRepeat: "no-repeat",
                  } as CSSProperties
                }
              />
            ) : (
              <img
                src={synclabLogo}
                alt=""
                data-timeline-logo="original"
                className="absolute left-1/2 top-0 w-[min(360px,38%)] -translate-x-[calc(50%-147px)] -translate-y-1/2 select-none"
                style={{ opacity: logoPrefs.logoStrength }}
              />
            )}
          </div>
          <div ref={rowsRef} className="relative" data-timeline-track-rows>
            {shownTracks.map((t) => {
              const i = tracks.indexOf(t);
              const folder = t.folderId ? folders.find((f) => f.id === t.folderId) : undefined;
              const firstInFolder =
                folder && !tracks.slice(0, i).some((x) => x.folderId === folder.id);
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
                  {!folder?.collapsed && (
                    <TrackRow
                      track={t}
                      index={i}
                      headerWidth={headerWidth}
                      setHeaderWidth={setHeaderWidth}
                    />
                  )}
                </Fragment>
              );
            })}
            <div
              className="pointer-events-none absolute inset-0 z-30"
              style={{
                clipPath:
                  "inset(0 0 0 calc(var(--timeline-header-width) + var(--timeline-scroll-x, 0px) - 2px))",
              }}
            >
              <SongPlayhead
                totalSteps={totalSteps}
                onDragStart={dragSongPlayhead}
                onMove={(step) => setTransport({ step })}
              />
            </div>
          </div>
          <div
            data-new-channel-drop
            className="min-h-28 transition-colors"
            onPointerDown={() => clearTimelineSelection()}
          >
            <div className="flex items-center gap-3 px-2 pt-2">
              <AddTrackMenu size="sm" />
              <span className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
                {tracks.length} tracks
              </span>
            </div>
            <div
              className={`m-2 rounded-[3px] border border-dashed px-3 py-3 text-center font-mono text-[10px] tracking-widest uppercase transition-colors ${
                over
                  ? "border-primary bg-primary/10 text-primary"
                  : "border-border/70 text-muted-foreground"
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
                if (
                  file &&
                  (file.type.startsWith("audio") ||
                    /\.(mp3|wav|wave|aif|aiff|m4a|aac|ogg|flac|webm)$/i.test(file.name))
                ) {
                  e.preventDefault();
                  const id = addTrack(
                    "sampler",
                    file.name
                      .replace(/\.[^.]+$/, "")
                      .toUpperCase()
                      .slice(0, 16),
                  );
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
                      toast.success(`${payload.name} on the timeline`, {
                        description: "Placed on a new audio track at the playhead",
                      });
                    })
                    .catch((err) =>
                      toast.error("Could not read that audio file", {
                        description: err instanceof Error ? err.message : undefined,
                      }),
                    );
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
      {!phonePaged &&
        (phone ? (
          <TimelineHScrollbar
            scrollRef={scrollRef}
            zoom={zoom}
            setZoom={setZoom}
            className="is-timeline"
          />
        ) : (
          <TimelineOverview scrollRef={scrollRef} zoom={zoom} setZoom={setZoom} />
        ))}
      {phone && <TimelineVScrollbar scrollRef={scrollRef} />}
    </section>
  );
}
