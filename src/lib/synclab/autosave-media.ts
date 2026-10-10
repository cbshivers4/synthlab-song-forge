/** Keeps the audio/video behind blob: URLs in IndexedDB so an accidental close can restore them with the autosaved session. */
const DB = "synclab-autosave";
const STORE = "media";

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(STORE);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function run<T>(mode: IDBTransactionMode, fn: (s: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const req = fn(db.transaction(STORE, mode).objectStore(STORE));
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export const putAutosaveItem = (key: string, value: unknown) => run("readwrite", (s) => s.put(value, key));
export const getAutosaveItem = <T,>(key: string) => run<T | undefined>("readonly", (s) => s.get(key) as IDBRequest<T | undefined>);
const keys = () => run<IDBValidKey[]>("readonly", (s) => s.getAllKeys());
const remove = (key: IDBValidKey) => run("readwrite", (s) => s.delete(key));

const stored = new Set<string>();

/** Stores every blob: URL the session uses and drops ones the session no longer references. */
export async function persistBlobUrls(urls: string[]) {
  const wanted = new Set(urls.filter((u) => u.startsWith("blob:")));
  for (const url of wanted) {
    if (stored.has(url)) continue;
    try {
      const blob = await (await fetch(url)).blob();
      await putAutosaveItem(`url:${url}`, blob);
      stored.add(url);
    } catch { /* revoked URL — nothing to keep */ }
  }
  try {
    for (const key of await keys()) {
      const k = String(key);
      if (k.startsWith("url:") && !wanted.has(k.slice(4))) { await remove(key); stored.delete(k.slice(4)); }
    }
  } catch { /* storage unavailable */ }
}

export const getBlobForUrl = (url: string) => getAutosaveItem<Blob>(`url:${url}`).catch(() => undefined);

export interface VideoSession { blob: Blob; name: string; chops: number[]; sourceBpm: number; targetBpm: number; stretchOn: boolean; noteGrid?: number; chopCount?: number; sensitivity?: number; manualSlice?: boolean }
export const saveVideoSession = (v: VideoSession) => putAutosaveItem("video-sampler", v).catch(() => undefined);
export const loadVideoSession = () => getAutosaveItem<VideoSession>("video-sampler").catch(() => undefined);
