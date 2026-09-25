/**
 * SYNCLAB Desktop Audio Bridge scanner foundation.
 *
 * This companion discovers native plugin bundles and reports honest metadata to the studio.
 * It does not load or process those binaries yet; open requests fail clearly until the native
 * host layer has been compiled and tested on macOS and Windows.
 */
const { createServer } = require("http");
const { readdir } = require("fs/promises");
const path = require("path");
const os = require("os");
const { WebSocketServer } = require("ws");

const PORT = Number(process.env.SYNCLAB_BRIDGE_PORT || 0);
const TOKEN = process.env.SYNCLAB_BRIDGE_TOKEN || "";
const VERSION = process.env.SYNCLAB_BRIDGE_VERSION || "1.0.0";

function roots() {
  if (process.platform === "darwin") {
    return [
      ["/Library/Audio/Plug-Ins/VST3", "VST3"],
      [path.join(os.homedir(), "Library/Audio/Plug-Ins/VST3"), "VST3"],
      ["/Library/Audio/Plug-Ins/Components", "AU"],
      [path.join(os.homedir(), "Library/Audio/Plug-Ins/Components"), "AU"],
    ];
  }
  if (process.platform === "win32") {
    return [
      [path.join(process.env.CommonProgramFiles || "C:\\Program Files\\Common Files", "VST3"), "VST3"],
      [path.join(process.env.LOCALAPPDATA || "", "Programs/Common/VST3"), "VST3"],
    ];
  }
  return [[path.join(os.homedir(), ".vst3"), "VST3"], ["/usr/lib/vst3", "VST3"]];
}

async function walk(dir, format, output, depth = 0) {
  if (depth > 5) return;
  let entries;
  try {
    entries = await readdir(dir, { withFileTypes: true });
  } catch {
    return;
  }
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    const extension = path.extname(entry.name).toLowerCase();
    const isBundle = extension === ".vst3" || extension === ".component";
    if (isBundle) {
      const actualFormat = extension === ".component" ? "AU" : format;
      output.push({
        uid: `${actualFormat}:${full}`,
        name: path.basename(entry.name, extension),
        vendor: "UNKNOWN VENDOR",
        format: actualFormat,
        path: full,
        status: "ok",
      });
    } else if (entry.isDirectory()) {
      await walk(full, format, output, depth + 1);
    }
  }
}

async function scanPlugins() {
  const plugins = [];
  for (const [dir, format] of roots()) await walk(dir, format, plugins);
  const unique = new Map(plugins.map((plugin) => [plugin.uid, plugin]));
  return [...unique.values()].sort((a, b) => a.name.localeCompare(b.name));
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
    formats: process.platform === "darwin" ? ["VST3", "AU"] : ["VST3"],
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
      send(socket, { t: "plugins", list: await scanPlugins() });
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
