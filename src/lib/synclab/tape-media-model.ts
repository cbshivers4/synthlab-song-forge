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
  /** set once saved on this device */
  store?: StoredInfo;
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
  /** set once saved on this device */
  store?: StoredInfo;
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

/** Shortest cassette on the shelf list whose two sides together hold `seconds` (else the longest). */
export function cassetteTypeFor(seconds: number): string {
  const fits = [...CASSETTE_TYPES]
    .filter((t) => t.minutes * 60 >= seconds)
    .sort((a, b) => a.minutes - b.minutes);
  return (fits[0] ?? [...CASSETTE_TYPES].sort((a, b) => b.minutes - a.minutes)[0]!).id;
}

/**
 * Dub a recording onto a cassette like a real deck: side A fills first and the rest carries on
 * onto side B. Anything longer than both sides is cut off (cutSeconds says how much).
 */
export function dubToCassette(
  capture: Capture,
  typeId: string,
): { a: Capture; b: Capture | null; cutSeconds: number } {
  const sideFrames = Math.floor(sideSeconds(typeId) * capture.sampleRate);
  const total = capture.left.length;
  const right = capture.right.length ? capture.right : capture.left;
  const part = (from: number, to: number): Capture => ({
    left: capture.left.slice(from, to),
    right: right.slice(from, to),
    sampleRate: capture.sampleRate,
  });
  const a = part(0, Math.min(total, sideFrames));
  const b = total > sideFrames ? part(sideFrames, Math.min(total, sideFrames * 2)) : null;
  const cutSeconds = Math.max(0, total - sideFrames * 2) / capture.sampleRate;
  return { a, b, cutSeconds };
}

// ---------- reel-to-reel tapes ----------

/** Reel size in inches, as printed on the box (5″, 7″, 10½″). */
export type ReelSize = 5 | 7 | 10;

export interface ReelType {
  id: string;
  name: string;
  size: ReelSize;
  /** flange colour, matched by data-finish in tape-cd.css; "machine" keeps the deck's own metal */
  finish: string;
  /** colour of the oxide on the reel, matched by data-oxide */
  oxide: "brown" | "black";
  /** recording time at the printed speed */
  minutes: number;
  speed: "3¾ ips" | "7½ ips" | "15 ips";
}

export const REEL_TYPES: readonly ReelType[] = [
  {
    id: "studio-10",
    name: "Studio Master 10½″",
    size: 10,
    finish: "machine",
    oxide: "brown",
    minutes: 33,
    speed: "15 ips",
  },
  {
    id: "black-10",
    name: "Black Metal 10½″",
    size: 10,
    finish: "black",
    oxide: "black",
    minutes: 66,
    speed: "7½ ips",
  },
  {
    id: "gold-10",
    name: "Gold Master 10½″",
    size: 10,
    finish: "gold",
    oxide: "brown",
    minutes: 33,
    speed: "15 ips",
  },
  {
    id: "red-10",
    name: "Detroit Red 10½″",
    size: 10,
    finish: "red",
    oxide: "black",
    minutes: 66,
    speed: "7½ ips",
  },
  {
    id: "long-10",
    name: "Long Play 10½″",
    size: 10,
    finish: "silver",
    oxide: "black",
    minutes: 96,
    speed: "7½ ips",
  },
  {
    id: "blue-7",
    name: "Clear Blue 7″",
    size: 7,
    finish: "blue",
    oxide: "brown",
    minutes: 32,
    speed: "7½ ips",
  },
  {
    id: "white-7",
    name: "White Plastic 7″",
    size: 7,
    finish: "white",
    oxide: "brown",
    minutes: 32,
    speed: "7½ ips",
  },
  {
    id: "smoke-7",
    name: "Smoke 7″ Long Play",
    size: 7,
    finish: "smoke",
    oxide: "black",
    minutes: 48,
    speed: "7½ ips",
  },
  {
    id: "orange-7",
    name: "Orange Demo 7″",
    size: 7,
    finish: "orange",
    oxide: "brown",
    minutes: 22,
    speed: "7½ ips",
  },
  {
    id: "green-5",
    name: "Mini Memo 5″",
    size: 5,
    finish: "green",
    oxide: "brown",
    minutes: 15,
    speed: "3¾ ips",
  },
];

export interface Reel {
  id: string;
  typeId: string;
  name: string;
  capture: Capture | null;
  store?: StoredInfo;
}

export const reelType = (id: string): ReelType =>
  REEL_TYPES.find((t) => t.id === id) ?? REEL_TYPES[0]!;
export const reelSeconds = (typeId: string) => reelType(typeId).minutes * 60;
export const reelSizeLabel = (size: ReelSize) => (size === 10 ? "10½″" : `${size}″`);

export function newReel(typeId: string, name: string, id: string): Reel {
  return { id, typeId: reelType(typeId).id, name: editName(name), capture: null };
}
/** The reel shelf starts with one blank reel of every type. */
export const seedReels = (makeId: () => string): Reel[] =>
  REEL_TYPES.map((t) => newReel(t.id, t.name, makeId()));

/** Shortest reel that holds `seconds` (else the longest). */
export function reelTypeFor(seconds: number): string {
  const byLength = [...REEL_TYPES].sort((a, b) => a.minutes - b.minutes);
  return (byLength.find((t) => t.minutes * 60 >= seconds) ?? byLength.at(-1)!).id;
}
/** Trim a recording to what the reel holds; cutSeconds says how much didn't fit. */
export function fitToReel(
  capture: Capture,
  typeId: string,
): { capture: Capture; cutSeconds: number } {
  const frames = Math.floor(reelSeconds(typeId) * capture.sampleRate);
  if (capture.left.length <= frames) return { capture, cutSeconds: 0 };
  return {
    capture: {
      left: capture.left.slice(0, frames),
      right: (capture.right.length ? capture.right : capture.left).slice(0, frames),
      sampleRate: capture.sampleRate,
    },
    cutSeconds: (capture.left.length - frames) / capture.sampleRate,
  };
}

// ---------- saved in the account (tape shelf store) ----------

export type ShelfKind = "reel" | "cassette" | "cd";

/** One stored recording: a reel's tape, a cassette side, a CD track. */
export interface StoredPart {
  key: string;
  seconds: number;
  title?: string;
  /** where the account keeps the recording (one lossless file per few minutes) */
  files?: string[];
  sampleRate?: number;
}
/**
 * Present on reels/cassettes/CDs saved in the account. The audio stays in account storage until
 * the item goes in a machine (loaded), so a full shelf never fills the memory.
 */
export interface StoredInfo {
  savedAt: number;
  /** changed since the last save */
  dirty: boolean;
  /** audio is in memory (parts can be read from the item itself) */
  loaded: boolean;
  parts: StoredPart[];
}
/** What the account keeps for one item (the audio is kept beside it, files per part). */
export interface SavedMeta {
  id: string;
  kind: ShelfKind;
  typeId: string;
  name: string;
  artist?: string;
  savedAt: number;
  parts: StoredPart[];
}

/** Mark a saved item as changed (unsaved items stay as they are). */
export function markDirty<T extends { store?: StoredInfo }>(item: T): T {
  return item.store && !item.store.dirty
    ? { ...item, store: { ...item.store, dirty: true } }
    : item;
}
export const needsSave = (item: { store?: StoredInfo }) => !item.store || item.store.dirty;
export const isStoredOnly = (item: { store?: StoredInfo }) => !!item.store && !item.store.loaded;

const storedSeconds = (item: { store?: StoredInfo }, key: string) =>
  item.store?.parts.find((p) => p.key === key)?.seconds ?? 0;

export const reelTapeSeconds = (r: Reel) =>
  isStoredOnly(r) ? storedSeconds(r, "tape") : captureSeconds(r.capture);
export const cassetteSideSeconds = (c: Cassette, side: CassetteSide) =>
  isStoredOnly(c) ? storedSeconds(c, side) : captureSeconds(c.sides[side]);
/** Track lengths, whether the CD's audio is in memory or still in account storage. */
export const discLengths = (d: Disc) =>
  isStoredOnly(d) ? d.store!.parts.map((p) => p.seconds) : discTrackSeconds(d);
export const discTrackCount = (d: Disc) =>
  isStoredOnly(d) ? d.store!.parts.length : d.tracks.length;

/** Split an item into what the store keeps: metadata plus one recording per part. */
export function toSaved(
  kind: ShelfKind,
  item: Reel | Cassette | Disc,
  savedAt: number,
): { meta: SavedMeta; audio: [string, Capture][] } {
  const audio: [string, Capture][] = [];
  const parts: StoredPart[] = [];
  const add = (key: string, capture: Capture | null, title?: string) => {
    parts.push({
      key,
      seconds: captureSeconds(capture),
      ...(title !== undefined ? { title } : {}),
    });
    if (capture) audio.push([key, capture]);
  };
  let name = "";
  let artist: string | undefined;
  if (kind === "reel") {
    const r = item as Reel;
    name = r.name;
    add("tape", r.capture);
  } else if (kind === "cassette") {
    const c = item as Cassette;
    name = c.name;
    add("A", c.sides.A);
    add("B", c.sides.B);
  } else {
    const d = item as Disc;
    name = d.title;
    artist = d.artist;
    for (const t of d.tracks) add(t.id, t.capture, t.title);
  }
  return {
    meta: {
      id: item.id,
      kind,
      typeId: item.typeId,
      name,
      ...(artist !== undefined ? { artist } : {}),
      savedAt,
      parts,
    },
    audio,
  };
}

const storedInfo = (meta: SavedMeta): StoredInfo => ({
  savedAt: meta.savedAt,
  dirty: false,
  loaded: false,
  parts: meta.parts,
});
/** Shelf items for saved metadata, with their audio still in storage. */
export const savedReel = (meta: SavedMeta): Reel => ({
  ...newReel(meta.typeId, meta.name, meta.id),
  store: storedInfo(meta),
});
export const savedCassette = (meta: SavedMeta): Cassette => ({
  ...newCassette(meta.typeId, meta.name, meta.id),
  store: storedInfo(meta),
});
export const savedDisc = (meta: SavedMeta): Disc => ({
  ...newDisc(meta.typeId, meta.name, meta.id),
  artist: editName(meta.artist ?? ""),
  store: storedInfo(meta),
});

/** Fill a stored item with its audio read back from the store. */
export function withAudio<T extends Reel | Cassette | Disc>(
  item: T,
  audio: Map<string, Capture>,
): T {
  if (!item.store) return item;
  const store = { ...item.store, loaded: true };
  if ("capture" in item) return { ...item, capture: audio.get("tape") ?? null, store };
  if ("sides" in item)
    return { ...item, sides: { A: audio.get("A") ?? null, B: audio.get("B") ?? null }, store };
  const tracks: CdTrack[] = [];
  for (const p of store.parts) {
    const capture = audio.get(p.key);
    if (capture) tracks.push({ id: p.key, title: p.title ?? "", capture });
  }
  return { ...item, tracks, store };
}
/** Let go of the audio of a saved, unchanged item (it reloads from storage next time). */
export function releaseAudio<T extends Reel | Cassette | Disc>(item: T): T {
  if (!item.store || item.store.dirty || !item.store.loaded) return item;
  const store = { ...item.store, loaded: false };
  if ("capture" in item) return { ...item, capture: null, store };
  if ("sides" in item) return { ...item, sides: { A: null, B: null }, store };
  return { ...item, tracks: [], store };
}
/** After a save: the item is clean and remembers its saved parts. */
export function markSaved<T extends Reel | Cassette | Disc>(item: T, meta: SavedMeta): T {
  return {
    ...item,
    store: { savedAt: meta.savedAt, dirty: false, loaded: true, parts: meta.parts },
  };
}

/** Seconds of audio per uploaded file (about 30 MB of stereo FLAC). */
export const CHUNK_SECONDS = 300;
/** Frame ranges of the files one recording is split into when saved to the account. */
export function chunkRanges(frames: number, sampleRate: number): [number, number][] {
  const size = Math.max(1, Math.floor(CHUNK_SECONDS * sampleRate));
  const out: [number, number][] = [];
  for (let from = 0; from < frames; from += size) out.push([from, Math.min(frames, from + size)]);
  return out;
}

/** Small status line for shelf slots: SAVED, UNSAVED (changed since saving) or none. */
export function shelfTag(item: { store?: StoredInfo }): "SAVED" | "UNSAVED" | null {
  if (!item.store) return null;
  return item.store.dirty ? "UNSAVED" : "SAVED";
}
