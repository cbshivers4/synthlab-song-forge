import { getEngine } from "./audio-engine";
import { activeSongClock } from "./song-clock";
import { chordAt, chordName, genKeysBar, keysBarOptions, type KeyNote, type KeysBarOptions, type KeysSettings } from "./keyboardist";
import type { Track } from "./types";

/**
 * The Live Keys player: a session-wide singleton like the Live Drummer's (it keeps playing while
 * you switch panels). It schedules each step on the audio clock just ahead of time. While the
 * song plays it locks to the song scheduler's steps (song-clock.ts) so chord changes and fills
 * land on the song's bars; otherwise it free-runs at the song tempo. Notes play through the
 * keyboard player's own instrument channel (engine.playNote), so its sound, fader, mute,
 * effects and bypass all apply.
 */
export interface KeysSnapshot {
  running: boolean;
  following: boolean;
  waiting: boolean;
  bar: number;
  step: number;
  fillQueued: boolean;
  breakQueued: boolean;
  hitQueued: boolean;
  /** notes of the bar being played, for the display */
  notes: KeyNote[];
  chord: string;
  nextChord: string;
  /** bars captured while following the song (Print my performance) */
  captured: number;
}

const LOOKAHEAD = 0.12;
const SONG_WAIT = 3;
export type KeysStart = "alone" | "song";

class KeysPlayer {
  private track: Track | null = null;
  private bpm = 120;
  private swing = 0;
  private spb = 16;
  private timer: ReturnType<typeof setInterval> | null = null;
  private running = false;
  private following = false;
  private ignoreSong = false;
  private waitSince: number | null = null;
  private noteListeners = new Set<(pitch: number, vel: number, seconds: number) => void>();
  private nextStep = 0;
  private nextTime = 0;
  private lastTime = 0;
  private cache = new Map<number, KeyNote[]>();
  private forced = new Map<number, KeysBarOptions>();
  private queued: { fill: number | null; fillAt: number; brk: number | null; hit: number | null } = { fill: null, fillAt: 0, brk: null, hit: null };
  private captured = new Map<number, KeyNote[]>();
  private shown = { bar: 0, step: 0 };
  private listeners = new Set<() => void>();

  /** The bridge keeps the player pointed at the latest keys channel and song settings. */
  sync(track: Track | null, bpm: number, swing: number, stepsPerBar: number) {
    const prev = this.track?.keyboardist;
    if (track?.id !== this.track?.id) { this.cache.clear(); this.captured.clear(); }
    this.track = track;
    this.bpm = bpm;
    this.swing = swing;
    if (stepsPerBar !== this.spb) { this.spb = stepsPerBar; this.cache.clear(); }
    if (track?.keyboardist !== prev) this.invalidate();
    if (!track?.keyboardist && this.running) this.stop();
  }

  get trackId() { return this.track?.id ?? null; }

  start(mode: KeysStart = "alone") {
    if (this.running || !this.track?.keyboardist) return;
    const ctx = getEngine().init();
    this.running = true;
    this.following = false;
    this.ignoreSong = mode === "alone";
    this.waitSince = mode === "song" ? ctx.currentTime : null;
    this.cache.clear();
    this.forced.clear();
    this.nextStep = 0;
    this.nextTime = ctx.currentTime + 0.06;
    this.lastTime = ctx.currentTime;
    this.tick();
    this.timer = setInterval(() => this.tick(), 25);
    this.emit();
  }

  stop() {
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
    const wasRunning = this.running;
    this.running = false;
    this.following = false;
    this.ignoreSong = false;
    this.waitSince = null;
    this.queued = { fill: null, fillAt: 0, brk: null, hit: null };
    // Lift the hands: held chords stop with the player (the song's own channels are left alone).
    const engine = getEngine();
    if (wasRunning && this.track && engine.ctx && !activeSongClock(engine.ctx.currentTime)) engine.silenceChannels([this.track.id]);
    this.emit();
  }

  toggle() { if (this.running) this.stop(); else this.start(); }
  /** Fill now: the current bar ends with a run if there is still room, otherwise the next one. */
  fill() { this.place("fill"); this.emit(); }
  /** Lay out for the next bar, coming back in with a big chord. */
  breakNext() { this.place("brk"); this.emit(); }
  /** A big chord on the next downbeat. */
  hitNext() { this.place("hit"); this.emit(); }

  invalidate() {
    const keep = this.shown.bar;
    for (const bar of [...this.cache.keys()]) if (bar >= keep) this.cache.delete(bar);
    this.emit();
  }

  snapshot(): KeysSnapshot {
    const bar = this.shown.bar;
    const s = this.track?.keyboardist;
    const now = s ? chordAt(s, bar, this.shown.step, this.spb) : null;
    let next = "";
    if (s && now) {
      for (let k = this.shown.step + 1; k < this.spb * 2; k++) {
        const c = chordAt(s, bar + Math.floor(k / this.spb), k % this.spb, this.spb);
        if (c !== now) { next = chordName(s, c); break; }
      }
    }
    return {
      running: this.running, following: this.following, waiting: this.running && this.waitSince !== null, bar, step: this.shown.step,
      fillQueued: this.queued.fill !== null, breakQueued: this.queued.brk !== null, hitQueued: this.queued.hit !== null,
      notes: this.cache.get(bar) ?? (s ? genKeysBar(s, bar, this.spb, keysBarOptions(s, bar)) : []),
      chord: s && now ? chordName(s, now) : "", nextChord: next, captured: this.captured.size,
    };
  }

  performance(): { bar: number; notes: KeyNote[] }[] {
    return [...this.captured.entries()].sort((a, b) => a[0] - b[0]).map(([bar, notes]) => ({ bar, notes }));
  }
  clearPerformance() { this.captured.clear(); this.emit(); }

  subscribe(fn: () => void) { this.listeners.add(fn); return () => void this.listeners.delete(fn); }
  /** Called as each note is heard (for the keyboard picture). */
  onNote(fn: (pitch: number, vel: number, seconds: number) => void) { this.noteListeners.add(fn); return () => void this.noteListeners.delete(fn); }
  private emit() { this.listeners.forEach((l) => l()); }

  private place(kind: "fill" | "brk" | "hit") {
    if (!this.running) return;
    const settings = this.track?.keyboardist;
    if (kind === "fill") {
      const fillLen = Math.min(this.spb, (settings?.fills ?? 0.5) > 0.5 ? 8 : 4);
      const target = this.nextStep % this.spb < this.spb - fillLen ? this.barOf(this.nextStep) : this.barOf(this.nextStep) + 1;
      this.forced.set(target, { ...this.forced.get(target), fill: true });
      this.forced.set(target + 1, { ...this.forced.get(target + 1), hit: true });
      this.cache.delete(target); this.cache.delete(target + 1);
      this.queued.fill = target; this.queued.fillAt = this.spb - fillLen;
    } else if (kind === "brk") {
      const target = this.barOf(this.nextStep) + 1;
      this.forced.set(target, { ...this.forced.get(target), silent: true });
      this.forced.set(target + 1, { ...this.forced.get(target + 1), hit: true });
      this.cache.delete(target); this.cache.delete(target + 1);
      this.queued.brk = target;
    } else {
      const target = this.barOf(this.nextStep) + (this.nextStep % this.spb === 0 ? 0 : 1);
      this.forced.set(target, { ...this.forced.get(target), hit: true });
      this.cache.delete(target);
      this.queued.hit = target;
    }
  }

  private barOf(step: number) { return Math.max(0, Math.floor(step / this.spb)); }

  private barNotes(bar: number): KeyNote[] {
    const hit = this.cache.get(bar);
    if (hit) return hit;
    const settings = this.track?.keyboardist;
    if (!settings) return [];
    const opts = { ...keysBarOptions(settings, bar), ...this.forced.get(bar) };
    const notes = genKeysBar(settings, bar, this.spb, opts);
    this.cache.set(bar, notes);
    if (this.cache.size > 16) for (const k of [...this.cache.keys()]) if (k < bar - 4) this.cache.delete(k);
    for (const k of [...this.forced.keys()]) if (k < bar - 1) this.forced.delete(k);
    return notes;
  }

  private tick() {
    const engine = getEngine();
    const ctx = engine.ctx;
    if (!ctx || !this.running) return;
    const now = ctx.currentTime;
    let song = activeSongClock(now);
    if (song && this.ignoreSong) song = null;
    else if (!song) this.ignoreSong = false;
    if (this.waitSince !== null) {
      if (!song) {
        if (now - this.waitSince > SONG_WAIT) this.stop();
        return;
      }
      this.waitSince = null;
    }
    if (song) {
      if (!this.following) { this.following = true; this.cache.clear(); this.emit(); }
      const steps: { step: number; time: number }[] = [];
      for (let j = 0; j < 64; j++) {
        const time = song.time - j * song.dur;
        if (time <= this.lastTime + 1e-4 || time < now - 0.005) break;
        steps.push({ step: song.step - j, time });
      }
      steps.reverse().forEach(({ step, time }) => this.play(Math.max(0, step), time, song.dur, true));
      if (steps.length) this.lastTime = steps[steps.length - 1]!.time;
      return;
    }
    if (this.following) { this.stop(); return; }
    const dur = 60 / Math.max(20, this.bpm) / 4;
    // After a stall (busy page, background tab) skip the steps that are already late instead of
    // firing them all at once: a pile of late chords lands together as one loud, distorted burst.
    while (this.nextTime < now - 0.03) {
      this.lastTime = Math.max(this.lastTime, this.nextTime);
      this.nextTime += dur;
      this.nextStep++;
    }
    while (this.nextTime < now + LOOKAHEAD) {
      if (this.nextTime > this.lastTime + 1e-4) this.play(this.nextStep, this.nextTime, dur, false);
      this.lastTime = Math.max(this.lastTime, this.nextTime);
      this.nextTime += dur;
      this.nextStep++;
    }
  }

  private play(step: number, time: number, dur: number, follow: boolean) {
    const t = this.track;
    if (!t?.keyboardist || !t.patch) return;
    const spb = this.spb;
    const bar = Math.floor(step / spb);
    const s = step % spb;
    if (follow) this.nextStep = step + 1;
    const notes = this.barNotes(bar);
    const here = notes.filter((n) => Math.floor(n.step) === s);
    if (follow) {
      if (s === 0 || !this.captured.has(bar)) this.captured.set(bar, []);
      this.captured.get(bar)!.push(...here);
    }
    const q = this.queued;
    const landed = (q.fill !== null && (bar > q.fill || (bar === q.fill && s >= q.fillAt))) || (q.brk !== null && bar >= q.brk) || (q.hit !== null && bar >= q.hit);
    if (q.fill !== null && (bar > q.fill || (bar === q.fill && s >= q.fillAt))) q.fill = null;
    if (q.brk !== null && bar >= q.brk) q.brk = null;
    if (q.hit !== null && bar >= q.hit) q.hit = null;
    const prevBar = this.shown.bar;
    this.shown = { bar, step: s };
    const engine = getEngine();
    const ahead = Math.max(0, (time - (engine.ctx?.currentTime ?? time)) * 1000);
    if (bar !== prevBar || s === 0 || landed) setTimeout(() => this.emit(), ahead);
    if (t.muted || t.deviceBypassed || !here.length) return;
    const swung = time + (s % 2 === 1 ? Math.min(0.9, Math.max(0, this.swing)) * 0.5 * dur : 0);
    const oct = (t.octave ?? 0) * 12;
    for (const n of here) {
      const when = swung + (n.step - s) * dur;
      const seconds = Math.max(0.05, n.length * dur * 0.96);
      engine.playNote(t.id, t.patch, n.pitch + oct, seconds, n.vel, when);
      if (this.noteListeners.size) {
        const pitch = n.pitch, vel = n.vel;
        setTimeout(() => this.noteListeners.forEach((l) => l(pitch, vel, seconds)), Math.max(0, (when - (engine.ctx?.currentTime ?? when)) * 1000));
      }
    }
  }
}

let player: KeysPlayer | null = null;
export function getKeysPlayer() { return (player ??= new KeysPlayer()); }
