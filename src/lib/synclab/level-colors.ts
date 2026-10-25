/** Shared green / orange / red level colours for every meter, scope and effect display. */
export const LEVEL_GREEN = "oklch(0.78 0.18 145)";
export const LEVEL_ORANGE = "oklch(0.76 0.18 55)";
export const LEVEL_RED = "oklch(0.63 0.24 27)";

/** Peak (linear 0..1+) at or above −1 dBFS is clipping red; −6 dBFS and up is hot orange. */
export const ORANGE_AT = 0.5;
export const RED_AT = 0.89;

/** Shared mixer scale: -48 to +6 dBFS, including an actual overload zone. */
export const mixerDbToFraction = (db: number) => Math.min(1, Math.max(0, (db + 48) / 54));
export const mixerFractionToDb = (fraction: number) => fraction * 54 - 48;
export const mixerSegmentDb = (index: number, count = 32) => mixerFractionToDb((index + 1) / count);

export function levelColor(peak: number): string {
  if (peak >= RED_AT) return LEVEL_RED;
  if (peak >= ORANGE_AT) return LEVEL_ORANGE;
  return LEVEL_GREEN;
}

/** Same thresholds expressed in dBFS (for meters drawn on a dB scale). */
export function dbColor(db: number): string {
  if (db >= -1) return LEVEL_RED;
  if (db >= -6) return LEVEL_ORANGE;
  return LEVEL_GREEN;
}

export function peakOf(data: ArrayLike<number> | null | undefined): number {
  if (!data) return 0;
  let p = 0;
  for (let i = 0; i < data.length; i++) {
    const a = Math.abs(data[i] ?? 0);
    if (a > p) p = a;
  }
  return p;
}

/** Spectrum displays: louder bins move toward orange/red (dB relative to full scale). */
export function spectrumColor(db: number): string {
  if (db >= -12) return LEVEL_RED;
  if (db >= -30) return LEVEL_ORANGE;
  return LEVEL_GREEN;
}
