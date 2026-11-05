/**
 * Live arpeggiator: notes you play by hand (on-screen keys, typing keys, MIDI) on a synth
 * whose ARP is on are collected per channel and stepped through on the audio clock,
 * using the same rate/direction/octaves/gate/swing/sync maths as song playback.
 */
import type { SynthPatch } from "./types";
import { arpStepSeconds } from "./synth-timing";

export interface ArpEngine {
  ctx: AudioContext | null;
  tempo: number;
  playNote(trackId: string, patch: SynthPatch, midi: number, duration: number, velocity?: number, when?: number): void;
}

interface Held { vel: number; until: number; order: number }
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
export function arpSequence(pitches: number[], arp: SynthPatch["arp"], playedOrder?: number[]): number[] {
  if (pitches.length === 0) return [];
  void playedOrder;
  const base = [...pitches].sort((a, b) => a - b);
  const oct = Math.max(1, Math.round(arp.octaves || 1));
  const up: number[] = [];
  for (let o = 0; o < oct; o++) for (const p of base) up.push(p + o * 12);
  switch (arp.direction) {
    case "down": return [...up].reverse();
    case "updown": return up.length > 2 ? [...up, ...up.slice(1, -1).reverse()] : up;
    case "alternate": return up.flatMap((p, i) => (i === 0 ? [p] : [p, up[0] as number]));
    default: return up;
  }
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
    const played = [...live].sort((a, b) => a[1].order - b[1].order).map(([p]) => p);
    const seq = arpSequence(live.map(([p]) => p), arp, played);
    const pitch = arp.direction === "random"
      ? (seq[Math.floor(Math.random() * seq.length)] as number)
      : (seq[pool.index % seq.length] as number);
    const vel = Math.max(...live.map(([, h]) => h.vel));
    const swing = Math.min(1, Math.max(0, arp.swing ?? 0));
    const at = pool.next + (pool.seq % 2 === 1 ? swing * step * 0.5 : 0);
    pool.engine.playNote(trackId, pool.patch, pitch, Math.max(0.02, step * Math.max(0.05, arp.gate || 0.5)), vel, at);
    pool.index++;
    pool.seq++;
    pool.next += step;
  }
}

/**
 * Adds a hand-played note to the channel's arp. Returns false when the patch's ARP is off,
 * so the caller plays the note normally. `hold` is how long the key counts as held.
 */
export function arpLiveNote(engine: ArpEngine, trackId: string, patch: SynthPatch, pitch: number, hold: number, vel: number): boolean {
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

/** Stop all live arps (Stop button / panic). */
export function stopLiveArps() {
  for (const p of pools.values()) if (p.timer) clearInterval(p.timer);
  pools.clear();
}
