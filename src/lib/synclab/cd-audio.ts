/**
 * Audio CD (Red Book) rules used by the CD burner: 44.1 kHz 16-bit stereo, sectors of 588
 * stereo frames (1/75 s), tracks of at least 4 seconds, at most 99 tracks, 74 or 80 minutes.
 */
export const CD_RATE = 44100;
export const CD_SECTOR_FRAMES = 588;
export const CD_MIN_TRACK_SECONDS = 4;
export const CD_MAX_TRACKS = 99;
/** Burners add a 2-second gap before each track after the first. */
export const CD_TRACK_GAP_SECONDS = 2;

/** Frames a track takes on the disc: at least 4 s, rounded up to whole sectors. */
export function cdTrackFrames(seconds: number): number {
  const frames = Math.ceil(Math.max(CD_MIN_TRACK_SECONDS, Math.max(0, seconds)) * CD_RATE);
  return Math.ceil(frames / CD_SECTOR_FRAMES) * CD_SECTOR_FRAMES;
}
export const cdTrackSeconds = (seconds: number) => cdTrackFrames(seconds) / CD_RATE;

/** Seconds of disc used by these track lengths, including the gaps between tracks. */
export function cdUsedSeconds(trackSeconds: readonly number[]): number {
  return trackSeconds.reduce(
    (sum, s, i) => sum + cdTrackSeconds(s) + (i > 0 ? CD_TRACK_GAP_SECONDS : 0),
    0,
  );
}

/** Seconds left on a disc of the given minutes for one more track (gap included). */
export function cdRemainingSeconds(trackSeconds: readonly number[], minutes: number): number {
  const gap = trackSeconds.length ? CD_TRACK_GAP_SECONDS : 0;
  return Math.max(0, minutes * 60 - cdUsedSeconds(trackSeconds) - gap);
}

export function cdCanAdd(
  trackSeconds: readonly number[],
  minutes: number,
  seconds: number,
): { ok: true } | { ok: false; reason: string } {
  if (trackSeconds.length >= CD_MAX_TRACKS)
    return { ok: false, reason: `An audio CD holds at most ${CD_MAX_TRACKS} tracks.` };
  if (cdTrackSeconds(seconds) > cdRemainingSeconds(trackSeconds, minutes))
    return { ok: false, reason: `That doesn't fit — the ${minutes}-minute disc is too full.` };
  return { ok: true };
}

/** mm:ss:ff with 75 frames per second, as used in CUE sheets. */
export function cdTimecode(seconds: number): string {
  const total = Math.max(0, Math.round(seconds * 75));
  const ff = total % 75;
  const ss = Math.floor(total / 75) % 60;
  const mm = Math.floor(total / 75 / 60);
  return [mm, ss, ff].map((n) => String(n).padStart(2, "0")).join(":");
}

const unsafe = /[\\/:*?"<>|\u0000-\u001f]/g;
/** Plain ASCII (accents dropped, other symbols to "-") so every burner and computer reads the names. */
const ascii = (s: string) =>
  s
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^\x20-\x7e]/g, "-");
export const cdSafeName = (name: string, fallback: string) =>
  ascii(name).replace(unsafe, "-").replace(/\s+/g, " ").trim().slice(0, 60) || fallback;

export const cdTrackFileName = (index: number, title: string) =>
  `${String(index + 1).padStart(2, "0")} - ${cdSafeName(title, `Track ${index + 1}`)}.wav`;

const cueText = (s: string) =>
  ascii(s)
    .replace(/"/g, "'")
    .replace(/[\r\n]+/g, " ")
    .trim()
    .slice(0, 80);

/** CUE sheet that points at one WAV file per track, with CD-Text titles. */
export function cdCueSheet(disc: {
  title: string;
  artist: string;
  tracks: readonly { title: string }[];
}): string {
  const lines = [
    `PERFORMER "${cueText(disc.artist) || "SYNCLAB"}"`,
    `TITLE "${cueText(disc.title) || "SYNCLAB CD"}"`,
  ];
  disc.tracks.forEach((track, i) => {
    lines.push(
      `FILE "${cdTrackFileName(i, track.title)}" WAVE`,
      `  TRACK ${String(i + 1).padStart(2, "0")} AUDIO`,
      `    TITLE "${cueText(track.title) || `Track ${i + 1}`}"`,
      `    PERFORMER "${cueText(disc.artist) || "SYNCLAB"}"`,
    );
    if (i > 0) lines.push(`    PREGAP ${cdTimecode(CD_TRACK_GAP_SECONDS)}`);
    lines.push(`    INDEX 01 00:00:00`);
  });
  return lines.join("\r\n") + "\r\n";
}

/**
 * Radius (in the disc's 60 mm scale) out to which the disc has been written: data is written
 * in a spiral at constant density, so the written area — not the radius — grows with time.
 */
export const CD_PROGRAM_INNER = 23;
export const CD_PROGRAM_OUTER = 58;
export function cdBurnRadius(fraction: number): number {
  const f = Math.max(0, Math.min(1, fraction));
  return Math.sqrt(CD_PROGRAM_INNER ** 2 + f * (CD_PROGRAM_OUTER ** 2 - CD_PROGRAM_INNER ** 2));
}

/** Pads a 44.1 kHz channel pair to whole sectors and the 4-second minimum. */
export function padForCd(left: Float32Array, right: Float32Array) {
  const frames = cdTrackFrames(left.length / CD_RATE);
  const l = new Float32Array(frames);
  const r = new Float32Array(frames);
  l.set(left.subarray(0, frames));
  r.set(right.subarray(0, frames));
  return { left: l, right: r, sampleRate: CD_RATE };
}
