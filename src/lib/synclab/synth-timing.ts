/**
 * Tempo maths for synth LFOs and the arpeggiator, shared by live playback, the scheduler and
 * offline export so a SYNC switch sounds the same everywhere.
 */

/** Musical LFO lengths in cycles per beat: 4 bars … 1/32 note. */
export const LFO_SYNC_DIVISIONS = [1 / 16, 1 / 8, 1 / 4, 1 / 2, 1, 2, 4, 8] as const;

/**
 * LFO speed in Hz. With SYNC on, the RATE knob snaps to the nearest musical length at the song
 * tempo (e.g. at 120 BPM, 2 Hz becomes exactly one cycle per beat), so the wobble stays on the grid
 * when the tempo changes.
 */
export function lfoHz(lfo: { rate: number; sync?: boolean | undefined }, bpm: number): number {
  const rate = Math.max(0.01, lfo.rate || 0);
  if (!lfo.sync) return rate;
  const beatHz = Math.max(20, bpm || 120) / 60;
  const wanted = rate / beatHz;
  let best: number = LFO_SYNC_DIVISIONS[0];
  for (const d of LFO_SYNC_DIVISIONS)
    if (Math.abs(Math.log(d / wanted)) < Math.abs(Math.log(best / wanted))) best = d;
  return best * beatHz;
}

/** Seconds of one 16th step at the fixed reference tempo used when arp TEMPO SYNC is off. */
export const FREE_ARP_STEP_SECONDS = 60 / 120 / 4;

/** Time between arp notes: follows the song with TEMPO SYNC on, a fixed 120 BPM clock when off. */
export function arpStepSeconds(
  arp: { rate: number; sync?: boolean | undefined },
  songStepSeconds: number,
): number {
  const rate = Math.max(0.25, arp.rate || 1);
  return ((arp.sync ?? true) ? songStepSeconds : FREE_ARP_STEP_SECONDS) / rate;
}

/** Start of arp note i: every second note is pushed late by SWING (0…1 → up to half a note). */
export function arpHitOffset(i: number, arpStep: number, swing: number | undefined): number {
  const s = Math.min(1, Math.max(0, swing ?? 0));
  return i * arpStep + (i % 2 === 1 ? s * arpStep * 0.5 : 0);
}
