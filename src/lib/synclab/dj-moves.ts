/**
 * A recorded DJ performance: snapshots of both decks and the mixer taken while the mix records
 * (every 50 ms and on every change), timed from the start of the recording. Replay looks up the
 * snapshot at a time in the recorded audio so the decks, knobs and records move exactly as they did.
 * Pure data — nothing here touches audio.
 */
export interface DeckFrame {
  /** which load this is (each successful load counts up), so replay shows the right record */
  load: number;
  name: string | null;
  playing: boolean;
  /** play position in seconds */
  pos: number;
  pitch: number;
  gain: number;
  eq: { high: number; mid: number; low: number };
  filter: number;
  fader: number;
  loop: { start: number; end: number; beats: number } | null;
  phones: boolean;
  rpm: 33 | 45;
}
export interface MixFrame {
  t: number;
  A: DeckFrame;
  B: DeckFrame;
  crossfader: number;
  master: number;
}

const sameDeck = (a: DeckFrame, b: DeckFrame) =>
  a.load === b.load &&
  a.name === b.name &&
  a.playing === b.playing &&
  a.pitch === b.pitch &&
  a.gain === b.gain &&
  a.eq.high === b.eq.high &&
  a.eq.mid === b.eq.mid &&
  a.eq.low === b.eq.low &&
  a.filter === b.filter &&
  a.fader === b.fader &&
  a.phones === b.phones &&
  a.rpm === b.rpm &&
  (a.loop?.beats ?? 0) === (b.loop?.beats ?? 0) &&
  (a.loop?.start ?? 0) === (b.loop?.start ?? 0);

/** Positions within this of the expected spot are smooth playing, not a jump (seek/scratch). */
const JUMP = 0.08;

/**
 * Adds a snapshot. Stopped decks with nothing changed aren't stored twice; playing decks always are,
 * because their position moves. Frames must arrive in time order (older ones are ignored).
 */
export function pushFrame(frames: MixFrame[], f: MixFrame): MixFrame[] {
  const last = frames[frames.length - 1];
  if (last && f.t < last.t) return frames;
  if (
    last &&
    !f.A.playing &&
    !f.B.playing &&
    !last.A.playing &&
    !last.B.playing &&
    sameDeck(last.A, f.A) &&
    sameDeck(last.B, f.B) &&
    last.A.pos === f.A.pos &&
    last.B.pos === f.B.pos &&
    last.crossfader === f.crossfader &&
    last.master === f.master
  )
    return frames;
  frames.push(f);
  return frames;
}

/** Index of the last frame at or before t (−1 before the first). */
export function frameIndexAt(frames: MixFrame[], t: number): number {
  let lo = 0,
    hi = frames.length - 1,
    ans = -1;
  while (lo <= hi) {
    const m = (lo + hi) >> 1;
    if (frames[m]!.t <= t) {
      ans = m;
      lo = m + 1;
    } else hi = m - 1;
  }
  return ans;
}

function deckAt(
  a: DeckFrame,
  b: DeckFrame | undefined,
  f: number,
  dt: number,
  rate: number,
): DeckFrame {
  if (!a.playing) return a;
  if (b && b.load === a.load && b.playing) {
    // smooth playing between the two snapshots: glide; a jump (cue, scratch, seek) holds until the next one
    const expected = a.pos + dt * rate;
    if (Math.abs(b.pos - expected) < JUMP + dt * 0.05)
      return { ...a, pos: a.pos + (b.pos - a.pos) * f };
    return a;
  }
  return { ...a, pos: a.pos + dt * f * rate };
}

/** What the decks looked like t seconds into the recording, with play positions glided between snapshots. */
export function frameAt(frames: MixFrame[], t: number): MixFrame | null {
  const i = frameIndexAt(frames, t);
  if (i < 0) return frames[0] ?? null;
  const a = frames[i]!;
  const b = frames[i + 1];
  const dt = b ? b.t - a.t : t - a.t;
  const f = b && dt > 0 ? Math.max(0, Math.min(1, (t - a.t) / dt)) : 1;
  const span = b ? dt : t - a.t;
  const rate = (d: DeckFrame) => (1 + d.pitch) * (d.rpm === 45 ? 45 / (100 / 3) : 1);
  return {
    t,
    A: deckAt(a.A, b?.A, f, span, rate(a.A)),
    B: deckAt(a.B, b?.B, f, span, rate(a.B)),
    crossfader: b ? a.crossfader + (b.crossfader - a.crossfader) * f : a.crossfader,
    master: a.master,
  };
}

/** Load numbers that appear in the recording — their records/waveforms must be kept for replay. */
export function loadsUsed(frames: MixFrame[]): Set<number> {
  const out = new Set<number>();
  for (const f of frames) {
    out.add(f.A.load);
    out.add(f.B.load);
  }
  return out;
}
