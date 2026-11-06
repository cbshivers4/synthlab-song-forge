import { sidewaysCanvas } from "./canvas-point";

/**
 * Pop-up windows and menus lock page scrolling with a document-level touch handler that judges
 * swipe direction in screen space. On the sideways phone canvas the screen is turned 90°, so a
 * swipe along a window's own up/down axis looks sideways to that handler and gets blocked —
 * the window never scrolls. Swipes that start inside an open window or menu stop at <body>
 * before reaching that handler, so the browser scrolls them natively (in the turned layout).
 */
const POPUP = '[role="dialog"], [role="alertdialog"], [role="menu"], [role="listbox"], [data-radix-popper-content-wrapper]';

export function shouldFreeSidewaysTouch(target: EventTarget | null, sideways: boolean): boolean {
  if (!sideways) return false;
  const el = target as Element | null;
  return !!el && typeof el.closest === "function" && !!el.closest(POPUP);
}

export function installSidewaysPopupScroll(): () => void {
  const onMove = (event: TouchEvent) => {
    if (shouldFreeSidewaysTouch(event.target, sidewaysCanvas())) event.stopPropagation();
  };
  document.body.addEventListener("touchmove", onMove, { passive: true });
  return () => document.body.removeEventListener("touchmove", onMove);
}
