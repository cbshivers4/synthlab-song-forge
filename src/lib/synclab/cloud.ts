import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import type { Json } from "@/integrations/supabase/types";
import type { AudioClip, AuxId, BusId, BusState, DrumPad, PluginDef, PluginInstance, SongSection, SynthPatch, Track, TrackFolder, Transport, VcaId } from "./types";
import type { SavedPad } from "./pad-session";
import { drumSamplePlan, mediaStorePlan } from "./cloud-media";

const BUCKET = "synclab-cloud";

export interface CloudSession {
  version: 1;
  tracks: Track[];
  transport: Transport;
  buses: Record<BusId, BusState>;
  vcas?: Record<VcaId, BusState>;
  auxReturns?: Record<AuxId, BusState>;
  fxChains: Record<string, PluginInstance[]>;
  installedPlugins: PluginDef[];
  userPresets: SynthPatch[];
  padBank: Record<number, SavedPad>;
  sections?: SongSection[];
  folders?: TrackFolder[];
  /** Project-wide notes (ideas, lyrics, mix and mastering reminders). */
  projectNotes?: string;
}

export interface CloudProject {
  id: string;
  name: string;
  bpm: number;
  key: string;
  timeSig: string;
  template: string;
  openedAt: number;
  updatedAt: number;
  trackCount?: number;
  session?: CloudSession;
}

const safe = (name: string) => name.replace(/[^a-zA-Z0-9._-]+/g, "-").replace(/^-+|-+$/g, "") || "audio";

async function currentUserId() {
  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user) throw new Error("Sign in to use cloud storage.");
  return data.user.id;
}

/** Copies audio from any readable link (new recording, web link, app file) into project storage. */
async function copyToStorage(url: string, path: string) {
  const response = await fetch(url);
  if (!response.ok) throw new Error("An audio file could not be read for saving.");
  const blob = await response.blob();
  if (!blob.size) throw new Error("An audio file was empty.");
  const { error } = await supabase.storage.from(BUCKET).upload(path, blob, {
    contentType: blob.type || "application/octet-stream",
    upsert: true,
  });
  if (error) throw error;
}

async function uploadUrl(url: string, path: string) {
  if (!url.startsWith("blob:")) return url;
  const response = await fetch(url);
  if (!response.ok) throw new Error("An audio file could not be prepared for upload.");
  const blob = await response.blob();
  const { error } = await supabase.storage.from(BUCKET).upload(path, blob, {
    contentType: blob.type || "application/octet-stream",
    upsert: true,
  });
  if (error) throw error;
  return path;
}

/** Stores one audio reference: uploads new audio, keeps permanent paths, never saves expiring links. */
async function storeMedia(url: string | undefined, existingPath: string | undefined, newPath: string) {
  const plan = mediaStorePlan(url, existingPath, newPath);
  if ("upload" in plan) await uploadUrl(url ?? "", plan.upload);
  return "cloudPath" in plan ? { cloudPath: plan.cloudPath, url: undefined } : { cloudPath: undefined, url: plan.url };
}

async function prepareSession(session: CloudSession, userId: string, projectId: string): Promise<CloudSession> {
  const notStored = new Set<string>();
  const tracks = await Promise.all(session.tracks.map(async (track) => {
    const up = async (clip: AudioClip): Promise<AudioClip> => {
      const alts = clip.alts ? await Promise.all(clip.alts.map(up)) : undefined;
      if (!clip.url && !clip.cloudPath) return { ...clip, alts };
      return { ...clip, alts, ...(await storeMedia(clip.url, clip.cloudPath, `${userId}/${projectId}/audio/${clip.id}-${safe(clip.name)}`)) };
    };
    const clips = await Promise.all((track.clips ?? []).map(up));
    let sampler = track.sampler;
    if (sampler?.url || sampler?.cloudPath) {
      const stored = await storeMedia(sampler.url, sampler.cloudPath, `${userId}/${projectId}/samples/${track.id}-${safe(sampler.name)}`);
      sampler = { ...sampler, cloudPath: stored.cloudPath, url: stored.url ?? "" };
    }
    const sampleUploads = new Map<string, Promise<string | null>>();
    const upPad = async (pad: DrumPad): Promise<DrumPad> => {
      const plan = drumSamplePlan(pad.sampleUrl, pad.sampleCloudPath, `${userId}/${projectId}/drums/${track.id}-${pad.id}-${safe(pad.sample ?? pad.name)}`);
      if (plan.kind === "none") return pad;
      if (plan.kind === "keep") return { ...pad, sampleCloudPath: plan.cloudPath, sampleUrl: undefined };
      // The same sample is shared by a pad's copies in every bank: copy it once.
      const key = `${plan.from}>${plan.cloudPath}`;
      let upload = sampleUploads.get(key);
      if (!upload) {
        upload = copyToStorage(plan.from, plan.cloudPath).then(() => plan.cloudPath, () => null);
        sampleUploads.set(key, upload);
      }
      const stored = await upload;
      if (stored) return { ...pad, sampleCloudPath: stored, sampleUrl: undefined };
      // Couldn't read the sample right now: keep the old reference untouched and say so.
      notStored.add(pad.sample ?? pad.name);
      return pad;
    };
    const pads = track.pads ? await Promise.all(track.pads.map(upPad)) : undefined;
    const drumPatterns = track.drumPatterns ? await Promise.all(track.drumPatterns.map(bank => Promise.all((bank ?? []).map(upPad)))) : undefined;
    return { ...track, clips, sampler, pads, drumPatterns };
  }));
  const padBank: Record<number, SavedPad> = {};
  for (const [key, pad] of Object.entries(session.padBank)) {
    const stored = await storeMedia(pad.url, pad.cloudPath, `${userId}/${projectId}/pads/${key}-${safe(pad.name)}`);
    padBank[Number(key)] = { ...pad, cloudPath: stored.cloudPath, url: stored.url ?? "" };
  }
  if (notStored.size) {
    toast.warning(`${notStored.size === 1 ? "A drum sample" : `${notStored.size} drum samples`} couldn't be copied into the project`, {
      description: `${[...notStored].slice(0, 4).join(", ")} — load ${notStored.size === 1 ? "it" : "them"} onto the pad again, then save, so ${notStored.size === 1 ? "it keeps" : "they keep"} playing later.`,
    });
  }
  return { ...session, tracks, padBank };
}

async function signedUrl(path?: string) {
  if (!path) return "";
  if (/^https?:/i.test(path)) return path;
  const { data, error } = await supabase.storage.from(BUCKET).createSignedUrl(path, 60 * 60 * 12);
  if (error) throw error;
  return data.signedUrl;
}

/** Fresh playable link for audio stored in the cloud (links expire after 12 hours). */
export const freshCloudUrl = (path: string) => signedUrl(path);

async function restoreSession(session: CloudSession): Promise<CloudSession> {
  const sampleUrls = new Map<string, Promise<string>>();
  const missing = new Set<string>();
  const downPad = async (pad: DrumPad): Promise<DrumPad> => {
    if (!pad.sampleCloudPath) return pad;
    let url = sampleUrls.get(pad.sampleCloudPath);
    if (!url) { url = signedUrl(pad.sampleCloudPath).catch(() => ""); sampleUrls.set(pad.sampleCloudPath, url); }
    const sampleUrl = await url;
    const { getEngine } = await import('./audio-engine');
    if (sampleUrl && await getEngine().ensureBuffer(sampleUrl)) return { ...pad, sampleUrl };
    // One unreadable sample (e.g. an expired link from an old save) must not stop the project
    // opening. The pad keeps its saved reference, so saving again never erases it.
    missing.add(pad.sample ?? pad.name);
    return { ...pad, sampleUrl: undefined };
  };
  const tracks = await Promise.all(session.tracks.map(async (track) => ({
    ...track,
    pads: track.pads ? await Promise.all(track.pads.map(downPad)) : undefined,
    drumPatterns: track.drumPatterns ? await Promise.all(track.drumPatterns.map(bank => Promise.all((bank ?? []).map(downPad)))) : undefined,
    clips: await Promise.all((track.clips ?? []).map(async function down(clip: AudioClip): Promise<AudioClip> {
      return {
        ...clip,
        alts: clip.alts ? await Promise.all(clip.alts.map(down)) : undefined,
        url: clip.cloudPath ? await signedUrl(clip.cloudPath) : clip.url,
      };
    })),
    sampler: track.sampler
      ? { ...track.sampler, url: track.sampler.cloudPath ? await signedUrl(track.sampler.cloudPath) : track.sampler.url }
      : undefined,
    recording: false,
  })));
  const padBank: Record<number, SavedPad> = {};
  for (const [key, pad] of Object.entries(session.padBank ?? {})) {
    padBank[Number(key)] = { ...pad, url: pad.cloudPath ? await signedUrl(pad.cloudPath) : pad.url };
  }
  if (missing.size) {
    toast.warning(`${missing.size === 1 ? "A drum sample" : `${missing.size} drum samples`} couldn't be loaded`, {
      description: `${[...missing].slice(0, 4).join(", ")} — the pad stays silent for its sample until you load the sound onto it again. Everything else opened normally.`,
    });
  }
  return { ...session, tracks, padBank, transport: { ...session.transport, playing: false, recording: false, paused: false, step: 0 } };
}

export async function listCloudProjects(): Promise<CloudProject[]> {
  const { data, error } = await supabase.from("cloud_projects").select("id,name,bpm,musical_key,time_signature,template,opened_at,updated_at,session").order("updated_at", { ascending: false });
  if (error) throw error;
  return data.map((row) => {
    const session = row.session as unknown as CloudSession | null;
    return { id: row.id, name: row.name, bpm: row.bpm, key: row.musical_key, timeSig: row.time_signature, template: row.template, openedAt: new Date(row.opened_at).getTime(), updatedAt: new Date(row.updated_at).getTime(), trackCount: session?.tracks?.length ?? 0 };
  });
}

export async function saveCloudProject(project: Omit<CloudProject, "updatedAt" | "session">, session: CloudSession) {
  const userId = await currentUserId();
  const id = project.id || crypto.randomUUID();
  const prepared = await prepareSession(session, userId, id);
  const { data, error } = await supabase.from("cloud_projects").upsert({
    id,
    user_id: userId,
    name: project.name,
    bpm: project.bpm,
    musical_key: project.key,
    time_signature: project.timeSig,
    template: project.template,
    opened_at: new Date(project.openedAt).toISOString(),
    session: prepared as unknown as Json,
  }).select("id,updated_at").single();
  if (error) throw error;
  return { id: data.id, updatedAt: new Date(data.updated_at).getTime() };
}

export async function loadCloudProject(id: string): Promise<CloudProject> {
  const { data, error } = await supabase.from("cloud_projects").select("*").eq("id", id).single();
  if (error) throw error;
  return {
    id: data.id,
    name: data.name,
    bpm: data.bpm,
    key: data.musical_key,
    timeSig: data.time_signature,
    template: data.template,
    openedAt: Date.now(),
    updatedAt: new Date(data.updated_at).getTime(),
    session: await restoreSession(data.session as unknown as CloudSession),
  };
}

export async function renameCloudProject(id: string, name: string) {
  const { error } = await supabase.from("cloud_projects").update({ name }).eq("id", id);
  if (error) throw error;
}

export async function deleteCloudProject(project: CloudProject) {
  // Deletion reads stored paths directly; missing audio must not block removal.
  const userId = await currentUserId();
  const { data, error: readError } = await supabase.from("cloud_projects").select("session").eq("id", project.id).eq("user_id", userId).single();
  if (readError) throw readError;
  const session = data.session as unknown as CloudSession | null;
  const paths = new Set<string>();
  const collectClip = (clip: AudioClip) => {
    if (clip.cloudPath) paths.add(clip.cloudPath);
    for (const alternate of clip.alts ?? []) collectClip(alternate);
  };
  for (const track of session?.tracks ?? []) {
    for (const clip of track.clips ?? []) collectClip(clip);
    if (track.sampler?.cloudPath) paths.add(track.sampler.cloudPath);
    for (const pad of [...(track.pads ?? []), ...(track.drumPatterns ?? []).flat()]) if (pad?.sampleCloudPath) paths.add(pad.sampleCloudPath);
  }
  for (const pad of Object.values(session?.padBank ?? {})) if (pad.cloudPath) paths.add(pad.cloudPath);
  const { data: deleted, error } = await supabase.from("cloud_projects").delete().eq("id", project.id).eq("user_id", userId).select("id").single();
  if (error) throw error;
  if (!deleted) throw new Error("This project could not be deleted. Refresh the list and try again.");
  const ownedPaths = [...paths].filter((path) => path.startsWith(`${userId}/${project.id}/`));
  if (ownedPaths.length) {
    const { error: cleanupError } = await supabase.storage.from(BUCKET).remove(ownedPaths);
    if (cleanupError) {
      const { toast } = await import("sonner");
      toast.warning("Project deleted; some stored audio could not be removed.");
    }
  }
}

export async function uploadCloudExport(blob: Blob, name: string) {
  const userId = await currentUserId();
  const path = `${userId}/exports/${Date.now()}-${safe(name)}`;
  const { error } = await supabase.storage.from(BUCKET).upload(path, blob, { contentType: blob.type, upsert: false });
  if (error) throw error;
  return path;
}