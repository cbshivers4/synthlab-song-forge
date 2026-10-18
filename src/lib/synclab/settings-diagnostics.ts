import { PREFS_KEY } from "./preferences";

export const RELOAD_CHECK_KEY = "synclab.diagnostics.reload";
const documentId = Math.random().toString(36).slice(2);
const keys = [PREFS_KEY, "synclab.input.device", "synclab.input.channel", "synclab.input.gainDb", "synclab.output.device", "synclab.qwerty", "synclab.qwerty.octave", "synclab.mobile-accessibility.v1"];
export type CheckResult = { status: "passed" | "attention" | "blocked"; detail: string };
type Snapshot = { documentId: string; values: Record<string, string | null> };

export function capturePreferences(storage: Pick<Storage, "getItem">): Record<string, string | null> {
  return Object.fromEntries(keys.map(key => [key, storage.getItem(key)]));
}

export function comparePreferences(before: Record<string, string | null>, after: Record<string, string | null>): CheckResult {
  const changed = Object.keys(before).filter(key => before[key] !== after[key]);
  if (changed.length) return { status: "blocked", detail: `${changed.length} saved preference group(s) changed or disappeared after reload.` };
  const saved = Object.values(before).filter(value => value !== null).length;
  return saved ? { status: "passed", detail: `${saved} saved preference group(s) persisted after a full page reload.` } : { status: "attention", detail: "No saved preferences to verify. Change a setting, then run the reload check again." };
}

export function prepareReloadCheck(): void {
  const values = capturePreferences(localStorage);
  const probe = "synclab.diagnostics.storage-probe";
  try {
    localStorage.setItem(probe, documentId);
    if (localStorage.getItem(probe) !== documentId) throw new Error("Storage did not retain the test value.");
  } finally { localStorage.removeItem(probe); }
  sessionStorage.setItem(RELOAD_CHECK_KEY, JSON.stringify({ documentId, values } satisfies Snapshot));
}

export function readReloadCheck(): CheckResult | null {
  try {
    const raw = sessionStorage.getItem(RELOAD_CHECK_KEY);
    if (!raw) return null;
    const snapshot = JSON.parse(raw) as Snapshot;
    if (!snapshot.values || typeof snapshot.documentId !== "string") throw new Error("Invalid check");
    if (snapshot.documentId === documentId) return { status: "attention", detail: "Reload is pending. Reopening Settings alone does not verify persistence." };
    return comparePreferences(snapshot.values, capturePreferences(localStorage));
  } catch { return { status: "blocked", detail: "Preference storage cannot be read. Check browser storage permissions and retry." }; }
}

export function accessFailure(error: unknown): CheckResult {
  const name = (error as { name?: string })?.name;
  if (name === "NotAllowedError" || name === "SecurityError") return { status: "blocked", detail: "Permission denied. Allow access in your browser/site permissions and try again." };
  if (name === "NotFoundError" || name === "OverconstrainedError") return { status: "attention", detail: "The selected device is not available. Connect it or choose System default in Audio." };
  if (name === "NotReadableError") return { status: "blocked", detail: "The device could not be opened; another app may be using it." };
  return { status: "blocked", detail: error instanceof Error ? error.message : "Access check failed. Try again." };
}

/** Independent capture: never takes ownership of the studio's shared microphone. */
export async function probeMicrophone(request: () => Promise<MediaStream>): Promise<CheckResult> {
  let stream: MediaStream | undefined;
  try {
    stream = await request();
    const track = stream.getAudioTracks().find(track => track.readyState === "live");
    return track ? { status: "passed", detail: `Input opened: ${track.label || "microphone"}. Test capture released; no recording saved.` } : { status: "attention", detail: "No live audio input was returned." };
  } catch (error) { return accessFailure(error); }
  finally { stream?.getTracks().forEach(track => track.stop()); }
}