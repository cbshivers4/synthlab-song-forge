import { getEngine } from "./audio-engine";
import { activeSongClock } from "./song-clock";
import {
  barOptions,
  genBar,
  padForRole,
  type BarOptions,
  type DrumHit,
  type DrumRole,
  type DrummerSettings,
} from "./drummer";
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
  /** started with "Play with song" and waiting for the song to start */
  waiting: boolean;
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

/** Seconds queued ahead on the audio clock, so a busy page never makes the player stumble. */
const LOOKAHEAD = 0.3;
/** "Play with song" gives up if the song hasn't started within this many seconds. */
const SONG_WAIT = 3;
export type DrummerStart = "alone" | "song";

class DrummerPlayer {
  private track: Track | null = null;
  private bpm = 120;
  private swing = 0;
  private spb = 16;
  private timer: ReturnType<typeof setInterval> | null = null;
  private running = false;
  private following = false;
  /** "alone": ignore the song until it has stopped once (pausing it takes a moment to land) */
  private ignoreSong = false;
  /** "song": wait for the song clock, never free-run */
  private waitSince: number | null = null;
  /** (role, velocity, audio-clock time the hit sounds) — told when the hit is scheduled, ~0.3 s early */
  private hitListeners = new Set<(role: DrumRole, vel: number, when: number) => void>();
  private nextStep = 0;
  private nextTime = 0;
  private lastTime = 0;
  private cache = new Map<number, DrumHit[]>();
  private forced = new Map<number, BarOptions>();
  /** bars a pressed Fill / Break / Crash lands on (null = nothing waiting) */
  private queued: {
    fill: number | null;
    fillAt: number;
    brk: number | null;
    crash: number | null;
  } = { fill: null, fillAt: 0, brk: null, crash: null };
  private captured = new Map<number, DrumHit[]>();
  private shown = { bar: 0, step: 0, time: 0 };
  private listeners = new Set<() => void>();

  /** The bridge keeps the player pointed at the latest drummer channel and song settings. */
  sync(track: Track | null, bpm: number, swing: number, stepsPerBar: number) {
    const prev = this.track?.drummer;
    if (track?.id !== this.track?.id) {
      this.cache.clear();
      this.captured.clear();
    }
    this.track = track;
    this.bpm = bpm;
    this.swing = swing;
    if (stepsPerBar !== this.spb) {
      this.spb = stepsPerBar;
      this.cache.clear();
    }
    if (track?.drummer !== prev) this.invalidate();
    if (!track?.drummer && this.running) this.stop();
  }

  get trackId() {
    return this.track?.id ?? null;
  }

  /**
   * "alone" previews the drummer by itself at the song tempo (it only locks to the song if you
   * start the song afterwards); "song" waits for the song and plays locked to its bars.
   */
  start(mode: DrummerStart = "alone") {
    if (this.running || !this.track?.drummer) return;
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
    this.running = false;
    this.following = false;
    this.ignoreSong = false;
    this.waitSince = null;
    this.queued = { fill: null, fillAt: 0, brk: null, crash: null };
    this.emit();
  }

  toggle() {
    if (this.running) this.stop();
    else this.start();
  }

  /**
   * Hand over to a printed part: queue every step the song has already scheduled, then stop.
   * Called in the same commit that adds the printed track, so no step is missed or doubled.
   */
  finish() {
    if (this.running) this.tick();
    this.stop();
  }

  /** Already playing alone: lock onto the song (which is starting) instead of carrying on unsynced. */
  followSong() {
    if (!this.running || this.following) return;
    this.ignoreSong = false;
    this.waitSince = getEngine().ctx?.currentTime ?? 0;
    this.emit();
  }

  /** Fill now: the current bar ends with a fill if there is still room, otherwise the next one. */
  fill() {
    this.place("fill");
    this.emit();
  }
  /** Drop the drums out for the next bar; they come back in with a crash. */
  breakNext() {
    this.place("brk");
    this.emit();
  }
  crashNext() {
    this.place("crash");
    this.emit();
  }

  /** Settings changed: bars from the one playing now are generated again for the next steps. */
  invalidate() {
    const keep = this.shown.bar;
    for (const bar of [...this.cache.keys()]) if (bar >= keep) this.cache.delete(bar);
    this.emit();
  }

  snapshot(): DrummerSnapshot {
    const bar = this.shown.bar;
    return {
      running: this.running,
      following: this.following,
      waiting: this.running && this.waitSince !== null,
      bar,
      step: this.shown.step,
      fillQueued: this.queued.fill !== null,
      breakQueued: this.queued.brk !== null,
      crashQueued: this.queued.crash !== null,
      hits:
        this.cache.get(bar) ??
        (this.track?.drummer
          ? genBar(this.track.drummer, bar, this.spb, barOptions(this.track.drummer, bar))
          : []),
      captured: this.captured.size,
    };
  }

  /** Bars played along with the song, in song order. */
  performance(): { bar: number; hits: DrumHit[] }[] {
    return [...this.captured.entries()]
      .sort((a, b) => a[0] - b[0])
      .map(([bar, hits]) => ({ bar, hits }));
  }

  clearPerformance() {
    this.captured.clear();
    this.emit();
  }

  subscribe(fn: () => void) {
    this.listeners.add(fn);
    return () => void this.listeners.delete(fn);
  }
  /** Called as each hit is heard (for the drum set picture). */
  onHit(fn: (role: DrumRole, vel: number, when: number) => void) {
    this.hitListeners.add(fn);
    return () => void this.hitListeners.delete(fn);
  }
  private emit() {
    this.listeners.forEach((l) => l());
  }

  /** Put a queued fill/break/crash on the right bar relative to what is playing now. */
  private place(kind: "fill" | "brk" | "crash") {
    if (!this.running) return;
    const bar = this.shown.bar;
    const settings = this.track?.drummer;
    if (kind === "fill") {
      const fillLen = Math.min(this.spb, (settings?.fills ?? 0.5) > 0.5 ? 8 : 4);
      const target =
        this.nextStep % this.spb < this.spb - fillLen
          ? this.barOf(this.nextStep)
          : this.barOf(this.nextStep) + 1;
      this.forced.set(target, { ...this.forced.get(target), fill: true });
      this.forced.set(target + 1, { ...this.forced.get(target + 1), crash: true });
      this.cache.delete(target);
      this.cache.delete(target + 1);
      this.queued.fill = target;
      this.queued.fillAt = this.spb - fillLen;
    } else if (kind === "brk") {
      const target = this.barOf(this.nextStep) + 1;
      this.forced.set(target, { ...this.forced.get(target), silent: true });
      this.forced.set(target + 1, { ...this.forced.get(target + 1), crash: true });
      this.cache.delete(target);
      this.cache.delete(target + 1);
      this.queued.brk = target;
    } else {
      const target = this.barOf(this.nextStep) + (this.nextStep % this.spb === 0 ? 0 : 1);
      this.forced.set(target, { ...this.forced.get(target), crash: true });
      this.cache.delete(target);
      this.queued.crash = target;
    }
    void bar;
  }

  private barOf(step: number) {
    return Math.max(0, Math.floor(step / this.spb));
  }

  private barHits(bar: number): DrumHit[] {
    const hit = this.cache.get(bar);
    if (hit) return hit;
    const settings = this.track?.drummer;
    if (!settings) return [];
    const forced = this.forced.get(bar);
    const opts = { ...barOptions(settings, bar), ...forced };
    const hits = genBar(settings, bar, this.spb, opts);
    this.cache.set(bar, hits);
    // keep the caches small during long sessions
    if (this.cache.size > 16)
      for (const k of [...this.cache.keys()]) if (k < bar - 4) this.cache.delete(k);
    for (const k of [...this.forced.keys()]) if (k < bar - 1) this.forced.delete(k);
    return hits;
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
      if (!this.following) {
        this.following = true;
        this.cache.clear();
        this.emit();
      }
      const steps: { step: number; time: number }[] = [];
      for (let j = 0; j < 64; j++) {
        const time = song.time - j * song.dur;
        if (time <= this.lastTime + 1e-4 || time < now - 0.005) break;
        steps.push({ step: song.step - j, time });
      }
      steps
        .reverse()
        .forEach(({ step, time }) => this.play(Math.max(0, step), time, song.dur, true));
      if (steps.length) this.lastTime = steps[steps.length - 1]!.time;
      return;
    }
    if (this.following) {
      this.stop();
      return;
    }
    const dur = 60 / Math.max(20, this.bpm) / 4;
    // After a stall, skip steps that are already late instead of firing them all at once.
    while (this.nextTime < now - 0.05) {
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
    const q = this.queued;
    const landed =
      (q.fill !== null && (bar > q.fill || (bar === q.fill && s >= q.fillAt))) ||
      (q.brk !== null && bar >= q.brk) ||
      (q.crash !== null && bar >= q.crash);
    if (q.fill !== null && (bar > q.fill || (bar === q.fill && s >= q.fillAt))) q.fill = null;
    if (q.brk !== null && bar >= q.brk) q.brk = null;
    if (q.crash !== null && bar >= q.crash) q.crash = null;
    const prevBar = this.shown.bar;
    this.shown = { bar, step: s, time };
    if (bar !== prevBar || s === 0 || landed)
      setTimeout(
        () => this.emit(),
        Math.max(0, (time - (getEngine().ctx?.currentTime ?? time)) * 1000),
      );
    if (t.muted || t.deviceBypassed) return;
    const swung = time + (s % 2 === 1 ? Math.min(0.9, Math.max(0, this.swing)) * 0.5 * dur : 0);
    const engine = getEngine();
    const padSolo = t.pads.some((p) => p.solo);
    for (const h of hits) {
      if (h.step !== s) continue;
      const target = padForRole(t.pads, h.role);
      if (!target || target.pad.muted || (padSolo && !target.pad.solo)) continue;
      const pad = target.pitch
        ? { ...target.pad, pitch: target.pad.pitch + target.pitch }
        : target.pad;
      const n = Math.max(1, Math.min(4, h.retrig ?? 1));
      for (let k = 0; k < n; k++) {
        const vel = h.vel * (n > 1 ? 0.75 + 0.25 * (k / n) : 1),
          when = swung + (k * dur) / n;
        engine.playDrum(t.id, pad, vel, when);
        // the kit picture queues this and moves the piece when the audio clock gets there (one per retrigger)
        this.hitListeners.forEach((l) => l(h.role, vel, when));
      }
    }
  }
}

let player: DrummerPlayer | null = null;
export function getDrummer() {
  return (player ??= new DrummerPlayer());
}
