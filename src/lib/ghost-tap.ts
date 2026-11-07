/**
 * Ghost-tap guard for pop-up menus.
 *
 * On a phone a menu opens while the finger is still down (on the ⋯ button, or after a
 * long-press). When the finger lifts, the browser fires a pointerup/click at that spot —
 * which is now a menu item — so the item runs without the user ever touching it
 * (e.g. "Cut" removing a track). A real choice always starts with a press inside the menu.
 */
export type MenuClickInfo = {
  /** A pointer went down inside this menu since it opened. */
  downInside: boolean;
  /** MouseEvent.detail — 0 for keyboard and script-triggered clicks. */
  detail: number;
  /** Pointer type of the click when the browser reports it ("mouse", "touch", "pen" or ""). */
  pointerType: string;
  now: number;
  /** Until when script-triggered clicks are blocked after a finger lifted that never pressed inside. */
  blockUntil: number;
};

/** How long after a stray finger lift a script-triggered item click is still ignored. */
export const GHOST_TAP_WINDOW_MS = 450;

export function shouldBlockMenuClick(c: MenuClickInfo): boolean {
  if (c.downInside) return false;
  // Real clicks (finger or mouse) that never pressed inside the menu: the finger that opened it.
  // Mouse press-drag-release selection is kept for desktop.
  if (c.detail > 0) return c.pointerType !== "mouse";
  // Keyboard (Enter/Space) stays allowed; only block script clicks right after a stray finger lift.
  return c.now < c.blockUntil;
}
