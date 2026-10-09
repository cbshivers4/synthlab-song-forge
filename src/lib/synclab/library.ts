import { supabase } from "@/integrations/supabase/client";
import type { Json } from "@/integrations/supabase/types";

/** A saved sound or part, stored in a named folder on the cloud or on this computer. */
export type LibraryKind = "sample" | "synth" | "drum" | "notes";
export type LibraryLocation = "cloud" | "device";

export interface LibraryItem {
  id: string;
  kind: LibraryKind;
  folder: string;
  name: string;
  data: unknown;
  location: LibraryLocation;
  createdAt: number;
  /** cloud: storage path of the audio; device: audio blob kept in this browser */
  audioPath?: string | null;
  audio?: Blob | null;
}

const BUCKET = "synclab-cloud";
const DB = "synclab-library";
const STORE = "items";
const listeners = new Set<() => void>();
export const onLibraryChange = (fn: () => void) => {
  listeners.add(fn);
  return () => void listeners.delete(fn);
};
const emit = () => listeners.forEach((l) => l());

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(STORE, { keyPath: "id" });
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error ?? new Error("This browser can't store files on this computer."));
  });
}

async function tx<T>(mode: IDBTransactionMode, run: (s: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const req = run(db.transaction(STORE, mode).objectStore(STORE));
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function userId() {
  const { data } = await supabase.auth.getUser();
  if (!data.user) throw new Error("Sign in to save to the cloud.");
  return data.user.id;
}

const safe = (s: string) => s.replace(/[^a-zA-Z0-9._-]+/g, "-").slice(0, 60) || "item";

export async function listLibrary(location: LibraryLocation): Promise<LibraryItem[]> {
  if (location === "device") {
    const all = await tx<LibraryItem[]>("readonly", (s) => s.getAll() as IDBRequest<LibraryItem[]>);
    return all.sort((a, b) => b.createdAt - a.createdAt);
  }
  const { data, error } = await supabase.from("library_items").select("*").order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []).map((r) => ({
    id: r.id,
    kind: r.kind as LibraryKind,
    folder: r.folder,
    name: r.name,
    data: r.data,
    audioPath: r.audio_path,
    location: "cloud" as const,
    createdAt: new Date(r.created_at).getTime(),
  }));
}

export async function saveToLibrary(input: { kind: LibraryKind; folder: string; name: string; data: unknown; audio?: Blob | null; location: LibraryLocation }) {
  const folder = input.folder.trim() || "Unsorted";
  const name = input.name.trim() || "Untitled";
  if (input.location === "device") {
    const item: LibraryItem = { id: crypto.randomUUID(), kind: input.kind, folder, name, data: input.data, audio: input.audio ?? null, location: "device", createdAt: Date.now() };
    await tx("readwrite", (s) => s.put(item));
    emit();
    return;
  }
  const uid = await userId();
  let audioPath: string | null = null;
  if (input.audio) {
    audioPath = `${uid}/library/${Date.now()}-${safe(name)}`;
    const { error } = await supabase.storage.from(BUCKET).upload(audioPath, input.audio, { contentType: input.audio.type || "audio/wav" });
    if (error) throw error;
  }
  const { error } = await supabase.from("library_items").insert({ user_id: uid, kind: input.kind, folder, name, data: (input.data ?? {}) as Json, audio_path: audioPath });
  if (error) {
    if (audioPath) await supabase.storage.from(BUCKET).remove([audioPath]);
    throw error;
  }
  emit();
}

export async function deleteFromLibrary(item: LibraryItem) {
  if (item.location === "device") {
    await tx("readwrite", (s) => s.delete(item.id));
  } else {
    if (item.audioPath) await supabase.storage.from(BUCKET).remove([item.audioPath]);
    const { error } = await supabase.from("library_items").delete().eq("id", item.id);
    if (error) throw error;
  }
  emit();
}

export async function libraryAudio(item: LibraryItem): Promise<Blob | null> {
  if (item.audio) return item.audio;
  if (!item.audioPath) return null;
  const { data, error } = await supabase.storage.from(BUCKET).download(item.audioPath);
  if (error) throw error;
  return data;
}

/** Downloads the item as a real file to the computer's Downloads folder. */
export async function downloadLibraryItem(item: LibraryItem) {
  const audio = item.kind === "sample" ? await libraryAudio(item) : null;
  const blob = audio ?? new Blob([JSON.stringify({ synclab: item.kind, name: item.name, data: item.data }, null, 2)], { type: "application/json" });
  const ext = audio ? (audio.type.includes("wav") ? "wav" : audio.type.includes("mpeg") ? "mp3" : "webm") : "synclab.json";
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  const metadata = item.data as { filename?: string; mimeType?: string } | null;
  a.download = metadata?.filename ?? `${safe(item.folder)}-${safe(item.name)}.${ext}`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 5000);
}

export async function blobFromUrl(url: string) {
  const r = await fetch(url);
  if (!r.ok) throw new Error("That sound could not be read.");
  return r.blob();
}

export const KIND_LABEL: Record<LibraryKind, string> = { sample: "Samples", synth: "Synth sounds", drum: "Drum kits", notes: "Notes (MIDI)" };
