/**
 * Swipe scrolling for pop-up menus on the sideways phone canvas.
 *
 * The whole app is rotated 90° on upright phones. Menus lock page scrolling while open, and that
 * lock judges swipe direction from raw screen coordinates: a finger moving along the menu's list
 * moves sideways on the glass, so the swipe is cancelled and the lower menu items can't be reached.
 * Native scrolling of a rotated box is also unreliable across phone browsers.
 *
 * So on the sideways canvas, menus take touch drags themselves (CSS gives them touch-action: none)
 * and this moves the nearest scrollable box by the drag mapped into the rotated layout, with a short
 * glide after release. A drag never also picks the item it started on.
 */
import { sidewaysCanvas } from "@/lib/synclab/canvas-point";

/** Pure: a finger movement on the glass -> the same movement in the rotated layout space. */
export function sidewaysTouchDelta(screenDx: number, screenDy: number) {
  // Mirrors rotateSidewaysPoint: layout x = screen y, layout y = screenWidth - screen x.
  return { dx: screenDy, dy: -screenDx };
}

/** Pure: new scroll offset when content follows the finger, clamped to the scroll range. */
export function followFinger(scroll: number, fingerDelta: number, max: number) {
  return Math.max(0, Math.min(max, scroll - fingerDelta));
}

/** Finger travel (layout px) before a press counts as a scroll instead of a tap. */
export const DRAG_SCROLL_SLOP = 8;

const LAYER = "[role='menu']";

function scrollerFor(el: HTMLElement, layer: Element) {
  for (let n: HTMLElement | null = el; n; n = n.parentElement) {
    const cs = getComputedStyle(n);
    if (
      (cs.overflowY === "auto" || cs.overflowY === "scroll") &&
      n.scrollHeight - n.clientHeight > 1
    )
      return n;
    if (n === layer) break;
  }
  return null;
}

let installed = false;

export function installSidewaysModalScroll() {
  if (installed || typeof window === "undefined") return;
  installed = true;
  type Drag = {
    id: number;
    box: HTMLElement;
    sx: number;
    sy: number;
    lx: number;
    ly: number;
    lt: number;
    v: number;
    dragging: boolean;
  };
  let drag: Drag | null = null;
  let blockClickUntil = 0;
  let glide = 0;

  window.addEventListener(
    "pointerdown",
    (e) => {
      cancelAnimationFrame(glide);
      drag = null;
      if (e.pointerType === "mouse" || !sidewaysCanvas()) return;
      const target = e.target as HTMLElement | null;
      const layer = target?.closest?.(LAYER);
      if (!target || !layer || target.closest("input,textarea,select,canvas,[role='slider']"))
        return;
      const box = scrollerFor(target, layer);
      if (!box) return;
      drag = {
        id: e.pointerId,
        box,
        sx: e.clientX,
        sy: e.clientY,
        lx: e.clientX,
        ly: e.clientY,
        lt: performance.now(),
        v: 0,
        dragging: false,
      };
    },
    true,
  );

  window.addEventListener(
    "pointermove",
    (e) => {
      if (!drag || e.pointerId !== drag.id) return;
      const total = sidewaysTouchDelta(e.clientX - drag.sx, e.clientY - drag.sy);
      if (!drag.dragging && Math.abs(total.dy) < DRAG_SCROLL_SLOP) return;
      drag.dragging = true;
      const { dy } = sidewaysTouchDelta(e.clientX - drag.lx, e.clientY - drag.ly);
      const now = performance.now();
      const box = drag.box;
      box.scrollTop = followFinger(box.scrollTop, dy, box.scrollHeight - box.clientHeight);
      drag.v = dy / Math.max(1, now - drag.lt);
      drag.lx = e.clientX;
      drag.ly = e.clientY;
      drag.lt = now;
    },
    true,
  );

  const finish = (e: PointerEvent) => {
    if (!drag || e.pointerId !== drag.id) return;
    const { dragging, box } = drag;
    let v = drag.v;
    drag = null;
    if (!dragging) return;
    // The lift after a scroll is not a choice of the item under the finger.
    blockClickUntil = performance.now() + 400;
    let last = performance.now();
    const step = (t: number) => {
      const dt = t - last;
      last = t;
      v *= Math.pow(0.95, dt / 16);
      if (Math.abs(v) < 0.02) return;
      box.scrollTop = followFinger(box.scrollTop, v * dt, box.scrollHeight - box.clientHeight);
      glide = requestAnimationFrame(step);
    };
    glide = requestAnimationFrame(step);
  };
  window.addEventListener("pointerup", finish, true);
  window.addEventListener("pointercancel", finish, true);

  window.addEventListener(
    "click",
    (e) => {
      if (performance.now() > blockClickUntil) return;
      if (!(e.target as HTMLElement | null)?.closest?.(LAYER)) return;
      blockClickUntil = 0;
      e.preventDefault();
      e.stopPropagation();
    },
    true,
  );
}
