import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { listLibrary, saveToLibrary } from "./library";

export const isSharedMedia = (name: string) => /\.(mp3|mp4)$/i.test(name);
const pending = new Map<string, Promise<void>>();

/** Content-addressed retention avoids duplicates when an existing library file is reused. */
export async function retainMedia(blob: Blob, filename: string, folder = "Uploads"): Promise<void> {
  if (!isSharedMedia(filename)) return;
  const hash = Array.from(new Uint8Array(await crypto.subtle.digest("SHA-256", await blob.arrayBuffer())), (b) => b.toString(16).padStart(2, "0")).join("");
  const existing = pending.get(hash);
  if (existing) return existing;
  const task = (async () => {
    const items = await listLibrary("cloud");
    if (items.some((i) => (i.data as { mediaHash?: string } | null)?.mediaHash === hash)) return;
    const video = /\.mp4$/i.test(filename);
    await saveToLibrary({ kind: "sample", location: "cloud", folder, name: filename, audio: blob,
      data: { mediaHash: hash, filename, mediaType: video ? "video" : "audio", mimeType: video ? "video/mp4" : "audio/mpeg", size: blob.size } });
    toast.success(`${filename} saved to your account library`);
  })();
  pending.set(hash, task);
  try { await task; } finally { pending.delete(hash); }
}

export function retainMediaInBackground(blob: Blob, filename: string, folder?: string) {
  void (async () => {
    // Skip silently when signed out — background retention is a convenience,
    // not something to nag guests about on every import/export.
    const { data } = await supabase.auth.getSession();
    if (!data.session) return;
    await retainMedia(blob, filename, folder);
  })().catch((e) => toast.error("File not saved to your account library", {
    description: e instanceof Error ? e.message : "Check your connection and sign in, then upload it in My Library.",
  }));
}

let videoSelection: { blob: Blob; name: string; kit?: VideoKit } | null = null;
export interface VideoKit { chops: number[]; sourceBpm: number; targetBpm: number; stretchOn: boolean; noteGrid?: number; chopCount?: number; sensitivity?: number; manualSlice?: boolean; midiNotes?: import("./video-pad-map").VideoPadMidiNote[] }
export function selectLibraryVideo(blob: Blob, name: string, kit?: VideoKit) { videoSelection = { blob, name, ...(kit ? { kit } : {}) }; }
export function takeLibraryVideo() { const value = videoSelection; videoSelection = null; return value; }