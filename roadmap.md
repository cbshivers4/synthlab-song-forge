# Cloud storage
- [x] Save and reopen full projects in the signed-in account
- [x] Upload recordings, samples, pad sounds, and exports privately
- [x] Add cloud project browsing and deletion

# Bass generator
- [x] Add a playable bass generator that creates editable MIDI patterns

# Roadmap

- [x] Add an Ableton Live file handoff for aligned audio stems, standard MIDI, and WAV mix export without claiming embedded Ableton support

- [x] Add project-saved VCA groups and aux-return mixing controls without removing existing mixer controls
- [x] Make phone accessibility settings prominent in the More menu and beat maker, open directly to mobile options; verify on a phone-sized screen
- [x] Polish mixer while preserving every channel control; center and enlarge its channel icons
- [x] Give each Live Looper circle a persistent custom color
- [x] Reduce visual update work that can cause playback/recording stutters, then verify browser flows
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

## Current studio refinement
- [x] Preserve the audio outside the recorded measures when replacing only part of an existing take
- [x] Make VCA and aux meters show actual audio, and verify their faders/mutes and the mixer master level control the intended signal paths
- [x] Sample pads show a solid (no-outline) waveform behind the label (user reversed the earlier no-waveform request)
- [x] Simplify the timeline track menu without removing actions
- [x] Select actual installed speech voices in Vocal Forge, rather than relabeling the same voice as different templates
- [x] Keep synth recording waveforms visible and constrain recorded material to captured measures
- [x] Show recent projects and templates as lists
- [x] Reduce insert-change pops and generator preview drift
- [x] Verify bus effect gain changes alter the live output and preserve sound through insertion, adjustment, and removal
- [x] Prevent repeated instrument/drum recordings from stacking unless overdub is enabled
- [x] Review Live Looper export routing; retain direct monitor to prevent loop feedback and use Timeline transfer for export
- [ ] Listen to synth recording, Vocal Forge voices and effects/generator previews on real speakers (requires ears and device audio)

## Removed (Oct 2)
- [x] Removed AI Studio group (Vocal Forge, Stem Separator, Voice Remover, AI Co-Producer, Hum to Beat, AI Stem Generator) and Bass Generator — panels, menus, tools rail, mobile nav, search, help articles, component + server-function files deleted. ai-vocal track kind kept for playback of existing projects.
- [x] Recorded MIDI notes clamp to the loop end (e.g. 2-bar loop = no notes past bar 2); notes may still cross bar lines inside the region. Build OK, not yet played with a real controller.

## Oct 3 requests
- [x] Make Delay clearly discoverable in the bottom effect picker and color the bottom modules by device family
- [x] Synth recording like other DAWs (arm instrument track, record from looper/track without fuss)
- [x] Click a track header to highlight it for copy/paste
- [x] Live Looper: arm/record from inside the looper without the top REC button
- [x] dB markings next to the master meter
- [x] Track header volume follows its VCA fader visually
- [x] Sample pads show a filled waveform on each pad
- [x] Drum/MIDI clips show a waveform-style display in the timeline
- [x] Phone recording like Koala Sampler: SAMPLE tab in Beat Maker — hold a pad to record into it, tap to play, shares the Pad Sampler bank; fixed Beat Maker not opening while a tool panel was up
- [x] My Library (cloud/computer folders for samples, synth, drums, notes) + distinct effect window looks

## Current request
- [x] Show real moving audio displays in bottom instrument and effect modules.
- [x] Make pop-outs open from the click and give desktop windows a draggable header; browser-tested all four panels, Mac hardware test still needed.

## Branding: SYNCLAB, not Lovable (Oct 3)
- [x] Hide the "Edit with Lovable" badge on the published site; verified 0 visible matches on the published URL
- [x] Rewrite README.md to SYNCLAB Vocal Forge branding
- [x] Set the support contact to cbshivers@gmail.com and verify it shows in-app ("Prefer email? cbshivers@gmail.com")
- [x] Fix the hidden backend break: public.has_role lacked EXECUTE for authenticated, so every RLS policy using it failed and support settings read as empty
- [ ] Point the app's own links (About tab Website, electron/app-info.cjs, index.tsx og:url/canonical, sitemap) at a custom domain once one is connected — they currently use the real published lovable.app URL
- [x] Mixer mirrors every timeline track plus Master; Buses/VCA/Aux open only on request
- [x] Track colour drives timeline clips, waveforms and mixer strip
- [x] Live-played notes and drum hits are not re-voiced during the same recording pass (no doubling)
- [x] Loop-end auto-stop hands over from notes to the printed take without replaying notes on top; notes stamped at the heard position; long takes grow the pattern instead of wrapping; repeated pad hits replace neighbours instead of flamming
- [x] Per-track select checkboxes + Select All; clicking a track header opens its editor
- [x] MIDI controller library by manufacturer with device drawings and factory auto-maps
- [ ] Verify no-doubling with a real MIDI keyboard/pads while recording (needs hardware)
- [x] Mirror every timeline track in the mixer by default; keep Master visible and bus/VCA/aux strips optional
- [x] Clear/cut track content without deleting the channel (toolbar Clear button + track menu "Clear track contents"; channel delete stays in the ⋮ menu)
