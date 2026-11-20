/**
 * SYNCLAB desktop runtime.
 *
 * The studio runs in two places and is honest about the difference:
 *
 *   Browser tab  — everything that Web Audio, Web MIDI and getUserMedia can do. No native
 *                  plugin hosting, no direct disk access (downloads only).
 *   Desktop app  — the same studio inside an Electron shell (see /electron). It adds real
 *                  Save/Open dialogs on your own disk and a home for the Desktop Audio
 *                  Bridge, which is the process that hosts VST3/AU/CLAP natively.
 *
 * Nothing here simulates a capability. If the shell is absent, every desktop-only call
 * reports that plainly and the UI falls back to the browser behaviour.
 */

export interface DesktopApi {
  desktop: true;
  platform: "darwin" | "win32" | "linux" | string;
  appName?: string;
  appId?: string;
  appVersion?: string;
  versions: { electron: string; chrome: string };
  chooseFolder?: () => Promise<{ ok: boolean; canceled?: boolean; path?: string }>;
  /** Native menu commands; returns an unsubscribe function. */
  onMenu?: (handler: (command: string) => void) => () => void;
  saveFile: (
    name: string,
    data: ArrayBuffer,
    filters?: { name: string; extensions: string[] }[],
  ) => Promise<{ ok: boolean; canceled?: boolean; path?: string }>;
  openFiles: (
    filters?: { name: string; extensions: string[] }[],
    multiple?: boolean,
  ) => Promise<{
    ok: boolean;
    canceled?: boolean;
    files?: { name: string; path: string; data: ArrayBuffer }[];
  }>;
  revealFile: (path: string) => Promise<{ ok: boolean }>;
  pluginBridgeInfo?: () => Promise<{ ok: boolean; url: string; capability: "scan" | "host" }>;
}

declare global {
  interface Window {
    synclab?: DesktopApi;
  }
}

/** True only inside the SYNCLAB desktop shell. Never guessed from the user agent. */
export function isDesktop(): boolean {
  return typeof window !== "undefined" && window.synclab?.desktop === true;
}

export function desktopApi(): DesktopApi | null {
  return typeof window !== "undefined" && window.synclab?.desktop ? window.synclab : null;
}

export function platformName(): string {
  const api = desktopApi();
  if (api) {
    if (api.platform === "darwin") return "macOS";
    if (api.platform === "win32") return "Windows";
    return "Linux";
  }
  if (typeof navigator === "undefined") return "Unknown";
  const ua = navigator.userAgent;
  if (/Mac/i.test(ua)) return "macOS";
  if (/Win/i.test(ua)) return "Windows";
  if (/Android/i.test(ua)) return "Android";
  if (/iPhone|iPad/i.test(ua)) return "iOS";
  return "Linux";
}

export function runtimeLabel(): string {
  const api = desktopApi();
  return api ? `SYNCLAB Desktop (${platformName()})` : `Browser (${platformName()})`;
}

/**
 * Save bytes. On desktop this opens a real system Save dialog and writes to the chosen path.
 * In a browser it falls back to a normal download, which is all a tab is allowed to do.
 * Returns the path when a real file was written, otherwise null.
 */
export async function saveBytes(
  name: string,
  data: ArrayBuffer | Blob,
  filters?: { name: string; extensions: string[] }[],
): Promise<{ saved: boolean; path: string | null; canceled: boolean }> {
  const buffer = data instanceof Blob ? await data.arrayBuffer() : data;
  const retain = () => {
    if (/\.(mp3|mp4)$/i.test(name))
      void import("./media-library").then(({ retainMediaInBackground }) =>
        retainMediaInBackground(data instanceof Blob ? data : new Blob([buffer]), name, "Exports"),
      );
  };
  const api = desktopApi();
  if (api) {
    const res = await api.saveFile(name, buffer, filters);
    if (res.ok) retain();
    return { saved: Boolean(res.ok), path: res.path ?? null, canceled: Boolean(res.canceled) };
  }
  const blob = data instanceof Blob ? data : new Blob([buffer]);
  retain();
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 4000);
  return { saved: true, path: null, canceled: false };
}

/** Open files from disk. Desktop uses a native dialog; the browser uses a file input. */
export async function openLocalFiles(
  accept: string,
  filters?: { name: string; extensions: string[] }[],
  multiple = false,
): Promise<File[]> {
  const api = desktopApi();
  if (api) {
    const res = await api.openFiles(filters, multiple);
    if (!res.ok || !res.files) return [];
    return res.files.map((f) => new File([f.data], f.name));
  }
  return new Promise((resolve) => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = accept;
    input.multiple = multiple;
    input.onchange = () => resolve(Array.from(input.files ?? []));
    input.click();
  });
}

/** Architecture layers, as shipped. Used by the Desktop panel so the doc cannot drift. */
export interface Layer {
  id: string;
  name: string;
  detail: string;
  where: "Web + Desktop" | "Desktop only" | "Cloud";
  status: "shipped" | "bridge required";
}

export const ARCHITECTURE: Layer[] = [
  {
    id: "ui",
    name: "Modular UI",
    detail:
      "Timeline, piano roll, mixer, instruments and effects — one screen, panels open on demand.",
    where: "Web + Desktop",
    status: "shipped",
  },
  {
    id: "engine",
    name: "Project Engine",
    detail:
      "Tracks, clips, notes, automation, sections and undo history. One shared project timebase.",
    where: "Web + Desktop",
    status: "shipped",
  },
  {
    id: "audio",
    name: "Audio & MIDI Engine",
    detail:
      "Web Audio scheduling, recording, effects and mastering; Web MIDI for controllers and keyboards.",
    where: "Web + Desktop",
    status: "shipped",
  },
  {
    id: "native",
    name: "Native Audio / Plugin Bridge",
    detail:
      "A companion process on your computer hosts VST3/AU/CLAP and can drive an ASIO/Core Audio device at low latency. The studio talks to it over ws://127.0.0.1:8787. No browser can load a plugin binary itself.",
    where: "Desktop only",
    status: "bridge required",
  },
  {
    id: "files",
    name: "Local File System",
    detail:
      "In the desktop shell, Save and Open use real system dialogs and write to the path you pick. In a browser tab you get downloads and file pickers instead.",
    where: "Desktop only",
    status: "shipped",
  },
  {
    id: "ai",
    name: "AI Services",
    detail:
      "Vocal tone (the vocoder), the reference analyser and the mastering chain run inside the studio itself; nothing is sent to a server.",
    where: "Web + Desktop",
    status: "shipped",
  },
  {
    id: "cloud",
    name: "Cloud Services",
    detail:
      "Account, subscription, cloud projects, samples and exports — identical in both runtimes.",
    where: "Cloud",
    status: "shipped",
  },
];
