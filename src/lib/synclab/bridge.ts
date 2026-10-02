/**
 * Desktop Audio Bridge client.
 *
 * A browser tab cannot load a native VST3/AU/CLAP binary — there is no API for it in any
 * browser, and there never has been. The only honest way to use real plugins from this app is
 * to run a small companion program on the same computer that hosts the plugin natively and
 * talks to this tab over a local WebSocket.
 *
 * This module is the client half of that link. It is a real implementation of the protocol:
 * nothing here pretends a plugin is loaded. When no bridge is running, every call reports the
 * disconnected state and the UI shows "Desktop Audio Bridge required".
 *
 * Protocol (JSON text frames both ways, plus binary frames for plugin GUI images):
 *   in  : hello   { name, version, formats[], audio }
 *   in  : plugins { list: BridgePlugin[] }
 *   in  : opened  { id, width, height, params[] }
 *   in  : params  { id, params[] }
 *   in  : closed  { id }
 *   in  : error   { message }
 *   in  : binary  [1 byte idLen][idLen bytes utf8 id][image bytes]  -> plugin editor frame
 *   out : scan    {}
 *   out : open    { uid }
 *   out : close   { id }
 *   out : pointer { id, kind, x, y, button }
 *   out : wheel   { id, x, y, dy }
 *   out : key     { id, kind, key, code, mods }
 *   out : param   { id, index, value }
 *   out : preset  { id, action, name? }
 */

export type BridgeFormat = "VST3" | "AU" | "CLAP" | "AAX" | "VST2";
const FORMATS: string[] = ["VST3", "AU", "CLAP", "AAX", "VST2"];

export interface BridgeFolder {
  path: string;
  exists: boolean;
  count: number;
  custom: boolean;
}

export interface BridgePlugin {
  uid: string;
  name: string;
  vendor: string;
  format: BridgeFormat;
  path: string;
  isInstrument?: boolean;
  version?: string;
  /** e.g. "EQ", "Reverb", "Synth" — as reported by the plugin */
  category?: string;
  /** "failed" when the bridge could not load it during scanning */
  status?: "ok" | "failed" | "unsupported";
  error?: string;
}

export interface BridgeParam {
  index: number;
  name: string;
  value: number; // normalised 0..1, as native plugin APIs expose it
  text?: string; // plugin-formatted display value, e.g. "-6.2 dB"
}

export interface BridgeEditor {
  id: string;
  uid: string;
  name: string;
  width: number;
  height: number;
  params: BridgeParam[];
  frame?: string | undefined; // object URL of the most recent GUI image
}

export interface BridgeState {
  status: "idle" | "connecting" | "connected" | "error";
  url: string;
  host?: string | undefined; // bridge app name + version
  formats: BridgeFormat[];
  audio: boolean; // true when the bridge streams processed audio back
  capabilities: ("scan" | "host")[];
  plugins: BridgePlugin[];
  editors: Record<string, BridgeEditor>;
  scanning: boolean;
  progress?: { done: number; total: number; current: string } | undefined;
  folders: BridgeFolder[];
  message?: string | undefined;
}

export const DEFAULT_BRIDGE_URL = "ws://127.0.0.1:8787";
const URL_KEY = "synclab.bridge.url";

export function savedBridgeUrl(): string {
  if (typeof localStorage === "undefined") return DEFAULT_BRIDGE_URL;
  return localStorage.getItem(URL_KEY) || DEFAULT_BRIDGE_URL;
}

type Listener = (s: BridgeState) => void;

class BridgeClient {
  private socket: WebSocket | null = null;
  private listeners = new Set<Listener>();
  private state: BridgeState = {
    status: "idle",
    url: DEFAULT_BRIDGE_URL,
    formats: [],
    audio: false,
    capabilities: [],
    plugins: [],
    editors: {},
    scanning: false,
    folders: [],
  };

  get snapshot() {
    return this.state;
  }

  subscribe(fn: Listener) {
    this.listeners.add(fn);
    fn(this.state);
    return () => {
      this.listeners.delete(fn);
    };
  }

  private set(patch: Partial<BridgeState>) {
    this.state = { ...this.state, ...patch };
    this.listeners.forEach((l) => l(this.state));
  }

  async connect(url = savedBridgeUrl()) {
    this.disconnect();
    if (typeof window !== "undefined" && window.synclab?.pluginBridgeInfo && url === DEFAULT_BRIDGE_URL) {
      try {
        const info = await window.synclab.pluginBridgeInfo();
        if (info.ok) url = info.url;
      } catch {
        // Fall through to the normal connection error state.
      }
    }
    if (typeof localStorage !== "undefined") localStorage.setItem(URL_KEY, url);
    this.set({ status: "connecting", url, message: undefined });
    let socket: WebSocket;
    try {
      socket = new WebSocket(url);
    } catch {
      this.set({ status: "error", message: `Could not open ${url}. Check the address.` });
      return;
    }
    socket.binaryType = "arraybuffer";
    this.socket = socket;

    const timer = setTimeout(() => {
      if (this.state.status === "connecting") {
        socket.close();
        this.set({
          status: "error",
          message: `No bridge answered at ${url}. Start the SYNCLAB Desktop Audio Bridge on this computer, then connect again.`,
        });
      }
    }, 4000);

    socket.onopen = () => {
      clearTimeout(timer);
      this.set({ status: "connected", message: undefined });
      this.scan();
    };
    socket.onerror = () => {
      clearTimeout(timer);
      if (this.state.status !== "connected") {
        this.set({
          status: "error",
          message: `No bridge answered at ${url}. Start the SYNCLAB Desktop Audio Bridge on this computer, then connect again.`,
        });
      }
    };
    socket.onclose = () => {
      clearTimeout(timer);
      if (this.socket === socket) this.socket = null;
      Object.values(this.state.editors).forEach((e) => e.frame && URL.revokeObjectURL(e.frame));
      this.set({
        status: this.state.status === "error" ? "error" : "idle",
        editors: {},
        plugins: this.state.status === "error" ? [] : this.state.plugins,
        scanning: false,
      });
    };
    socket.onmessage = (event) => this.receive(event.data);
  }

  disconnect() {
    const socket = this.socket;
    this.socket = null;
    if (socket) {
      socket.onclose = null;
      socket.close();
    }
    Object.values(this.state.editors).forEach((e) => e.frame && URL.revokeObjectURL(e.frame));
    this.set({ status: "idle", editors: {}, scanning: false, host: undefined });
  }

  private send(msg: Record<string, unknown>) {
    if (this.socket?.readyState === WebSocket.OPEN) {
      this.socket.send(JSON.stringify(msg));
      return true;
    }
    return false;
  }

  private receive(data: unknown) {
    if (data instanceof ArrayBuffer) {
      this.frame(data);
      return;
    }
    if (typeof data !== "string") return;
    let msg: Record<string, unknown>;
    try {
      msg = JSON.parse(data) as Record<string, unknown>;
    } catch {
      return;
    }
    switch (msg["t"]) {
      case "hello":
        const formats = Array.isArray(msg["formats"])
          ? msg["formats"].filter((value): value is BridgeFormat => FORMATS.includes(String(value)))
          : [];
        const capabilities = Array.isArray(msg["capabilities"])
          ? msg["capabilities"].filter((value): value is "scan" | "host" => value === "scan" || value === "host")
          : [];
        this.set({
          host: `${String(msg["name"] ?? "Audio Bridge")} ${String(msg["version"] ?? "")}`.trim(),
          formats,
          audio: Boolean(msg["audio"]),
          capabilities,
        });
        break;
      case "plugins":
        this.set({ plugins: validPlugins(msg["list"]), folders: validFolders(msg["folders"]), scanning: false, progress: undefined });
        break;
      case "progress":
        this.set({ progress: { done: Number(msg["done"]) || 0, total: Number(msg["total"]) || 0, current: String(msg["current"] ?? "") } });
        break;
      case "plugin": {
        const [one] = validPlugins([msg["plugin"]]);
        if (!one) break;
        const rest = this.state.plugins.filter((p) => p.uid !== one.uid);
        this.set({ plugins: [...rest, one].sort((a, b) => a.name.localeCompare(b.name)) });
        break;
      }
      case "opened": {
        const id = String(msg["id"]);
        this.set({
          editors: {
            ...this.state.editors,
            [id]: {
              id,
              uid: String(msg["uid"] ?? ""),
              name: String(msg["name"] ?? "Plugin"),
              width: Number(msg["width"] ?? 800),
              height: Number(msg["height"] ?? 500),
              params: (msg["params"] as BridgeParam[]) ?? [],
            },
          },
        });
        break;
      }
      case "params": {
        const id = String(msg["id"]);
        const editor = this.state.editors[id];
        if (!editor) break;
        this.set({
          editors: { ...this.state.editors, [id]: { ...editor, params: (msg["params"] as BridgeParam[]) ?? [] } },
        });
        break;
      }
      case "closed": {
        const id = String(msg["id"]);
        const editors = { ...this.state.editors };
        const gone = editors[id];
        if (gone?.frame) URL.revokeObjectURL(gone.frame);
        delete editors[id];
        this.set({ editors });
        break;
      }
      case "error":
        this.set({ message: String(msg["message"] ?? "The bridge reported an error.") });
        break;
      default:
        break;
    }
  }

  /** Binary GUI frame: [idLen][id][image bytes]. */
  private frame(buffer: ArrayBuffer) {
    const view = new Uint8Array(buffer);
    const idLen = view[0] ?? 0;
    if (!idLen || view.length <= idLen + 1) return;
    const id = new TextDecoder().decode(view.subarray(1, 1 + idLen));
    const editor = this.state.editors[id];
    if (!editor) return;
    const blob = new Blob([view.subarray(1 + idLen)], { type: "image/png" });
    const url = URL.createObjectURL(blob);
    if (editor.frame) URL.revokeObjectURL(editor.frame);
    this.set({ editors: { ...this.state.editors, [id]: { ...editor, frame: url } } });
  }

  scan() {
    if (!this.send({ t: "scan", folders: customPluginFolders() })) return false;
    this.set({ scanning: true, progress: undefined, message: undefined });
    return true;
  }

  scanOne(path: string) {
    return this.send({ t: "scan-one", path });
  }

  open(uid: string) {
    if (!this.state.capabilities.includes("host")) {
      this.set({ message: "This bridge can discover plugins, but native loading and audio are not included in this build yet." });
      return false;
    }
    return this.send({ t: "open", uid });
  }

  close(id: string) {
    return this.send({ t: "close", id });
  }

  pointer(id: string, kind: "down" | "move" | "up", x: number, y: number, button = 0) {
    return this.send({ t: "pointer", id, kind, x, y, button });
  }

  wheel(id: string, x: number, y: number, dy: number) {
    return this.send({ t: "wheel", id, x, y, dy });
  }

  key(id: string, kind: "down" | "up", e: { key: string; code: string; shiftKey: boolean; ctrlKey: boolean; altKey: boolean; metaKey: boolean }) {
    return this.send({
      t: "key",
      id,
      kind,
      key: e.key,
      code: e.code,
      mods: { shift: e.shiftKey, ctrl: e.ctrlKey, alt: e.altKey, meta: e.metaKey },
    });
  }

  setParam(id: string, index: number, value: number) {
    return this.send({ t: "param", id, index, value });
  }

  preset(id: string, action: "prev" | "next" | "save", name?: string) {
    return this.send({ t: "preset", id, action, ...(name ? { name } : {}) });
  }
}

export const bridge = new BridgeClient();

function validPlugins(input: unknown): BridgePlugin[] {
  if (!Array.isArray(input)) return [];
  return input.flatMap((value) => {
    if (!value || typeof value !== "object") return [];
    const item = value as Record<string, unknown>;
    const format = String(item["format"] ?? "");
    if (typeof item["uid"] !== "string" || typeof item["name"] !== "string" || !FORMATS.includes(format)) return [];
    return [{
      uid: item["uid"],
      name: item["name"],
      vendor: typeof item["vendor"] === "string" ? item["vendor"] : "UNKNOWN VENDOR",
      format: format as BridgeFormat,
      path: typeof item["path"] === "string" ? item["path"] : "",
      ...(typeof item["isInstrument"] === "boolean" ? { isInstrument: item["isInstrument"] } : {}),
      ...(typeof item["version"] === "string" ? { version: item["version"] } : {}),
      ...(typeof item["category"] === "string" ? { category: item["category"] } : {}),
      ...(item["status"] === "ok" || item["status"] === "failed" || item["status"] === "unsupported" ? { status: item["status"] } : {}),
      ...(typeof item["error"] === "string" ? { error: item["error"] } : {}),
    }];
  });
}

function validFolders(input: unknown): BridgeFolder[] {
  if (!Array.isArray(input)) return [];
  return input.flatMap((v) => {
    if (!v || typeof v !== "object" || typeof (v as BridgeFolder).path !== "string") return [];
    const f = v as BridgeFolder;
    return [{ path: f.path, exists: Boolean(f.exists), count: Number(f.count) || 0, custom: Boolean(f.custom) }];
  });
}

const FOLDERS_KEY = "synclab.plugins.folders";
export function customPluginFolders(): string[] {
  if (typeof localStorage === "undefined") return [];
  try {
    const v = JSON.parse(localStorage.getItem(FOLDERS_KEY) ?? "[]");
    return Array.isArray(v) ? v.filter((x): x is string => typeof x === "string") : [];
  } catch {
    return [];
  }
}
export function setCustomPluginFolders(list: string[]) {
  try {
    localStorage.setItem(FOLDERS_KEY, JSON.stringify([...new Set(list)]));
  } catch {
    /* storage blocked */
  }
}
