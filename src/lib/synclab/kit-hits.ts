import type { DrumRole } from "./drummer";

/**
 * Live Drummer picture timing: the player schedules each hit ~0.3 s ahead on the audio clock and
 * publishes it with that time; the picture queues it and plays the animation when the audio clock
 * reaches it, so you see the stick land when you hear it. Pure (no DOM, no audio).
 */
export interface QueuedHit {
  at: number;
  role: DrumRole;
  vel: number;
}

export class HitQueue {
  private items: QueuedHit[] = [];
  push(hit: QueuedHit) {
    // keep time order (hits arrive nearly in order; retriggers can interleave)
    let i = this.items.length;
    while (i > 0 && this.items[i - 1]!.at > hit.at) i--;
    this.items.splice(i, 0, hit);
    if (this.items.length > 256) this.items.splice(0, this.items.length - 256);
  }
  /** Hits whose time has come; ones more than `stale` seconds late are dropped (a hidden tab caught up). */
  drain(now: number, stale = 0.25): QueuedHit[] {
    let n = 0;
    while (n < this.items.length && this.items[n]!.at <= now) n++;
    if (!n) return [];
    return this.items.splice(0, n).filter((h) => now - h.at <= stale);
  }
  clear() {
    this.items = [];
  }
  get size() {
    return this.items.length;
  }
}

/** The pieces of the real-looking acoustic drum set. */
export type AcousticPiece =
  | "kick"
  | "snare"
  | "hat"
  | "crash1"
  | "crash2"
  | "ride"
  | "tomHi"
  | "tomMid"
  | "tomLo"
  | "cowbell"
  | "tamb";

/**
 * Which piece of the acoustic set shows a drummer role. Crash hits alternate between the left and
 * right crash like a drummer's two hands (same crash sound — only the picture alternates).
 */
export function acousticPieceFor(
  role: DrumRole,
  crashCount: number,
): { piece: AcousticPiece; open?: boolean } {
  switch (role) {
    case "kick":
      return { piece: "kick" };
    case "snare":
    case "rim":
    case "clap":
      return { piece: "snare" };
    case "hat":
      return { piece: "hat", open: false };
    case "openhat":
      return { piece: "hat", open: true };
    case "ride":
      return { piece: "ride" };
    case "crash":
      return { piece: crashCount % 2 === 0 ? "crash1" : "crash2" };
    case "tomHi":
    case "conga":
      return { piece: "tomHi" };
    case "tomMid":
    case "congaLo":
      return { piece: "tomMid" };
    case "tomLo":
      return { piece: "tomLo" };
    case "cowbell":
    case "clave":
    case "perc":
      return { piece: "cowbell" };
    case "tamb":
    case "shaker":
      return { piece: "tamb" };
  }
}

/** Roles a tap on each piece plays (first that the kit has a pad for). */
export const ACOUSTIC_TAP: Record<AcousticPiece, DrumRole[]> = {
  kick: ["kick"],
  snare: ["snare", "rim", "clap"],
  hat: ["hat", "openhat"],
  crash1: ["crash"],
  crash2: ["crash"],
  ride: ["ride"],
  tomHi: ["tomHi", "conga"],
  tomMid: ["tomMid", "congaLo"],
  tomLo: ["tomLo"],
  cowbell: ["cowbell", "clave", "perc"],
  tamb: ["tamb", "shaker"],
};

/** How far an animation swings for a hit (soft ghost notes barely move, accents swing hard). */
export function swingFor(vel: number): number {
  return Math.max(0.25, Math.min(1.2, 0.25 + vel * 0.95));
}
