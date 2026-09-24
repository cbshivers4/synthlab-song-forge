import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export type Skin = {
  color?: string | undefined;
  padColor?: string | undefined;
  image?: string | undefined;
  /** 1 = cover, up to 4x zoom (crops the picture). */
  imageZoom?: number | undefined;
  /** Focus point, 0-100 %. */
  imageX?: number | undefined;
  imageY?: number | undefined;
};
export type SkinKey = "sampler" | "drums" | "synth";
export type Skins = Partial<Record<SkinKey, Skin>>;
export type SkinPreset = { id: string; name: string; skins: Skins };

const KEY = "synclab.skins.v1";
const PRESET_KEY = "synclab.skin-presets.v1";
const EVT = "synclab:skins";

function read<T>(k: string, fallback: T): T {
  try {
    const v = localStorage.getItem(k);
    return v ? (JSON.parse(v) as T) : fallback;
  } catch {
    return fallback;
  }
}
export const readSkins = () => read<Skins>(KEY, {});
export const readPresets = () => read<SkinPreset[]>(PRESET_KEY, []);

function write(k: string, v: unknown, sync = true) {
  try {
    localStorage.setItem(k, JSON.stringify(v));
  } catch {
    throw new Error("This picture is too large to save on this device.");
  }
  window.dispatchEvent(new Event(EVT));
  if (sync) scheduleSync();
}

export function setSkin(key: SkinKey, patch: Partial<Skin>) {
  const all = readSkins();
  all[key] = { ...all[key], ...patch };
  write(KEY, all);
}

export function savePreset(name: string) {
  const list = readPresets();
  list.push({ id: crypto.randomUUID(), name: name.trim() || `Theme ${list.length + 1}`, skins: readSkins() });
  write(PRESET_KEY, list);
}
export function applyPreset(id: string) {
  const p = readPresets().find((x) => x.id === id);
  if (p) write(KEY, p.skins);
}
export function deletePreset(id: string) {
  write(PRESET_KEY, readPresets().filter((x) => x.id !== id));
}

export function useSkin(key: SkinKey): Skin {
  const [skin, set] = useState<Skin>({});
  useEffect(() => {
    const load = () => set(readSkins()[key] ?? {});
    load();
    window.addEventListener(EVT, load);
    return () => window.removeEventListener(EVT, load);
  }, [key]);
  return skin;
}

export function usePresets(): SkinPreset[] {
  const [list, set] = useState<SkinPreset[]>([]);
  useEffect(() => {
    const load = () => set(readPresets());
    load();
    window.addEventListener(EVT, load);
    return () => window.removeEventListener(EVT, load);
  }, []);
  return list;
}

/* ---------- account sync ---------- */
let timer: number | undefined;
let pulled = false;
function scheduleSync() {
  window.clearTimeout(timer);
  timer = window.setTimeout(() => void pushToAccount(), 1200);
}
async function pushToAccount() {
  if (!pulled) return; // never overwrite the account copy before reading it
  const { data } = await supabase.auth.getUser();
  if (!data.user) return;
  await supabase.from("user_visual_settings").upsert({
    user_id: data.user.id,
    skins: readSkins() as never,
    presets: readPresets() as never,
    updated_at: new Date().toISOString(),
  });
}
/** Loads account settings; if the account has none yet, uploads this device's. */
export async function pullFromAccount() {
  const { data: u } = await supabase.auth.getUser();
  if (!u.user) return;
  const { data, error } = await supabase
    .from("user_visual_settings")
    .select("skins, presets")
    .eq("user_id", u.user.id)
    .maybeSingle();
  if (error) return;
  pulled = true;
  if (data) {
    try {
      write(KEY, data.skins ?? {}, false);
      write(PRESET_KEY, data.presets ?? [], false);
    } catch {
      /* device storage full; keep local copy */
    }
  } else {
    await pushToAccount();
  }
}
let started = false;
export function startSkinSync() {
  if (started || typeof window === "undefined") return;
  started = true;
  void pullFromAccount();
  supabase.auth.onAuthStateChange((event) => {
    if (event === "SIGNED_IN") void pullFromAccount();
    if (event === "SIGNED_OUT") pulled = false;
  });
}

/** Shrinks a picture so it can be stored and synced. */
export function imageToDataUrl(file: File, max = 1280): Promise<string> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      const s = Math.min(1, max / Math.max(img.width, img.height));
      const c = document.createElement("canvas");
      c.width = Math.round(img.width * s);
      c.height = Math.round(img.height * s);
      c.getContext("2d")!.drawImage(img, 0, 0, c.width, c.height);
      URL.revokeObjectURL(url);
      resolve(c.toDataURL("image/jpeg", 0.8));
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("That file could not be opened as a picture."));
    };
    img.src = url;
  });
}
