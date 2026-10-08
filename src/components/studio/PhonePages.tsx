import { useEffect, useRef, useState, type ReactNode } from "react";
import { ChevronLeft, ChevronRight, ChevronUp, ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";

type PageArea = { el: HTMLElement; label: string; horizontal: boolean; vertical: boolean };

/** Finite phone view of existing editors: page buttons, not gesture scrolling.
 * Overlapping pages keep controls at a boundary reachable without shrinking them.
 */
export function PhonePages({ children, name }: { children: ReactNode; name: string }) {
  const viewport = useRef<HTMLDivElement>(null);
  const [areas, setAreas] = useState<PageArea[]>([]);
  const [active, setActive] = useState(0);
  const [, refresh] = useState(0);
  useEffect(() => {
    const root = viewport.current;
    if (!root) return;
    let frame = 0;
    const scan = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        const targets = [root, ...Array.from(root.querySelectorAll<HTMLElement>("*"))].filter((el) => {
          if (!el.clientWidth || !el.clientHeight || el.closest('[role="slider"],canvas,svg')) return false;
          const style = getComputedStyle(el);
          return el === root || /auto|scroll/.test(style.overflowX + style.overflowY) || el.dataset.phonePaged === "true";
        });
        const next: PageArea[] = [];
        for (const el of targets) {
          const horizontal = el.scrollWidth > el.clientWidth + 4;
          const vertical = el.scrollHeight > el.clientHeight + 4;
          if (!horizontal && !vertical) continue;
          el.dataset.phonePaged = "true";
          el.style.overflow = "hidden";
          const label = el.getAttribute("aria-label") || (el.id === "timeline-scroll" ? "Tracks & bars" : el.classList.contains("mobile-mixer-strips") ? "Channels" : el.classList.contains("timeline-track-actions") ? "Track actions" : el.classList.contains("mx-console-toolbar") ? "Mixer options" : el.classList.contains("drum-pad-grid") ? "Drum pads" : el === root ? name : `Controls ${next.length + 1}`);
          next.push({ el, label, horizontal, vertical });
        }
        setAreas((prev) => prev.length === next.length && prev.every((a, i) => a.el === next[i]?.el && a.horizontal === next[i]?.horizontal && a.vertical === next[i]?.vertical) ? prev : next);
      });
    };
    scan();
    const observer = new ResizeObserver(scan);
    observer.observe(root);
    const mutations = new MutationObserver(scan);
    mutations.observe(root, { childList: true, subtree: true });
    const timer = window.setInterval(scan, 700);
    const blockWheel = (event: WheelEvent) => event.preventDefault();
    root.addEventListener("wheel", blockWheel, { passive: false });
    return () => { cancelAnimationFrame(frame); observer.disconnect(); mutations.disconnect(); clearInterval(timer); root.removeEventListener("wheel", blockWheel); };
  }, [name]);
  const area = areas[Math.min(active, Math.max(0, areas.length - 1))];
  const move = (axis: "x" | "y", direction: number) => {
    if (!area) return;
    const el = area.el;
    if (axis === "x") el.scrollLeft += direction * Math.max(48, el.clientWidth - 56);
    else el.scrollTop += direction * Math.max(48, el.clientHeight - 56);
    refresh((n) => n + 1);
  };
  const xPage = area ? Math.floor(area.el.scrollLeft / Math.max(48, area.el.clientWidth - 56)) + 1 : 1;
  const yPage = area ? Math.floor(area.el.scrollTop / Math.max(48, area.el.clientHeight - 56)) + 1 : 1;
  return <div className="phone-pages flex min-h-0 flex-1 flex-col overflow-hidden">
    <div ref={viewport} className="phone-page-viewport relative min-h-0 flex-1 overflow-hidden" aria-label={`${name} pages`}>{children}</div>
    <footer className="phone-page-controls grid h-14 shrink-0 grid-cols-[minmax(0,1fr)_auto] items-center gap-2 border-t border-border bg-surface px-3">
      <div className="flex min-w-0 items-center gap-2">
        {areas.length > 1 ? <select aria-label="Page section" className="h-12 min-w-0 max-w-48 rounded border border-border bg-background px-2 text-xs" value={Math.min(active, areas.length - 1)} onChange={(e) => { setActive(Number(e.target.value)); refresh((n) => n + 1); }}>{areas.map((a, i) => <option key={i} value={i}>{a.label}</option>)}</select> : <span className="truncate text-xs font-semibold">{area?.label ?? name}</span>}
        <span className="shrink-0 text-xs text-muted-foreground" aria-live="polite">{area ? `Page ${area.horizontal ? xPage : yPage}` : "All in view"}</span>
      </div>
      <div className="flex shrink-0 gap-1">
        {area?.vertical && <><Button variant="outline" size="icon" className="size-12" aria-label="Previous controls page" disabled={area.el.scrollTop < 1} onClick={() => move("y", -1)}><ChevronUp /></Button><Button variant="outline" size="icon" className="size-12" aria-label="Next controls page" disabled={area.el.scrollTop + area.el.clientHeight >= area.el.scrollHeight - 2} onClick={() => move("y", 1)}><ChevronDown /></Button></>}
        {area?.horizontal && <><Button variant="outline" size="icon" className="size-12" aria-label="Previous horizontal page" disabled={area.el.scrollLeft < 1} onClick={() => move("x", -1)}><ChevronLeft /></Button><Button variant="outline" size="icon" className="size-12" aria-label="Next horizontal page" disabled={area.el.scrollLeft + area.el.clientWidth >= area.el.scrollWidth - 2} onClick={() => move("x", 1)}><ChevronRight /></Button></>}
      </div>
    </footer>
  </div>;
}