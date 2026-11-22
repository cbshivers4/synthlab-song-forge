import type {
  AuxId,
  BusId,
  BusState,
  CustomBus,
  PluginInstance,
  SongSection,
  Track,
  TrackFolder,
  VcaId,
} from "../types";

/**
 * Live collaboration ("Live together"): pure helpers shared by the bridge and tests.
 * Edits travel as whole channels (last change wins per channel) plus the song-wide settings;
 * arming and recording stay with each person, because each records on their own device.
 */

/** Track fields that belong to one person's device, never shared. */
export const LOCAL_TRACK_KEYS = ["armed", "recording"] as const;

export function shareableTrack(t: Track): Track {
  const { armed: _a, recording: _r, ...rest } = t as Track & { recording?: unknown };
  return { ...rest, armed: false } as Track;
}

/** Content fingerprint of what others see of a channel (same content = nothing to send). */
export const trackKey = (t: Track) => JSON.stringify(shareableTrack(t));

export interface SharedSong {
  bpm: number;
  swing: number;
  bars: number;
  beatsPerBar: number;
  buses: Record<BusId, BusState>;
  customBuses: CustomBus[];
  vcas: Record<VcaId, BusState>;
  auxReturns: Record<AuxId, BusState>;
  fxChains: Record<string, PluginInstance[]>;
  sections: SongSection[];
  folders: TrackFolder[];
  projectNotes: string;
}
export const songKey = (s: SharedSong) => JSON.stringify(s);

export interface TrackChange {
  upserts: Track[];
  removed: string[];
  /** full channel order after the change (null = unchanged) */
  order: string[] | null;
}

/** Applies someone else's channel changes, keeping this device's arm/record state. */
export function applyTrackChange(local: Track[], change: TrackChange): Track[] {
  const removed = new Set(change.removed);
  const incoming = new Map(change.upserts.map((t) => [t.id, t]));
  const out: Track[] = [];
  for (const t of local) {
    if (removed.has(t.id)) continue;
    const r = incoming.get(t.id);
    if (r) {
      out.push({ ...r, armed: t.armed, ...(t.recording ? { recording: t.recording } : {}) });
      incoming.delete(t.id);
    } else out.push(t);
  }
  for (const r of incoming.values()) if (!removed.has(r.id)) out.push({ ...r, armed: false });
  if (!change.order) return out;
  const rank = new Map(change.order.map((id, i) => [id, i]));
  return out
    .map((t, i) => ({ t, i }))
    .sort(
      (a, b) =>
        (rank.get(a.t.id) ?? change.order!.length + a.i) -
        (rank.get(b.t.id) ?? change.order!.length + b.i),
    )
    .map((x) => x.t);
}

/** Splits channels into groups that each stay under maxBytes of JSON (one big channel stays alone). */
export function chunkTracks(tracks: Track[], maxBytes: number): Track[][] {
  const chunks: Track[][] = [];
  let cur: Track[] = [];
  let size = 0;
  for (const t of tracks) {
    const n = JSON.stringify(t).length;
    if (cur.length && size + n > maxBytes) {
      chunks.push(cur);
      cur = [];
      size = 0;
    }
    cur.push(t);
    size += n;
  }
  if (cur.length) chunks.push(cur);
  return chunks;
}

export interface Peer {
  clientId: string;
  userId: string;
  name: string;
  email: string;
  joinedAt: number;
  seenAt: number;
}

/** Someone who hasn't said "still here" for this long has left. */
export const PEER_TIMEOUT_MS = 50_000;
export const PRESENCE_EVERY_MS = 20_000;

export function livePeers(peers: Iterable<Peer>, now = Date.now()): Peer[] {
  return [...peers]
    .filter((p) => now - p.seenAt < PEER_TIMEOUT_MS)
    .sort((a, b) => a.joinedAt - b.joinedAt || a.clientId.localeCompare(b.clientId));
}

/**
 * Who sends the song to someone who just joined: the person who has been in it longest
 * (so only one copy is sent). `me` is this device; `joiner` is the newcomer.
 */
export function answersJoin(me: Peer, others: Peer[], joinerId: string, now = Date.now()): boolean {
  const here = livePeers([me, ...others.filter((p) => p.clientId !== joinerId)], now);
  return here[0]?.clientId === me.clientId;
}

export function initials(name: string): string {
  const parts = name
    .trim()
    .split(/[\s._-]+/)
    .filter(Boolean);
  return ((parts[0]?.[0] ?? "?") + (parts[1]?.[0] ?? "")).toUpperCase();
}

/** Normalised email for invites. */
export function cleanEmail(v: string): string | null {
  const e = v.trim().toLowerCase();
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e) && e.length <= 254 ? e : null;
}
