/**
 * SYNCLAB — desktop shell (Electron main process).
 *
 * Honest scope: this shell hosts the SYNCLAB studio in a native window and adds the things a
 * browser tab cannot do — a real Save/Open dialog on your own disk, a native application menu,
 * a window that remembers where it was, and a place for the Desktop Audio Bridge to run beside
 * the app.
 *
 * It does NOT by itself host VST3/AU/CLAP plugins. Native plugin hosting and low-latency native
 * audio are the job of the separate SYNCLAB Desktop Audio Bridge process, which the studio talks
 * to over ws://127.0.0.1:8787 (see src/lib/synclab/bridge.ts).
 *
 * Run:      npm run desktop:dev
 * Package:  npm run desktop:package -- --platform=darwin --arch=arm64
 */
const { app, BrowserWindow, ipcMain, dialog, shell, session, systemPreferences } = require("electron");
const path = require("path");
const fs = require("fs/promises");
const crypto = require("crypto");
const { fork } = require("child_process");
const info = require("./app-info.cjs");
const { buildMenu } = require("./menu.cjs");
const windowState = require("./window-state.cjs");
const security = require("./security.cjs");

/** Where the studio is served from. Override with SYNCLAB_URL for a local dev server. */
const APP_URL = process.env.SYNCLAB_URL || info.website;

app.setName(info.productName);
app.setAppUserModelId(info.appId);

let win = null;
let pluginBridge = null;
let pluginBridgePort = null;
const pluginBridgeToken = crypto.randomBytes(24).toString("hex");

function startPluginBridge() {
  if (pluginBridge) return;
  pluginBridge = fork(path.join(__dirname, "plugin-bridge.cjs"), [], {
    env: {
      ...process.env,
      SYNCLAB_BRIDGE_PORT: "0",
      SYNCLAB_BRIDGE_TOKEN: pluginBridgeToken,
      SYNCLAB_BRIDGE_VERSION: info.version,
    },
    stdio: ["ignore", "ignore", "ignore", "ipc"],
  });
  pluginBridge.on("message", (message) => {
    if (message?.type === "ready" && Number.isInteger(message.port)) pluginBridgePort = message.port;
  });
  pluginBridge.once("exit", () => {
    pluginBridge = null;
    pluginBridgePort = null;
  });
}

function iconPath() {
  const file = process.platform === "win32" ? "icon.ico" : "icon.png";
  return path.join(__dirname, "..", "build-resources", file);
}

function createWindow() {
  const state = windowState.restore();

  win = new BrowserWindow({
    x: state.x,
    y: state.y,
    width: state.width,
    height: state.height,
    minWidth: 1100,
    minHeight: 700,
    backgroundColor: "#0a0a0c",
    title: info.productName,
    icon: iconPath(),
    show: false,
    webPreferences: {
      preload: path.join(__dirname, "preload.cjs"),
      contextIsolation: true,
      nodeIntegration: false,
      // Sandboxed renderer: the page and preload get no Node.js access.
      sandbox: true,
      webSecurity: true,
      // The sandboxed preload can't read files, so the app identity travels as an argument.
      additionalArguments: [`--synclab-info=${JSON.stringify({ productName: info.productName, appId: info.appId, version: info.version })}`],
    },
  });

  if (state.maximized) win.maximize();
  if (state.fullscreen) win.setFullScreen(true);
  windowState.track(win);
  buildMenu(win);

  win.once("ready-to-show", () => win.show());
  // The studio sets its own document title; keep the product name in the window frame.
  win.on("page-title-updated", (e) => e.preventDefault());

  // Electron needs an explicit chooser; never silently select nearby hardware.
  let choosingBluetooth = false;
  win.webContents.on("select-bluetooth-device", (event, devices, callback) => {
    event.preventDefault();
    if (choosingBluetooth || !devices.length) return;
    choosingBluetooth = true;
    dialog.showMessageBox(win, {
      type: "question",
      title: "Connect Bluetooth MIDI",
      message: "Choose your nearby Bluetooth LE MIDI controller",
      detail: "Pair audio-only headphones and speakers in system Bluetooth settings.",
      buttons: [...devices.map(device => device.deviceName || "Unnamed Bluetooth device"), "Cancel"],
      cancelId: devices.length,
      noLink: true,
    }).then(({ response }) => callback(devices[response]?.deviceId || ""))
      .catch(() => callback(""))
      .finally(() => { choosingBluetooth = false; });
  });

  win.loadURL(APP_URL);


  win.webContents.on("did-fail-load", (_e, _code, description) => {
    win.loadURL(
      "data:text/html," +
        encodeURIComponent(
          `<body style="background:#0a0a0c;color:#e6e6e6;font:14px system-ui;padding:40px">
             <h2>${info.productName} could not reach the studio</h2>
             <p>${description}</p>
             <p>This build loads the studio over the network. Check your connection and reopen the app.</p>
           </body>`,
        ),
    );
  });
}

/** Opens a link in the user's browser — web and email links only. */
function openOutside(url) {
  if (security.isSafeExternal(url)) void shell.openExternal(url);
}

// Every window (the studio and its pop-out panels) gets the same rules.
app.on("web-contents-created", (_event, contents) => {
  // Studio pop-out panels (mixer, drums, keys, synth) open as real windows for a second monitor;
  // everything else opens in the user's browser, never inside SYNCLAB.
  contents.setWindowOpenHandler(({ url, frameName }) => {
    if ((url === "about:blank" || url === "") && String(frameName).startsWith("synclab-")) {
      return {
        action: "allow",
        overrideBrowserWindowOptions: { backgroundColor: "#0b0b0d", autoHideMenuBar: true },
      };
    }
    openOutside(url);
    return { action: "deny" };
  });
  // The window itself only shows SYNCLAB and the sign-in pages it passes through.
  const guard = (event, url) => {
    if (security.isAllowedNavigation(url, APP_URL)) return;
    event.preventDefault();
    openOutside(url);
  };
  contents.on("will-navigate", guard);
  contents.on("will-redirect", guard);
  // SYNCLAB never embeds <webview>; refuse any attempt.
  contents.on("will-attach-webview", (event) => event.preventDefault());
});

app.whenReady().then(async () => {
  // The microphone / audio interface and MIDI gear are available to SYNCLAB's own pages only.
  const frameUrl = (wc, details) => details?.requestingUrl || details?.requestingOrigin || wc?.getURL?.() || "";
  session.defaultSession.setPermissionRequestHandler((wc, permission, cb, details) => cb(security.allowPermission(permission, frameUrl(wc, details), APP_URL)));
  session.defaultSession.setPermissionCheckHandler((wc, permission, requestingOrigin, details) => security.allowPermission(permission, details?.requestingUrl || requestingOrigin || wc?.getURL?.() || "", APP_URL));
  // Hardening headers on SYNCLAB's own pages (see security.cjs for what they block).
  session.defaultSession.webRequest.onHeadersReceived((details, callback) => {
    if (details.resourceType !== "mainFrame" || !security.isAppUrl(details.url, APP_URL)) return callback({});
    callback({ responseHeaders: { ...details.responseHeaders, "Content-Security-Policy": [security.CONTENT_SECURITY_POLICY] } });
  });
  session.defaultSession.setBluetoothDevicePermissionHandler(details => details.origin === new URL(APP_URL).origin);
  if (process.platform === "darwin") {
    try {
      await systemPreferences.askForMediaAccess("microphone");
    } catch {
      /* user can grant later in System Settings → Privacy → Microphone */
    }
  }
  // Always load the newest published studio instead of an old cached copy.
  try {
    await session.defaultSession.clearCache();
  } catch {
    /* cache clearing is best-effort */
  }
  startPluginBridge();
  createWindow();
});
app.on("before-quit", () => pluginBridge?.kill());
app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});
app.on("activate", () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow();
});

/* ---- Real local file access, the one thing the browser tab cannot do ---- */

/** Native actions answer SYNCLAB's own page only, with well-formed requests. */
function trusted(event) {
  const frame = event.senderFrame;
  return !!frame && security.isTrustedSender(frame.url, frame.origin, APP_URL);
}
const DENIED = { ok: false, error: "Not allowed" };
const cleanFilters = (filters) =>
  Array.isArray(filters)
    ? filters
        .filter((f) => f && typeof f.name === "string" && Array.isArray(f.extensions))
        .map((f) => ({ name: f.name.slice(0, 80), extensions: f.extensions.filter((x) => typeof x === "string" && /^[\w*]{1,12}$/.test(x)) }))
    : [];

ipcMain.handle("synclab:save-file", async (e, request) => {
  if (!trusted(e)) return DENIED;
  const { name, data, filters } = request || {};
  if (typeof name !== "string" || !(data instanceof ArrayBuffer || ArrayBuffer.isView(data) || Array.isArray(data))) return { ok: false, error: "Bad request" };
  const res = await dialog.showSaveDialog(win, { defaultPath: path.basename(name).slice(0, 200), filters: cleanFilters(filters) });
  if (res.canceled || !res.filePath) return { ok: false, canceled: true };
  await fs.writeFile(res.filePath, Buffer.from(new Uint8Array(data)));
  return { ok: true, path: res.filePath };
});

ipcMain.handle("synclab:open-files", async (e, request) => {
  if (!trusted(e)) return DENIED;
  const { filters, multiple } = request || {};
  const res = await dialog.showOpenDialog(win, {
    properties: multiple ? ["openFile", "multiSelections"] : ["openFile"],
    filters: cleanFilters(filters),
  });
  if (res.canceled) return { ok: false, canceled: true };
  const files = await Promise.all(
    res.filePaths.map(async (p) => ({ name: path.basename(p), path: p, data: (await fs.readFile(p)).buffer })),
  );
  return { ok: true, files };
});

ipcMain.handle("synclab:choose-folder", async (e) => {
  if (!trusted(e)) return DENIED;
  const res = await dialog.showOpenDialog(win, { properties: ["openDirectory", "createDirectory"] });
  if (res.canceled || !res.filePaths[0]) return { ok: false, canceled: true };
  return { ok: true, path: res.filePaths[0] };
});

ipcMain.handle("synclab:reveal", async (e, filePath) => {
  if (!trusted(e)) return DENIED;
  if (typeof filePath !== "string" || !path.isAbsolute(filePath)) return { ok: false, error: "Bad path" };
  shell.showItemInFolder(filePath);
  return { ok: true };
});

ipcMain.handle("synclab:plugin-bridge-info", async (e) => trusted(e) ? ({
  ok: Boolean(pluginBridge && pluginBridgePort),
  url: pluginBridgePort ? `ws://127.0.0.1:${pluginBridgePort}/?token=${pluginBridgeToken}` : "",
  capability: "scan",
}) : DENIED);
