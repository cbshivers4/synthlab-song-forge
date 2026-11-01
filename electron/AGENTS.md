# Desktop shell

Web Bluetooth uses an explicit native chooser and same-origin device permission; never silently choose nearby hardware, because users must select their MIDI controller.
Trust rules live in security.cjs (pure, unit-tested): windows navigate only to SYNCLAB origins and HTTPS sign-in hosts, only http/https/mailto go to the OS, mic/MIDI permissions and every IPC handler require a SYNCLAB sender, so a stray page in the window can't reach native file access.
Renderers are sandboxed; the preload can only require "electron", so app identity is passed via additionalArguments, never require() of local files.
Guard Electron APIs that differ between versions (e.g. Bluetooth permission handler) so a missing API can't stop the window from opening.
Offline studio (offline-studio.cjs, pure + unit-tested): the window keeps its https://synclabsapp.com address while an https protocol handler stores pages and hashed code files on disk; pages are network-first (updates still ship by publishing), /assets are copy-first, server functions/API/hosting internals are never stored. Packaging captures a seed copy so the first launch works offline. Keeping the real origin means sign-in, localStorage projects and OAuth return links are identical online and offline.
