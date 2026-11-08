/**
 * DJ Decks playlist store (browser only). One module singleton, so the list you're building stays
 * put while you switch panels or between phone and desktop layouts, just like the decks.
 *
 * Saved playlists — and a copy of each music file they list — live in this browser's storage
 * (IndexedDB), so they come back after a reload even when the original files have moved. Nothing is
 * uploaded. In test mode (?test=1) everything stays in memory and is gone on reload.
 */
import { TEST_MODE } from "./test-mode";
import { uid } from "./presets";
import type { DeckId } from "./dj-engine";
import {
  addToPlaylist, audioKey, moveInPlaylist, playlistChanged, playlistName, removeFromPlaylist, sortPlaylists, trackTitle, unusedAudio,
  type Playlist, type PlaylistTrack,
} from "./dj-playlist";

/* ---------------- storage backends ---------------- */

export interface Backend {
  list(): Promise<Playlist[]>;
  /** Writes the playlist and any audio it needs in one go. */
  save(p: Playlist, audio: [string, Blob][]): Promise<void>;
  remove(id: string): Promise<void>;
  audio(key: string): Promise<Blob | null>;
  hasAudio(key: string): Promise<boolean>;
  dropAudio(keys: string[]): Promise<void>;
}

export function memoryBackend(): Backend {
  const lists = new Map<string, Playlist>();
  const blobs = new Map<string, Blob>();
  return {
    list: async () => [...lists.values()],
    save: async (p, audio) => { for (const [k, b] of audio) blobs.set(k, b); lists.set(p.id, p); },
    remove: async (id) => { lists.delete(id); },
    audio: async (k) => blobs.get(k) ?? null,
    hasAudio: async (k) => blobs.has(k),
    dropAudio: async (keys) => { for (const k of keys) blobs.delete(k); },
  };
}

function idbBackend(): Backend {
  let opening: Promise<IDBDatabase> | null = null;
  const db = () => (opening ??= new Promise<IDBDatabase>((resolve, reject) => {
    const req = indexedDB.open("synclab-dj-playlists", 1);
    req.onupgradeneeded = () => {
      req.result.createObjectStore("playlists", { keyPath: "id" });
      req.result.createObjectStore("audio");
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => { opening = null; reject(req.error ?? new Error("This browser's storage isn't available.")); };
  }));
  const done = (t: IDBTransaction) => new Promise<void>((resolve, reject) => {
    t.oncomplete = () => resolve();
    t.onerror = () => reject(t.error);
    t.onabort = () => reject(t.error ?? new Error("Saving was cancelled."));
  });
  const get = async <T>(store: string, run: (s: IDBObjectStore) => IDBRequest<T>) => {
    const d = await db();
    return new Promise<T>((resolve, reject) => {
      const r = run(d.transaction(store, "readonly").objectStore(store));
      r.onsuccess = () => resolve(r.result);
      r.onerror = () => reject(r.error);
    });
  };
  return {
    list: () => get<Playlist[]>("playlists", (s) => s.getAll() as IDBRequest<Playlist[]>),
    async save(p, audio) {
      const t = (await db()).transaction(["playlists", "audio"], "readwrite");
      const a = t.objectStore("audio");
      for (const [k, b] of audio) a.put(b, k);
      t.objectStore("playlists").put(p);
      await done(t);
    },
    async remove(id) { const t = (await db()).transaction("playlists", "readwrite"); t.objectStore("playlists").delete(id); await done(t); },
    audio: async (k) => (await get<Blob | undefined>("audio", (s) => s.get(k) as IDBRequest<Blob | undefined>)) ?? null,
    hasAudio: async (k) => (await get<number>("audio", (s) => s.count(k))) > 0,
    async dropAudio(keys) {
      if (!keys.length) return;
      const t = (await db()).transaction("audio", "readwrite");
      const s = t.objectStore("audio");
      for (const k of keys) s.delete(k);
      await done(t);
    },
  };
}

const LAST_KEY = "synclab.dj.playlist.last";

function friendlyError(e: unknown) {
  const name = (e as { name?: string })?.name;
  if (name === "QuotaExceededError") return new Error("There isn't enough storage space on this device for these music files. Remove some tracks or delete an old playlist, then save again.");
  return e instanceof Error ? e : new Error("This browser couldn't save the playlist.");
}

/* ---------------- the store ---------------- */

export class PlaylistStore {
  private backend: Backend;
  private listeners = new Set<() => void>();
  /** Files added this session, so they play and save without being read back from storage. */
  private blobs = new Map<string, Blob>();
  version = 0;
  ready = false;
  saved: Playlist[] = [];
  /** Saved playlist being edited, or null for a new unsaved one. */
  currentId: string | null = null;
  name = "";
  tracks: PlaylistTrack[] = [];
  onDeck: Record<DeckId, string | null> = { A: null, B: null };

  constructor(backend: Backend, private remember: boolean) { this.backend = backend; }

  subscribe(fn: () => void) { this.listeners.add(fn); return () => { this.listeners.delete(fn); }; }
  private emit() { this.version++; this.listeners.forEach((l) => l()); }

  get current() { return this.saved.find((p) => p.id === this.currentId) ?? null; }
  get dirty() { return playlistChanged(this.name, this.tracks, this.current); }
  get displayName() { return this.name || "New playlist"; }

  private initing: Promise<void> | null = null;
  init() {
    this.initing ??= (async () => {
      try {
        this.saved = sortPlaylists(await this.backend.list());
        const last = this.remember ? localStorage.getItem(LAST_KEY) : null;
        const open = this.saved.find((p) => p.id === last);
        if (open && !this.tracks.length && !this.currentId) this.show(open);
      } catch { this.saved = []; }
      this.ready = true;
      this.emit();
    })();
    return this.initing;
  }

  private show(p: Playlist | null) {
    this.currentId = p?.id ?? null;
    this.name = p?.name ?? "";
    this.tracks = p ? p.tracks.map((t) => ({ ...t })) : [];
    if (this.remember) { try { if (p) localStorage.setItem(LAST_KEY, p.id); else localStorage.removeItem(LAST_KEY); } catch { /* private mode */ } }
  }

  /** Adds music files to the end of the list. */
  addFiles(files: File[]) {
    const audio = files.filter((f) => f.type.startsWith("audio/") || /\.(mp3|wav|wave|aif|aiff|m4a|aac|ogg|flac|webm)$/i.test(f.name));
    const incoming = audio.map((f) => ({ key: audioKey(f), name: trackTitle(f.name), size: f.size }));
    const r = addToPlaylist(this.tracks, incoming, uid);
    for (const f of audio) if (!this.blobs.has(audioKey(f))) this.blobs.set(audioKey(f), f);
    this.tracks = r.tracks;
    for (const t of r.added) this.probeDuration(t);
    this.emit();
    return { added: r.added.length, duplicates: r.duplicates, overLimit: r.overLimit, notAudio: files.length - audio.length };
  }

  private probeDuration(t: PlaylistTrack) {
    const blob = this.blobs.get(t.key);
    if (!blob || typeof Audio === "undefined") return;
    const url = URL.createObjectURL(blob);
    const el = new Audio();
    const finish = () => { URL.revokeObjectURL(url); el.removeAttribute("src"); };
    el.preload = "metadata";
    el.onloadedmetadata = () => { if (Number.isFinite(el.duration)) this.setDuration(t.key, el.duration); finish(); };
    el.onerror = finish;
    el.src = url;
  }

  setDuration(key: string, seconds: number) {
    let changed = false;
    this.tracks = this.tracks.map((t) => (t.key === key && t.duration == null ? ((changed = true), { ...t, duration: seconds }) : t));
    if (changed) this.emit();
  }

  remove(id: string) { this.tracks = removeFromPlaylist(this.tracks, id); this.emit(); }
  move(id: string, delta: number) { this.tracks = moveInPlaylist(this.tracks, id, delta); this.emit(); }

  /** Starts a fresh, unsaved playlist. */
  newPlaylist() { this.show(null); this.emit(); }

  open(id: string) { const p = this.saved.find((x) => x.id === id); if (p) { this.show(p); this.emit(); } }

  /** Throws away unsaved edits to the open saved playlist. */
  revert() { this.show(this.current); this.emit(); }

  /** Saves the list (with copies of its music) under `name`. Returns the saved playlist. */
  async save(name = this.name) {
    const others = this.saved.filter((p) => p.id !== this.currentId).map((p) => p.name);
    const p: Playlist = { id: this.currentId ?? uid(), name: playlistName(name, others), tracks: this.tracks.map((t) => ({ ...t })), savedAt: Date.now() };
    const audio: [string, Blob][] = [];
    const missing: string[] = [];
    for (const t of p.tracks) {
      const b = this.blobs.get(t.key);
      if (b) { if (!(await this.backend.hasAudio(t.key))) audio.push([t.key, b]); }
      else if (!(await this.backend.hasAudio(t.key))) missing.push(t.name);
    }
    if (missing.length) throw new Error(`Couldn't find the music for ${missing.slice(0, 3).join(", ")}. Remove ${missing.length === 1 ? "it" : "them"} and add the file${missing.length === 1 ? "" : "s"} again.`);
    if (audio.length && typeof navigator !== "undefined") void navigator.storage?.persist?.().catch(() => false);
    const before = this.current;
    try { await this.backend.save(p, audio); } catch (e) { throw friendlyError(e); }
    this.saved = sortPlaylists([p, ...this.saved.filter((x) => x.id !== p.id)]);
    this.show(p);
    // music the old version of this list used and no saved list still needs
    if (before) await this.backend.dropAudio(unusedAudio(before.tracks.map((t) => t.key), this.saved)).catch(() => undefined);
    this.emit();
    return p;
  }

  /** Deletes a saved playlist and any stored music only it used. Your original files are untouched. */
  async deletePlaylist(id: string) {
    const p = this.saved.find((x) => x.id === id);
    if (!p) return;
    try { await this.backend.remove(id); } catch (e) { throw friendlyError(e); }
    this.saved = this.saved.filter((x) => x.id !== id);
    await this.backend.dropAudio(unusedAudio(p.tracks.map((t) => t.key), this.saved)).catch(() => undefined);
    if (this.currentId === id) this.show(null);
    this.emit();
  }

  /** Clears an unsaved list. */
  clear() { this.tracks = []; this.emit(); }

  async audioFor(t: PlaylistTrack): Promise<Blob | null> {
    const mem = this.blobs.get(t.key);
    if (mem) return mem;
    const stored = await this.backend.audio(t.key);
    if (stored) this.blobs.set(t.key, stored);
    return stored;
  }

  markOnDeck(deck: DeckId, trackId: string | null) { this.onDeck = { ...this.onDeck, [deck]: trackId }; this.emit(); }
}

let store: PlaylistStore | null = null;
export function getPlaylists() {
  return (store ??= new PlaylistStore(TEST_MODE || typeof indexedDB === "undefined" ? memoryBackend() : idbBackend(), !TEST_MODE));
}
/** For tests. */
export const createPlaylistStore = (backend: Backend = memoryBackend()) => new PlaylistStore(backend, false);
