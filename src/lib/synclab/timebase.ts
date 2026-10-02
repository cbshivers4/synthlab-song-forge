/**
 * SYNCLAB project timebase.
 *
 * One clock for the whole app: a "step" is a 1/16 note and 4 steps make a beat
 * (a quarter note). A bar holds the project's beats-per-bar (time signature
 * numerator over 4, e.g. 3/4, 5/4, 7/4). The timeline, sequencer, loop markers,
 * song sections, metronome and playback scheduler all measure positions in
 * these same steps, so what you see is what you hear.
 *
 * The meter is a module-level value kept in sync by the studio store
 * (setBeatsPerBar) so every helper below follows the current time signature.
 */

export const STEPS_PER_BEAT = 4;
export const METERS = [2, 3, 4, 5, 6, 7] as const;

let beatsPerBar = 4;
export const getBeatsPerBar = () => beatsPerBar;
export const setBeatsPerBar = (n: number | null | undefined) => {
  const v = Math.round(Number(n));
  beatsPerBar = v >= 1 && v <= 16 ? v : 4;
};
/** Steps in one bar at the current time signature (16 in 4/4). */
export const stepsPerBar = () => STEPS_PER_BEAT * beatsPerBar;

/** Total length of the song in steps. */
export const songSteps = (bars?: number | null) => Math.max(1, bars ?? 4) * stepsPerBar();

/** How many bars are needed to hold this many steps. */
export const barsForSteps = (steps: number) => Math.max(1, Math.ceil(steps / stepsPerBar()));

/** Length of one step in seconds at a given tempo. */
export const stepSeconds = (bpm: number) => 60 / Math.max(20, bpm) / STEPS_PER_BEAT;

/** Length of one bar in seconds at a given tempo. */
export const barSeconds = (bpm: number) => stepSeconds(bpm) * stepsPerBar();

/** Musical position readout for a step, 1-indexed: bar 1, beat 1 is the start. */
export const barBeat = (step: number) => ({
  bar: Math.floor(Math.max(0, step) / stepsPerBar()) + 1,
  beat: Math.floor((Math.max(0, step) % stepsPerBar()) / STEPS_PER_BEAT) + 1,
});

/** "01.3" style position label. */
export const positionLabel = (step: number) => {
  const { bar, beat } = barBeat(step);
  return `${String(bar).padStart(2, "0")}.${beat}`;
};
