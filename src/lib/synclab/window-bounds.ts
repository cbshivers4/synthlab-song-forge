export type WindowBounds = { x: number; y: number; w: number; h: number };
export function fitWindow(bounds: WindowBounds, viewport: { w: number; h: number }): WindowBounds {
  const w = Math.min(Math.max(300, bounds.w), viewport.w);
  const h = Math.min(Math.max(180, bounds.h), viewport.h);
  return { w, h, x: Math.max(0, Math.min(viewport.w - w, bounds.x)), y: Math.max(0, Math.min(viewport.h - h, bounds.y)) };
}