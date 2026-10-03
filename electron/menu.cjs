/**
 * Native application menu for SYNCLAB.
 *
 * Every item here is wired to something the studio actually does: each one sends
 * a command string to the page, which src/lib/synclab/desktop-menu.ts maps onto a
 * real studio action. Nothing in this menu is decorative — if a capability needs
 * the Desktop Audio Bridge (native plugin hosting), the studio says so when the
 * panel opens rather than the menu pretending it is available.
 */
const { Menu, shell, app } = require("electron");
const info = require("./app-info.cjs");

/** @param {import('electron').BrowserWindow} win */
function buildMenu(win) {
  const send = (command) => () => win?.webContents.send("synclab:menu", command);
  const item = (label, command, accelerator) => ({ label, accelerator, click: send(command) });

  const template = [
    ...(process.platform === "darwin"
      ? [
          {
            label: info.productName,
            submenu: [
              { label: `About ${info.productName}`, click: send("help:about") },
              { type: "separator" },
              { label: "Settings…", accelerator: "Cmd+,", click: send("panel:settings") },
              { type: "separator" },
              { role: "hide" },
              { role: "hideOthers" },
              { role: "unhide" },
              { type: "separator" },
              { role: "quit" },
            ],
          },
        ]
      : []),
    {
      label: "File",
      submenu: [
        item("New Project", "file:new", "CmdOrCtrl+N"),
        item("Open Project…", "file:open", "CmdOrCtrl+O"),
        { type: "separator" },
        item("Save", "file:save", "CmdOrCtrl+S"),
        item("Save As…", "file:saveas", "CmdOrCtrl+Shift+S"),
        { type: "separator" },
        item("Import Audio…", "file:import-audio"),
        item("Import MIDI…", "file:import-midi"),
        { type: "separator" },
        item("Export / Bounce…", "file:export", "CmdOrCtrl+E"),
        { type: "separator" },
        process.platform === "darwin" ? { role: "close" } : { role: "quit", label: "Quit" },
      ],
    },
    {
      label: "Edit",
      submenu: [
        // No accelerators here: the app registers its own keyboard shortcuts
        // (which ignore text fields), so global menu accelerators would hijack
        // typing — Cmd+C/Cmd+A etc. must keep working inside inputs.
        item("Undo", "edit:undo"),
        item("Redo", "edit:redo"),
        { type: "separator" },
        item("Cut Track", "edit:cut"),
        item("Copy Track", "edit:copy"),
        item("Paste Track", "edit:paste"),
        item("Duplicate Track", "edit:duplicate"),
        item("Delete Track", "edit:delete"),
        { type: "separator" },
        item("Select All", "edit:selectall"),
        item("Split at Playhead", "edit:split"),
      ],
    },
    {
      label: "View",
      submenu: [
        item("Timeline", "panel:none"),
        item("Piano Roll", "panel:piano"),
        item("Mixer", "panel:mixer"),
        item("Browser", "panel:browser"),
        item("Appearance & Themes", "panel:appearance"),
        { type: "separator" },
        { role: "resetZoom" },
        { role: "zoomIn" },
        { role: "zoomOut" },
        { type: "separator" },
        { role: "togglefullscreen" },
        { role: "minimize" },
      ],
    },
    {
      label: "Project",
      submenu: [
        item("Project Settings", "panel:settings"),
        item("Tempo, Key & Time Signature", "panel:settings"),
        { type: "separator" },
        item("Play / Pause", "transport:play", "Space"),
        item("Stop", "transport:stop"),
        item("Record", "transport:record", "CmdOrCtrl+R"),
      ],
    },
    {
      label: "Track",
      submenu: [
        item("Add Audio Track", "track:audio"),
        item("Add Instrument Track", "track:synth"),
        item("Add MIDI Track", "track:midi"),
        item("Add Drum Machine", "track:drum"),
        item("Add Sampler", "track:sampler"),
        item("Add AI Vocal Track", "track:ai-vocal"),
        { type: "separator" },
        item("Buses & Sends (Mixer)", "panel:mixer"),
      ],
    },
    {
      label: "Audio",
      submenu: [
        item("Audio Settings", "panel:settings"),
        item("Input & Output Devices", "panel:settings"),
        item("Mixer", "panel:mixer"),
      ],
    },
    {
      label: "MIDI",
      submenu: [
        item("MIDI Devices", "panel:settings"),
        item("Piano Roll", "panel:piano"),
        item("Virtual Keyboard", "panel:keys"),
      ],
    },
    {
      label: "Tools",
      submenu: [
        item("Sampler", "panel:sampler"),
        item("Drum Machine", "panel:drums"),
        item("Synthesizer", "panel:synth"),
        item("Stem Separator", "panel:stems"),
        item("Voice Remover", "panel:voice"),
        item("Browser", "panel:browser"),
      ],
    },
    {
      label: "Plugins",
      submenu: [
        item("Plugin Rack", "panel:plugins"),
        item("Plugin & Bridge Settings", "panel:settings"),
      ],
    },
    {
      label: "Window",
      submenu: [
        { role: "minimize" },
        { role: "zoom" },
        { type: "separator" },
        item("Mixer", "panel:mixer"),
        item("Piano Roll", "panel:piano"),
        item("Browser", "panel:browser"),
        ...(process.platform === "darwin" ? [{ type: "separator" }, { role: "front" }] : []),
      ],
    },
    {
      label: "Help",
      submenu: [
        item("SYNCLAB Help Center", "help:center"),
        item("Keyboard Shortcuts", "help:shortcuts"),
        item("Report a Problem", "help:problem"),
        { type: "separator" },
        { label: "SYNCLAB Website", click: () => shell.openExternal(info.website) },
        { label: "Check for Updates…", click: send("app:check-updates") },
        { type: "separator" },
        { label: `About ${info.productName} ${app.getVersion()}`, click: send("help:about") },
        { label: "Developer Tools", accelerator: "CmdOrCtrl+Alt+I", click: () => win?.webContents.toggleDevTools() },
      ],
    },
  ];

  Menu.setApplicationMenu(Menu.buildFromTemplate(template));
}

module.exports = { buildMenu };
