/**
 * SYNCLAB project timebase.
 *
 * One clock for the whole app: a "step" is a 1/16 note, 4 steps make a beat and
 * 16 steps make a bar. The timeline, the piano roll, the drum machine, the
 * sequencer, loop markers, song sections and the playback scheduler all measure
 * positions in these same steps, so what you see is what you hear.
 */

export const STEPS_PER_BEAT = 4;
export const BEATS_PER_BAR = 4;
export const STEPS_PER_BAR = STEPS_PER_BEAT * BEATS_PER_BAR; // 16

/** Total length of the song in steps. */
export const songSteps = (bars?: number | null) => Math.max(1, bars ?? 4) * STEPS_PER_BAR;

/** How many bars are needed to hold this many steps. */
export const barsForSteps = (steps: number) => Math.max(1, Math.ceil(steps / STEPS_PER_BAR));

/** Length of one step in seconds at a given tempo. */
export const stepSeconds = (bpm: number) => 60 / Math.max(20, bpm) / STEPS_PER_BEAT;

/** Length of one bar in seconds at a given tempo. */
export const barSeconds = (bpm: number) => stepSeconds(bpm) * STEPS_PER_BAR;

/** Musical position readout for a step, 1-indexed: bar 1, beat 1 is the start. */
export const barBeat = (step: number) => ({
  bar: Math.floor(Math.max(0, step) / STEPS_PER_BAR) + 1,
  beat: Math.floor((Math.max(0, step) % STEPS_PER_BAR) / STEPS_PER_BEAT) + 1,
});

/** "01.3" style position label. */
export const positionLabel = (step: number) => {
  const { bar, beat } = barBeat(step);
  return `${String(bar).padStart(2, "0")}.${beat}`;
};
