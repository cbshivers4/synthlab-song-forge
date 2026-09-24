/**
 * SYNCLAB VOCAL FORGE — desktop shell (Electron main process).
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
const info = require("./app-info.cjs");
const { buildMenu } = require("./menu.cjs");
const windowState = require("./window-state.cjs");

/** Where the studio is served from. Override with SYNCLAB_URL for a local dev server. */
const APP_URL = process.env.SYNCLAB_URL || info.website;

app.setName(info.productName);
app.setAppUserModelId(info.appId);

let win = null;

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
    },
  });

  if (state.maximized) win.maximize();
  if (state.fullscreen) win.setFullScreen(true);
  windowState.track(win);
  buildMenu(win);

  win.once("ready-to-show", () => win.show());
  // The studio sets its own document title; keep the product name in the window frame.
  win.on("page-title-updated", (e) => e.preventDefault());

  win.loadURL(APP_URL);

  // External links open in the user's browser, not inside the studio window.
  win.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: "deny" };
  });

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

app.whenReady().then(async () => {
  // Allow the studio to use the microphone / audio interface and MIDI gear.
  const allowed = new Set(["media", "audioCapture", "midi", "midiSysex", "speaker-selection"]);
  session.defaultSession.setPermissionRequestHandler((_wc, permission, cb) => cb(allowed.has(permission)));
  session.defaultSession.setPermissionCheckHandler((_wc, permission) => allowed.has(permission));
  if (process.platform === "darwin") {
    try {
      await systemPreferences.askForMediaAccess("microphone");
    } catch {
      /* user can grant later in System Settings → Privacy → Microphone */
    }
  }
  createWindow();
});
app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});
app.on("activate", () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow();
});

/* ---- Real local file access, the one thing the browser tab cannot do ---- */

ipcMain.handle("synclab:save-file", async (_e, { name, data, filters }) => {
  const res = await dialog.showSaveDialog(win, { defaultPath: name, filters: filters || [] });
  if (res.canceled || !res.filePath) return { ok: false, canceled: true };
  await fs.writeFile(res.filePath, Buffer.from(new Uint8Array(data)));
  return { ok: true, path: res.filePath };
});

ipcMain.handle("synclab:open-files", async (_e, { filters, multiple }) => {
  const res = await dialog.showOpenDialog(win, {
    properties: multiple ? ["openFile", "multiSelections"] : ["openFile"],
    filters: filters || [],
  });
  if (res.canceled) return { ok: false, canceled: true };
  const files = await Promise.all(
    res.filePaths.map(async (p) => ({ name: path.basename(p), path: p, data: (await fs.readFile(p)).buffer })),
  );
  return { ok: true, files };
});

ipcMain.handle("synclab:choose-folder", async () => {
  const res = await dialog.showOpenDialog(win, { properties: ["openDirectory", "createDirectory"] });
  if (res.canceled || !res.filePaths[0]) return { ok: false, canceled: true };
  return { ok: true, path: res.filePaths[0] };
});

ipcMain.handle("synclab:reveal", async (_e, filePath) => {
  shell.showItemInFolder(filePath);
  return { ok: true };
});
