import { useEffect, useRef, type RefObject } from "react";
import { canvasPoint, canvasRect } from "@/lib/synclab/canvas-point";
import { thumbOnBar, scrollForThumbOnBar } from "./vscroll-math";

/**
 * Phone horizontal scroll bar. Works on the sideways phone canvas (pointer math uses layout
 * coordinates) and only moves its own scroll container. With zoom it shows − / + zoom buttons
 * (timeline); without zoom it shows ◀ / ▶ step buttons (mixer channels).
 */
export function TimelineHScrollbar({
  scrollRef,
  zoom,
  setZoom,
  label = "Scroll the timeline left and right",
  controls = "timeline-scroll",
  className,
}: {
  scrollRef: RefObject<HTMLDivElement | null>;
  zoom?: number;
  setZoom?: (z: number) => void;
  label?: string;
  controls?: string;
  className?: string;
}) {
  const barRef = useRef<HTMLDivElement>(null);
  const thumbRef = useRef<HTMLDivElement>(null);
  const drag = useRef<{ x: number; offset: number } | null>(null);

  useEffect(() => {
    const el = scrollRef.current;
    const bar = barRef.current;
    const thumb = thumbRef.current;
    if (!el || !bar || !thumb) return;
    let frame = 0;
    const sync = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        const g = thumbOnBar(el.scrollLeft, el.scrollWidth, el.clientWidth, bar.clientWidth);
        thumb.style.width = `${g.size}px`;
        thumb.style.transform = `translateX(${g.offset}px)`;
        bar.dataset["full"] = el.scrollWidth <= el.clientWidth + 1 ? "true" : "false";
      });
    };
    sync();
    el.addEventListener("scroll", sync, { passive: true });
    const ro = new ResizeObserver(sync);
    const observeKids = () => { for (const kid of Array.from(el.children)) ro.observe(kid); };
    ro.observe(el);
    ro.observe(bar);
    observeKids();
    // Channels appearing/disappearing change the scroll width without resizing the container.
    const mo = new MutationObserver(() => { observeKids(); sync(); });
    mo.observe(el, { childList: true });
    return () => { cancelAnimationFrame(frame); el.removeEventListener("scroll", sync); ro.disconnect(); mo.disconnect(); };
  }, [scrollRef, zoom]);

  const scrollTo = (thumbOffset: number) => {
    const el = scrollRef.current;
    const bar = barRef.current;
    if (el && bar) el.scrollLeft = scrollForThumbOnBar(thumbOffset, el.scrollWidth, el.clientWidth, bar.clientWidth);
  };
  const step = (dir: -1 | 1) => {
    const el = scrollRef.current;
    if (el) el.scrollBy({ left: dir * Math.max(80, el.clientWidth * 0.6), behavior: "smooth" });
  };

  const zoomBtn = "timeline-hscroll-zoom";
  const hasZoom = zoom != null && setZoom != null;
  return (
    <div className={className ? `timeline-hscroll-row ${className}` : "timeline-hscroll-row"}>
      {hasZoom ? (
        <button type="button" className={zoomBtn} onClick={() => setZoom(Math.max(1, Math.round((zoom - 0.5) * 2) / 2))} aria-label="Zoom out the arrangement" title="Zoom out">−</button>
      ) : (
        <button type="button" className={zoomBtn} onClick={() => step(-1)} aria-label="Scroll left" title="Scroll left">◀</button>
      )}
      <div
        ref={barRef}
        className="timeline-hscroll"
        role="scrollbar"
        aria-orientation="horizontal"
        aria-controls={controls}
        aria-label={label}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={0}
        onPointerDown={(e) => {
          const el = scrollRef.current;
          const bar = barRef.current;
          if (!el || !bar) return;
          e.preventDefault();
          e.stopPropagation();
          bar.setPointerCapture(e.pointerId);
          const x = canvasPoint(e.clientX, e.clientY).x;
          const local = x - canvasRect(bar).left;
          const g = thumbOnBar(el.scrollLeft, el.scrollWidth, el.clientWidth, bar.clientWidth);
          // Tap outside the thumb: centre the thumb under the finger, then keep dragging from there.
          if (local < g.offset || local > g.offset + g.size) scrollTo(local - g.size / 2);
          drag.current = { x, offset: thumbOnBar(el.scrollLeft, el.scrollWidth, el.clientWidth, bar.clientWidth).offset };
        }}
        onPointerMove={(e) => {
          if (!drag.current) return;
          scrollTo(drag.current.offset + (canvasPoint(e.clientX, e.clientY).x - drag.current.x));
        }}
        onPointerUp={() => { drag.current = null; }}
        onPointerCancel={() => { drag.current = null; }}
      >
        <div ref={thumbRef} className="timeline-hscroll-thumb" />
      </div>
      {hasZoom ? (
        <>
          <span className="timeline-hscroll-zoom-label">{zoom.toFixed(1)}×</span>
          <button type="button" className={zoomBtn} onClick={() => setZoom(Math.min(8, Math.round((zoom + 0.5) * 2) / 2))} aria-label="Zoom in on the arrangement" title="Zoom in">+</button>
        </>
      ) : (
        <button type="button" className={zoomBtn} onClick={() => step(1)} aria-label="Scroll right" title="Scroll right">▶</button>
      )}
    </div>
  );
}
