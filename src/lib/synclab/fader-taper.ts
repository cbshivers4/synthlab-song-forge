/**
 * Console-style fader travel. Channel volume is stored as a linear gain
 * (1 = 0 dB); the fader position follows a dB taper like a hardware desk, so
 * the top of the throw reaches +6 dB and every centimetre of travel is audible.
 */
export const FADER_MAX_GAIN = 2; // ≈ +6 dB

/** Fader position (0..1) at each dB mark; positions between marks interpolate in dB. */
const TAPER: readonly [db: number, pos: number][] = [
  [-60, 0.04],
  [-40, 0.15],
  [-30, 0.25],
  [-20, 0.4],
  [-10, 0.6],
  [-5, 0.7],
  [0, 0.8],
  [20 * Math.log10(FADER_MAX_GAIN), 1],
];

const dbToGain = (db: number) => Math.pow(10, db / 20);
const FLOOR_GAIN = dbToGain(-60);

/** Fader position (0..1) → linear gain (0..FADER_MAX_GAIN). */
export function faderGain(position: number): number {
  const p = Math.min(1, Math.max(0, Number.isFinite(position) ? position : 0));
  if (p <= 0) return 0;
  const first = TAPER[0]!;
  if (p < first[1]) return FLOOR_GAIN * (p / first[1]);
  for (let i = 1; i < TAPER.length; i++) {
    const [db0, p0] = TAPER[i - 1]!;
    const [db1, p1] = TAPER[i]!;
    if (p >= 1) return FADER_MAX_GAIN;
    if (p <= p1) return dbToGain(db0 + ((p - p0) / (p1 - p0)) * (db1 - db0));
  }
  return FADER_MAX_GAIN;
}

/** Linear gain → fader position (0..1); the inverse of faderGain. */
export function faderPosition(gain: number): number {
  const g = Number.isFinite(gain) ? gain : 0;
  if (g <= 0) return 0;
  const first = TAPER[0]!;
  if (g < FLOOR_GAIN) return (g / FLOOR_GAIN) * first[1];
  const db = 20 * Math.log10(g);
  for (let i = 1; i < TAPER.length; i++) {
    const [db0, p0] = TAPER[i - 1]!;
    const [db1, p1] = TAPER[i]!;
    if (db <= db1) return p0 + ((db - db0) / (db1 - db0)) * (p1 - p0);
  }
  return 1;
}

/** Position of a dB mark on the fader scale (for tick labels beside the fader). */
export const faderTickPosition = (db: number) => faderPosition(dbToGain(db));
