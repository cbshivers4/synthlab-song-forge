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

/** Element rect in layout space (getBoundingClientRect is screen-space when rotated). */
export function canvasRect(el: HTMLElement) {
  const r = el.getBoundingClientRect();
  if (!sidewaysCanvas()) {
    return { left: r.left, top: r.top, right: r.right, bottom: r.bottom, width: r.width, height: r.height };
  }
  let left = 0;
  let top = 0;
  let node: HTMLElement | null = el;
  while (node) {
    left += node.offsetLeft;
    top += node.offsetTop;
    node = node.offsetParent as HTMLElement | null;
  }
  const width = el.offsetWidth;
  const height = el.offsetHeight;
  return { left, top, right: left + width, bottom: top + height, width, height };
}
