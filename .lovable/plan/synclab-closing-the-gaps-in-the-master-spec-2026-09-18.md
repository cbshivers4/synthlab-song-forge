# SYNCLAB — closing the gaps in the master spec

Most of this specification is already live in SYNCLAB: splash with skip, welcome/sign-in, project start with templates and recents, the one-page studio (menu, transport, tools rail, timeline, bottom editor), unlimited tracks, audio and MIDI recording, piano roll, the synth with 67 presets, the drum machine with 24 kits, sampler and 64-pad sampler, six-console mixer with buses, sends, EQ, scopes, 16 effects, Pro-EQ, vocoder, clip meters, automation lanes, undo/redo, autosave, cloud projects, AI Co-Producer, WAV/MP3 export and themes.

So this is not a rebuild. Below is only what is still missing or half-finished, in the order I'd ship it.

## Stage 4 — Sample editor and clip editing

- Double-click any audio clip to open an inline editor: waveform with zoom, gain, pitch, speed, start/end, fade in/out, reverse, normalize, time stretch, loop.
- Edits stay non-destructive — the original audio is kept and every change is undoable.
- Clip context actions rounded out: crossfade, consolidate, rename, bounce, freeze.

## Stage 5 — Export, templates, arrangement

- Export stems (per track), MIDI files, and the selected region, with Draft / High / Master quality and a progress display.
- Detroit Techno and Vocal templates built out with their full track lists; save, rename, duplicate, delete and favourite your own.
- Song sections (Intro, Verse, Chorus, Bridge, Breakdown, Drop, Outro) as markers on the ruler, with duplicate / move / delete / loop section.

## Stage 6 — Vocal Forge and AI tools

- Vocal Forge full flow: lyrics, voice, character, emotion, energy, pitch, formant, speed, style, genre, preset — with Generate, Preview, Regenerate, Insert.
- Generated vocals align to the project's BPM, key and section structure instead of landing at bar 1.
- AI mastering: analyse the mix, suggest settings, preview, apply, undo.
- Stem separation, voice removal and hum-to-beat stay honestly marked until the server-side models are wired; no fake buttons.

## Stage 7 — Controls, XY pad, hardware feel

- A control audit against the rule set: knobs for sound shaping, vertical faders for levels, horizontal sliders for ranges and positions, buttons for actions, toggles for on/off.
- Every continuous control shows its value, supports fine drag (Shift), double-click reset and mouse wheel.
- A large XY pad in the main workspace with selectable X/Y destinations, min/max, curve, presets, MIDI learn, and movement recordable as automation.

## Stage 8 — Plugin manager, responsive, help

- Plugin Manager and browser: categories, search, favourites, recent, manufacturer; drag a plugin onto a channel. Native VST3/AU hosting stays clearly marked as requiring the SYNCLAB Native Companion — never faked.
- Tablet and phone layout: collapsed panels, touch pads, accessible transport, quick Vocal Forge.
- Help centre with step-by-step interactive tutorials, What's New, and an accessibility pass (keyboard nav, ARIA, contrast, touch targets).

## Ground rules held throughout

- Nothing currently working is removed.
- No button that claims success when nothing happened; browser limits are stated plainly.
- SYNCLAB keeps its own dark Detroit identity.

I'll start with Stage 4 once you approve, and show you each stage as it lands.
