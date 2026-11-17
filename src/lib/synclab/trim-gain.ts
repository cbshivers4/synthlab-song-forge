/**
 * Mixer GAIN (input trim) range, shared by every channel strip, the master strip,
 * the phone mixer, MIDI learn and the audio engine. The knob works in dB like a
 * console trim; projects store the linear multiplier (Track.gain / BusState.gain).
 */
export const TRIM_MIN_DB = -24;
export const TRIM_MAX_DB = 24;
export const TRIM_MAX_GAIN = Math.pow(10, TRIM_MAX_DB / 20);

/** Linear trim → dB, clamped to the knob range (0 or missing reads as the bottom stop). */
export function trimDb(gain: number | undefined): number {
  const g = gain ?? 1;
  if (!(g > 0)) return TRIM_MIN_DB;
  const db = 20 * Math.log10(g);
  return Math.min(TRIM_MAX_DB, Math.max(TRIM_MIN_DB, Math.round(db * 10) / 10));
}

/** dB on the knob → stored linear multiplier. */
export function trimGain(db: number): number {
  const d = Math.min(TRIM_MAX_DB, Math.max(TRIM_MIN_DB, db));
  return Math.pow(10, d / 20);
}

/** Engine-side safety clamp for any stored value. */
export function clampTrim(gain: number | undefined): number {
  const g = gain ?? 1;
  return Number.isFinite(g) ? Math.min(TRIM_MAX_GAIN, Math.max(0, g)) : 1;
}

/** A controller knob (0..1) sweeps the same dB range as the on-screen knob. */
export function trimFromCc(v: number): number {
  const n = Math.min(1, Math.max(0, v));
  return trimGain(Math.round((TRIM_MIN_DB + n * (TRIM_MAX_DB - TRIM_MIN_DB)) * 2) / 2);
}

export function trimText(gain: number | undefined): string {
  const db = trimDb(gain);
  return `${db > 0 ? "+" : ""}${db.toFixed(1)} dB`;
}

/** Compact knob readout in dB: "+6", "0", "-12.5". */
export function trimKnobText(db: number): string {
  const r = Math.round(db * 2) / 2;
  return `${r > 0 ? "+" : ""}${Number.isInteger(r) ? r : r.toFixed(1)}dB`;
}
