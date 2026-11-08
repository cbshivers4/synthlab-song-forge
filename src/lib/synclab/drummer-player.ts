import { getEngine } from "./audio-engine";
import { activeSongClock } from "./song-clock";
import { barOptions, genBar, padForRole, type BarOptions, type DrumHit, type DrummerSettings } from "./drummer";
import type { Track } from "./types";

/**
 * The Live Drummer's player: a session-wide singleton (it keeps playing while you switch
 * panels). It schedules each step on the audio clock just ahead of time. While the song plays
 * it locks to the song scheduler's steps (song-clock.ts) so fills land on the song's bars and
 * swing matches; otherwise it free-runs at the song tempo. Hits play through the drummer's own
 * drum channel, so its fader, mute, effects and bypass all apply.
 */
export interface DrummerSnapshot {
  running: boolean;
  following: boolean;
  bar: number;
  step: number;
  fillQueued: boolean;
  breakQueued: boolean;
  crashQueued: boolean;
  /** hits of the bar being played, for the groove display */
  hits: DrumHit[];
  /** bars captured while following the song (Print my performance) */
  captured: number;
}

const LOOKAHEAD = 0.12;

class DrummerPlayer {
  private track: Track | null = null;
  private bpm = 120;
  private swing = 0;
  private spb = 16;
  private timer: ReturnType<typeof setInterval> | null = null;
  private running = false;
  private following = false;
  private nextStep = 0;
  private nextTime = 0;
  private lastTime = 0;
  private cache = new Map<number, DrumHit[]>();
  private forced = new Map<number, BarOptions>();
  private queued = { fill: false, brk: false, crash: false };
  private captured = new Map<number, DrumHit[]>();
  private shown = { bar: 0, step: 0, time: 0 };
  private listeners = new Set<() => void>();

  /** The bridge keeps the player pointed at the latest drummer channel and song settings. */
  sync(track: Track | null, bpm: number, swing: number, stepsPerBar: number) {
    const prev = this.track?.drummer;
    if (track?.id !== this.track?.id) { this.cache.clear(); this.captured.clear(); }
    this.track = track;
    this.bpm = bpm;
    this.swing = swing;
    if (stepsPerBar !== this.spb) { this.spb = stepsPerBar; this.cache.clear(); }
    if (track?.drummer !== prev) this.invalidate();
    if (!track?.drummer && this.running) this.stop();
  }

  get trackId() { return this.track?.id ?? null; }

  start() {
    if (this.running || !this.track?.drummer) return;
    const ctx = getEngine().init();
    this.running = true;
    this.following = false;
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
    this.running = false;
    this.following = false;
    this.queued = { fill: false, brk: false, crash: false };
    this.emit();
  }

  toggle() { if (this.running) this.stop(); else this.start(); }

  /** Fill now: the current bar ends with a fill if there is still room, otherwise the next one. */
  fill() { this.queued.fill = true; this.place("fill"); this.emit(); }
  /** Drop the drums out for the next bar; they come back in with a crash. */
  breakNext() { this.queued.brk = true; this.place("brk"); this.emit(); }
  crashNext() { this.queued.crash = true; this.place("crash"); this.emit(); }

  /** Settings changed: bars from the one playing now are generated again for the next steps. */
  invalidate() {
    const keep = this.shown.bar;
    for (const bar of [...this.cache.keys()]) if (bar >= keep) this.cache.delete(bar);
    this.emit();
  }

  snapshot(): DrummerSnapshot {
    const bar = this.shown.bar;
    return {
      running: this.running, following: this.following, bar, step: this.shown.step,
      fillQueued: this.queued.fill, breakQueued: this.queued.brk, crashQueued: this.queued.crash,
      hits: this.cache.get(bar) ?? (this.track?.drummer ? genBar(this.track.drummer, bar, this.spb, barOptions(this.track.drummer, bar)) : []),
      captured: this.captured.size,
    };
  }

  /** Bars played along with the song, in song order. */
  performance(): { bar: number; hits: DrumHit[] }[] {
    return [...this.captured.entries()].sort((a, b) => a[0] - b[0]).map(([bar, hits]) => ({ bar, hits }));
  }

  clearPerformance() { this.captured.clear(); this.emit(); }

  subscribe(fn: () => void) { this.listeners.add(fn); return () => void this.listeners.delete(fn); }
  private emit() { this.listeners.forEach((l) => l()); }

  /** Put a queued fill/break/crash on the right bar relative to what is playing now. */
  private place(kind: "fill" | "brk" | "crash") {
    if (!this.running) return;
    const bar = this.shown.bar;
    const settings = this.track?.drummer;
    if (kind === "fill") {
      const fillLen = Math.min(this.spb, (settings?.fills ?? 0.5) > 0.5 ? 8 : 4);
      const target = this.nextStep % this.spb < this.spb - fillLen ? this.barOf(this.nextStep) : this.barOf(this.nextStep) + 1;
      this.forced.set(target, { ...this.forced.get(target), fill: true });
      this.forced.set(target + 1, { ...this.forced.get(target + 1), crash: true });
      this.cache.delete(target); this.cache.delete(target + 1);
    } else if (kind === "brk") {
      const target = this.barOf(this.nextStep) + 1;
      this.forced.set(target, { ...this.forced.get(target), silent: true });
      this.forced.set(target + 1, { ...this.forced.get(target + 1), crash: true });
      this.cache.delete(target); this.cache.delete(target + 1);
    } else {
      const target = this.barOf(this.nextStep) + (this.nextStep % this.spb === 0 ? 0 : 1);
      this.forced.set(target, { ...this.forced.get(target), crash: true });
      this.cache.delete(target);
    }
    void bar;
  }

  private barOf(step: number) { return Math.max(0, Math.floor(step / this.spb)); }

  private barHits(bar: number): DrumHit[] {
    const hit = this.cache.get(bar);
    if (hit) return hit;
    const settings = this.track?.drummer;
    if (!settings) return [];
    const forced = this.forced.get(bar);
    const opts = { ...barOptions(settings, bar), ...forced };
    if (forced?.fill) this.queued.fill = false;
    if (forced?.silent) this.queued.brk = false;
    if (forced?.crash && !forced.fill && !forced.silent) this.queued.crash = false;
    const hits = genBar(settings, bar, this.spb, opts);
    this.cache.set(bar, hits);
    // keep the caches small during long sessions
    if (this.cache.size > 16) for (const k of [...this.cache.keys()]) if (k < bar - 4) this.cache.delete(k);
    for (const k of [...this.forced.keys()]) if (k < bar - 1) this.forced.delete(k);
    return hits;
  }

  private tick() {
    const engine = getEngine();
    const ctx = engine.ctx;
    if (!ctx || !this.running) return;
    const now = ctx.currentTime;
    const song = activeSongClock(now);
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
    while (this.nextTime < now + LOOKAHEAD) {
      if (this.nextTime > this.lastTime + 1e-4) this.play(this.nextStep, this.nextTime, dur, false);
      this.lastTime = Math.max(this.lastTime, this.nextTime);
      this.nextTime += dur;
      this.nextStep++;
    }
  }

  private play(step: number, time: number, dur: number, follow: boolean) {
    const t = this.track;
    if (!t?.drummer || !t.pads) return;
    const spb = this.spb;
    const bar = Math.floor(step / spb);
    const s = step % spb;
    if (follow) this.nextStep = step + 1;
    const hits = this.barHits(bar);
    if (follow) {
      // capture what was actually played this pass (Print my performance)
      if (s === 0 || !this.captured.has(bar)) this.captured.set(bar, []);
      this.captured.get(bar)!.push(...hits.filter((h) => h.step === s));
    }
    const prevBar = this.shown.bar;
    this.shown = { bar, step: s, time };
    if (bar !== prevBar || s === 0) setTimeout(() => this.emit(), Math.max(0, (time - (getEngine().ctx?.currentTime ?? time)) * 1000));
    if (t.muted || t.deviceBypassed) return;
    const swung = time + (s % 2 === 1 ? Math.min(0.9, Math.max(0, this.swing)) * 0.5 * dur : 0);
    const engine = getEngine();
    const padSolo = t.pads.some((p) => p.solo);
    for (const h of hits) {
      if (h.step !== s) continue;
      const target = padForRole(t.pads, h.role);
      if (!target || target.pad.muted || (padSolo && !target.pad.solo)) continue;
      const pad = target.pitch ? { ...target.pad, pitch: target.pad.pitch + target.pitch } : target.pad;
      const n = Math.max(1, Math.min(4, h.retrig ?? 1));
      for (let k = 0; k < n; k++) engine.playDrum(t.id, pad, h.vel * (n > 1 ? 0.75 + 0.25 * (k / n) : 1), swung + (k * dur) / n);
    }
  }
}

let player: DrummerPlayer | null = null;
export function getDrummer() { return (player ??= new DrummerPlayer()); }
