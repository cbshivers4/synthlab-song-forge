import * as React from "react";
import * as SliderPrimitive from "@radix-ui/react-slider";

import { cn } from "@/lib/utils";
import { sidewaysCanvas } from "@/lib/synclab/canvas-point";
import { sidewaysSliderValue } from "@/lib/synclab/sideways-slider";

type SliderProps = React.ComponentPropsWithoutRef<typeof SliderPrimitive.Root>;

/**
 * Radix reads screen-space pointer coordinates, which point the wrong way on the
 * sideways phone canvas (body rotated 90°). There we take over the drag and map
 * the finger into the slider's own axis, so faders and sliders follow the finger.
 */
function useSidewaysDrag(props: SliderProps) {
  const dragging = React.useRef(false);
  const latest = React.useRef(props);
  latest.current = props;

  const apply = (el: HTMLElement, e: React.PointerEvent) => {
    const p = latest.current;
    const current = p.value ?? p.defaultValue ?? [p.min ?? 0];
    const next = sidewaysSliderValue({
      rect: el.getBoundingClientRect(),
      clientX: e.clientX,
      clientY: e.clientY,
      screenWidth: window.innerWidth,
      min: p.min ?? 0,
      max: p.max ?? 100,
      step: p.step ?? 1,
      vertical: p.orientation === "vertical",
      inverted: !!p.inverted,
    });
    // Move the thumb nearest the finger (single-thumb sliders: the only one).
    let idx = 0;
    current.forEach((v, i) => {
      if (Math.abs(v - next) < Math.abs((current[idx] ?? 0) - next)) idx = i;
    });
    if (current[idx] === next) return current;
    const values = current.map((v, i) => (i === idx ? next : v));
    p.onValueChange?.(values);
    return values;
  };

  return {
    onPointerDownCapture: (e: React.PointerEvent<HTMLSpanElement>) => {
      if (props.disabled || !sidewaysCanvas()) return;
      e.stopPropagation();
      e.preventDefault();
      dragging.current = true;
      const el = e.currentTarget;
      try {
        el.setPointerCapture(e.pointerId);
      } catch {
        /* ignore */
      }
      apply(el, e);
      el.querySelector<HTMLElement>("[role=slider]")?.focus({ preventScroll: true });
    },
    onPointerMoveCapture: (e: React.PointerEvent<HTMLSpanElement>) => {
      if (!dragging.current) return;
      e.stopPropagation();
      apply(e.currentTarget, e);
    },
    onPointerUpCapture: (e: React.PointerEvent<HTMLSpanElement>) => {
      if (!dragging.current) return;
      e.stopPropagation();
      dragging.current = false;
      try {
        e.currentTarget.releasePointerCapture(e.pointerId);
      } catch {
        /* ignore */
      }
      const values = apply(e.currentTarget, e);
      latest.current.onValueCommit?.(values);
    },
    onPointerCancelCapture: () => {
      dragging.current = false;
    },
  };
}

const Slider = React.forwardRef<React.ElementRef<typeof SliderPrimitive.Root>, SliderProps>(
  ({ className, ...props }, ref) => {
    const sideways = useSidewaysDrag(props);
    return (
      <SliderPrimitive.Root
        ref={ref}
        className={cn("relative flex w-full touch-none select-none items-center", className)}
        {...props}
        {...sideways}
      >
        <SliderPrimitive.Track className="relative h-1.5 w-full grow overflow-hidden rounded-full bg-primary/20">
          <SliderPrimitive.Range className="absolute h-full bg-primary" />
        </SliderPrimitive.Track>
        <SliderPrimitive.Thumb
          aria-label={props["aria-label"]}
          aria-labelledby={props["aria-labelledby"]}
          aria-valuetext={props["aria-valuetext"]}
          className="block h-4 w-4 rounded-full border border-primary/50 bg-background shadow transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50"
        />
      </SliderPrimitive.Root>
    );
  },
);
Slider.displayName = SliderPrimitive.Root.displayName;

export { Slider };
