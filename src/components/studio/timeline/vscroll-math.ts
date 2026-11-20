/** Thumb size and position for a custom vertical scroll bar the same height as the scroll area. */
export function thumbGeometry(
  scrollTop: number,
  scrollHeight: number,
  clientHeight: number,
  minThumb = 40,
) {
  const track = Math.max(1, clientHeight);
  const height = Math.min(
    track,
    Math.max(minThumb, (clientHeight * clientHeight) / Math.max(1, scrollHeight)),
  );
  const max = Math.max(0, scrollHeight - clientHeight);
  const offset = max > 0 ? (Math.min(max, Math.max(0, scrollTop)) / max) * (track - height) : 0;
  return { height, offset };
}

/** Scroll position for a thumb dragged to `thumbOffset` (clamped to the bar). */
export function scrollTopForThumb(
  thumbOffset: number,
  scrollHeight: number,
  clientHeight: number,
  minThumb = 40,
) {
  const { height } = thumbGeometry(0, scrollHeight, clientHeight, minThumb);
  const room = Math.max(1, clientHeight - height);
  const max = Math.max(0, scrollHeight - clientHeight);
  return (Math.min(room, Math.max(0, thumbOffset)) / room) * max;
}

/** Thumb size/position on a bar of any length (e.g. a horizontal bar narrower than the scroll area). */
export function thumbOnBar(
  scrollPos: number,
  scrollSize: number,
  clientSize: number,
  barLength: number,
  minThumb = 48,
) {
  const bar = Math.max(1, barLength);
  const size = Math.min(bar, Math.max(minThumb, (bar * clientSize) / Math.max(1, scrollSize)));
  const max = Math.max(0, scrollSize - clientSize);
  const offset = max > 0 ? (Math.min(max, Math.max(0, scrollPos)) / max) * (bar - size) : 0;
  return { size, offset };
}

/** Scroll position for a thumb dragged to `thumbOffset` along a bar of `barLength`. */
export function scrollForThumbOnBar(
  thumbOffset: number,
  scrollSize: number,
  clientSize: number,
  barLength: number,
  minThumb = 48,
) {
  const { size } = thumbOnBar(0, scrollSize, clientSize, barLength, minThumb);
  const room = Math.max(1, barLength - size);
  const max = Math.max(0, scrollSize - clientSize);
  return (Math.min(room, Math.max(0, thumbOffset)) / room) * max;
}
