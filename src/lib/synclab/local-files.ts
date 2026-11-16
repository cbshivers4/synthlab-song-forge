import { getEngine } from "./audio-engine";
import { uid } from "./presets";
import type { AudioClip as Clip } from "./types";
import { decodeAudioFile } from "./aiff-decode";

/** Audio files read from a folder on the user's computer (kept in memory for this session only). */
export type LocalFile = { id: string; name: string; path: string; size: number; file: File };
export type LocalFolder = { id: string; name: string; files: LocalFile[]; handle?: DirHandle };

export const AUDIO_EXT = /\.(mp3|wav|wave|aif|aiff|m4a|aac|ogg|flac|webm)$/i;
const registry = new Map<string, LocalFile>();
export const getLocalFile = (id: string) => registry.get(id);

/* ---------- opened folders, shared between the browser panel and the tools rail ---------- */
let folders: LocalFolder[] = [];
const folderListeners = new Set<() => void>();
const emitFolders = () => folderListeners.forEach((l) => l());
export const getLocalFolders = () => folders;
export function addLocalFolder(f: LocalFolder) {
  void import("./media-library").then(({ retainMediaInBackground }) => {
    for (const item of f.files) if (/\.mp3$/i.test(item.name)) retainMediaInBackground(item.file, item.name);
  });
  folders = [f, ...folders.filter((x) => x.id !== f.id)];
  if (f.handle) void rememberHandle(f.id, f.name, f.handle);
  emitFolders();
}
export function removeLocalFolder(id: string) {
  folders = folders.filter((f) => f.id !== id);
  void forgetHandle(id);
  emitFolders();
}

/* ---------- remembered folders (Chrome/Edge folder access survives reloads) ---------- */
const DB = "synclab-local-folders";
function db(): Promise<IDBDatabase | null> {
  if (typeof indexedDB === "undefined") return Promise.resolve(null);
  return new Promise((resolve) => {
    const req = indexedDB.open(DB, 1);
    req.onupgradeneeded = () => req.result.createObjectStore("handles");
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => resolve(null);
  });
}
async function tx<T>(mode: IDBTransactionMode, fn: (s: IDBObjectStore) => IDBRequest<T>): Promise<T | undefined> {
  const d = await db();
  if (!d) return undefined;
  return new Promise((resolve) => {
    try {
      const r = fn(d.transaction("handles", mode).objectStore("handles"));
      r.onsuccess = () => resolve(r.result);
      r.onerror = () => resolve(undefined);
    } catch { resolve(undefined); }
  });
}
async function rememberHandle(id: string, name: string, handle: DirHandle) { await tx("readwrite", (s) => s.put({ id, name, handle }, id)); }
async function forgetHandle(id: string) { await tx("readwrite", (s) => s.delete(id)); }
export type RememberedFolder = { id: string; name: string };
/** Folders opened before a reload that are not open now; reopening needs one click to re-allow access. */
export async function rememberedFolders(): Promise<RememberedFolder[]> {
  const all = (await tx("readonly", (s) => s.getAll() as IDBRequest<{ id: string; name: string }[]>)) ?? [];
  return all.filter((r) => !folders.some((f) => f.id === r.id)).map((r) => ({ id: r.id, name: r.name }));
}
export async function forgetRememberedFolder(id: string) { await forgetHandle(id); }
/** Silently reloads remembered folders the browser still allows reading (no prompt), so they just appear. */
let restoring: Promise<void> | null = null;
export function restoreGrantedFolders(): Promise<void> {
  restoring ??= (async () => {
    const all = (await tx("readonly", (s) => s.getAll() as IDBRequest<{ id: string; name: string; handle: DirHandle & { queryPermission?: (o: { mode: string }) => Promise<string> } }[]>)) ?? [];
    for (const rec of all) {
      if (folders.some((f) => f.id === rec.id)) continue;
      try {
        if ((await rec.handle.queryPermission?.({ mode: "read" })) !== "granted") continue;
        const out: { file: File; path: string }[] = [];
        await walk(rec.handle, "", out, 0);
        addLocalFolder({ ...toFolder(rec.name, out), id: rec.id, handle: rec.handle });
      } catch { /* stays as a one-click Reopen entry */ }
    }
  })();
  return restoring;
}
/** Must run from a click: the browser asks to allow reading the folder again. */
export async function reconnectFolder(id: string): Promise<LocalFolder | null> {
  const rec = await tx("readonly", (s) => s.get(id) as IDBRequest<{ id: string; name: string; handle: DirHandle & { requestPermission?: (o: { mode: string }) => Promise<string> } } | undefined>);
  if (!rec) return null;
  const perm = await rec.handle.requestPermission?.({ mode: "read" });
  if (perm && perm !== "granted") throw new Error("Access to that folder was not allowed.");
  const out: { file: File; path: string }[] = [];
  await walk(rec.handle, "", out, 0);
  const f = { ...toFolder(rec.name, out), id, handle: rec.handle };
  addLocalFolder(f);
  return f;
}

/** Pick individual audio files (works in every browser). */
export function pickFiles(): Promise<LocalFolder | null> {
  return new Promise((resolve) => {
    const input = document.createElement("input");
    input.type = "file";
    input.multiple = true;
    input.accept = "audio/*,.wav,.mp3,.aif,.aiff,.flac,.ogg,.m4a";
    input.onchange = () => {
      const list = Array.from(input.files ?? []);
      resolve(list.length ? toFolder(list.length === 1 ? list[0]!.name : `${list.length} files`, list.map((f) => ({ file: f, path: f.name }))) : null);
    };
    input.click();
  });
}
export const onFoldersChange = (fn: () => void) => {
  folderListeners.add(fn);
  return () => void folderListeners.delete(fn);
};

function toFolder(name: string, entries: { file: File; path: string }[]): LocalFolder {
  const files = entries
    .filter((e) => AUDIO_EXT.test(e.file.name))
    .sort((a, b) => a.path.localeCompare(b.path))
    .map((e) => {
      const f: LocalFile = { id: uid(), name: e.file.name, path: e.path, size: e.file.size, file: e.file };
      registry.set(f.id, f);
      return f;
    });
  return { id: uid(), name, files };
}

type DirHandle = { name: string; kind: string; values(): AsyncIterable<{ kind: string; name: string; getFile?: () => Promise<File> } & DirHandle> };

async function walk(dir: DirHandle, prefix: string, out: { file: File; path: string }[], depth: number) {
  for await (const h of dir.values()) {
    if (h.kind === "file" && AUDIO_EXT.test(h.name) && h.getFile) out.push({ file: await h.getFile(), path: prefix + h.name });
    else if (h.kind === "directory" && depth < 4) await walk(h, `${prefix}${h.name}/`, out, depth + 1);
  }
}

/** Uses the folder picker when the browser allows it; otherwise a folder upload input. */
export async function pickFolder(): Promise<LocalFolder | null> {
  const w = window as unknown as { showDirectoryPicker?: () => Promise<DirHandle> };
  if (w.showDirectoryPicker) {
    try {
      const dir = await w.showDirectoryPicker();
      const out: { file: File; path: string }[] = [];
      await walk(dir, "", out, 0);
      return { ...toFolder(dir.name, out), handle: dir };
    } catch (e) {
      if ((e as Error)?.name === "AbortError") return null;
      /* blocked inside the preview frame — fall back to the input */
    }
  }
  return new Promise((resolve) => {
    const input = document.createElement("input");
    input.type = "file";
    input.multiple = true;
    input.setAttribute("webkitdirectory", "");
    input.onchange = () => {
      const list = Array.from(input.files ?? []);
      if (!list.length) return resolve(null);
      const rel = (f: File) => (f as File & { webkitRelativePath?: string }).webkitRelativePath || f.name;
      const root = rel(list[0]!).split("/")[0] || "Folder";
      resolve(toFolder(root, list.map((f) => ({ file: f, path: rel(f).split("/").slice(1).join("/") || f.name }))));
    };
    input.click();
  });
}

/* ---------- preview through the master (so the master scope shows it) ---------- */
let current: AudioBufferSourceNode | null = null;
let currentId: string | null = null;
let analyser: AnalyserNode | null = null;
/** Live tap on the file being previewed — the browser's player bar draws its scope from this. */
export const getPreviewAnalyser = () => analyser;
const listeners = new Set<(id: string | null) => void>();
const emit = () => listeners.forEach((l) => l(currentId));
export const onPreviewChange = (fn: (id: string | null) => void) => {
  listeners.add(fn);
  return () => void listeners.delete(fn);
};

export function stopPreview() {
  try { current?.stop(); } catch { /* already stopped */ }
  current = null;
  currentId = null;
  emit();
}

export async function playPreview(id: string) {
  const lf = registry.get(id);
  if (!lf) return;
  stopPreview();
  const engine = getEngine();
  const ctx = engine.init();
  if (ctx.state === "suspended") await ctx.resume();
  const buf = await decodeAudioFile(ctx, await lf.file.arrayBuffer());
  const src = ctx.createBufferSource();
  src.buffer = buf;
  if (!analyser) {
    analyser = ctx.createAnalyser();
    analyser.fftSize = 2048;
  }
  src.connect(analyser);
  analyser.connect(engine.master ?? ctx.destination);
  src.onended = () => {
    if (current === src) { current = null; currentId = null; emit(); }
  };
  src.start();
  current = src;
  currentId = id;
  emit();
}

/** Decodes a local file into a real audio clip starting at `start` (1/16 steps). */
export async function clipFromLocalFile(id: string, start: number): Promise<Clip> {
  const lf = registry.get(id);
  if (!lf) throw new Error("That file is no longer open — reopen its folder.");
  return clipFromFile(lf.file, start);
}

/** Decodes any audio file into a waveform clip starting at `start` (steps). */
export async function clipFromFile(file: File, start: number): Promise<Clip> {
  const engine = getEngine();
  await engine.init();
  const name = file.name.replace(/\.[^.]+$/, "").toUpperCase().slice(0, 18);
  const loaded = await engine.loadSampleFile(file, name);
  return { id: uid(), name, peaks: loaded.peaks, duration: loaded.duration, url: loaded.url, start, offset: 0, length: loaded.duration, gain: 1 };
}
