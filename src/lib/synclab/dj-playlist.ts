/**
 * DJ Decks playlists — pure list rules (no browser APIs), shared by the playlist store and tests.
 *
 * A playlist is an ordered list of music files. Each entry points at its audio by a content key
 * (file name + size), so the same file added to two playlists is stored once, and deleting a
 * playlist only removes audio no other saved playlist still uses.
 */

export interface PlaylistTrack {
  /** Entry id inside this playlist (the same file can't be listed twice in one playlist). */
  id: string;
  /** Points at the stored audio; shared between playlists that list the same file. */
  key: string;
  name: string;
  size: number;
  /** Seconds, once known. */
  duration: number | null;
}

export interface Playlist {
  id: string;
  name: string;
  tracks: PlaylistTrack[];
  savedAt: number;
}

export const MAX_PLAYLIST_NAME = 40;
export const MAX_PLAYLIST_TRACKS = 200;

/** "My Song.mp3" -> "My Song" */
export const trackTitle = (fileName: string) => fileName.replace(/\.[^./\\]+$/, "").trim() || fileName;

/** Same name and byte size = same file. */
export const audioKey = (file: { name: string; size: number }) => `${file.name}|${file.size}`;

export interface IncomingTrack { key: string; name: string; size: number; duration?: number | null }

/** Adds files to the end, skipping files already in the list and anything past the size limit. */
export function addToPlaylist(tracks: PlaylistTrack[], incoming: IncomingTrack[], makeId: () => string) {
  const out = [...tracks];
  const have = new Set(tracks.map((t) => t.key));
  const added: PlaylistTrack[] = [];
  let duplicates = 0, overLimit = 0;
  for (const f of incoming) {
    if (have.has(f.key)) { duplicates++; continue; }
    if (out.length >= MAX_PLAYLIST_TRACKS) { overLimit++; continue; }
    const t: PlaylistTrack = { id: makeId(), key: f.key, name: f.name, size: f.size, duration: f.duration ?? null };
    have.add(f.key);
    out.push(t);
    added.push(t);
  }
  return { tracks: out, added, duplicates, overLimit };
}

export const removeFromPlaylist = (tracks: PlaylistTrack[], id: string) => tracks.filter((t) => t.id !== id);

/** Moves one entry up (-1) or down (+1); the ends stay put. */
export function moveInPlaylist(tracks: PlaylistTrack[], id: string, delta: number) {
  const from = tracks.findIndex((t) => t.id === id);
  if (from < 0) return tracks;
  const to = Math.max(0, Math.min(tracks.length - 1, from + delta));
  if (to === from) return tracks;
  const out = [...tracks];
  const [t] = out.splice(from, 1);
  out.splice(to, 0, t!);
  return out;
}

/**
 * A clean name for a playlist: trimmed, single-spaced, within the length limit, "Playlist N" when
 * empty, and never the same as another saved playlist (adds " (2)", " (3)"…).
 */
export function playlistName(raw: string, otherNames: string[]) {
  const taken = new Set(otherNames.map((n) => n.trim().toLowerCase()));
  let base = raw.replace(/\s+/g, " ").trim().slice(0, MAX_PLAYLIST_NAME).trim();
  if (!base) {
    let n = 1;
    while (taken.has(`playlist ${n}`)) n++;
    return `Playlist ${n}`;
  }
  if (!taken.has(base.toLowerCase())) return base;
  for (let n = 2; ; n++) {
    const tag = ` (${n})`;
    const name = base.slice(0, MAX_PLAYLIST_NAME - tag.length).trim() + tag;
    if (!taken.has(name.toLowerCase())) return name;
  }
}

/** Audio keys that no playlist in `playlists` still lists — safe to delete from storage. */
export function unusedAudio(keys: Iterable<string>, playlists: Playlist[]) {
  const used = new Set(playlists.flatMap((p) => p.tracks.map((t) => t.key)));
  return [...new Set(keys)].filter((k) => !used.has(k));
}

/** True when the working list differs from what was last saved. */
export function playlistChanged(name: string, tracks: PlaylistTrack[], saved: Pick<Playlist, "name" | "tracks"> | null) {
  if (!saved) return tracks.length > 0;
  if (name !== saved.name || tracks.length !== saved.tracks.length) return true;
  return tracks.some((t, i) => t.key !== saved.tracks[i]!.key);
}

export const playlistSeconds = (tracks: PlaylistTrack[]) => tracks.reduce((s, t) => s + (t.duration ?? 0), 0);

/** Saved playlists, newest save first. */
export const sortPlaylists = (list: Playlist[]) => [...list].sort((a, b) => b.savedAt - a.savedAt);
