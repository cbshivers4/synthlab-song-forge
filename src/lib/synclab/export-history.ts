/** The last exports made on this device (names and settings only — the files themselves are wherever you saved them). */
export interface ExportHistoryEntry {
  at: number;
  what: string;
  files: string[];
  mb: number;
  detail: string;
}
const KEY = "synclab.exportHistory";
const MAX = 12;

export function readExportHistory(): ExportHistoryEntry[] {
  try {
    const v = JSON.parse(localStorage.getItem(KEY) || "[]");
    return Array.isArray(v) ? (v as ExportHistoryEntry[]).slice(0, MAX) : [];
  } catch {
    return [];
  }
}
export function addExportHistory(entry: ExportHistoryEntry): ExportHistoryEntry[] {
  const next = [entry, ...readExportHistory()].slice(0, MAX);
  try {
    localStorage.setItem(KEY, JSON.stringify(next));
  } catch {
    /* storage unavailable */
  }
  return next;
}
export function clearExportHistory() {
  try {
    localStorage.removeItem(KEY);
  } catch {
    /* storage unavailable */
  }
}
