/** Display magnification only: never changes audio gain or dB meter readings. */
export function waveformDisplayGain(peak: number): number {
  if (!Number.isFinite(peak) || peak <= 0.00001) return 1;
  return Math.max(1, Math.min(64, 0.8 / peak));
}