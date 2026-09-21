/**
 * SYNCLAB desktop preload — the only bridge between the studio page and the native shell.
 * contextIsolation is on, so the page sees exactly the functions listed here and nothing else.
 */
const { contextBridge, ipcRenderer } = require("electron");
const info = require("./app-info.cjs");

contextBridge.exposeInMainWorld("synclab", {
  desktop: true,
  platform: process.platform, // "darwin" | "win32" | "linux"
  appName: info.productName,
  appId: info.appId,
  appVersion: info.version,
  versions: {
    electron: process.versions.electron,
    chrome: process.versions.chrome,
  },
  saveFile: (name, data, filters) => ipcRenderer.invoke("synclab:save-file", { name, data, filters }),
  openFiles: (filters, multiple) => ipcRenderer.invoke("synclab:open-files", { filters, multiple }),
  chooseFolder: () => ipcRenderer.invoke("synclab:choose-folder"),
  revealFile: (filePath) => ipcRenderer.invoke("synclab:reveal", filePath),
  /** Native menu commands. Returns an unsubscribe function. */
  onMenu: (handler) => {
    const listener = (_e, command) => handler(command);
    ipcRenderer.on("synclab:menu", listener);
    return () => ipcRenderer.removeListener("synclab:menu", listener);
  },
});
