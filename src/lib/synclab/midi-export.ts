/**
 * MIDI export. Notes are collected by running the same per-step scheduler the song uses
 * (scheduleStep) against a note-collecting stand-in for the audio engine, so the .mid file
 * contains exactly the notes and drum hits that play — patterns, loops, chains, arps and all.
 */
import { padNote } from "./drum-notes";
import { OFFLINE_LIVE, scheduleStep } from "./schedule-step";
import { tracksAtStep } from "./song-render";
import { stepSeconds } from "./timebase";
import type { DrumPad, Track, Transport } from "./types";

export interface MidiEvent { pitch: number; start: number; dur: number; vel: number }
export interface MidiTrackOut { name: string; drums: boolean; events: MidiEvent[] }

/** Collects every note the given tracks play from startStep for lengthSteps (times in seconds from the start). */
export function collectSongNotes(tracks: Track[], transport: Transport, startStep: number, lengthSteps: number): MidiTrackOut[] {
  const byId = new Map<string, MidiTrackOut>();
  const out = (id: string) => {
    let o = byId.get(id);
    if (!o) {
      const t = tracks.find((x) => x.id === id);
      o = { name: t?.name ?? "Track", drums: t?.kind === "drum", events: [] };
      byId.set(id, o);
    }
    return o;
  };
  const stepDur = stepSeconds(transport.bpm);
  const collector = {
    tempo: transport.bpm,
    playNote: (id: string, _patch: unknown, pitch: number, dur: number, vel: number, when?: number) => out(id).events.push({ pitch, start: when ?? 0, dur, vel }),
    playSample: (id: string, _s: unknown, pitch: number, dur: number, vel: number, when?: number) => out(id).events.push({ pitch, start: when ?? 0, dur, vel }),
    playDrum: (id: string, pad: DrumPad, vel: number, when?: number) => {
      const t = tracks.find((x) => x.id === id);
      out(id).events.push({ pitch: padNote(pad, t?.pads ?? [pad]), start: when ?? 0, dur: stepDur, vel });
    },
  };
  // Everything else the scheduler might call (clips, pitch bend, clicks) has no MIDI note: ignore it.
  const engine = new Proxy(collector, { get: (o, k) => (k in o ? (o as Record<string | symbol, unknown>)[k] : () => {}) });
  const tp: Transport = { ...transport, loop: false, metronome: false, recording: false };
  for (let i = 0; i < lengthSteps; i++) {
    const n = startStep + i;
    scheduleStep(engine as never, tracksAtStep(tracks, n), tp, n, i * stepDur, { ...OFFLINE_LIVE, lastScheduled: i === 0 ? null : n - 1 });
  }
  return [...byId.values()].filter((t) => t.events.length);
}

const PPQ = 96;

function vlq(n: number): number[] {
  let v = Math.max(0, Math.round(n));
  const bytes = [v & 0x7f];
  while ((v >>= 7)) bytes.unshift((v & 0x7f) | 0x80);
  return bytes;
}
const text = (s: string) => [...new TextEncoder().encode(s.slice(0, 64))];
function chunk(type: string, data: number[]): number[] {
  const len = data.length;
  return [...text(type), (len >>> 24) & 255, (len >>> 16) & 255, (len >>> 8) & 255, len & 255, ...data];
}

/** Writes a Standard MIDI File (type 1): a tempo/time-signature track, then one track per instrument. Drums use channel 10. */
export function writeMidiFile(tracks: MidiTrackOut[], bpm: number, beatsPerBar = 4): Blob {
  const secToTick = (s: number) => Math.round((s * bpm * PPQ) / 60);
  const usPerBeat = Math.round(60_000_000 / bpm);
  const conductor = [
    0, 0xff, 0x51, 3, (usPerBeat >> 16) & 255, (usPerBeat >> 8) & 255, usPerBeat & 255,
    0, 0xff, 0x58, 4, beatsPerBar, 2, 24, 8,
    0, 0xff, 0x2f, 0,
  ];
  const chunks = [chunk("MTrk", conductor)];
  let melodic = 0;
  for (const t of tracks) {
    const ch = t.drums ? 9 : (melodic++ % 15 >= 9 ? (melodic - 1) % 15 + 1 : (melodic - 1) % 15);
    const evs: { tick: number; bytes: number[]; off: boolean }[] = [];
    for (const e of t.events) {
      const p = Math.max(0, Math.min(127, Math.round(e.pitch)));
      const v = Math.max(1, Math.min(127, Math.round(e.vel * 127)));
      const on = secToTick(e.start);
      evs.push({ tick: on, bytes: [0x90 | ch, p, v], off: false });
      evs.push({ tick: Math.max(on + 1, secToTick(e.start + e.dur)), bytes: [0x80 | ch, p, 0], off: true });
    }
    // note-offs before note-ons at the same tick so repeated notes retrigger cleanly
    evs.sort((a, b) => a.tick - b.tick || Number(b.off) - Number(a.off));
    const nameBytes = text(t.name);
    const data = [0, 0xff, 0x03, ...vlq(nameBytes.length), ...nameBytes];
    let last = 0;
    for (const e of evs) { data.push(...vlq(e.tick - last), ...e.bytes); last = e.tick; }
    data.push(0, 0xff, 0x2f, 0);
    chunks.push(chunk("MTrk", data));
  }
  const header = chunk("MThd", [0, 1, (chunks.length >> 8) & 255, chunks.length & 255, (PPQ >> 8) & 255, PPQ & 255]);
  return new Blob([new Uint8Array([...header, ...chunks.flat()])], { type: "audio/midi" });
}
