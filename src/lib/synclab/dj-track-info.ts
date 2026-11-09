/**
 * Song details for the DJ track list (browser only): title and artist from the file's own tags, and
 * the tempo — from the tag, from the deck once the track has been loaded, or measured on this device
 * with the decks' own tempo detection (one track at a time, in the background).
 *
 * Keyed by the playlist audio key (name|size), so the same file shows the same details in every
 * playlist. Results are remembered on this device (localStorage) so tempos aren't measured twice;
 * test mode keeps them in memory only. Nothing is uploaded and playlists themselves are untouched.
 */
import { TEST_MODE } from "./test-mode";
import { detectBpm } from "./dj";
import { id3Size, mp4Tags, readTrackTags, type TrackTags } from "./track-tags";

export type BpmFrom = "tag" | "deck" | "scan";
export interface TrackInfo {
  title: string | null;
  artist: string | null;
  bpm: number | null;
  bpmFrom: BpmFrom | null;
  /** Tempo measuring state; "failed" = the file couldn't be decoded here. */
  scan: "idle" | "queued" | "scanning" | "failed";
  tagsRead: boolean;
}

const CACHE_KEY = "synclab.dj.trackInfo.v1";
const CACHE_MAX = 600;
const MB = 1024 * 1024;

const ascii = (b: Uint8Array, from: number, to: number) => String.fromCharCode(...b.subarray(from, Math.min(to, b.length)));
const u32 = (b: Uint8Array, i: number) => ((b[i]! << 24) >>> 0) + (b[i + 1]! << 16) + (b[i + 2]! << 8) + b[i + 3]!;
const bytesOf = async (blob: Blob, from: number, to: number) => new Uint8Array(await blob.slice(from, Math.min(blob.size, to)).arrayBuffer());

/** Reads only the parts of the file that hold its tags (never decodes the audio). */
export async function readBlobTags(blob: Blob): Promise<TrackTags> {
  const first = await bytesOf(blob, 0, 64 * 1024);
  const tail = blob.size >= 128 ? await bytesOf(blob, blob.size - 128, blob.size) : undefined;
  if (ascii(first, 4, 8) === "ftyp") {
    // walk the top-level boxes to the "moov" box (it can sit after the audio) and read just that
    let pos = 0;
    for (let n = 0; n < 64 && pos + 8 <= blob.size; n++) {
      const h = await bytesOf(blob, pos, pos + 16);
      let size = u32(h, 0);
      if (size === 1) size = u32(h, 8) * 2 ** 32 + u32(h, 12);
      else if (size === 0) size = blob.size - pos;
      if (size < 8) break;
      if (ascii(h, 4, 8) === "moov") return size <= 16 * MB ? mp4Tags(await bytesOf(blob, pos, pos + size)) : { title: null, artist: null, bpm: null };
      pos += size;
    }
    return { title: null, artist: null, bpm: null };
  }
  let head = first;
  const id3 = id3Size(first);
  if (id3 > first.length) head = await bytesOf(blob, 0, Math.min(id3, 16 * MB));
  else if (ascii(first, 0, 4) === "fLaC") head = await bytesOf(blob, 0, 2 * MB);
  return readTrackTags(head, tail);
}

/** Decodes the file at a low rate (tempo only needs the beat) and runs the decks' tempo detection. */
async function measureBpm(blob: Blob): Promise<number | null> {
  if (typeof OfflineAudioContext === "undefined") return null;
  const ctx = new OfflineAudioContext(1, 1, 22050);
  const buf = await ctx.decodeAudioData(await blob.arrayBuffer());
  const chans = Array.from({ length: buf.numberOfChannels }, (_, c) => buf.getChannelData(c));
  const mono = new Float32Array(buf.length);
  for (const ch of chans) for (let i = 0; i < ch.length; i++) mono[i] = (mono[i] ?? 0) + (ch[i] ?? 0) / chans.length;
  if (buf.duration < 6) return null;
  const { bpm, confidence } = detectBpm(mono, buf.sampleRate);
  return confidence > 0 ? Math.round(bpm * 10) / 10 : null;
}

type Cached = { t: string | null; a: string | null; b: number | null; f: BpmFrom | null };

export class TrackInfoStore {
  private map = new Map<string, TrackInfo>();
  private listeners = new Set<() => void>();
  private queue: { key: string; load: () => Promise<Blob | null> }[] = [];
  private running = false;
  private saveTimer: ReturnType<typeof setTimeout> | null = null;
  version = 0;

  constructor(private remember: boolean) {
    if (!remember || typeof localStorage === "undefined") return;
    try {
      const raw = JSON.parse(localStorage.getItem(CACHE_KEY) ?? "{}") as Record<string, Cached>;
      for (const [k, c] of Object.entries(raw)) this.map.set(k, { title: c.t, artist: c.a, bpm: c.b, bpmFrom: c.f, scan: "idle", tagsRead: true });
    } catch { /* no cache */ }
  }

  subscribe(fn: () => void) { this.listeners.add(fn); return () => { this.listeners.delete(fn); }; }
  private emit() { this.version++; this.listeners.forEach((l) => l()); this.persist(); }

  get(key: string): TrackInfo | null { return this.map.get(key) ?? null; }

  private patch(key: string, p: Partial<TrackInfo>) {
    const cur = this.map.get(key) ?? { title: null, artist: null, bpm: null, bpmFrom: null, scan: "idle", tagsRead: false };
    this.map.set(key, { ...cur, ...p });
    this.emit();
  }

  private persist() {
    if (!this.remember || typeof localStorage === "undefined") return;
    if (this.saveTimer) clearTimeout(this.saveTimer);
    this.saveTimer = setTimeout(() => {
      const out: Record<string, Cached> = {};
      const done = [...this.map.entries()].filter(([, v]) => v.tagsRead).slice(-CACHE_MAX);
      for (const [k, v] of done) out[k] = { t: v.title, a: v.artist, b: v.bpm, f: v.bpmFrom };
      try { localStorage.setItem(CACHE_KEY, JSON.stringify(out)); } catch { /* storage full: details are re-read next time */ }
    }, 400);
  }

  /** Reads the title/artist/tempo tags once per file, then measures the tempo if no tag gave one. */
  async ensure(key: string, load: () => Promise<Blob | null>) {
    const cur = this.map.get(key);
    if (cur && (cur.tagsRead && (cur.bpm != null || cur.scan !== "idle"))) return;
    if (!cur?.tagsRead) {
      this.patch(key, { tagsRead: true });
      try {
        const blob = await load();
        if (blob) {
          const tags = await readBlobTags(blob);
          const now = this.map.get(key)!;
          this.patch(key, {
            title: tags.title, artist: tags.artist,
            ...(tags.bpm != null && now.bpmFrom !== "deck" ? { bpm: tags.bpm, bpmFrom: "tag" as const } : {}),
          });
        }
      } catch { /* unreadable tags: the file name is shown */ }
    }
    const now = this.map.get(key)!;
    if (now.bpm == null && now.scan === "idle") {
      this.patch(key, { scan: "queued" });
      this.queue.push({ key, load });
      void this.run();
    }
  }

  /** The deck's own detected tempo wins: it's what the deck shows and syncs to. */
  setDeckBpm(key: string, bpm: number) {
    if (!(bpm > 0)) return;
    this.queue = this.queue.filter((q) => q.key !== key);
    this.patch(key, { bpm: Math.round(bpm * 10) / 10, bpmFrom: "deck", scan: "idle" });
  }

  private async run() {
    if (this.running) return;
    this.running = true;
    while (this.queue.length) {
      const { key, load } = this.queue.shift()!;
      const cur = this.map.get(key);
      if (!cur || cur.bpm != null) continue;
      this.patch(key, { scan: "scanning" });
      try {
        const blob = await load();
        const bpm = blob ? await measureBpm(blob) : null;
        const after = this.map.get(key)!;
        if (after.bpm == null) this.patch(key, bpm != null ? { bpm, bpmFrom: "scan", scan: "idle" } : { scan: "failed" });
      } catch { this.patch(key, { scan: "failed" }); }
      // breathe between files so the decks and waveforms stay smooth
      await new Promise((r) => setTimeout(r, 120));
    }
    this.running = false;
  }
}

let store: TrackInfoStore | null = null;
export const getTrackInfo = () => (store ??= new TrackInfoStore(!TEST_MODE));
