/**
 * Cheap reads for animated displays (scopes, meters, EQ curves).
 *
 * Reading clientWidth or getComputedStyle inside a 20-60 fps draw loop forces the browser to
 * recalculate layout/styles of the whole page every frame, right after React changed it. With
 * several displays in the mixer that stalled the page long enough to make playback stumble.
 * Sizes come from a ResizeObserver instead, and CSS colours are re-read at most once a second.
 */

type Size = { w: number; h: number };
const sizes = new WeakMap<Element, Size>();
let observer: ResizeObserver | null = null;

/** Current client size of an element, kept up to date without forcing layout in a draw loop. */
export function elementSize(el: HTMLElement): Size {
  const known = sizes.get(el);
  if (known) return known;
  const size = { w: el.clientWidth, h: el.clientHeight };
  if (typeof ResizeObserver === "undefined") return size;
  sizes.set(el, size);
  observer ??= new ResizeObserver((entries) => {
    // Layout is already done when this runs, so reading sizes here costs nothing extra.
    for (const entry of entries) {
      const target = entry.target as HTMLElement;
      const s = sizes.get(target);
      if (s) {
        s.w = target.clientWidth;
        s.h = target.clientHeight;
      }
    }
  });
  observer.observe(el);
  return size;
}

/** Stop tracking an element (call when its display unmounts). */
export function releaseElementSize(el: HTMLElement | null | undefined) {
  if (!el || !sizes.has(el)) return;
  sizes.delete(el);
  observer?.unobserve(el);
}

const styles = new WeakMap<Element, Map<string, { v: string; t: number }>>();

/** A CSS custom property as seen by `el`, re-read at most every `maxAgeMs` (theme/skin changes still show). */
export function cssVarOf(el: Element, name: string, maxAgeMs = 1000): string {
  const now = typeof performance !== "undefined" ? performance.now() : Date.now();
  let map = styles.get(el);
  if (!map) styles.set(el, (map = new Map()));
  const hit = map.get(name);
  if (hit && now - hit.t < maxAgeMs) return hit.v;
  const v = getComputedStyle(el).getPropertyValue(name).trim();
  map.set(name, { v, t: now });
  return v;
}

/** Drop-in for `getComputedStyle(el)` when a draw loop only reads custom properties. */
export function cachedStyle(el: Element): { getPropertyValue: (name: string) => string } {
  return { getPropertyValue: (name: string) => cssVarOf(el, name) };
}
