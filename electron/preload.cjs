/**
 * SYNCLAB desktop preload — the only bridge between the studio page and the native shell.
 * contextIsolation is on, so the page sees exactly the functions listed here and nothing else.
 */
const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("synclab", {
  desktop: true,
  platform: process.platform, // "darwin" | "win32" | "linux"
  versions: {
    electron: process.versions.electron,
    chrome: process.versions.chrome,
  },
  saveFile: (name, data, filters) => ipcRenderer.invoke("synclab:save-file", { name, data, filters }),
  openFiles: (filters, multiple) => ipcRenderer.invoke("synclab:open-files", { filters, multiple }),
  revealFile: (filePath) => ipcRenderer.invoke("synclab:reveal", filePath),
});
