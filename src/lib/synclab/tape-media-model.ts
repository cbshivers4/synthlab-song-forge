/**
 * Cassettes and blank CDs for the Tape & CD Recorder. Pure data helpers (tested); the audio on
 * each cassette side and CD track is the same Capture the tape machine records and plays.
 */
import type { Capture } from "./bounce";
import { cdCanAdd } from "./cd-audio";

export type CassetteSide = "A" | "B";
export type TapeFormula = "Normal" | "Chrome" | "Metal";

export interface CassetteType {
  id: string;
  name: string;
  /** IEC tape type printed on the shell and lit on the deck */
  formula: TapeFormula;
  /** total minutes, both sides together (C60 = 30 minutes a side) */
  minutes: number;
  /** shell colour, matched by data-shell in tape-cd.css */
  shell: string;
}

export const CASSETTE_TYPES: readonly CassetteType[] = [
  { id: "normal-60", name: "Normal C60", formula: "Normal", minutes: 60, shell: "smoke" },
  { id: "normal-90", name: "Normal C90", formula: "Normal", minutes: 90, shell: "black" },
  { id: "chrome-60", name: "Chrome C60", formula: "Chrome", minutes: 60, shell: "clear" },
  { id: "chrome-90", name: "Chrome C90", formula: "Chrome", minutes: 90, shell: "white" },
  { id: "metal-46", name: "Metal C46", formula: "Metal", minutes: 46, shell: "gold" },
  { id: "metal-90", name: "Metal C90", formula: "Metal", minutes: 90, shell: "graphite" },
  { id: "studio-red-60", name: "Studio Red C60", formula: "Chrome", minutes: 60, shell: "red" },
  {
    id: "detroit-blue-90",
    name: "Detroit Blue C90",
    formula: "Normal",
    minutes: 90,
    shell: "blue",
  },
  { id: "mixtape-120", name: "Mixtape C120", formula: "Normal", minutes: 120, shell: "orange" },
  { id: "ferro-60", name: "Ferro Brown C60", formula: "Normal", minutes: 60, shell: "brown" },
  { id: "ice-46", name: "Clear Ice C46", formula: "Chrome", minutes: 46, shell: "ice" },
  { id: "neon-60", name: "Neon Green C60", formula: "Chrome", minutes: 60, shell: "green" },
];

export interface Cassette {
  id: string;
  typeId: string;
  name: string;
  sides: Record<CassetteSide, Capture | null>;
}

export const cassetteType = (id: string): CassetteType =>
  CASSETTE_TYPES.find((t) => t.id === id) ?? CASSETTE_TYPES[0]!;
/** One side holds half the cassette's minutes. */
export const sideSeconds = (typeId: string) => (cassetteType(typeId).minutes * 60) / 2;
export const otherSide = (side: CassetteSide): CassetteSide => (side === "A" ? "B" : "A");
export const captureSeconds = (capture: Capture | null) =>
  capture ? capture.left.length / capture.sampleRate : 0;

/** Names keep what you type (up to 40 characters); empty names show the fallback. */
export const MAX_NAME = 40;
export const editName = (name: string) => name.replace(/[\r\n\t]+/g, " ").slice(0, MAX_NAME);
export const shownName = (name: string, fallback: string) => name.trim() || fallback;

export function newCassette(typeId: string, name: string, id: string): Cassette {
  const type = cassetteType(typeId);
  return { id, typeId: type.id, name: editName(name), sides: { A: null, B: null } };
}

/** The shelf starts with one blank cassette of every type. */
export const seedCassettes = (makeId: () => string): Cassette[] =>
  CASSETTE_TYPES.map((t) => newCassette(t.id, t.name, makeId()));

export function renameCassette(list: Cassette[], id: string, name: string): Cassette[] {
  return list.map((c) => (c.id === id ? { ...c, name: editName(name) } : c));
}

export function writeSide(
  list: Cassette[],
  id: string,
  side: CassetteSide,
  capture: Capture | null,
): Cassette[] {
  return list.map((c) => (c.id === id ? { ...c, sides: { ...c.sides, [side]: capture } } : c));
}

// ---------- CDs ----------

export interface DiscType {
  id: string;
  name: string;
  minutes: 74 | 80;
  /** disc colour, matched by data-finish in tape-cd.css */
  finish: string;
}

export const DISC_TYPES: readonly DiscType[] = [
  { id: "silver-80", name: "CD-R 80 · Silver", minutes: 80, finish: "silver" },
  { id: "gold-80", name: "CD-R 80 · Gold", minutes: 80, finish: "gold" },
  { id: "azure-74", name: "CD-R 74 · Azure", minutes: 74, finish: "azure" },
  { id: "black-80", name: "CD-R 80 · Black", minutes: 80, finish: "black" },
  { id: "white-80", name: "CD-R 80 · Printable White", minutes: 80, finish: "white" },
  { id: "red-74", name: "CD-R 74 · Detroit Red", minutes: 74, finish: "red" },
];

export interface CdTrack {
  id: string;
  title: string;
  capture: Capture;
}
export interface Disc {
  id: string;
  typeId: string;
  title: string;
  artist: string;
  tracks: CdTrack[];
}

export const discType = (id: string): DiscType =>
  DISC_TYPES.find((t) => t.id === id) ?? DISC_TYPES[0]!;
export const discTrackSeconds = (disc: Disc) => disc.tracks.map((t) => captureSeconds(t.capture));

export function newDisc(typeId: string, title: string, id: string): Disc {
  return { id, typeId: discType(typeId).id, title: editName(title), artist: "", tracks: [] };
}
export const seedDiscs = (makeId: () => string): Disc[] =>
  DISC_TYPES.map((t) => newDisc(t.id, "My CD", makeId()));

export function addDiscTrack(
  disc: Disc,
  track: CdTrack,
): { disc: Disc; error: null } | { disc: Disc; error: string } {
  const fit = cdCanAdd(
    discTrackSeconds(disc),
    discType(disc.typeId).minutes,
    captureSeconds(track.capture),
  );
  if (!fit.ok) return { disc, error: fit.reason };
  return {
    disc: { ...disc, tracks: [...disc.tracks, { ...track, title: editName(track.title) }] },
    error: null,
  };
}

export function moveDiscTrack(disc: Disc, id: string, delta: number): Disc {
  const from = disc.tracks.findIndex((t) => t.id === id);
  const to = from + delta;
  if (from < 0 || to < 0 || to >= disc.tracks.length) return disc;
  const tracks = disc.tracks.slice();
  const [moved] = tracks.splice(from, 1);
  tracks.splice(to, 0, moved!);
  return { ...disc, tracks };
}

export const removeDiscTrack = (disc: Disc, id: string): Disc => ({
  ...disc,
  tracks: disc.tracks.filter((t) => t.id !== id),
});

export const renameDiscTrack = (disc: Disc, id: string, title: string): Disc => ({
  ...disc,
  tracks: disc.tracks.map((t) => (t.id === id ? { ...t, title: editName(title) } : t)),
});
