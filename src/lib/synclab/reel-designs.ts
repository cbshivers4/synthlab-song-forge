/**
 * Swappable reel-to-reel designs. Each design is a different machine face (colours, frame, reel
 * metal, head-cover badge and counter) around the same controls and the same tape engine, so
 * switching design never changes the sound or the tape. The choice is a device preference.
 */
import { useSyncExternalStore } from "react";

export interface ReelDesign {
  id: string;
  name: string;
  /** printed under the brand on the deck */
  model: string;
  /** what the design is inspired by, shown in the picker */
  blurb: string;
  /** head-cover badge lines */
  head: [string, string];
}

export const REEL_DESIGNS: readonly ReelDesign[] = [
  {
    id: "classic",
    name: "Silver Stereo",
    model: "STEREO TAPE RECORDER · DETROIT",
    blurb: "Satin silver face, walnut sides",
    head: ["PRECISION STEREO HEAD", "R2R · DIRECT DRIVE"],
  },
  {
    id: "studio",
    name: "Studio Master",
    model: "MASTER RECORDER · 2-TRACK · 30 IPS",
    blurb: "Warm studio grey console machine, black keys",
    head: ["STUDIO MASTER HEADBLOCK", "ERASE · RECORD · REPRODUCE"],
  },
  {
    id: "broadcast",
    name: "Broadcast Silver",
    model: "BROADCAST TAPE DECK · 7½ / 15 IPS",
    blurb: "Bright brushed aluminium over a smoked deck",
    head: ["BROADCAST HEAD ASSEMBLY", "3 MOTORS · ½ TRACK"],
  },
  {
    id: "midnight",
    name: "Midnight Black",
    model: "GX STEREO DECK · GLASS & CRYSTAL HEADS",
    blurb: "Black anodised face with gold trim",
    head: ["CRYSTAL FERRITE HEADS", "AUTO REVERSE · QUARTZ LOCK"],
  },
  {
    id: "field",
    name: "Field Portable",
    model: "PORTABLE FIELD RECORDER · MONO/STEREO",
    blurb: "Gunmetal location recorder with leather straps",
    head: ["FIELD HEAD", "BATTERY · CRYSTAL SYNC"],
  },
];

export const DEFAULT_REEL_DESIGN = "classic";
const KEY = "synclab.reel.design";
const EVENT = "synclab:reel-design";

/** A known design id, or the default for anything else (old values, hand-edited files). */
export function parseReelDesign(value: unknown): string {
  return typeof value === "string" && REEL_DESIGNS.some((d) => d.id === value)
    ? value
    : DEFAULT_REEL_DESIGN;
}

export function reelDesign(id: string): ReelDesign {
  return REEL_DESIGNS.find((d) => d.id === id) ?? REEL_DESIGNS[0]!;
}

export function readReelDesign(): string {
  try {
    return parseReelDesign(localStorage.getItem(KEY));
  } catch {
    return DEFAULT_REEL_DESIGN;
  }
}

export function setReelDesign(id: string) {
  const next = parseReelDesign(id);
  try {
    localStorage.setItem(KEY, next);
  } catch {
    /* storage blocked: still switch for this session */
  }
  window.dispatchEvent(new CustomEvent(EVENT, { detail: next }));
}

let session: string | null = null;
function subscribe(cb: () => void) {
  const on = (e: Event) => {
    session = (e as CustomEvent<string>).detail ?? null;
    cb();
  };
  const onStorage = (e: StorageEvent) => {
    if (e.key === KEY) {
      session = null;
      cb();
    }
  };
  window.addEventListener(EVENT, on);
  window.addEventListener("storage", onStorage);
  return () => {
    window.removeEventListener(EVENT, on);
    window.removeEventListener("storage", onStorage);
  };
}

export function useReelDesign(): string {
  return useSyncExternalStore(
    subscribe,
    () => session ?? readReelDesign(),
    () => DEFAULT_REEL_DESIGN,
  );
}
