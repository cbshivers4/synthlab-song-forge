/** Presentation only: the transport remains the single musical clock. */
export function recordingPosition(step: number, beatsPerBar: number) {
  const beats = Math.max(1, beatsPerBar);
  const barSteps = beats * 4;
  const safe = Math.max(0, step);
  const within = safe % barSteps;
  return {
    bar: Math.floor(safe / barSteps) + 1,
    beat: Math.floor(within / 4) + 1,
    nextBar: Math.floor(safe / barSteps) + 2,
    beatsRemaining: (barSteps - within) / 4,
    progress: within / barSteps,
  };
}

export function recordingFollowScroll(step: number, totalSteps: number, width: number, headerWidth: number, visibleWidth: number, scrollLeft: number) {
  const x = headerWidth + (step / Math.max(1, totalSteps)) * Math.max(1, width - headerWidth);
  const margin = Math.min(80, visibleWidth / 4);
  if (x >= scrollLeft + margin && x <= scrollLeft + visibleWidth - margin) return scrollLeft;
  return Math.min(Math.max(0, width - visibleWidth), Math.max(0, x - visibleWidth * 0.4));
}