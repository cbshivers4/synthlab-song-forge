/** Cached device preferences; never project autosave. */
export const PREFS_KEY = "synclab.prefs";
export const PREFS_EVENT = "synclab:preferences";
export const PLAYBACK_DEFAULTS = {
  midiThru: true,
  velocityCurve: "Linear",
  pitchBendRange: 2,
  clickSound: "Detroit Rim",
  clickLevel: 0.6,
  clickWhilePlaying: false,
  showTooltips: true,
  reduceMotion: false,
  exportFormat: "WAV 24-bit",
  exportRate: "48 kHz",
  exportTail: 2,
  normalizeExport: false,
};
let current = { ...PLAYBACK_DEFAULTS };
export const playbackPreferences = () => current;
export function refreshPreferences() {
  try {
    current = { ...PLAYBACK_DEFAULTS, ...JSON.parse(localStorage.getItem(PREFS_KEY) ?? "{}") };
  } catch {
    current = { ...PLAYBACK_DEFAULTS };
  }
  document.documentElement.toggleAttribute("data-reduce-motion", current.reduceMotion);
  document.documentElement.toggleAttribute("data-hide-tooltips", !current.showTooltips);
}
export function notifyPreferencesChanged() {
  refreshPreferences();
  window.dispatchEvent(new Event(PREFS_EVENT));
}
export function curvedVelocity(value: number, curve: string): number {
  const v = Math.min(1, Math.max(0, value));
  if (v === 0) return 0;
  if (curve === "Soft") return Math.sqrt(v);
  if (curve === "Hard") return v * v;
  if (curve === "Fixed 100") return 100 / 127;
  return v;
}
export function bendCents(value: number, range: number): number {
  return (Math.min(1, Math.max(0, value)) * 2 - 1) * Math.min(24, Math.max(1, range)) * 100;
}
