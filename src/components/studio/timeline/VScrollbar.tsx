import { useEffect, useRef, type RefObject } from "react";
import { canvasPoint } from "@/lib/synclab/canvas-point";
import { thumbGeometry, scrollTopForThumb } from "./vscroll-math";

/**
 * Always-visible vertical scroll bar for the phone timeline. Phone browsers hide their own
 * scrollbars (or ignore styling), so this draws a finger-sized bar beside the tracks: drag the
 * thumb, or tap the bar to jump there. It only moves the timeline's own scroll position.
 */
export function TimelineVScrollbar({ scrollRef, controls = "timeline-scroll", label = "Scroll tracks up and down" }: { scrollRef: RefObject<HTMLDivElement | null>; controls?: string; label?: string }) {
  const barRef = useRef<HTMLDivElement>(null);
  const thumbRef = useRef<HTMLDivElement>(null);
  const drag = useRef<{ y: number; top: number } | null>(null);

  useEffect(() => {
    const el = scrollRef.current;
    const bar = barRef.current;
    const thumb = thumbRef.current;
    if (!el || !bar || !thumb) return;
    let frame = 0;
    const sync = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        const can = el.scrollHeight > el.clientHeight + 1;
        bar.hidden = !can;
        bar.style.top = `${el.offsetTop}px`;
        bar.style.height = `${el.clientHeight}px`;
        const g = thumbGeometry(el.scrollTop, el.scrollHeight, el.clientHeight);
        thumb.style.height = `${g.height}px`;
        thumb.style.transform = `translateY(${g.offset}px)`;
      });
    };
    sync();
    el.addEventListener("scroll", sync, { passive: true });
    const ro = new ResizeObserver(sync);
    ro.observe(el);
    if (el.firstElementChild) ro.observe(el.firstElementChild);
    return () => { cancelAnimationFrame(frame); el.removeEventListener("scroll", sync); ro.disconnect(); };
  }, [scrollRef]);

  const scrollTo = (thumbOffset: number) => {
    const el = scrollRef.current;
    if (el) el.scrollTop = scrollTopForThumb(thumbOffset, el.scrollHeight, el.clientHeight);
  };

  return (
    <div
      ref={barRef}
      hidden
      className="timeline-vscroll"
      role="scrollbar"
      aria-orientation="vertical"
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
        const y = canvasPoint(e.clientX, e.clientY).y;
        const g = thumbGeometry(el.scrollTop, el.scrollHeight, el.clientHeight);
        const barTop = canvasBarTop(bar);
        const local = y - barTop;
        // Tap outside the thumb: centre the thumb under the finger, then keep dragging from there.
        if (local < g.offset || local > g.offset + g.height) scrollTo(local - g.height / 2);
        drag.current = { y, top: thumbGeometry(el.scrollTop, el.scrollHeight, el.clientHeight).offset };
      }}
      onPointerMove={(e) => {
        if (!drag.current) return;
        const y = canvasPoint(e.clientX, e.clientY).y;
        scrollTo(drag.current.top + (y - drag.current.y));
      }}
      onPointerUp={() => { drag.current = null; }}
      onPointerCancel={() => { drag.current = null; }}
    >
      <div ref={thumbRef} className="timeline-vscroll-thumb" />
    </div>
  );
}

/** The bar's top edge in the app's own (possibly sideways) layout space. */
function canvasBarTop(bar: HTMLElement) {
  const r = bar.getBoundingClientRect();
  // On the sideways phone canvas the bar's layout top edge maps to the screen's right edge.
  const p = canvasPoint(r.right, r.top);
  const q = canvasPoint(r.left, r.top);
  return Math.min(p.y, q.y);
}
