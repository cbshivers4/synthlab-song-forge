import { useLayoutEffect, useRef, type ReactNode } from "react";
import { fitScale } from "@/lib/synclab/fit-scale";

/**
 * Shows its children at full size when they fit, otherwise scales them down (never up) so the
 * whole panel is visible without scrolling. The content is laid out wider by the same factor, so
 * rows use the full width instead of leaving empty space at the side.
 *
 * Only a last resort scrolls: below `minScale` the panel stays at `minScale` and scrolls.
 * Pointer math keeps working because every control here maps clicks through the element's live
 * bounding box (canvasRect / getBoundingClientRect), which already includes the scale.
 */
export function FitToBox({
  children,
  enabled = true,
  minScale = 0.55,
  className = "",
  label,
}: {
  children: ReactNode;
  enabled?: boolean;
  minScale?: number;
  className?: string;
  label?: string;
}) {
  const outer = useRef<HTMLDivElement>(null);
  const inner = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    const box = outer.current;
    const body = inner.current;
    if (!box || !body) return;
    if (!enabled) {
      body.style.width = "";
      body.style.transform = "";
      box.style.overflowY = "";
      delete box.dataset["fitScale"];
      return;
    }
    let frame = 0;
    const fit = () => {
      frame = 0;
      const width = box.clientWidth;
      const height = box.clientHeight;
      if (!width || !height) return;
      const measure = (scale: number) => {
        body.style.width = `${width / scale}px`;
        return { height: body.scrollHeight, width: body.scrollWidth };
      };
      const scale = fitScale(width, height, measure, minScale);
      body.style.width = `${width / scale}px`;
      body.style.transform = scale < 1 ? `scale(${scale})` : "";
      box.dataset["fitScale"] = scale.toFixed(3);
      // Only when even the smallest size is too tall does the panel scroll.
      box.style.overflowY = body.scrollHeight * scale > height + 1 ? "auto" : "hidden";
    };
    const schedule = () => {
      if (!frame) frame = requestAnimationFrame(fit);
    };
    fit();
    const observer = new ResizeObserver(schedule);
    observer.observe(box);
    observer.observe(body);
    return () => {
      observer.disconnect();
      if (frame) cancelAnimationFrame(frame);
    };
  }, [enabled, minScale]);

  return (
    <div
      ref={outer}
      className={`fit-to-box relative min-h-0 min-w-0 ${enabled ? "flex-1 overflow-hidden" : ""} ${className}`}
      aria-label={label}
    >
      <div ref={inner} className="fit-to-box-body @container origin-top-left">
        {children}
      </div>
    </div>
  );
}
