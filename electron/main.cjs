/**
 * SYNCLAB VOCAL FORGE — desktop shell (Electron main process).
 *
 * Honest scope: this shell hosts the same SYNCLAB studio in a native window and adds the
 * things a browser tab cannot do — a real Save/Open dialog on your own disk, a persistent
 * window, and a place for the Desktop Audio Bridge to run beside the app.
 *
 * It does NOT by itself host VST3/AU/CLAP plugins. Native plugin hosting and low-latency
 * native audio are the job of the separate SYNCLAB Desktop Audio Bridge process, which the
 * app talks to over ws://127.0.0.1:8787 (see src/lib/synclab/bridge.ts).
 *
 * Run:      npx electron .
 * Package:  npx @electron/packager . "SYNCLAB" --platform=darwin --arch=x64 --out=electron-release --overwrite
 */
const { app, BrowserWindow, ipcMain, dialog, shell } = require("electron");
const path = require("path");
const fs = require("fs/promises");

/** Where the studio is served from. Override with SYNCLAB_URL for a local dev server. */
const APP_URL = process.env.SYNCLAB_URL || "https://synclab-vocal-forge.lovable.app/";

let win = null;

function createWindow() {
  win = new BrowserWindow({
    width: 1600,
    height: 1000,
    minWidth: 1100,
    minHeight: 700,
    backgroundColor: "#0a0a0c",
    title: "SYNCLAB VOCAL FORGE",
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, "preload.cjs"),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

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
             <h2>SYNCLAB could not reach the studio</h2>
             <p>${description}</p>
             <p>The desktop shell loads the studio over the network. Check your connection and reopen the app.</p>
           </body>`,
        ),
    );
  });
}

app.whenReady().then(createWindow);
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

ipcMain.handle("synclab:reveal", async (_e, filePath) => {
  shell.showItemInFolder(filePath);
  return { ok: true };
});
