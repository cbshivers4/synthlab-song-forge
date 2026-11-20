/**
 * Latency compensation helpers. Browsers report output delay (baseLatency +
 * outputLatency) but never the microphone round trip, so the input side is a
 * device-local offset the user can tune in Settings → Audio.
 */
const KEY = "synclab.recLatencyMs";
export const DEFAULT_INPUT_LATENCY_MS = 10;
let cached: number | null = null;

export function clampLatencyMs(ms: number): number {
  return Number.isFinite(ms)
    ? Math.max(0, Math.min(300, Math.round(ms)))
    : DEFAULT_INPUT_LATENCY_MS;
}

export function getInputLatencyMs(): number {
  if (cached != null) return cached;
  try {
    const raw = localStorage.getItem(KEY);
    cached = raw == null ? DEFAULT_INPUT_LATENCY_MS : clampLatencyMs(Number(raw));
  } catch {
    cached = DEFAULT_INPUT_LATENCY_MS;
  }
  return cached;
}

export function setInputLatencyMs(ms: number) {
  cached = clampLatencyMs(ms);
  try {
    localStorage.setItem(KEY, String(cached));
  } catch {
    /* storage unavailable */
  }
}

/** Seconds between scheduling a sound and it leaving the speakers. */
export function outputDelay(
  ctx: { baseLatency?: number; outputLatency?: number } | null | undefined,
): number {
  if (!ctx) return 0;
  const d = (ctx.baseLatency ?? 0) + (ctx.outputLatency ?? 0);
  return Number.isFinite(d) ? Math.max(0, Math.min(0.3, d)) : 0;
}

/**
 * Where a mic take belongs: the recorder started at heard step `startStep`;
 * the first `inputSec` of audio predates the performer's sound arriving, so it
 * is skipped via the clip offset and the playable length shrinks to match.
 */
export function alignedTake(startStep: number, duration: number, inputSec: number) {
  const offset = Math.max(0, Math.min(duration, inputSec));
  return { start: Math.max(0, startStep), offset, length: Math.max(0, duration - offset) };
}

/**
 * Where a take belongs when its recorder was already running before the song started
 * (it is opened during the count-in, or just before playback, so beat 1 is never missed).
 * `songHeardAt` is the audio-clock time step `songStep` reached the speakers (or, for a
 * channel print, the time it was produced); the audio recorded before that is skipped via
 * the clip offset, plus `inputSec` of microphone delay for mic takes.
 */
export function preRollTake(
  songStep: number,
  songHeardAt: number,
  recStartedAt: number,
  duration: number,
  inputSec: number,
) {
  const lead = Math.max(0, songHeardAt - recStartedAt);
  const offset = Math.max(0, Math.min(duration, lead + inputSec));
  return { start: Math.max(0, songStep), offset, length: Math.max(0, duration - offset) };
}
