/**
 * Pop-up placement on the sideways phone canvas.
 *
 * The sideways phone layout rotates <body> 90° with CSS. Radix pop-ups (menus,
 * pop-overs, drop-down lists) measure their button in screen space but are
 * drawn inside the rotated body, so they land off-screen. On that canvas we
 * place each pop-up ourselves, next to its button in the rotated layout space,
 * and cap its height to the room left so every item can still be reached.
 */
import * as React from "react";
import { canvasRect, sidewaysCanvas } from "@/lib/synclab/canvas-point";

export type PopSide = "top" | "bottom" | "left" | "right";
export type PopAlign = "start" | "center" | "end";

type Box = { left: number; top: number; right: number; bottom: number };

export type SidewaysPlaceInput = {
  anchor: Box;
  width: number;
  height: number;
  viewW: number;
  viewH: number;
  side?: PopSide | undefined;
  align?: PopAlign | undefined;
  offset?: number | undefined;
  pad?: number | undefined;
};

const clamp = (v: number, lo: number, hi: number) => Math.min(Math.max(v, lo), Math.max(lo, hi));

/** Pure placement maths, in layout pixels. */
export function placeSideways(o: SidewaysPlaceInput) {
  const { anchor: a, width, height, viewW, viewH } = o;
  const offset = o.offset ?? 4;
  const pad = o.pad ?? 8;
  const align = o.align ?? "center";
  let side: PopSide = o.side ?? "bottom";
  const along = (start: number, end: number, size: number, view: number) => {
    const pos =
      align === "start" ? start : align === "end" ? end - size : (start + end) / 2 - size / 2;
    return clamp(pos, pad, view - pad - size);
  };
  if (side === "top" || side === "bottom") {
    const below = viewH - pad - (a.bottom + offset);
    const above = a.top - offset - pad;
    if (side === "bottom" && height > below && above > below) side = "top";
    else if (side === "top" && height > above && below > above) side = "bottom";
    const room = side === "bottom" ? below : above;
    // Too little room on either side: let it overlap its button rather than shrink to nothing.
    const maxH = Math.max(0, room >= Math.min(height, 120) ? room : viewH - 2 * pad);
    const h = Math.min(height, maxH);
    const y = clamp(
      side === "bottom" ? a.bottom + offset : a.top - offset - h,
      pad,
      viewH - pad - h,
    );
    return { x: along(a.left, a.right, width, viewW), y, maxH, side };
  }
  const right = viewW - pad - (a.right + offset);
  const left = a.left - offset - pad;
  if (side === "right" && width > right && left > right) side = "left";
  else if (side === "left" && width > left && right > left) side = "right";
  const maxH = Math.max(0, viewH - 2 * pad);
  const h = Math.min(height, maxH);
  const x = clamp(
    side === "right" ? a.right + offset : a.left - offset - width,
    pad,
    viewW - pad - width,
  );
  return { x, y: along(a.top, a.bottom, h, viewH), maxH, side };
}

type Opts = {
  side?: PopSide | undefined;
  align?: PopAlign | undefined;
  sideOffset?: number | undefined;
};

function attach(node: HTMLElement, getOpts: () => Opts) {
  if (!sidewaysCanvas()) return undefined;
  const wrapper = node.parentElement;
  if (!wrapper?.hasAttribute("data-radix-popper-content-wrapper")) return undefined;
  // The track menu keeps its own centred sideways layout (styles.css).
  if (node.classList.contains("timeline-channel-menu")) return undefined;
  // The synth preset browser fills the sideways screen instead (styles.css), so its lists have room.
  if (node.classList.contains("preset-browser")) return undefined;
  let raf = 0;
  const clear = () => {
    wrapper.removeAttribute("data-sideways-placed");
    wrapper.removeAttribute("data-sideways-tall");
  };
  const place = () => {
    raf = 0;
    if (!sidewaysCanvas() || !node.isConnected) {
      clear();
      return;
    }
    const trigger = node.id
      ? document.querySelector(`[aria-controls="${CSS.escape(node.id)}"]`)
      : null;
    if (!trigger) return;
    const { side, align, sideOffset } = getOpts();
    const body = document.body;
    const width = node.offsetWidth;
    const height = Math.max(node.offsetHeight, node.scrollHeight);
    const r = placeSideways({
      anchor: canvasRect(trigger),
      width,
      height,
      viewW: body.clientWidth || window.innerHeight,
      viewH: body.clientHeight || window.innerWidth,
      side,
      align,
      offset: sideOffset,
    });
    wrapper.style.setProperty("--sw-x", `${Math.round(r.x)}px`);
    wrapper.style.setProperty("--sw-y", `${Math.round(r.y)}px`);
    wrapper.style.setProperty("--sw-max-h", `${Math.floor(r.maxH)}px`);
    wrapper.setAttribute("data-sideways-placed", r.side);
    if (height > r.maxH + 1) wrapper.setAttribute("data-sideways-tall", "");
    else wrapper.removeAttribute("data-sideways-tall");
  };
  const schedule = () => {
    if (!raf) raf = requestAnimationFrame(place);
  };
  place();
  schedule();
  const ro = typeof ResizeObserver !== "undefined" ? new ResizeObserver(schedule) : null;
  ro?.observe(node);
  window.addEventListener("resize", schedule);
  window.addEventListener("scroll", schedule, true);
  return () => {
    if (raf) cancelAnimationFrame(raf);
    ro?.disconnect();
    window.removeEventListener("resize", schedule);
    window.removeEventListener("scroll", schedule, true);
  };
}

/** Ref for a Radix pop-up content element; forwards to the caller's ref too. */
export function useSidewaysPopper<T extends HTMLElement>(
  forwarded: React.ForwardedRef<T>,
  opts: Opts,
) {
  const optsRef = React.useRef(opts);
  optsRef.current = opts;
  const cleanup = React.useRef<(() => void) | undefined>(undefined);
  return React.useCallback(
    (node: T | null) => {
      cleanup.current?.();
      cleanup.current = node ? attach(node, () => optsRef.current) : undefined;
      if (typeof forwarded === "function") forwarded(node);
      else if (forwarded) forwarded.current = node;
    },
    [forwarded],
  );
}
