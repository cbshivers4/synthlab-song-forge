/**
 * DAW-style cutting for note channels (synth, MIDI, sampler notes).
 *
 * A note channel is a looping pattern of `steps` length. Cutting it at a song
 * position first "unrolls" the pattern into one long part that covers the whole
 * song (steps = song length, every repeat written out), so the cut lands on the
 * repeat you actually clicked. The cut positions are kept on the track as region
 * boundaries; each region can then be selected and deleted on its own.
 */
import type { MidiNote } from "./types";

const EPS = 0.001;

/** Write every repeat of a looping pattern out across the song. Absolute (recorded) notes are kept as-is. */
export function unrollNotes(notes: MidiNote[], patLen: number, total: number): MidiNote[] {
  const len = Math.max(1, patLen);
  if (len >= total) return notes;
  const reps = Math.ceil(total / len);
  const out: MidiNote[] = [];
  for (const n of notes) {
    if (n.recordedEnd != null) { out.push(n); continue; }
    const inPat = n.step - Math.floor(n.step / len) * len;
    for (let r = 0; r < reps; r++) {
      const at = r * len + inPat;
      if (at >= total) break;
      out.push({ ...n, id: r === 0 ? n.id : `${n.id}-r${r}`, step: at, length: Math.min(n.length, total - at) });
    }
  }
  return out;
}

/** Split every note that crosses `pos` into a left and right part. */
export function cutNotesAt(notes: MidiNote[], pos: number, stamp = Date.now()) {
  let cut = 0;
  const next = notes.flatMap((n) => {
    const len = Math.max(EPS, n.length);
    if (pos <= n.step + EPS || pos >= n.step + len - EPS) return [n];
    cut += 1;
    const firstLen = pos - n.step;
    const a: MidiNote = { ...n, id: `${n.id}-a${stamp}`, length: firstLen };
    const b: MidiNote = { ...n, id: `${n.id}-b${stamp}`, step: pos, length: len - firstLen };
    if (n.recordedEnd != null) b.recordedEnd = Math.max(Math.floor(pos) + 1, n.recordedEnd);
    return [a, b];
  });
  return { notes: next, cut };
}

/** Insert a cut position into a sorted, unique list. */
export function addCut(cuts: number[] | undefined, pos: number, total: number): number[] {
  const list = (cuts ?? []).filter((c) => c > EPS && c < total - EPS && Math.abs(c - pos) > EPS);
  if (pos > EPS && pos < total - EPS) list.push(pos);
  return list.sort((a, b) => a - b);
}

/** Regions between cuts: [start, end) pairs covering the song. */
export function regionsOf(cuts: number[] | undefined, total: number): [number, number][] {
  const edges = [0, ...(cuts ?? []).filter((c) => c > EPS && c < total - EPS).sort((a, b) => a - b), total];
  const out: [number, number][] = [];
  for (let i = 0; i < edges.length - 1; i++) if (edges[i + 1]! - edges[i]! > EPS) out.push([edges[i]!, edges[i + 1]!]);
  return out;
}

/** The region that contains `pos`. */
export function regionAt(cuts: number[] | undefined, total: number, pos: number): [number, number] {
  const regions = regionsOf(cuts, total);
  return regions.find(([a, b]) => pos >= a - EPS && pos < b - EPS) ?? regions[regions.length - 1] ?? [0, total];
}

/** Notes that start inside a region. */
export const notesInRegion = (notes: MidiNote[], [a, b]: [number, number]) => notes.filter((n) => n.step >= a - EPS && n.step < b - EPS);

/** Remove every note that starts inside the region. */
export const deleteRegion = (notes: MidiNote[], region: [number, number]) => {
  const drop = new Set(notesInRegion(notes, region).map((n) => n.id));
  return notes.filter((n) => !drop.has(n.id));
};

/** Snap a cut position to the grid unless free cutting is on. grid <= 0 = free. */
export const snapCut = (pos: number, grid: number, free: boolean) => (free || grid <= 0 ? pos : Math.round(pos / grid) * grid);
