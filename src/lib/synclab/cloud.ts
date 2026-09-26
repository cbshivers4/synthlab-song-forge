import { supabase } from "@/integrations/supabase/client";
import type { Json } from "@/integrations/supabase/types";
import type { AuxId, BusId, BusState, PluginDef, PluginInstance, SongSection, SynthPatch, Track, Transport, VcaId } from "./types";
import type { SavedPad } from "./pad-session";

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
  session?: CloudSession;
}

const safe = (name: string) => name.replace(/[^a-zA-Z0-9._-]+/g, "-").replace(/^-+|-+$/g, "") || "audio";

async function currentUserId() {
  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user) throw new Error("Sign in to use cloud storage.");
  return data.user.id;
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

async function prepareSession(session: CloudSession, userId: string, projectId: string): Promise<CloudSession> {
  const tracks = await Promise.all(session.tracks.map(async (track) => {
    const clips = await Promise.all((track.clips ?? []).map(async (clip) => {
      const cloudPath = clip.cloudPath ?? `${userId}/${projectId}/audio/${clip.id}-${safe(clip.name)}`;
      return clip.url ? { ...clip, cloudPath: await uploadUrl(clip.url, cloudPath), url: undefined } : clip;
    }));
    let sampler = track.sampler;
    if (sampler?.url) {
      const cloudPath = sampler.cloudPath ?? `${userId}/${projectId}/samples/${track.id}-${safe(sampler.name)}`;
      sampler = { ...sampler, cloudPath: await uploadUrl(sampler.url, cloudPath), url: "" };
    }
    return { ...track, clips, sampler };
  }));
  const padBank: Record<number, SavedPad> = {};
  for (const [key, pad] of Object.entries(session.padBank)) {
    const cloudPath = pad.cloudPath ?? `${userId}/${projectId}/pads/${key}-${safe(pad.name)}`;
    padBank[Number(key)] = { ...pad, cloudPath: await uploadUrl(pad.url, cloudPath), url: "" };
  }
  return { ...session, tracks, padBank };
}

async function signedUrl(path?: string) {
  if (!path) return "";
  const { data, error } = await supabase.storage.from(BUCKET).createSignedUrl(path, 60 * 60 * 12);
  if (error) throw error;
  return data.signedUrl;
}

async function restoreSession(session: CloudSession): Promise<CloudSession> {
  const tracks = await Promise.all(session.tracks.map(async (track) => ({
    ...track,
    clips: await Promise.all((track.clips ?? []).map(async (clip) => ({
      ...clip,
      url: clip.cloudPath ? await signedUrl(clip.cloudPath) : clip.url,
    }))),
    sampler: track.sampler
      ? { ...track.sampler, url: track.sampler.cloudPath ? await signedUrl(track.sampler.cloudPath) : track.sampler.url }
      : undefined,
    recording: false,
  })));
  const padBank: Record<number, SavedPad> = {};
  for (const [key, pad] of Object.entries(session.padBank ?? {})) {
    padBank[Number(key)] = { ...pad, url: pad.cloudPath ? await signedUrl(pad.cloudPath) : pad.url };
  }
  return { ...session, tracks, padBank, transport: { ...session.transport, playing: false, recording: false, paused: false, step: 0 } };
}

export async function listCloudProjects(): Promise<CloudProject[]> {
  const { data, error } = await supabase.from("cloud_projects").select("id,name,bpm,musical_key,time_signature,template,opened_at,updated_at").order("updated_at", { ascending: false });
  if (error) throw error;
  return data.map((row) => ({ id: row.id, name: row.name, bpm: row.bpm, key: row.musical_key, timeSig: row.time_signature, template: row.template, openedAt: new Date(row.opened_at).getTime(), updatedAt: new Date(row.updated_at).getTime() }));
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
  const full = await loadCloudProject(project.id);
  const paths = new Set<string>();
  for (const track of full.session?.tracks ?? []) {
    for (const clip of track.clips ?? []) if (clip.cloudPath) paths.add(clip.cloudPath);
    if (track.sampler?.cloudPath) paths.add(track.sampler.cloudPath);
  }
  for (const pad of Object.values(full.session?.padBank ?? {})) if (pad.cloudPath) paths.add(pad.cloudPath);
  if (paths.size) await supabase.storage.from(BUCKET).remove([...paths]);
  const { error } = await supabase.from("cloud_projects").delete().eq("id", project.id);
  if (error) throw error;
}

export async function uploadCloudExport(blob: Blob, name: string) {
  const userId = await currentUserId();
  const path = `${userId}/exports/${Date.now()}-${safe(name)}`;
  const { error } = await supabase.storage.from(BUCKET).upload(path, blob, { contentType: blob.type, upsert: false });
  if (error) throw error;
  return path;
}