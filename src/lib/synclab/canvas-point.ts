/**
 * The sideways phone canvas rotates <body> 90° with CSS, but pointer events
 * still report screen-space coordinates. These helpers map them into the
 * rotated layout space so drag/tap math works on upright phones.
 */
export function sidewaysCanvas(): boolean {
  if (typeof window === "undefined" || typeof document === "undefined") return false;
  if (!document.documentElement.classList.contains("phone-sideways-default")) return false;
  return window.matchMedia(
    "(orientation: portrait) and (max-width: 767px) and (pointer: coarse), (orientation: portrait) and (max-width: 600px)",
  ).matches;
}

/** Pure mapping: screen point -> layout point for the 90°-rotated canvas. */
export function rotateSidewaysPoint(clientX: number, clientY: number, screenWidth: number) {
  return { x: clientY, y: screenWidth - clientX };
}

/** Pointer event coordinates in the app's layout space. */
export function canvasPoint(clientX: number, clientY: number) {
  if (!sidewaysCanvas()) return { x: clientX, y: clientY };
  return rotateSidewaysPoint(clientX, clientY, window.innerWidth);
}

/** Pure mapping: an element's screen-space bounding box -> its rect in the rotated layout space. */
export function rotateSidewaysRect(
  r: { left: number; top: number; right: number; bottom: number },
  screenWidth: number,
) {
  const a = rotateSidewaysPoint(r.left, r.top, screenWidth);
  const b = rotateSidewaysPoint(r.right, r.bottom, screenWidth);
  const left = Math.min(a.x, b.x),
    right = Math.max(a.x, b.x);
  const top = Math.min(a.y, b.y),
    bottom = Math.max(a.y, b.y);
  return { left, top, right, bottom, width: right - left, height: bottom - top };
}

/**
 * Element rect in the same layout space as canvasPoint. Derived from the live
 * bounding box (not offsetTop sums), so scrolled panels and lists stay accurate.
 */
export function canvasRect(el: Element) {
  const r = el.getBoundingClientRect();
  if (!sidewaysCanvas()) {
    return {
      left: r.left,
      top: r.top,
      right: r.right,
      bottom: r.bottom,
      width: r.width,
      height: r.height,
    };
  }
  return rotateSidewaysRect(r, window.innerWidth);
}
