# Cloud storage
- [x] Save and reopen full projects in the signed-in account
- [x] Upload recordings, samples, pad sounds, and exports privately
- [x] Add cloud project browsing and deletion

# Bass generator
- [x] Add a playable bass generator that creates editable MIDI patterns

# Roadmap

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

## Timeline / mixer / drums polish (in progress)
- [ ] Stable MIDI note per drum lane; recorded pads land on the right note
- [ ] Drum piano roll with drum names instead of melodic note labels
- [ ] Professional audio clip waveforms (center line, visible when quiet)
- [ ] Horizontal navigation/overview bar at the bottom of the timeline
- [ ] Move the SYNCLAB timeline watermark down and center, subtle
- [ ] Mixer: MUTE/SOLO/RECORD/MONITOR at the bottom, larger Mute and Solo
