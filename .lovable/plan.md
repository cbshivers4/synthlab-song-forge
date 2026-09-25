# Desktop Plugin Bridge — Next Increment

## Goal
Turn the existing plugin-browser protocol into an installable desktop companion that can discover installed VST3 plugins on Windows and VST3/AU plugins on macOS without pretending the website itself can run native plugins.

## What will change
- Add the native bridge companion source and build configuration using a proven plugin-hosting framework.
- Scan standard macOS and Windows plugin locations, isolate scan failures, and return real plugin metadata and errors to SYNCLAB.
- Implement the existing local connection handshake, rescan request, plugin list response, and clean disconnect behavior.
- Make the desktop app detect/start the companion when it is installed, while leaving the website in an honest “bridge required” state.
- Add connection/version diagnostics so users can tell whether the bridge is absent, incompatible, scanning, or ready.
- Add protocol tests with a local mock bridge and update packaging scripts so future signed releases can include the companion.

## Technical details
- Native formats: VST3 on macOS/Windows; Audio Units on macOS. CLAP remains listed only when the native host actually supports it.
- Local-only communication stays on `127.0.0.1`; messages are schema-validated before entering app state.
- Native audio processing and plugin windows will only be marked complete after real macOS/Windows hardware testing. This pass can verify the browser/desktop protocol and packaging integration in the current environment, but not certify third-party plugin compatibility.

## Verification
- Test connect, scan, failure reporting, open/close, parameter updates, and disconnect against a mock companion.
- Confirm the browser never shows plugins as loaded without a live bridge.
- Confirm the website and desktop shell still build cleanly.
