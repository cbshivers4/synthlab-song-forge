# SYNCLAB — audit, fix, and professional build-out

## What the audit found

Already working and kept as-is: splash/sign-in, start screen with recents and cloud projects, timeline up to 512 bars with loop and export flags, unlimited tracks, recording with count-in, piano roll, flagship synth (67 presets), 24-kit drum machine, Sampler + 64-pad Pad Sampler, six-console mixer with buses/sends/EQ/scopes, 16 effects, Pro-EQ 8, VX-16 vocoder, plugin rack with honest browser limits, MIDI learn for mixer control, WAV/MP3 export, cloud save, AI Co-Producer, search palette, themes.

Real gaps confirmed in the code:
- No undo/redo anywhere.
- No automation system.
- No autosave, and a page refresh loses the session.
- No stem export and no MIDI export.
- No sample editor (fade, normalize, reverse, crop).
- Panels and track heights cannot be resized.
- No status bar (engine state, sample rate, voices, load).
- Vocal Forge is still a placeholder, not a real vocal workflow.
- Menus list several items that do nothing yet.
- Mobile and tablet get the desktop layout shrunk down.

## Staged build

**Stage 1 — Foundation fixes**
Undo/redo across tracks, notes, pads, clips, mixer and patches, wired to Edit menu and Cmd/Ctrl+Z. Autosave and crash recovery to local storage so a refresh restores the session. Status bar along the bottom: engine state, sample rate, buffer, voice count, tempo. Every menu item either works or says plainly what it needs.

**Stage 2 — Arrangement**
Clips become real objects on the timeline: move, resize, split, duplicate, rename, drag between tracks, loop, snap and zoom. Track heights drag to resize; the bottom editor and side panels resize and collapse.

**Stage 3 — Automation**
Automation lanes under each track for volume, pan, sends, synth and effect parameters. Draw and edit points, read/write/touch/latch modes, played back by the engine.

**Stage 4 — Sample editor and audio tools**
Dedicated editor panel: zoom, trim, crop, split, fade in/out, gain, normalize, reverse, pitch, loop points. Reachable from any audio clip, the Sampler and Pad Sampler.

**Stage 5 — Export and projects**
Stem export (per track or selection), MIDI export, sample-rate and bit-depth choices, plus project templates and backups.

**Stage 6 — Vocal Forge**
Full guided flow: text, voice, style, key and tempo, generate, preview, edit, place on the timeline, export — using the AI backend already connected, with pitch, formant, vocoder and effects on the result.

**Stage 7 — Plugin manager and bridge**
Proper manager: scan progress, vendor, format, version, status, failures, favorites, search, categories, drag onto a channel. Native plugins state "Requires SYNCLAB Desktop Audio Bridge" rather than pretending to load.

**Stage 8 — Responsive and polish**
Purpose-built tablet and phone layouts: transport always reachable, swipeable mixer, browser as a drawer, large touch pads and touch-friendly synth. Then a full pass for tooltips, context menus, shortcuts, error messages and render performance.

## Ground rules kept throughout

Nothing working gets removed or duplicated. No control is shown as functional unless it is. Browser limits (native plugin code, hardware MIDI in Chrome/Edge, device labels needing mic permission) are stated in the interface, never faked. Detroit SYNCLAB identity and the neon logo stay.

## Technical notes

History as a command stack in `src/lib/synclab/history.ts` layered over the store snapshot/restore that already exists. Autosave reuses `snapshot()` into local storage with a debounce, cloud save unchanged. Clips get a `start`/`length`/`offset` model on `Track.clips`; automation stored per track as parameter lanes with breakpoints read by `audio-engine.ts` on the transport tick. Stems bounce by soloing each track through the existing master capture path. Panel sizing via resizable primitives; layout sizes persisted with the app state.
