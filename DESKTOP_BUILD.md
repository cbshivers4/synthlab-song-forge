# SYNCLAB — desktop build guide

This document describes how the desktop application is built, what it currently does, and what
still requires a real macOS or Windows machine. Nothing here is aspirational: if a step cannot be
performed in this environment, it says so.

## Identity — one source of truth

`electron/app-info.cjs` holds the product name, application id (`com.synclab.vocalforge`), version,
publisher, copyright and URLs. The main process, the preload bridge and `scripts/build-desktop.mjs`
all read it, so the name/version in the window title, the About box, the file names and the
installer metadata cannot drift apart. Change the version there (and in `package.json` `version`
and `SYNCLAB_VERSION` in `src/lib/synclab/support.ts`) and rebuild.

## Layout

```
electron/app-info.cjs      identity + metadata
electron/main.cjs          window, IPC, file dialogs, offline fallback page
electron/menu.cjs          native application menu -> "synclab:menu" commands
electron/window-state.cjs  remembers size, position, maximized, fullscreen, multi-display safe
electron/preload.cjs       the ONLY surface the page can see (contextIsolation on)
electron/plugin-bridge.cjs authenticated local scanner for installed VST3/AU bundles
build-resources/           icon.icns (macOS), icon.ico (Windows), icon.png (Linux/window)
scripts/build-desktop.mjs  packaging entry point
src/lib/synclab/desktop.ts      runtime detection + saveBytes/openLocalFiles
src/lib/synclab/desktop-menu.ts native menu commands -> studio actions
src/lib/synclab/bridge.ts       client for the Desktop Audio Bridge (ws://127.0.0.1:8787)
```

Layering: UI -> Project Engine (`store.tsx`) -> Audio/MIDI Engine (`audio-engine.ts`, `midi.ts`) ->
Plugin Bridge (`bridge.ts`) -> Local File System (`desktop.ts` + IPC) -> Desktop OS. AI and account
features stay in the cloud service layer (server functions) and are reachable from both runtimes.

The packaged desktop app starts the scanner on `127.0.0.1` with a private per-launch token. It scans
standard VST3 locations on Windows and VST3/Audio Unit locations on macOS. This scanner reports real
bundle names and paths, but it does not load plugin code or process audio. Native hosting remains a
separate milestone that must be compiled and tested on each supported operating system.

## Development

```bash
npm install
npm run dev                 # web studio on http://localhost:8080
SYNCLAB_URL=http://localhost:8080 npm run desktop:dev
```

`SYNCLAB_URL` points the shell at any studio build; without it the shell loads the published studio.

## Production packaging

```bash
npm run desktop:package -- --platform=darwin --arch=arm64
npm run desktop:package -- --platform=darwin --arch=x64
npm run desktop:package -- --platform=win32  --arch=x64
```

Output goes to `electron-release/`, zipped as
`SYNCLAB-<version>-<macOS|Windows>-<arch>.zip`.

## What still needs a real Mac / Windows machine

| Artifact | Requirement |
| --- | --- |
| `.dmg` | macOS only (`hdiutil` / `electron-builder` on macOS). Cross-compiling produces the `.app` and a `.zip`, never a `.dmg`. |
| macOS code signing | Apple Developer ID certificate in the keychain: `codesign --deep --force --options runtime --sign "Developer ID Application: <name>" SYNCLAB.app` |
| macOS notarization | `xcrun notarytool submit <zip> --apple-id <id> --team-id <team> --password <app-specific> --wait`, then `xcrun stapler staple`. |
| `.exe` installer | Windows: `electron-builder --win nsis` or Squirrel/Inno Setup on a Windows host. The portable `.zip` is produced here. |
| Windows code signing | An EV or OV code-signing certificate and `signtool sign /fd sha256 /tr <timestamp> /td sha256 /f cert.pfx /p <pass>`. |

Unsigned builds still run: Windows shows SmartScreen ("More info" -> "Run anyway"), macOS needs
right-click -> Open the first time.

## Auto-updates

Not implemented yet. The intended path is `electron-updater` with a static update feed hosted on
the same CDN as the installers. It must not interrupt an active recording or playback: check on
launch and when idle, offer "Install on quit", and allow postponing. Until that exists, the Help
menu's "Check for Updates" states plainly that this build loads the studio over the network.

## Offline

The window always shows https://synclabsapp.com, but every page and code file it receives is also
stored on the computer (`electron/offline-studio.cjs`). Without internet the studio opens from that
copy: same sign-in, same projects saved on this computer, playing, recording and exporting. Cloud
projects, cloud saving, signing in for the first time, payments and AI tools still need internet.

`npm run desktop:package` first runs `scripts/capture-offline-studio.mjs`, which stores a copy of the
currently published studio in `build-resources/offline-studio/` (needs internet while packaging), so
even the first launch works offline. Pass `--no-offline-copy` to skip it; the app then needs to be
opened online once. Online, pages are always fetched fresh, so publishing the website still updates
desktop users on their next launch.

## Distribution

Installers are large and do not belong in the app repository. Publish them to external storage/CDN
and point the SYNCLAB download page at those URLs:

```
source -> desktop build -> macOS .app/.dmg/.zip, Windows .exe/.zip -> CDN -> download page
```

## Icons

`build-resources/icon.icns`, `icon.ico` and `icon.png` are generated from the official SYNCLAB logo
(`src/assets/synclab-logo.png`). To change the artwork, replace the logo and regenerate:

```bash
magick src/assets/synclab-logo.png -resize 1024x1024 build-resources/icon.png
magick build-resources/icon.png -define icon:auto-resize=256,128,64,48,32,16 build-resources/icon.ico
png2icns build-resources/icon.icns icon_16.png icon_32.png icon_128.png icon_256.png icon_512.png icon_1024.png
```
