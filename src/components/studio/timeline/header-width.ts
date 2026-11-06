/** Track-name column width limits. Phones can shrink it a lot to show more of the timeline. */
export const HEADER_WIDTH = {
  desktop: { min: 220, max: 600, initial: 294, key: "synclab.timeline.headerWidth" },
  phone: { min: 120, max: 420, initial: 258, key: "synclab.timeline.headerWidth.phone" },
} as const;

export function clampHeaderWidth(width: number, phone: boolean) {
  const { min, max } = phone ? HEADER_WIDTH.phone : HEADER_WIDTH.desktop;
  return Math.round(Math.min(max, Math.max(min, width)));
}
