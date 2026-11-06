import { useEffect, useRef, type RefObject } from "react";
import { canvasPoint, canvasRect } from "@/lib/synclab/canvas-point";
import { thumbOnBar, scrollForThumbOnBar } from "./vscroll-math";

/**
 * Phone timeline horizontal scroll bar with zoom buttons. Works on the sideways phone canvas
 * (pointer math uses layout coordinates) and only moves the timeline's own scroll position.
 */
export function TimelineHScrollbar({ scrollRef, zoom, setZoom }: { scrollRef: RefObject<HTMLDivElement | null>; zoom: number; setZoom: (z: number) => void }) {
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
    ro.observe(el);
    ro.observe(bar);
    if (el.firstElementChild) ro.observe(el.firstElementChild);
    return () => { cancelAnimationFrame(frame); el.removeEventListener("scroll", sync); ro.disconnect(); };
  }, [scrollRef, zoom]);

  const scrollTo = (thumbOffset: number) => {
    const el = scrollRef.current;
    const bar = barRef.current;
    if (el && bar) el.scrollLeft = scrollForThumbOnBar(thumbOffset, el.scrollWidth, el.clientWidth, bar.clientWidth);
  };

  const zoomBtn = "timeline-hscroll-zoom";
  return (
    <div className="timeline-hscroll-row">
      <button type="button" className={zoomBtn} onClick={() => setZoom(Math.max(1, Math.round((zoom - 0.5) * 2) / 2))} aria-label="Zoom out the arrangement" title="Zoom out">−</button>
      <div
        ref={barRef}
        className="timeline-hscroll"
        role="scrollbar"
        aria-orientation="horizontal"
        aria-controls="timeline-scroll"
        aria-label="Scroll the timeline left and right"
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
      <span className="timeline-hscroll-zoom-label">{zoom.toFixed(1)}×</span>
      <button type="button" className={zoomBtn} onClick={() => setZoom(Math.min(8, Math.round((zoom + 0.5) * 2) / 2))} aria-label="Zoom in on the arrangement" title="Zoom in">+</button>
    </div>
  );
}
