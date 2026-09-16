# SYNCLAB — full workstation build

Your spec is a full product roadmap, not one change. SYNCLAB already has a working one-page studio: timeline, tracks, mixer with buses and sends, synth, drum machine, piano roll, plugin rack, audio + MIDI recording, spinning splash. Nothing there gets removed — everything below is added on top or reorganised.

I'll build it in stages and show you each one, so you can steer instead of waiting for a single giant drop.

## Stage 1 — Shell, entry flow, themes, settings

- Splash now dismisses the moment the studio is ready (no forced wait), keeps the spin, and gains a Skip button.
- New welcome screen: logo, "Create. Record. Produce. Finish.", feature cards, Sign in / Create account / Google / Apple / Start free trial.
- Project start screen: New empty project, Templates, Recent projects, Import song, Start with AI, Open project. New-project dialog asks name, BPM, key, time signature, template.
- Full top menu bar: File, Edit, View, Project, Track, Audio, MIDI, Tools, AI, Plugins, Window, Help — with real actions wired where the feature exists, and greyed with a reason where it doesn't yet.
- Left collapsible SYNCLAB TOOLS rail: Vocal Forge, Stem Separator, Voice Remover, AI Co-Producer, Hum to Beat, Synths, Drum Machine, Beat Maker, Sample Chopper, Sampler, Mixer, Mastering. Panels stay context-aware: selecting a clip or track opens the matching tool.
- Theme system: 14 named themes plus a custom theme editor, applied app-wide through design tokens.
- Simple / Advanced mode toggle, defaulting to Simple.
- Keyboard shortcuts (Space, R, S, delete, undo/redo, copy/paste/duplicate) and an undo/redo history for project edits.

## Stage 2 — Accounts, projects, subscriptions

Needs Lovable Cloud (built-in accounts, database, storage, server functions). I'll turn it on in this stage.

- Email sign-in plus Google and Apple.
- Projects saved to your account: new, open, save, save as, autosave with status, recent, favourites, search, backup/restore.
- Content tables for presets, drum kits, samples, synth patches, voices, templates, themes, favourites — so new content is added as data, never a rebuild.
- Subscription tiers (Free, Creator, Producer, Pro) with configurable limits and a 7-day trial. Limits enforced server-side; payment provider wired only when you pick one.

## Stage 3 — Recording, editing, export deepening

- Input meters with peak/RMS/dBFS and clip indicator; audio device + buffer settings with honest latency reporting.
- Take management (loop record, takes list, audition, choose best), overdub/replace, punch, count-in 1/2/4 bars.
- Double-click a clip for an inline audio editor: gain, pitch, speed, start/end, fades, reverse, normalise, time stretch, loop — non-destructive, original always kept.
- Song sections and markers, automation lanes for volume, pan, sends and plugin parameters.
- Export WAV/MP3: master, stems, single track or selected region, with quality settings and progress.

## Stage 4 — Instruments

- Drum machine rebuilt as hardware: 16 velocity pads, banks A–D up to 64 pads, trigger animation, per-pad sample controls, choke groups, drum kit browser by genre, drum effects and presets, step sequencer at 16/32/64/128 steps with velocity, probability, flam, ratchet, swing, humanise, pattern banks, send to timeline as audio or MIDI.
- Synth gains the missing depth: ring mod, visual filter response, draggable envelope points, second LFO with full routing, arpeggiator, step sequencer, preset browser with favourites and randomise, animated hardware feedback.
- Beat Maker + Sample Chopper + Sampler: import or record audio, chop by transient/beat/bar/equal, assign slices to pads, pitch/reverse/stretch/loop, map across keyboard, resample and bounce to the timeline.

## Stage 5 — AI tools

All run through Lovable's AI gateway on the server, each aware of project BPM, key, sections and existing tracks.

- Vocal Forge expanded: voice, character, emotion, energy, pitch, formant, speed, style, genre, presets, preview, regenerate, insert aligned to the correct bar.
- Vocoder as an insertable effect with carrier/modulator and presets.
- Stem separation, voice removal, hum-to-beat — each producing new aligned tracks, original untouched.
- AI Co-Producer: natural-language commands that generate real clips, with Preview / Add it / Regenerate / Undo, plus suggestions you approve.
- AI mastering: analyse and suggest, preview, apply, undo.

## Stage 6 — Mix, master, plugins

- Channel context menu (add effect, add send, route to bus, create bus, colour, icon, freeze, bounce, delete), visual routing diagram, pre/post sends.
- Scopes: spectrum, stereo scope, correlation, loudness, peak — opened on demand.
- Master channel with peak/RMS/LUFS/correlation/spectrum, limiter, mastering presets with A/B.
- Plugin Bridge architecture: browser-hosted SYNCLAB effects work now; native VST3/AU discovery is architected behind a Native Companion and clearly marked unavailable until that companion exists. No fake scanning.

## Stage 7 — Templates, help, polish

- Templates including Detroit Techno and Vocal, plus save/rename/duplicate/delete your own.
- Help centre with interactive step-by-step tutorials, What's New, accessibility pass (keyboard nav, ARIA, contrast, touch targets), responsive tablet/mobile layout with touch-friendly pads and quick Vocal Forge.

## Ground rules I'll hold to

- No button that claims success when nothing happened. Anything the browser can't do says so plainly.
- Nothing currently working gets removed.
- SYNCLAB keeps its own dark Detroit identity — no other DAW's look.

I'll start with Stage 1 once you approve.
