/** Computer-keyboard MIDI ("typing keys"): A W S E D F T G Y H U J K play one octave, Z/X shift octaves. */
const KEY = "synclab.qwerty";
const OCT_KEY = "synclab.qwerty.octave";
export const QWERTY_MAP: Record<string, number> = {
  a: 0, w: 1, s: 2, e: 3, d: 4, f: 5, t: 6, g: 7, y: 8, h: 9, u: 10, j: 11, k: 12, o: 13, l: 14,
};

export function qwertyEnabled(): boolean {
  if (typeof window === "undefined") return true;
  return window.localStorage.getItem(KEY) !== "off";
}
export function setQwertyEnabled(on: boolean) {
  window.localStorage.setItem(KEY, on ? "on" : "off");
  window.dispatchEvent(new CustomEvent("synclab:qwerty"));
}
export function qwertyOctave(): number {
  if (typeof window === "undefined") return 4;
  const n = Number(window.localStorage.getItem(OCT_KEY));
  return Number.isFinite(n) && n >= 1 && n <= 7 ? n : 4;
}
export function setQwertyOctave(o: number) {
  window.localStorage.setItem(OCT_KEY, String(Math.min(7, Math.max(1, o))));
  window.dispatchEvent(new CustomEvent("synclab:qwerty"));
}
