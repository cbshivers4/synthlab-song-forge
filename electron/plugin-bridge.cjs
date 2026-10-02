/**
 * SYNCLAB Desktop Audio Bridge scanner foundation.
 *
 * This companion discovers VST3 / AU / CLAP bundles (plus custom folders), reads their metadata
 * files without executing plug-in code, and reports Ready / Failed / Unsupported honestly.
 * This companion discovers native plugin bundles and reports honest metadata to the studio.
 * It does not load or process those binaries yet; open requests fail clearly until the native
 * host layer has been compiled and tested on macOS and Windows.
 */
const { createServer } = require("http");
const { readdir, readFile, stat, access } = require("fs/promises");
const path = require("path");
const os = require("os");
const { WebSocketServer } = require("ws");

const PORT = Number(process.env.SYNCLAB_BRIDGE_PORT || 0);
const TOKEN = process.env.SYNCLAB_BRIDGE_TOKEN || "";
const VERSION = process.env.SYNCLAB_BRIDGE_VERSION || "1.0.0";

/** Standard plug-in folders for this operating system. */
function roots() {
  const home = os.homedir();
  if (process.platform === "darwin") {
    return [
      "/Library/Audio/Plug-Ins/VST3",
      path.join(home, "Library/Audio/Plug-Ins/VST3"),
      "/Library/Audio/Plug-Ins/Components",
      path.join(home, "Library/Audio/Plug-Ins/Components"),
      "/Library/Audio/Plug-Ins/CLAP",
      path.join(home, "Library/Audio/Plug-Ins/CLAP"),
      "/Library/Audio/Plug-Ins/VST",
    ];
  }
  if (process.platform === "win32") {
    const common = process.env.CommonProgramFiles || "C:\\Program Files\\Common Files";
    const local = process.env.LOCALAPPDATA || path.join(home, "AppData/Local");
    return [
      path.join(common, "VST3"),
      path.join(local, "Programs/Common/VST3"),
      path.join(common, "CLAP"),
      path.join(local, "Programs/Common/CLAP"),
      path.join(process.env.ProgramFiles || "C:\\Program Files", "VSTPlugins"),
      path.join(process.env.ProgramFiles || "C:\\Program Files", "Steinberg/VSTPlugins"),
    ];
  }
  return [path.join(home, ".vst3"), "/usr/lib/vst3", "/usr/local/lib/vst3", path.join(home, ".clap"), "/usr/lib/clap"];
}

const KINDS = {
  ".vst3": { format: "VST3", supported: true },
  ".component": { format: "AU", supported: process.platform === "darwin" },
  ".clap": { format: "CLAP", supported: true },
  ".vst": { format: "VST2", supported: false, reason: "VST2 plug-ins are not supported. Install the VST3 version if the maker offers one." },
  ".aaxplugin": { format: "AAX", supported: false, reason: "AAX plug-ins only run inside Pro Tools." },
};

function plistValue(xml, key) {
  const m = xml.match(new RegExp(`<key>${key}</key>\\s*<string>([^<]*)</string>`));
  return m ? m[1].trim() : "";
}

/** Reads name / maker / version from files inside the bundle without running any plug-in code. */
async function readMetadata(full, format) {
  const meta = {};
  if (format === "VST3") {
    try {
      const info = JSON.parse(await readFile(path.join(full, "Contents/Resources/moduleinfo.json"), "utf8"));
      if (info?.Name) meta.name = String(info.Name);
      if (info?.Version) meta.version = String(info.Version);
      if (info?.["Factory Info"]?.Vendor) meta.vendor = String(info["Factory Info"].Vendor);
      const sub = (info?.Classes || []).map((c) => (c?.["Sub Categories"] || []).join("|")).join("|");
      if (sub) {
        meta.isInstrument = /Instrument|Synth|Sampler|Drum/i.test(sub);
        meta.category = sub.split("|").filter((x) => x && x !== "Fx" && x !== "Instrument")[0] || undefined;
      }
    } catch { /* older VST3 bundles have no moduleinfo.json */ }
  }
  if (process.platform === "darwin") {
    try {
      const xml = await readFile(path.join(full, "Contents/Info.plist"), "utf8");
      if (xml.startsWith("<?xml") || xml.includes("<plist")) {
        meta.version = meta.version || plistValue(xml, "CFBundleShortVersionString") || plistValue(xml, "CFBundleVersion");
        const id = plistValue(xml, "CFBundleIdentifier");
        if (!meta.vendor && id) {
          const parts = id.split(".");
          if (parts.length >= 2) meta.vendor = parts[1].replace(/^./, (c) => c.toUpperCase());
        }
        const auName = xml.match(/<key>name<\/key>\s*<string>([^<]*)<\/string>/);
        if (format === "AU" && auName) {
          const [maker, name] = auName[1].split(":").map((x) => x.trim());
          if (name) { meta.vendor = maker; meta.name = name; }
        }
        const type = xml.match(/<key>type<\/key>\s*<string>([^<]*)<\/string>/);
        if (format === "AU" && type) meta.isInstrument = type[1] === "aumu";
      }
    } catch { /* binary plist or missing — keep file-name details */ }
  }
  return meta;
}

/** Checks a found bundle and returns one honest entry for it. */
async function inspect(full, isDir) {
  const ext = path.extname(full).toLowerCase();
  const kind = KINDS[ext];
  const base = { uid: `${kind.format}:${full}`, name: path.basename(full, path.extname(full)), vendor: "Unknown maker", format: kind.format, path: full };
  if (!kind.supported) return { ...base, status: "unsupported", error: kind.reason || `${kind.format} is not supported on this computer.` };
  try {
    await access(full);
    if (isDir) {
      const contents = await readdir(path.join(full, "Contents")).catch(() => null);
      if (!contents && process.platform !== "win32") {
        return { ...base, status: "failed", error: "The plug-in bundle is incomplete (no Contents folder). Reinstall it." };
      }
    } else {
      const info = await stat(full);
      if (info.size < 1024) return { ...base, status: "failed", error: "The plug-in file is empty or damaged. Reinstall it." };
    }
    const meta = await readMetadata(full, kind.format);
    return { ...base, ...Object.fromEntries(Object.entries(meta).filter(([, v]) => v !== undefined && v !== "")), status: "ok" };
  } catch (err) {
    const code = err && err.code;
    return { ...base, status: "failed", error: code === "EACCES" || code === "EPERM" ? "SYNCLAB is not allowed to read this plug-in. Check folder permissions." : "The plug-in could not be read." };
  }
}

async function walk(dir, found, depth = 0) {
  if (depth > 6) return;
  let entries;
  try {
    entries = await readdir(dir, { withFileTypes: true });
  } catch {
    return;
  }
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    const ext = path.extname(entry.name).toLowerCase();
    if (KINDS[ext]) found.push([full, entry.isDirectory()]);
    else if (entry.isDirectory()) await walk(full, found, depth + 1);
    else if (ext === ".dll" && process.platform === "win32") {
      found.push([full, false, "VST2"]);
    }
  }
}

async function folderExists(dir) {
  try { return (await stat(dir)).isDirectory(); } catch { return false; }
}

async function scanPlugins(extraFolders, onProgress) {
  const folders = [...new Set([...roots(), ...extraFolders])];
  const folderReport = [];
  const found = [];
  for (const dir of folders) {
    const exists = await folderExists(dir);
    const before = found.length;
    if (exists) await walk(dir, found);
    folderReport.push({ path: dir, exists, count: found.length - before, custom: extraFolders.includes(dir) });
  }
  const plugins = [];
  for (let i = 0; i < found.length; i++) {
    const [full, isDir, legacy] = found[i];
    if (legacy === "VST2") {
      plugins.push({ uid: `VST2:${full}`, name: path.basename(full, ".dll"), vendor: "Unknown maker", format: "VST2", path: full, status: "unsupported", error: "Looks like a VST2 plug-in (.dll). VST2 is not supported — install the VST3 version if available." });
    } else {
      plugins.push(await inspect(full, isDir));
    }
    if (i % 5 === 0 || i === found.length - 1) onProgress(i + 1, found.length, full);
  }
  const unique = new Map(plugins.map((plugin) => [plugin.uid, plugin]));
  return { list: [...unique.values()].sort((a, b) => a.name.localeCompare(b.name)), folders: folderReport };
}

function cleanFolders(input) {
  if (!Array.isArray(input)) return [];
  return input.filter((f) => typeof f === "string" && f.length > 1 && f.length < 1024 && path.isAbsolute(f)).slice(0, 50);
}

function send(socket, payload) {
  if (socket.readyState === socket.OPEN) socket.send(JSON.stringify(payload));
}

const server = createServer((request, response) => {
  response.writeHead(404);
  response.end();
});
const websocket = new WebSocketServer({ noServer: true, maxPayload: 1024 * 1024 });

server.on("upgrade", (request, socket, head) => {
  let supplied = "";
  try {
    supplied = new URL(request.url || "/", `http://${request.headers.host || "127.0.0.1"}`).searchParams.get("token") || "";
  } catch {
    socket.destroy();
    return;
  }
  if (!TOKEN || supplied !== TOKEN) {
    socket.write("HTTP/1.1 401 Unauthorized\r\nConnection: close\r\n\r\n");
    socket.destroy();
    return;
  }
  websocket.handleUpgrade(request, socket, head, (client) => websocket.emit("connection", client));
});

websocket.on("connection", (socket) => {
  send(socket, {
    t: "hello",
    name: "SYNCLAB Plugin Scanner",
    version: VERSION,
    formats: process.platform === "darwin" ? ["VST3", "AU", "CLAP"] : ["VST3", "CLAP"],
    audio: false,
    capabilities: ["scan"],
  });
  socket.on("message", async (raw, binary) => {
    if (binary || raw.length > 64 * 1024) return;
    let message;
    try {
      message = JSON.parse(raw.toString("utf8"));
    } catch {
      send(socket, { t: "error", code: "INVALID_MESSAGE", message: "The scanner received an invalid request." });
      return;
    }
    if (message?.t === "scan") {
      const result = await scanPlugins(cleanFolders(message.folders), (done, total, current) =>
        send(socket, { t: "progress", done, total, current }),
      );
      send(socket, { t: "plugins", list: result.list, folders: result.folders });
      return;
    }
    if (message?.t === "scan-one" && typeof message.path === "string" && path.isAbsolute(message.path) && KINDS[path.extname(message.path).toLowerCase()]) {
      const isDir = await stat(message.path).then((s) => s.isDirectory()).catch(() => false);
      send(socket, { t: "plugin", plugin: await inspect(message.path, isDir) });
      return;
    }
    if (message?.t === "open") {
      send(socket, {
        t: "error",
        code: "HOST_UNAVAILABLE",
        message: "This desktop build can discover this plugin, but native plugin loading and audio are not included yet.",
      });
      return;
    }
    send(socket, { t: "error", code: "UNSUPPORTED_REQUEST", message: "That bridge request is not supported by this build." });
  });
});

server.listen(PORT, "127.0.0.1", () => {
  const address = server.address();
  if (typeof address === "object" && address) process.send?.({ type: "ready", port: address.port });
});
const stop = () => websocket.close(() => server.close(() => process.exit(0)));
process.on("SIGTERM", stop);
process.on("SIGINT", stop);
