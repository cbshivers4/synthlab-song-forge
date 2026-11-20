/**
 * Live arpeggiator: notes you play by hand (on-screen keys, typing keys, MIDI) on a synth
 * whose ARP is on are collected per channel and stepped through on the audio clock,
 * using the same rate/direction/octaves/gate/swing/sync maths as song playback.
 */
import type { SynthPatch } from "./types";
import { arpStepSeconds } from "./synth-timing";
import { arpHit, arpSequence as walk } from "./arp-pattern";

export interface ArpEngine {
  ctx: AudioContext | null;
  tempo: number;
  playNote(
    trackId: string,
    patch: SynthPatch,
    midi: number,
    duration: number,
    velocity?: number,
    when?: number,
  ): void;
}

interface Held {
  vel: number;
  until: number;
  order: number;
}
interface Pool {
  engine: ArpEngine;
  patch: SynthPatch;
  held: Map<number, Held>;
  index: number;
  next: number;
  timer: ReturnType<typeof setInterval> | null;
  seq: number;
}

const pools = new Map<string, Pool>();
let orderSeq = 0;

/** Ordered list of pitches the arp walks through for the currently held notes. */
export function arpSequence(
  pitches: number[],
  arp: SynthPatch["arp"],
  _playedOrder?: number[],
): number[] {
  return walk(pitches, arp);
}

function tick(trackId: string) {
  const pool = pools.get(trackId);
  const ctx = pool?.engine.ctx;
  if (!pool || !ctx) return;
  const now = ctx.currentTime;
  for (const [p, h] of pool.held) if (h.until <= now) pool.held.delete(p);
  if (pool.held.size === 0) {
    if (pool.timer) clearInterval(pool.timer);
    pools.delete(trackId);
    return;
  }
  const arp = pool.patch.arp;
  const step = arpStepSeconds(arp, 60 / Math.max(20, pool.engine.tempo || 120) / 4);
  if (pool.next < now) pool.next = now;
  while (pool.next < now + 0.1) {
    const live = [...pool.held.entries()].filter(([, h]) => h.until > pool.next);
    if (live.length === 0) break;
    const hit = arpHit(
      arp,
      live.map(([p]) => p),
      pool.index,
    );
    if (hit) {
      const vel = Math.max(...live.map(([, h]) => h.vel)) * hit.accent;
      const swing = Math.min(1, Math.max(0, arp.swing ?? 0));
      const at = pool.next + (pool.seq % 2 === 1 ? swing * step * 0.5 : 0);
      const gate = Math.max(0.05, arp.gate || 0.5);
      for (const pitch of hit.pitches)
        pool.engine.playNote(
          trackId,
          pool.patch,
          pitch,
          Math.max(0.02, step * (hit.length - 1 + gate)),
          vel,
          at,
        );
    }
    pool.index++;
    pool.seq++;
    pool.next += step;
  }
}

/**
 * Adds a hand-played note to the channel's arp. Returns false when the patch's ARP is off,
 * so the caller plays the note normally. `hold` is how long the key counts as held.
 */
export function arpLiveNote(
  engine: ArpEngine,
  trackId: string,
  patch: SynthPatch,
  pitch: number,
  hold: number,
  vel: number,
): boolean {
  if (!patch.arp?.on || patch.modular) return false;
  const ctx = engine.ctx;
  if (!ctx) return false;
  const now = ctx.currentTime;
  let pool = pools.get(trackId);
  if (!pool) {
    pool = { engine, patch, held: new Map(), index: 0, next: now, timer: null, seq: 0 };
    pools.set(trackId, pool);
  }
  pool.patch = patch;
  pool.engine = engine;
  pool.held.set(pitch, { vel, until: now + Math.max(0.05, hold), order: orderSeq++ });
  if (!pool.timer) {
    pool.timer = setInterval(() => tick(trackId), 25);
  }
  tick(trackId);
  return true;
}

/** Note-off from a controller: stops that pitch (and its octave copies) on the next step. */
export function arpLiveRelease(trackId: string, pitch: number) {
  const pool = pools.get(trackId);
  const h = pool?.held.get(pitch);
  if (pool && h && pool.engine.ctx) h.until = Math.min(h.until, pool.engine.ctx.currentTime);
}

/** Lets go of every held key in a channel's arp (HOLD switched off). */
export function arpReleaseAll(trackId: string) {
  const pool = pools.get(trackId);
  const now = pool?.engine.ctx?.currentTime;
  if (!pool || now === undefined) return;
  for (const h of pool.held.values()) h.until = Math.min(h.until, now);
}

/** Stop all live arps (Stop button / panic). */
export function stopLiveArps() {
  for (const p of pools.values()) if (p.timer) clearInterval(p.timer);
  pools.clear();
}
