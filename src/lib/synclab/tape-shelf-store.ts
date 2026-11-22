/**
 * Saved reels, cassettes and CDs, kept in the signed-in account so they show on every device.
 * A row in tape_shelf_items lists each item and its parts (reel tape, cassette side, CD track);
 * each part's audio is uploaded as lossless 16-bit FLAC in five-minute files to the private
 * account bucket. Audio is only downloaded when an item goes in a machine. Parts whose audio
 * hasn't changed since it was saved or loaded are never uploaded again.
 * Test mode keeps everything in memory, so automation never touches the account.
 */
import { supabase } from "@/integrations/supabase/client";
import type { Json } from "@/integrations/supabase/types";
import type { Capture } from "./bounce";
import { TEST_MODE } from "./test-mode";
import { encodeInBackground } from "./audio-encode";
import { chunkRanges, type SavedMeta, type ShelfKind, type StoredPart } from "./tape-media-model";

const BUCKET = "synclab-cloud";
const TABLE = "tape_shelf_items";
/** Audio that's already in the account, so saving again skips the upload. */
// Per item: audio dubbed onto a CD from a reel is the same recording, but each item keeps its
// own copy in the account, so deleting the reel can't silence the CD.
type Stored = { files: string[]; sampleRate: number };
const uploaded = new WeakMap<Capture, Map<string, Stored>>();
const storedFor = (capture: Capture, id: string) => uploaded.get(capture)?.get(id);
function remember(capture: Capture, id: string, stored: Stored | null) {
  let byItem = uploaded.get(capture);
  if (!byItem) uploaded.set(capture, (byItem = new Map()));
  if (stored) byItem.set(id, stored);
  else byItem.delete(id);
}
const memory = { items: new Map<string, SavedMeta>(), audio: new Map<string, Capture>() };

const safe = (s: string) => s.replace(/[^a-zA-Z0-9_-]+/g, "-").slice(0, 40) || "part";

async function accountId(): Promise<string | null> {
  if (TEST_MODE) return null;
  const { data } = await supabase.auth.getSession();
  return data.session?.user.id ?? null;
}
export const SIGN_IN_MESSAGE = "Sign in to save reels, cassettes and CDs to your account.";

interface Row {
  id: string;
  kind: string;
  type_id: string;
  name: string;
  artist: string;
  parts: Json;
  saved_at: string;
}
const fromRow = (r: Row): SavedMeta => ({
  id: r.id,
  kind: r.kind as ShelfKind,
  typeId: r.type_id,
  name: r.name,
  artist: r.artist,
  savedAt: Date.parse(r.saved_at),
  parts: (Array.isArray(r.parts) ? r.parts : []) as unknown as StoredPart[],
});
const filesOf = (meta: SavedMeta | null | undefined) =>
  (meta?.parts ?? []).flatMap((p) => p.files ?? []);

/** Everything saved in the account, newest first (empty when signed out). */
export async function listSaved(): Promise<SavedMeta[]> {
  if (TEST_MODE) return [...memory.items.values()].sort((a, b) => b.savedAt - a.savedAt);
  const user = await accountId();
  if (!user) return [];
  const { data, error } = await supabase
    .from(TABLE)
    .select("id, kind, type_id, name, artist, parts, saved_at")
    .order("saved_at", { ascending: false });
  if (error) throw new Error("Couldn't read your saved tapes and CDs.");
  return (data ?? []).map((r) => fromRow(r as Row));
}

async function readSaved(user: string, id: string): Promise<SavedMeta | null> {
  const { data } = await supabase
    .from(TABLE)
    .select("id, kind, type_id, name, artist, parts, saved_at")
    .eq("user_id", user)
    .eq("id", id)
    .maybeSingle();
  return data ? fromRow(data as Row) : null;
}

/**
 * Save (or update) one item with its recordings. Returns the stored metadata (with file paths).
 * onProgress reports 0..1 over the audio that has to be uploaded.
 */
export async function saveToShelf(
  meta: SavedMeta,
  audio: [string, Capture][],
  onProgress?: (fraction: number) => void,
): Promise<SavedMeta> {
  if (TEST_MODE) {
    for (const key of [...memory.audio.keys()])
      if (key.startsWith(`${meta.id}:`)) memory.audio.delete(key);
    for (const [key, capture] of audio) memory.audio.set(`${meta.id}:${key}`, capture);
    memory.items.set(meta.id, meta);
    onProgress?.(1);
    return meta;
  }
  const user = await accountId();
  if (!user) throw new Error(SIGN_IN_MESSAGE);
  const previous = await readSaved(user, meta.id);
  const fresh = audio.filter(([, capture]) => !storedFor(capture, meta.id));
  const total = fresh.reduce((n, [, c]) => n + c.left.length, 0) || 1;
  let done = 0;
  const added: string[] = [];
  const stamp = Date.now().toString(36);
  const audioByKey = new Map(audio);
  try {
    const parts: StoredPart[] = [];
    for (const part of meta.parts) {
      const capture = audioByKey.get(part.key);
      if (!capture) {
        parts.push({ ...part, files: [] });
        continue;
      }
      const folder = `${user}/tapes/${safe(meta.id)}/`;
      let stored = storedFor(capture, meta.id);
      if (!stored) {
        const files: string[] = [];
        const right = capture.right.length ? capture.right : capture.left;
        const ranges = chunkRanges(capture.left.length, capture.sampleRate);
        for (let i = 0; i < ranges.length; i++) {
          const [from, to] = ranges[i]!;
          // slice(): only this piece is copied to the encoder, not the whole tape.
          const piece = {
            left: capture.left.slice(from, to),
            right: right.slice(from, to),
            sampleRate: capture.sampleRate,
          };
          const blob = await encodeInBackground(piece, "flac16", 0, (p) =>
            onProgress?.(Math.min(0.99, (done + (to - from) * p * 0.5) / total)),
          );
          const path = `${folder}${safe(part.key)}-${stamp}-${i}.flac`;
          const { error } = await supabase.storage
            .from(BUCKET)
            .upload(path, blob, { contentType: "audio/flac", upsert: true });
          if (error)
            throw new Error("The upload didn't finish. Check your connection and try again.");
          added.push(path);
          files.push(path);
          done += to - from;
          onProgress?.(Math.min(0.99, done / total));
        }
        stored = { files, sampleRate: capture.sampleRate };
        remember(capture, meta.id, stored);
      }
      parts.push({ ...part, files: stored.files, sampleRate: stored.sampleRate });
    }
    const saved: SavedMeta = { ...meta, parts };
    const { error } = await supabase.from(TABLE).upsert({
      user_id: user,
      id: meta.id,
      kind: meta.kind,
      type_id: meta.typeId,
      name: meta.name,
      artist: meta.artist ?? "",
      parts: parts as unknown as Json,
      saved_at: new Date(meta.savedAt).toISOString(),
    });
    if (error) throw new Error("Couldn't save it to your account. Try again.");
    // Files the item no longer uses (a side recorded over, a CD track removed).
    const keep = new Set(filesOf(saved));
    const stale = filesOf(previous).filter((f) => !keep.has(f));
    if (stale.length) await supabase.storage.from(BUCKET).remove(stale);
    onProgress?.(1);
    return saved;
  } catch (error) {
    if (added.length) {
      await supabase.storage.from(BUCKET).remove(added);
      for (const [, capture] of fresh) remember(capture, meta.id, null);
    }
    throw error instanceof Error ? error : new Error("Couldn't save it to your account.");
  }
}

async function decodeFlac(
  blob: Blob,
  sampleRate: number,
): Promise<{ left: Float32Array; right: Float32Array }> {
  const ctx = new OfflineAudioContext(2, 1, sampleRate);
  const buffer = await ctx.decodeAudioData(await blob.arrayBuffer());
  const left = buffer.getChannelData(0);
  return { left, right: buffer.numberOfChannels > 1 ? buffer.getChannelData(1) : left };
}
const join = (pieces: Float32Array[]) => {
  const out = new Float32Array(pieces.reduce((n, p) => n + p.length, 0));
  let at = 0;
  for (const p of pieces) {
    out.set(p, at);
    at += p.length;
  }
  return out;
};

/** Download the recordings of a saved item. */
export async function loadFromShelf(
  id: string,
  parts: StoredPart[],
): Promise<Map<string, Capture>> {
  const out = new Map<string, Capture>();
  if (TEST_MODE) {
    for (const p of parts) {
      const capture = memory.audio.get(`${id}:${p.key}`);
      if (capture) out.set(p.key, capture);
    }
    return out;
  }
  for (const p of parts) {
    if (!p.files?.length) continue;
    const sampleRate = p.sampleRate ?? 44100;
    const lefts: Float32Array[] = [];
    const rights: Float32Array[] = [];
    for (const path of p.files) {
      const { data, error } = await supabase.storage.from(BUCKET).download(path);
      if (error || !data)
        throw new Error("Couldn't download this recording. Check your connection.");
      const piece = await decodeFlac(data, sampleRate);
      lefts.push(piece.left);
      rights.push(piece.right);
    }
    const capture: Capture = { left: join(lefts), right: join(rights), sampleRate };
    remember(capture, id, { files: p.files, sampleRate });
    out.set(p.key, capture);
  }
  return out;
}

/** Delete a saved item and its recordings from the account. */
export async function deleteFromShelf(id: string) {
  if (TEST_MODE) {
    memory.items.delete(id);
    for (const key of [...memory.audio.keys()])
      if (key.startsWith(`${id}:`)) memory.audio.delete(key);
    return;
  }
  const user = await accountId();
  if (!user) throw new Error(SIGN_IN_MESSAGE);
  const previous = await readSaved(user, id);
  const { error } = await supabase.from(TABLE).delete().eq("user_id", user).eq("id", id);
  if (error) throw new Error("Couldn't delete it from your account. Try again.");
  const files = filesOf(previous);
  if (files.length) await supabase.storage.from(BUCKET).remove(files);
}

/** Run when someone signs in or out, so the shelf shows that account's tapes. */
export function onAccountChange(fn: () => void) {
  if (TEST_MODE) return () => {};
  const { data } = supabase.auth.onAuthStateChange((event) => {
    if (event === "SIGNED_IN" || event === "SIGNED_OUT") setTimeout(fn, 0);
  });
  return () => data.subscription.unsubscribe();
}
