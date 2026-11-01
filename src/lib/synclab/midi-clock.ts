/**
 * MIDI clock — sync SYNCLAB with drum machines, grooveboxes and other DAWs over MIDI.
 *
 * Send:   24 clock pulses per beat (0xF8) to every MIDI output, timed from the song
 *         scheduler's audio clock, plus Start (0xFA), Continue (0xFB, after a Song Position
 *         Pointer 0xF2) and Stop (0xFC) with the transport.
 * Follow: Start / Continue / Stop from an enabled MIDI input start and stop the song, and the
 *         incoming clock sets the song tempo (averaged, so jitter doesn't wobble the tempo).
 *
 * Web MIDI timestamps are on the performance.now() clock; audio times are converted with the
 * AudioContext's output timestamp so pulses leave when that step is heard.
 */
import { getMidiAccess } from "./midi";

export const PPQN = 24;
/** One SYNCLAB step is a 16th note: 6 clock pulses. */
export const PULSES_PER_STEP = PPQN / 4;

export interface MidiClockPrefs {
  send: boolean;
  follow: boolean;
}
const KEY = "synclab.midiClock";
const EVENT = "synclab:midi-clock-prefs";
let cached: MidiClockPrefs | null = null;

export function midiClockPrefs(): MidiClockPrefs {
  if (cached) return cached;
  try {
    const raw = JSON.parse(localStorage.getItem(KEY) || "{}") as Partial<MidiClockPrefs>;
    cached = { send: raw.send === true, follow: raw.follow === true };
  } catch {
    cached = { send: false, follow: false };
  }
  return cached;
}
export function setMidiClockPrefs(patch: Partial<MidiClockPrefs>) {
  cached = { ...midiClockPrefs(), ...patch };
  try { localStorage.setItem(KEY, JSON.stringify(cached)); } catch { /* storage blocked */ }
  window.dispatchEvent(new CustomEvent(EVENT));
}
export function onMidiClockPrefs(cb: () => void) {
  window.addEventListener(EVENT, cb);
  return () => window.removeEventListener(EVENT, cb);
}

/** Audio-clock times of the clock pulses inside one step. */
export function pulseTimes(stepTime: number, stepDur: number): number[] {
  return Array.from({ length: PULSES_PER_STEP }, (_, i) => stepTime + (i * stepDur) / PULSES_PER_STEP);
}

/** Song Position Pointer bytes for a position in 16th-note steps (MIDI beats are 16ths). */
export function songPositionBytes(step: number): [number, number, number] {
  const beats = Math.max(0, Math.min(16383, Math.floor(step)));
  return [0xf2, beats & 0x7f, (beats >> 7) & 0x7f];
}

/** Tempo from incoming clock pulses: average of recent pulse gaps, ignoring stalls. */
export class ClockTempo {
  private last: number | null = null;
  private gaps: number[] = [];
  /** Feed one pulse time (ms). Returns the tempo once a full beat of steady pulses has arrived. */
  pulse(ms: number): number | null {
    const prev = this.last;
    this.last = ms;
    if (prev === null) return null;
    const gap = ms - prev;
    if (gap <= 0 || gap > 250) { this.gaps = []; return null; } // < 10 BPM or a stall: start over
    this.gaps.push(gap);
    if (this.gaps.length > PPQN * 2) this.gaps.shift();
    if (this.gaps.length < PPQN) return null;
    const avg = this.gaps.reduce((a, b) => a + b, 0) / this.gaps.length;
    return 60000 / (avg * PPQN);
  }
  reset() { this.last = null; this.gaps = []; }
}

type Out = { send: (data: number[], timestamp?: number) => void };
async function outputs(): Promise<Out[]> {
  const a = await getMidiAccess();
  const outs = (a as unknown as { outputs?: Map<string, Out> } | null)?.outputs;
  return outs ? Array.from(outs.values()) : [];
}
let outCache: Out[] = [];
let outCacheAt = 0;
async function cachedOutputs() {
  if (performance.now() - outCacheAt > 2000) {
    outCache = await outputs();
    outCacheAt = performance.now();
  }
  return outCache;
}

/** performance.now() time at which audio-clock time `t` is heard. */
function perfTimeFor(ctx: AudioContext, t: number) {
  const stamp = ctx.getOutputTimestamp?.();
  if (stamp?.contextTime != null && stamp.performanceTime != null && stamp.performanceTime > 0) {
    return stamp.performanceTime + (t - stamp.contextTime) * 1000;
  }
  return performance.now() + (t - ctx.currentTime) * 1000;
}

/** Called by the scheduler for every step it schedules. */
export function sendClockForStep(ctx: AudioContext, stepTime: number, stepDur: number) {
  if (!midiClockPrefs().send) return;
  void cachedOutputs().then((outs) => {
    if (!outs.length) return;
    for (const t of pulseTimes(stepTime, stepDur)) {
      const at = Math.max(performance.now(), perfTimeFor(ctx, t));
      for (const o of outs) { try { o.send([0xf8], at); } catch { /* port went away */ } }
    }
  });
}

/** Start from the top, or continue from a song position. */
export function sendTransportStart(step: number) {
  if (!midiClockPrefs().send) return;
  void outputs().then((outs) => {
    for (const o of outs) {
      try {
        if (step <= 0) o.send([0xfa]);
        else { o.send(songPositionBytes(step)); o.send([0xfb]); }
      } catch { /* port went away */ }
    }
  });
}
export function sendTransportStop() {
  if (!midiClockPrefs().send) return;
  void outputs().then((outs) => { for (const o of outs) { try { o.send([0xfc]); } catch { /* port went away */ } } });
}

/* ---- incoming realtime messages (from the shared MIDI subscription) ---- */
export type RealtimeKind = "clock" | "start" | "continue" | "stop";
const realtime = new Set<(kind: RealtimeKind, ms: number) => void>();
export function onMidiRealtime(cb: (kind: RealtimeKind, ms: number) => void) {
  realtime.add(cb);
  return () => { realtime.delete(cb); };
}
/** Returns true when the byte was a clock/transport message (handled here, not as a note). */
export function dispatchRealtime(status: number, ms: number): boolean {
  const kind: RealtimeKind | null = status === 0xf8 ? "clock" : status === 0xfa ? "start" : status === 0xfb ? "continue" : status === 0xfc ? "stop" : null;
  if (!kind) return false;
  if (midiClockPrefs().follow) for (const cb of realtime) cb(kind, ms);
  return true;
}
