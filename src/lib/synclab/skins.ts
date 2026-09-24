import { useEffect, useState } from "react";

export type Skin = { color?: string; padColor?: string; image?: string };
type SkinKey = "sampler" | "drums" | "synth";
const KEY = "synclab.skins.v1";
const EVT = "synclab:skins";

function readAll(): Partial<Record<SkinKey, Skin>> {
  try {
    return JSON.parse(localStorage.getItem(KEY) || "{}");
  } catch {
    return {};
  }
}

export function setSkin(key: SkinKey, patch: Partial<Skin>) {
  const all = readAll();
  all[key] = { ...all[key], ...patch };
  try {
    localStorage.setItem(KEY, JSON.stringify(all));
  } catch {
    throw new Error("This picture is too large to save on this device.");
  }
  window.dispatchEvent(new Event(EVT));
}

export function useSkin(key: SkinKey): Skin {
  const [skin, set] = useState<Skin>({});
  useEffect(() => {
    const load = () => set(readAll()[key] ?? {});
    load();
    window.addEventListener(EVT, load);
    return () => window.removeEventListener(EVT, load);
  }, [key]);
  return skin;
}

/** Shrinks a picture so it can be stored on the device. */
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
