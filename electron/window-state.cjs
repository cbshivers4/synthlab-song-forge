/**
 * Remembers the studio window size, position, maximized and fullscreen state
 * between launches. Stored as JSON in the app's userData folder.
 *
 * If the remembered position no longer falls on a connected display (a laptop
 * unplugged from a second monitor), the window is centred on the primary
 * display instead of opening off-screen.
 */
const { app, screen } = require("electron");
const path = require("path");
const fs = require("fs");

const FILE = () => path.join(app.getPath("userData"), "window-state.json");
const DEFAULTS = { width: 1600, height: 1000, maximized: false, fullscreen: false };

function read() {
  try {
    return { ...DEFAULTS, ...JSON.parse(fs.readFileSync(FILE(), "utf8")) };
  } catch {
    return { ...DEFAULTS };
  }
}

/** Bounds to open with, validated against the displays actually attached now. */
function restore() {
  const state = read();
  if (typeof state.x === "number" && typeof state.y === "number") {
    const visible = screen.getAllDisplays().some((d) => {
      const b = d.workArea;
      return state.x >= b.x - 40 && state.y >= b.y - 40 && state.x < b.x + b.width && state.y < b.y + b.height;
    });
    if (!visible) {
      delete state.x;
      delete state.y;
    }
  }
  return state;
}

/** Saves on every move/resize/maximize so a crash still keeps the last layout. */
function track(win) {
  const save = () => {
    if (win.isDestroyed()) return;
    const normal = win.getNormalBounds();
    const state = {
      x: normal.x,
      y: normal.y,
      width: normal.width,
      height: normal.height,
      maximized: win.isMaximized(),
      fullscreen: win.isFullScreen(),
    };
    try {
      fs.mkdirSync(path.dirname(FILE()), { recursive: true });
      fs.writeFileSync(FILE(), JSON.stringify(state));
    } catch {
      /* a read-only profile simply forgets the layout */
    }
  };

  let timer = null;
  const debounced = () => {
    clearTimeout(timer);
    timer = setTimeout(save, 400);
  };

  for (const ev of ["resize", "move", "maximize", "unmaximize", "enter-full-screen", "leave-full-screen"]) {
    win.on(ev, debounced);
  }
  win.on("close", save);
}

module.exports = { restore, track };
