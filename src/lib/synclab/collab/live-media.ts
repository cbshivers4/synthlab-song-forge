import { supabase } from "@/integrations/supabase/client";
import type { AudioClip, DrumPad, Track } from "../types";

/**
 * Audio only on this device (new recordings, loaded files: "blob:" links) can't be played by
 * anyone else. Before a channel is shared, such audio is uploaded once into the song's storage
 * folder and the shared copy points at a playable link; this device keeps its own link.
 */
const BUCKET = "synclab-cloud";
const uploads = new Map<string, Promise<{ url: string; path: string } | null>>();

const safe = (name: string) =>
  name
    .replace(/[^a-zA-Z0-9._-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60) || "audio";

function share(url: string, folder: string, name: string) {
  let p = uploads.get(url);
  if (!p) {
    p = (async () => {
      try {
        const blob = await (await fetch(url)).blob();
        if (!blob.size) return null;
        const path = `${folder}live/${crypto.randomUUID()}-${safe(name)}`;
        const up = await supabase.storage
          .from(BUCKET)
          .upload(path, blob, { contentType: blob.type || "application/octet-stream" });
        if (up.error) return null;
        const signed = await supabase.storage.from(BUCKET).createSignedUrl(path, 60 * 60 * 12);
        return signed.data ? { url: signed.data.signedUrl, path } : null;
      } catch {
        return null;
      }
    })();
    uploads.set(url, p);
    void p.then((r) => {
      if (!r) uploads.delete(url);
    });
  }
  return p;
}

const isLocal = (u: string | undefined): u is string => !!u && u.startsWith("blob:");

export function hasLocalAudio(t: Track): boolean {
  return JSON.stringify(t).includes('"blob:');
}

/** The channel as others should get it, with this device's audio uploaded. */
export async function shareableMedia(t: Track, folder: string): Promise<Track> {
  if (!hasLocalAudio(t)) return t;
  const clip = async (c: AudioClip): Promise<AudioClip> => {
    const alts = c.alts ? await Promise.all(c.alts.map(clip)) : c.alts;
    if (!isLocal(c.url)) return { ...c, alts };
    const r = await share(c.url, folder, c.name);
    return r ? { ...c, alts, url: r.url, cloudPath: r.path } : { ...c, alts, url: undefined };
  };
  const pad = async (p: DrumPad): Promise<DrumPad> => {
    if (!isLocal(p.sampleUrl)) return p;
    const r = await share(p.sampleUrl, folder, p.sample ?? p.name);
    return r ? { ...p, sampleUrl: r.url, sampleCloudPath: r.path } : { ...p, sampleUrl: undefined };
  };
  let sampler = t.sampler;
  if (sampler && isLocal(sampler.url)) {
    const r = await share(sampler.url, folder, sampler.name);
    sampler = r ? { ...sampler, url: r.url, cloudPath: r.path } : { ...sampler, url: "" };
  }
  let patch = t.patch;
  const gran = patch?.granular;
  if (patch && gran && isLocal(gran.sampleUrl)) {
    const r = await share(gran.sampleUrl, folder, gran.sampleName ?? "granular");
    patch = {
      ...patch,
      granular: r
        ? { ...gran, sampleUrl: r.url, sampleCloudPath: r.path }
        : { ...gran, sampleUrl: "" },
    };
  }
  return {
    ...t,
    clips: t.clips ? await Promise.all(t.clips.map(clip)) : t.clips,
    pads: t.pads ? await Promise.all(t.pads.map(pad)) : t.pads,
    drumPatterns: t.drumPatterns
      ? await Promise.all(t.drumPatterns.map((b) => Promise.all((b ?? []).map(pad))))
      : t.drumPatterns,
    sampler,
    patch,
  };
}

/** Every playable link in a channel someone shared (to load the sounds before they're played). */
export function mediaUrls(t: Track): string[] {
  const out = new Set<string>();
  const add = (u: string | undefined) => {
    if (u && /^https?:/i.test(u)) out.add(u);
  };
  const clip = (c: AudioClip) => {
    add(c.url);
    c.alts?.forEach(clip);
  };
  t.clips?.forEach(clip);
  t.pads?.forEach((p) => add(p.sampleUrl));
  t.drumPatterns?.forEach((b) => b?.forEach((p) => add(p?.sampleUrl)));
  add(t.sampler?.url);
  add(t.patch?.granular?.sampleUrl);
  return [...out];
}
