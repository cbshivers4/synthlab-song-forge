/**
 * Interface recordings often land on one side only: a mic in input 1 of a
 * stereo interface fills the left channel and leaves the right silent, so the
 * sound only comes out of one speaker. When one side is silent and the other
 * carries sound, copy the sounding side across so it plays centred.
 * Real stereo (both sides carry sound) is never changed.
 */
const SILENT = 0.001; // about -60 dBFS
const SOUNDING = 0.01; // about -40 dBFS

function peak(data: Float32Array) {
  let p = 0;
  for (let i = 0; i < data.length; i++) {
    const v = Math.abs(data[i] ?? 0);
    if (v > p) p = v;
    if (p >= SILENT && p >= SOUNDING) break;
  }
  return p;
}

/** Returns which side was copied ("left" means the left side now fills both), or null. */
export function centerOneSided(buffer: { numberOfChannels: number; getChannelData(c: number): Float32Array }): "left" | "right" | null {
  if (buffer.numberOfChannels !== 2) return null;
  const l = buffer.getChannelData(0);
  const r = buffer.getChannelData(1);
  const pl = peak(l), pr = peak(r);
  if (pl >= SOUNDING && pr < SILENT) { r.set(l); return "left"; }
  if (pr >= SOUNDING && pl < SILENT) { l.set(r); return "right"; }
  return null;
}
