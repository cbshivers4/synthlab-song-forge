# Cloud storage
- [x] Save and reopen full projects in the signed-in account
- [x] Upload recordings, samples, pad sounds, and exports privately
- [x] Add cloud project browsing and deletion

# Bass generator
- [x] Add a playable bass generator that creates editable MIDI patterns

# Roadmap

- [ ] Polish mixer while preserving every channel control; center and enlarge its channel icons
- [ ] Give each Live Looper circle a persistent custom color
- [ ] Reduce visual update work that can cause playback/recording stutters, then verify browser flows
- [x] Show captured audio waveforms for recorded instruments and drums alongside editable notes; open recorded takes in the waveform editor
- [x] Verify audio, instrument, and drum recording in the signed-in browser studio with simulated microphone input
- [ ] Verify physical input/interface latency and playback on real devices (requires hardware)

- [x] Separate Live Looper from Live View, with circular waveform pads, selectable bar lengths, overdub, mute, reverse, and timeline transfer
- [ ] Verify Live Looper input timing and playback on real audio-interface hardware (requires a physical device)

- [x] Make the original SYNCLAB logo clearly visible on the welcome/login screen
- [ ] Restyle the welcome/login screen after the user chooses a visual direction
- [x] Color the main record button
- [x] Add playable chords, scales, note highlighting, and scale lock to the keyboard

## Stage 2 — arrangement (done)
- [x] Clips are positioned objects: move, trim both edges, duplicate, delete, drag to another audio channel
- [x] Recorded and imported clips actually play back at their bar position
- [x] Drag-to-resize track heights and the bottom editor (height remembered)

## Stage 3 — automation (done)
- [x] Volume, pan, reverb and delay send lanes per track
- [x] Draw, drag and delete points; READ/OFF per lane; curves ride the channel during playback
- [x] Record live device movements with Write, Touch, and Latch modes during playback
- [x] Edit device automation points with curve shaping and parameter-aware value scaling
- [x] Copy, paste, duplicate, and delete device automation across loop-selected timeline regions
- [x] Keyboard shortcuts for device automation region copy, paste, duplicate, and delete
- [x] Time-grid and parameter-aware value snapping for device automation points and regions
- [x] Per-lane lock/unlock controls for device automation lanes
- [x] Real-time audio and visual preview while dragging automation points, curves and regions
- [x] Per-lane undo/redo history for device automation edits (buttons + ⌘/Ctrl+Z, ⌘/Ctrl+Shift+Z)

## Stage 4 — clip editor (done)
- [x] Double-click an audio clip to open a non-destructive editor
- [x] Trim start/end, fades, gain, normalize, loop, reverse, rename, revert
- [x] Pitch and speed (browser couples them into one playback rate — stated honestly)
- [x] Interactive waveform zoom to 16× with horizontal scrolling and precise trim/fade handles
- [x] Undo and redo controls in the clip editor for comparing trim and fade changes
- [x] A/B waveform comparison with separate original and edited audition modes
- [x] Shared loop region for repeated Original and Edited waveform audition
- [x] Adjustable equal-power crossfade at audition loop boundaries
- [x] Expand timeline automation for filter and device parameters
- [x] Add original step-filter, resonator, scale/chord, and transient devices

## Mobile studio and access
- [x] Redesign the sign-in screen in the Clean Pro Console direction
- [x] Add sign-out to the session-selection screen
- [x] Make studio menus, transport, timeline actions, and tools touch-accessible on phones
- [x] Make pad microphone recording work on empty pads and mobile recording formats
- [x] Surface chord and scale controls clearly on phones
- [x] Implement real Hum to Beat recording and local rhythm extraction
- [x] Verify sign-in, menus, pads, keyboard, and Hum to Beat at phone and desktop sizes
- [x] Enlarge sampler and chopper pads, harden touch release, and return manual pads to the drum machine
- [x] Add mobile accessibility options for extra-large controls, increased text and high contrast
- [x] Add phone track gestures for select, long-press actions, mute, solo and reorder
- [x] Optimize phone landscape layouts for beat editing, arrangement and mixing
- [x] Add the five-button mobile onboarding tour

## Timeline / mixer / drums polish (done)
- [x] Stable MIDI note per drum lane; a drum controller plays and records those pads
- [x] Drum roll with drum names and notes instead of melodic labels (accent, humanize, flam, roll, note repeat, probability, swing)
- [x] Professional audio clip waveforms (center line, quiet takes still readable)
- [x] Horizontal navigation/overview bar at the bottom of the timeline with zoom
- [x] Moved the SYNCLAB timeline watermark down and center, subtle
- [x] Mixer: MUTE/SOLO/REC/MON at the bottom, larger Mute and Solo

## Next batches from the master spec
- [x] Preview-first AI stem generator (play/stop/regenerate per part, nothing added until Add to timeline; separator/voice remover already preview-first)
- [x] Sampler: decay/sustain, LP/HP/BP/Notch filter with cutoff+resonance, fade in/out, sample BPM + sync to project tempo (repitch)
- [x] Sampler Resample: renders the processed sound to a new audio track, original untouched
- [x] Warp to project BPM: pitch-preserving stretch (WSOLA) writes a new sample, original file untouched
- [x] Plugin browser: categories, favorites, recently used, search, drag, found/available/failed counts, "Plugin Scan Failed" cards
- [x] Actual native bundle scanning through the packaged desktop companion
- [x] Package an authenticated local desktop companion that scans standard VST3/AU locations and reports real bundle metadata
- [ ] Load and process native plugins — requires a signed native host and real macOS/Windows hardware testing
- [x] Add local analysis for reference tracks the user owns (tempo, key, loudness; no protected streaming audio)

## Drum performance and creative-tool themes
- [x] Add drum distortion, compression, glitch, mutation, velocity, pitch, decay, chance, flam and retrigger controls
- [x] Add eight recallable drum patterns per drum track
- [x] Add saved color themes to Vocal Forge, Stem Separator, Voice Remover, AI Co-Producer and Hum to Beat
- [x] Verify compilation, project tests, preview startup and the phone viewport

## Playback and recording stability
- [x] Share microphone ownership and release input streams when recording tools close
- [x] Resume browser audio after sleep/backgrounding and fade scheduled channels on transport stop
- [x] Start transport playback from the visible playhead
- [x] Move Bass Generator preview timing onto the audio clock
- [x] Move Pad Sampler sequence timing onto the audio clock
- [ ] Validate latency and audio-interface behavior on real macOS, Windows, iPhone and Android hardware
