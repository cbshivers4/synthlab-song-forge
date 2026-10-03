// Automatic mapping for Korg nanoKONTROL2-style 8-channel mixer controllers
// (factory default "CC mode" layout). Controls follow the track order:
// strip 1 = first track on the timeline, strip 2 = second track, and so on.
export type AutoMapHit = { strip: number; param: "volume" | "pan" | "solo" | "mute" | "arm" };

const KEY = "synclab.midi.automap";

export function autoMapEnabled(): boolean {
  if (typeof window === "undefined") return true;
  return window.localStorage.getItem(KEY) !== "off";
}
export function setAutoMapEnabled(on: boolean) {
  try { window.localStorage.setItem(KEY, on ? "on" : "off"); } catch { /* storage unavailable */ }
}

export function isKorgMixer(name: string | undefined): boolean {
  return !!name && /nano\s*kontrol|nanostudio|nano\s*studio/i.test(name);
}

export function korgAutoMap(cc: number): AutoMapHit | null {
  if (cc >= 0 && cc <= 7) return { strip: cc, param: "volume" };
  if (cc >= 16 && cc <= 23) return { strip: cc - 16, param: "pan" };
  if (cc >= 32 && cc <= 39) return { strip: cc - 32, param: "solo" };
  if (cc >= 48 && cc <= 55) return { strip: cc - 48, param: "mute" };
  if (cc >= 64 && cc <= 71) return { strip: cc - 64, param: "arm" };
  return null;
}
