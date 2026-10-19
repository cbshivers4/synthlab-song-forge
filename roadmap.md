# Cloud storage
- [x] Retain MP3/MP4 uploads and app exports in the private account library; verified signed-in uploads, reopen, MP3 timeline reuse, recorder export retention and phone video loading. Playback depends on browser codec support.
- [x] Save and reopen full projects in the signed-in account
- [x] Upload recordings, samples, pad sounds, and exports privately
- [x] Add cloud project browsing and deletion

# Bass generator
- [x] Add a playable bass generator that creates editable MIDI patterns

# Roadmap

- [x] Phone mixer master channel now stands out: accent-tinted face, accent edge plate, outer glow, wider strip and pinned to the right edge so it stays visible while scrolling. The phone console runs the desktop-style layout, so the earlier `.mx-phone`-only master styling never applied; added an `mx-phone-master` marker on touch layouts. Signed-in sideways-phone check verified sticky position, accent border/glow and distinct header; desktop console confirmed unchanged (marker absent); build OK.
- [x] Add shared app keyboard shortcuts and searchable Settings reference; signed-in desktop/phone verified reference/search, text-entry safety, arm toggle, mixer open/close and manual cloud saving. Fixed Ctrl+Shift+K search conflict and phone reference opening; 11 focused tests passed, build OK. Physical keyboard/device checks remain hardware-dependent.
- [x] Repair live synth oscillator/filter/envelope/LFO/per-voice FX updates, actual oscillator phase, MIDI print-to-live edits, drum sample/vintage gain/pitch/pan/tone/filter changes and in-place rack modulation/limiter/bitcrusher setters. Signed-in desktop/phone knob drag changed audio; held cutoff attenuated signal, level reached silence, drum gain silenced the same hit and seven rack types retained their nodes. 23 focused tests passed. Structural changes and drum attack/decay apply on subsequent notes; Voice Converter requires Convert. Physical hardware and an exhaustive every-control listening audit remain unverified.
- [x] Live synth displays: float-sample meters retain quiet signals, scopes magnify waveform display without changing sound or dB readings. Signed-in armed synth verified on desktop; phone master meter/scope captured during live playing, seven focused tests passed and build OK. Physical MIDI hardware remains unverified.
- [x] Add 32 original editable Touch Synth loop sets across 16 genres, with explicit replacement confirmation and single-lane loading preserving others; desktop/phone verified selection, five-lane playback and timeline transfer; 12 focused tests passed, build OK.
- [x] Touch Synth: poly voices play all five lanes together; scrollable note grid places and erases individual notes without clearing other loops. Signed-in desktop/phone verified one note per lane, single-note deletion and five notes sent to timeline; focused tests passed.
- [x] Add directly visible Touch Synth entries to desktop Synthesizers and phone Sounds; signed-in desktop/phone clicks opened the performance pad immediately and played notes without page errors; touch tests passed and build OK.
- [x] Distinct original vintage/genre drum PCM, TR-727 and R-8 kits, sample-override clearing with patterns/MIDI preserved, and gated scale-based Touch Synth in shared synth tabs. Signed-in desktop/phone verified selected sounds, changing pitch/tone, release stopping repeats and real TR-727 pad playback; 66 tests passed, build OK. Machine-inspired synthesis, not factory ROMs; touch plays gated notes, not continuous pitch-glide emulation.
- [x] Repair Bluetooth MIDI discovery and selected synth auditions: scan BLE devices without advertised service, validate MIDI before registration, preserve enabled inputs, show unclassified audio devices and explicit browser limits; add desktop chooser. Signed-in factory selections reached playback with distinct patches; simulated nearby controller appeared, phone had no overflow/errors, 50 tests passed. Physical Bluetooth and packaged desktop testing require hardware/new desktop build.
- [x] Enable simultaneous MIDI controllers with per-port checkboxes and All devices; detection preserves choices and hot-plug refresh reattaches inputs. Signed-in simulated-device selection verified; MIDI tests pass. Physical-controller testing remains unavailable here.
- [x] Move mixer channel buttons directly above scope and bottom icon; expose working High/Mid/Low EQ knobs on desktop and phone. Signed-in keyboard adjustments, all nine channels, centered icons and phone bottom-control scrolling verified; 44 tests passed. Physical-device listening remains unverified.
- [x] Give effects and synths distinct hardware faceplates, dimensional knobs and raised controls; signed-in synth/effect knob changes, bypass and sideways phone access verified; 44 tests passed. Audio routing and wallpaper controls preserved.
- [x] Streamline recording/takes, selected-part clip actions, loop editing and shared desktop/phone workspace. Signed-in desktop verified replace/overdub, count-in, arm/start/stop and imported-audio copy/paste/delete retaining the channel; sideways phone controls visible. 44 tests passed. Physical recording and take-switch listening remain hardware-dependent.
- [x] Fix doubled live recording visuals and bound drum edits/manual takes to loop markers. Signed-in desktop recording verified one drawn note and one timeline note; drum edit ended at loop marker on desktop and sideways phone. 41 tests passed; physical input testing remains hardware-dependent.
- [x] Match reference MIDI settings with category sidebar, controller drawings, detection/profile controls, input list and existing master input selection. Signed-in desktop/sideways-phone verified profile selection, mapping on/off, input All/None and library opening; MIDI/preference tests passed, build OK. Connected hardware is not available in this sandbox.
- [x] Add Settings → Diagnostics: reload persistence check with unsaved-song warning, microphone capture/release, MIDI permission/ports, audio devices and playback access. Signed-in desktop/sideways-phone verified actual reload, simulated microphone access and permission failures; 38 tests passed, build OK. Physical hardware remains unverified.
- [x] Audit reference settings; add User interface/Browsing/Sync/Other controls/Folders/Account sections using existing panels. Connect MIDI thru/velocity/bend, metronome sound/level/playback, export defaults and tooltip/motion preferences; replace inactive mixing/timing controls with real actions or clear limitations. Signed-in desktop and sideways-phone sections/switches passed; real virtual MIDI messages and captured metronome PCM passed; 32 tests passed and preview build OK.
- [ ] Physical audio-interface/MIDI-controller and native desktop folder-scan verification: requires connected hardware and macOS/Windows desktop runtime unavailable in this browser sandbox. MIDI clock/Link, native buffer/scratch disk and offline authorization remain explicitly unavailable, not claimed implemented.
- [x] Mixer name plate restored (instrument icon + channel name) as a plain row above the controls — never sticky, so it can't cover the channel meter; the meter now fits inside its fader row and the selected-track bar is hidden while the mixer is docked. Desktop faders/meters fully visible, last channel reachable by scrolling; sideways phone verified by scrolling. 27 audio tests passed, build OK.
- [x] Remove the mixer channel name/instrument bar from every strip (desktop, bus, VCA/aux and master); names stay in the left channel list and bus/VCA/aux/master identity moved into each strip's top row. Signed-in desktop and sideways-phone checks passed, 27 audio tests passed, build OK.
- [x] Match supplied mixer reference: flat grey console, compact colored strips, silver faders, left channel list and separate master output. Signed-in desktop selection/mute/fader and sideways phone mute/last-channel access passed; all 27 audio tests passed, preview build OK. Physical-device testing remains open.
- [x] Match supplied timeline/transport/tools references: grey lanes, compact icon tools and bottom desktop transport, solid color clips with white selection/handles. Signed-in browser verified imported audio off-grid cut, selected-piece deletion, MIDI cut pieces, recording/export menus and sideways phone full-height timeline/transport access; cut tests passed. Real-device testing remains open.
- [ ] AI Co-Producer reported failure on phone/desktop: signed-in preview checks opened and returned real chord answers on both sizes without errors; awaiting a screenshot of the user's failure to reproduce it.
- [x] Add a project-synced Studio View with instruments on stands, mixer, effects rack and monitors; signed-in desktop/phone checks verified editor opening, added sampler visibility, real meter activity, effect insertion and portrait/landscape scrolling.
- [x] Give phone pages full height with a hidden-by-default transport overlay and rail toggle; signed-in portrait/landscape checks verified timeline, mixer, all 7 Sounds and 15 Tools pages, plus transport access with collapsed navigation.
- [x] Fix reel recorder timeline meters on desktop and phone: read live stereo master taps without enabling microphone or capture; reflect transport playback status and preserve tape metering.
- [x] Reel-to-reel recorder on phone and desktop: AudioWorklet recording, live stereo VU meters, moving reels, playback/seek/loop, gain/tone/saturation/speed knobs, WAV/MP3/FLAC/AIFF export and timeline transfer. Signed-in browser checks verified PCM capture, meters, reel motion, WAV/MP3 contents and phone controls; physical-device listening remains unverified.
- [x] Move phone meters/MIDI below playback, retain Add track, correct shared drum-roll order and dark pad faces, and restore distinct Synth/Sampler opening; signed-in phone/desktop checks and drum identity/MIDI unit test passed.
- [x] Refresh login and Sounds; update drum order/faces/pattern label/five-column icons, sampler chop banks/red markers, four-column pad sampler/looper, Tools and Edit labels; desktop and phone browser checks passed, physical-phone testing remains hardware-dependent.
- [x] Simplify phone Home, add drum-roll/tap-record views and contain theme controls; signed-in phone checks verified quick fills, recorded hits, theme containment and no portrait/sideways page overflow. Physical-phone/audio checks remain hardware-dependent.
- [x] Repair Recent files deletion without restoring sample URLs; signed-in test deleted a newly saved project with missing audio via its trash button and verified it stayed deleted after reload
- [x] Add optional count-in haptic pulses and phone Recording toggle; browser tests verified 0/4 pulses, automatic recording, STOP cancellation and unsupported-browser status; physical vibration remains hardware-dependent
- [x] Add phone drum-roll 1/16, 1/8 and 1/4 snapping; touch tests verified actual hits, unchanged existing hits and portrait/sideways layouts
- [x] Make phone Edit countdown show large labeled bar and beat numbers; verified automatic recording and 0/4 engine clicks with click disabled/enabled in signed-in phone preview
- [x] Add mobile drum-roll row/step indicators and pinch/button zoom; browser two-touch gesture changed zoom and row indicators followed scrolling
- [x] Remember selected drum row/step across tabs and editor return; verified FX step 16 retained and visible
- [x] Add optional count-in click in phone Edit Recording; verified 0 engine clicks when off and 4 when on, both automatically recording after the countdown
- [x] Group phone Edit menu into Playback, Recording, Loop, Tempo & rhythm, and Meters & MIDI; expose count-in Off/1/2/4 bars. Signed-in phone preview verified countdown before automatic recording, desktop unchanged.
- [x] Restore access to every phone drum-roll row and step: touch-sized pattern pages, swipe-safe drum roll, and unobstructed portrait/sideways scrolling; signed-in checks reached first/last steps and the final drum row.
- [x] Move phone transport from Home to Edit with uncluttered menu controls; preserve desktop
- [x] Add and verify a horizontal phone drum machine view with accessible pads and all existing controls

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
- [x] Restyle the welcome/login screen in the chosen direction and verify the enlarged logo on desktop and phones
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
- [x] Add saved color themes to SYNCLAB, Stem Separator, Voice Remover, AI Co-Producer and Hum to Beat
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
- [x] Select actual installed speech voices in SYNCLAB, rather than relabeling the same voice as different templates
- [x] Keep synth recording waveforms visible and constrain recorded material to captured measures
- [x] Show recent projects and templates as lists
- [x] Reduce insert-change pops and generator preview drift
- [x] Verify bus effect gain changes alter the live output and preserve sound through insertion, adjustment, and removal
- [x] Prevent repeated instrument/drum recordings from stacking unless overdub is enabled
- [x] Review Live Looper export routing; retain direct monitor to prevent loop feedback and use Timeline transfer for export
- [ ] Listen to synth recording, SYNCLAB voices and effects/generator previews on real speakers (requires ears and device audio)

## Removed (Oct 2)
- [x] Removed AI Studio group (SYNCLAB, Stem Separator, Voice Remover, AI Co-Producer, Hum to Beat, AI Stem Generator) and Bass Generator — panels, menus, tools rail, mobile nav, search, help articles, component + server-function files deleted. ai-vocal track kind kept for playback of existing projects.
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
- [x] Add a phone RESIZE show/hide switch (also accessible with navigation collapsed), hide handles by default and contain timeline resizing separately from transport. Signed-in sideways checks passed for toggling, keyboard/drag resizing, unchanged transport dimensions and playback; 27 audio tests passed and build OK. Portrait remains intentionally rotate-gated; physical touch testing is unverified.
- [x] Make phone track resize grips clearly visible and redesign the transport as a compact bottom console. Signed-in sideways phone checks passed for dragging/keyboard resizing, playback/tempo and mixer controls; screenshots reviewed, build OK. Physical touch testing remains unverified.
- [x] Improve phone transport grouping and mixer readability/touch controls; preserve desktop styling and every action. Signed-in sideways phone playback/tempo/mute/fader checks passed without runtime errors; physical touch testing remains unverified.
- [x] Add horizontal channel-header and vertical lane resizing on desktop and phone; shared desktop toolbar/ruler/song/overview and console preserve controls. Signed-in desktop/sideways-phone checks passed for width dragging, height dragging, keyboard resizing and mixer mute; 27 audio tests passed. Physical touch testing remains unverified.
- [x] Restore document-wide graphite grey phone tokens for entry screens, studio tools and portalled menus; verified signed-in projects, studio, Video Sampler, sideways detection and desktop theme restoration in the browser.
- [x] Show real video audio waveform and manual cuts on desktop and phone; signed-in desktop, portrait and sideways checks verified decoding, waveform seeks/cuts, pad playback and timeline transfer. Chop tests passed; build OK. Physical-device listening remains unverified.
- [x] Keep sampler waveform visible during chopping and stretching on desktop and phone; signed-in checks verified real WAV waveform, manual cuts on both layouts, and 120→60 BPM stretch changing 6s to 12s. Chop tests and build passed; physical-device listening remains unverified.
- [x] Show sampler keyboard by default and add independent natural/sharp/played key colors and surround-only wallpaper to sampler, synth and sample-pad keyboards; signed-in desktop and phone checks verified all three, opaque keys and actual loaded-sample audio signal. Build OK; physical-device listening remains hardware-dependent.
- [x] Compact phone transport into shallow scrolling rows without removing controls; signed-in checks at 534×942, 390×844, 942×508 and 667×375 verified Play/Stop, BPM, Loop, bar steppers, meter/swing, tools menu and rail toggle. Transport measures 201px upright/148px sideways, meter/scope remain 192/240px, no page overflow; desktop checked at 1280×1800. Physical-phone testing remains hardware-dependent.
- [x] Rebalance the sideways phone layout so the SOUNDS/TOOLS tiles are usable and add a collapsible left nav with a bigger logo; signed-in checks at 942×508 verified one full row of big tiles, the rail collapsing to 48px and reopening, and the arrow click (a stale press animation rule that shifted the button on tap was fixed). Build OK, typecheck clean.
- [x] Move phone Loop and Tempo & rhythm onto the transport; signed-in checks verified steppers, loop toggle, BPM, meter, swing and tools menu with no overflow upright/sideways; desktop unchanged.
- [x] Restore native phone scrolling across editors, menus, all timeline tracks and mixer channels; signed-in preview reached the last track, Master, sampler bottom and menu bottom, and a simulated finger swipe scrolled the mixer
- [x] Apply selected left-rail landscape phone shell, graphite/teal tokens and orientation handling; desktop workspace retained
- [x] Replace phone viewport scrolling with overlapping timeline, mixer and instrument/tool pages; short-screen mixer uses levels/performance pages
- [x] Verify signed-in navigation, mixer mute changes, channel/track pages, count-in selection, drum/settings access and desktop return at 942×508, 844×390 and 667×375; physical phone rotation remains hardware-dependent
- [x] Make phone mixer bottom controls reachable by vertical touch scrolling without shrinking them; signed-in touch checks reached Mute/Solo/Arm/Monitor and Master on small portrait, tall portrait and sideways screens. Build OK.
- [x] Align phone playhead with the grid including extra-large controls; signed-in portrait, sideways and desktop checks confirmed cursor/ruler/grid positions match before and after scrolling, with Mute and track menus unobstructed.
- [x] Phone Home retains transport and its complete menu; Edit removes the top transport in portrait/landscape, including when TOOLS is open. Verified menu Play/Stop, tempo/metronome changes, horizontal timeline scrolling, sideways Home return and no page overflow; aligned song header/playhead/export overlays with track widths, build OK.
- [x] Add phone Settings → Enable microphone shortcut that requests permission and opens Audio; browser test confirmed granted permission, three simulated inputs, and no phone overflow. Physical-phone capture remains unverified.
- [x] Add Space (delay/reverb) and Texture (distortion/chorus) synth X-Y pads; signed-in desktop/phone-sized checks verified dragging and synchronized Effects knobs, no page overflow, build OK. Real-device listening remains unverified.
- [x] Make phone mixer essentials large with all channels scrollable and complete channel dialogs; drum roll uses 48px step pages and single-line tools. Verified signed-in mute/fader changes, Master dialog, step writing/page changes, portrait and 942×508 sideways view, no page overflow; physical-phone rotation remains untested.
- [x] Enlarge phone Sounds and Tools room tiles: 4 per row with tighter gaps/padding, taller boxes and bigger icons/labels. Signed-in portrait checks measured 103×185 (Sounds) and 103×140 (Tools, native scroll) with every label readable and none clipped.
- [x] Restyle desktop and phone transport in Glass studio style without resizing existing controls; phone extras use a menu. Signed-in browser verified Play/Stop, metronome toggle and tempo changes; no overflow at 508/390 phone widths, desktop screenshot checked, build OK.
- [x] Remove top-bar Keys shortcuts and compact transport spacing; signed-in Play/Stop verified, no overflow at 1280/1100/508 widths, meter/scope remain 192/240px.
- [x] Show sampler stretch below the waveform and Sampler for sampler instrument editing; signed-in test imported a 1s tone, stretched 120→60 BPM, confirmed 2s duration and INSTRUMENTS opened Sampler. Real-device listening remains unverified.
- [x] Select synth/MIDI channels into the piano roll; signed-in browser verified Bass selection opens piano roll, Open instrument opens synth, and reselecting Bass returns to piano roll; build OK.
- [x] Add Bluetooth shortcuts in Settings, More and phone settings; signed-in preview verified direct Audio access. Paste track material at the playhead onto the selected/explicit channel; imported WAV copy/paste verified two clips on IDEA with ten channels unchanged. Physical Bluetooth pairing remains hardware-dependent.
- [x] Make computer-key playing visible on embedded keyboards; signed-in browser verified toggle, letter labels, synth/sample key presses and octave changes; events claim the existing note path without global duplication. Real-device listening remains unverified.
- [x] Add optional playable keyboards below synth controls and sample pads; signed-in preview verified show/hide, key presses with selected bass and loaded starter sample, and sideways range changes; build OK. Real-device listening remains unverified.
- [x] Organize all synth features into nine uncluttered tabs without removing controls; verified every tab in the signed-in studio, with wrapping navigation and scrollable lower controls.
- [x] Keep timeline headers on one line, align sampler kind labels, and stop the playhead after track rows; verified signed-in with sampler name fitting and cursor ending at the last track.
- [x] Brighten sampler pads and show full timeline track names; verified in the signed-in studio with loaded starter samples.
- [x] Add color and JPEG wallpaper to transport, drum machine, synth, Live View, Live Looper, sampler, and sample pads without obscuring controls.
- [x] Show real moving audio displays in bottom instrument and effect modules.
- [x] Make pop-outs open from the click and give desktop windows a draggable header; browser-tested all four panels, Mac hardware test still needed.

## Branding: SYNCLAB, not Lovable (Oct 3)
- [x] Hide the "Edit with Lovable" badge on the published site; verified 0 visible matches on the published URL
- [x] Rewrite README.md to SYNCLAB SYNCLAB branding
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
- [x] Let the user add their own JPEG wallpaper: Appearance → Wallpaper (choose file, darken slider, per-panel ticks, remove), per-panel Wallpaper button with framing popover, drag a JPEG onto any of the 7 panels

## Done: DAW feature gaps (folders + shortcuts)
- [x] Track folders: TrackFolder type, store actions (add/rename/remove/collapse/assign), cloud session sync, FolderRow in Timeline, "Move to folder" submenu in track menu
- [x] Shortcuts: L loop, M mute selected track, arrows move playhead (bar/shift=step), Home to start, razor moved R->T (fixed duplicate key)
- [x] MenuBar shortcut help text updated; verified in preview (folder create/collapse/ungroup, L/M/arrows); project state restored after test

## Done: DAW gaps 2-4
- [x] Time-stretch audio clips keeping pitch (clip menu: Fit to N bars, 50–200%)
- [x] Comping: replaced takes kept on the new clip; clip menu "Takes" swaps a region (split first to comp pieces); saved with project
- [x] Piano roll: pitch-bend + mod-wheel lanes (drive synth), live MIDI pitch wheel, STRUM up/down; note sub-step timing now audible
- [ ] Click-through test of the new menus/lanes in the preview and listening test on real speakers

## Transport meter and scope
- [x] Align desktop transport compactly without resizing controls or changing phones
- [x] Widen the transport master meter and scope, keep the dB scale readable, and check nothing is cut off at 1280/1100/900
- [x] Color the meter green→yellow→orange→red and light CLIP when the master clips
- [x] Add per-channel peak-hold dB readouts and a clipping warning that stays visible
- [x] Let the clipping warning clear itself once the level holds below the clip zone (~0.9 s), keeping click-to-reset

## Mixer colours
- [x] Retint the default Studio Pro desk: charcoal body (#2b2b2e) with amber accent (#f0a03c); console highlights follow the desk accent instead of app blue; verified in preview (build OK, --primary/--ring/--mx-accent all amber, desk charcoal, no console errors)
- [x] Stop the timeline being squeezed when an editor panel is open: timeline keeps a 210px minimum, the editor panel now shrinks instead of pushing the toolbar's second row out of view (verified: toolbar row fully legible, nothing overlapping at 1334x986)

## Drum pad glyphs
- [x] Restore original pad sizing and replace rejected abstract glyphs with recognizable coloured instrument drawings; preserve names and S/M controls

## Drum patterns visibility
- [x] Bring A–H pattern selection, Copy/Clear and editable steps above the tall pad sound controls; pad sizing and instrument artwork unchanged; signed-in browser verified step editing and recall between banks with no runtime errors.

- [x] Select All button placed immediately next to the Select tool in the editing toolbar (verified: 9 CHANNELS -> 9 SELECTED)

- [x] Keep phone timeline REC and AUTO visible first, preserve other actions through horizontal scrolling, and prevent automation menu clicks from opening an instrument.

- [x] Sampler phone/desktop chopping: PCM attacks, manual cuts, gate/one-shot, choke, pad spreading; unit tests and signed-in portrait/sideways/desktop preview passed, including gate release and offset pad transfer. Physical-device listening remains unverified.

## AI / creative tools (Oct 2026)
- [x] Video Sampler: red draggable cuts, large PCM waveform pads, 4/8/12/16 counts and 1/1–1/64 grid; signed-in desktop edit/save and phone cloud reopen/touch drag verified, including stretch settings. Physical-device listening remains unverified.
- [x] Expose all six creative tools in the active phone Tools room and alternate phone menu; signed-in checks opened each tool upright, sideways and on desktop.
- [x] Hum to Beat (beatbox → drums, hum → melody; on-device analysis)
- [x] Separate stems (simple honest version: vocal remove/isolate, low/mid/high bands)
- [x] Convert voice (simple honest version: pitch/formant/robot effects)
- [x] AI co-producer
- [x] Bass generator
- [x] Generate stem (AI audio clip)
- [x] Video Sampler: time stretch (video BPM → target/song tempo, pitch kept) beside the pinned waveform on desktop and phone; verified signed-in
- [x] Video Sampler: save video+chops to library, even/delete chops, Open in Sampler, auto save restore
- [x] App auto save: flush on close, keep audio in browser storage for recovery
- [x] Account autosave removed (user request, Oct 17 2026): projects save only via File → Save / Save As / Ctrl+S (MenuBar dispatches `synclab:project-saved`, store's status-bar Saved time listens to it). Deleted local localStorage autosave + close/hide flush + "Recover previous session?" prompt + 20s cloud autosave + close/hide cloud flush; Settings "Auto-save session" toggle removed; Help text updated. Undo history, cloud library, and QuickNotes note autosave untouched. tsgo clean, 27 audio tests pass.
- [x] Library delete on desktop app: window.confirm is unsupported in Electron, so My Library delete and Sampler pad-replace are now tap-twice actions (verified signed in: file deleted, no error).

- [x] Color Video Sampler pads and map them to the shared keyboard; signed-in desktop/phone tests confirmed four colors, screen/typing/pad playback, linked active states, disabled empty keys and no page errors. Physical-device listening remains unverified.

- [x] Remove Video Sampler waveform boxes; per-pad MIDI Learn, clear, input selection and saved assignments. Signed-in desktop/phone checks passed with injected MIDI input; real hardware remains unverified.

- [x] Shared project Notes panel (transport bar + mixer), autosaving with project
- [ ] Master upgrade prompt: remaining sections (transport extras, mixer audit, tools 6-32) — awaiting user priority
- [x] Notes on every tool, clear-track stays on edit, R2R song counter, video resize, Separate/Add buttons, Generate bass, mobile mic/MIDI help

- [x] Show PCM waveforms for generated stems, converted voice, separated stems, bass/co-producer patterns and recorded Hum to Beat. Browser verified actual note/drum PCM and generated bass waveform on desktop/phone; hum/voice tests passed. Physical-device listening remains unverified.

- [x] Spectral Vocals/Drums/Bass/Music/Instrumental separation in a worker (unit-tested sum + isolation; browser separated a 20s mix with waveforms).
- [x] Hum to Beat YIN pitch tracking on level-normalised audio (quiet hum unit test; browser hum heard A3 C4 D4 A3).
- [x] Bass Generator genre templates: Detroit Techno, Electro, House, Trance, Ghetto Tech (pattern, sound, key, tempo).
- [x] Convert Voice: 21 grouped templates (gender/age, effects, harmony & space).
- [x] AI tool panels isolated by an error boundary; Co-Producer reproduced working on preview and published sites. Published site needs republishing to show the new waveforms.
- [x] Remove the phone timeline bar-count menu and place song length plus export range in the timeline Tools menu beside Add Track; signed-in phone checks verified the stepper and export flags, desktop ruler menu unchanged.

- [x] Per-track rack-mounted effects with live insert scopes/meters; signed-in desktop/phone checks verified synth-note signal, bypass, order, independent track chains, add/remove and Tools access. Physical-controller/audio listening remains hardware-dependent.

- [x] Fixes: solo-instrument stem prompts, sharper stem separation, mic hand-off between tools, white selected-track outline, razor/split cuts notes as well as clips, piano-roll Clear all notes, phone login photo, refreshed login feature list, Other Apps menu grouping.

- [x] DAW-style cutting: free/grid cut toggle, note parts unroll and cut into deletable regions, Delete removes selected clip/part; Open instrument picks a synth; menu actions no longer jump to the piano roll. Verified in browser.
- [x] Direct timeline Mixer/library/effects controls, phone Tools Mixer tile and collapsed-rail shortcut; named keyboard faders, channel selection, routing/effect labels, visible focus and always-accessible sends. Signed-in desktop and sideways phone checks passed with no runtime errors; 27 audio tests passed. Splice integration and physical-device checks are not included.
- [ ] AI stem separation (Demucs on Replicate) built and wired — blocked until the Replicate account has credit; then test a real song.
- [ ] Co-Producer full-page error on user's Samsung phone via synclabsapp.com — not reproducible; error screen now shows details, tool crashes contained. Waiting on user's new screenshot after publish.
- [x] Phone studio opens on the edit screen instead of an instrument: entering the studio or resuming the page closes any tool panel and restores EDIT. Signed-in phone checks passed (first screen timeline, drum machine opens on request, re-entry returns to timeline).

- [x] Refine Studio back view into independent device columns with detailed rear panels; signed-in desktop and sideways-phone checks verified all eight columns, horizontal scrolling and re-patching with no runtime errors.
- [x] Mixer overlap fixes: phone head-row colour dot/clip LED no longer inflated over the channel number (wrap + small-control exemptions), transport docked in-flow below the workspace so it never covers the mixer record button; signed-in sideways phone verified REC fully visible with transport open, 27 audio tests pass, build OK.
- [x] Make desktop Studio View open fully: the bottom device strip steps out for Studio View like it already does for the mixer, the room scales its equipment into the available space so nothing hides below a scrollbar, and the duplicated master-output footer bar was folded into the header. Signed-in 1440×900 check measured the panel filling the workspace with every instrument, monitor, desk and reel fully in view and no overlaps; 27 audio tests and typecheck passed. Sideways phone still scrolls inside the room by design. Live site needs republishing.

- [x] Oct 17: stronger selected-track highlight, drum-beat cutting, single-instrument stem isolation, Just-one stem buttons, visible bass sound picker, more stem templates
- [ ] Replicate account needs credit for clean AI stems (blocked on owner)
- [x] Verify save / don't save / cancel when closing an unsaved project on desktop and phone: signed-in Save retained a MIDI take on reopen, unchanged saved close skipped the prompt, Cancel kept the project open, and phone Don't save returned to Projects; 10 focused tests passed.
- [x] Oct 17: Separate Stems and Generate Stem now open a "Coming soon — not available now" screen on desktop and phone (tool implementations left intact for relaunch); verified signed-in on 1440×900 desktop and 942×534 sideways phone, 27 audio tests and typecheck pass. Live site needs republishing.
- [x] Rebuild Touch Synth as a 5-lane loop station (drums, bass, poly, melody, stabs/arp) with per-lane loop recording, colored note dots, moving playback line and Send to timeline; signed-in desktop/phone verified 3 recorded notes, playback and 3 notes landing on the timeline; 68 tests passed, build OK.
- [x] Oct 19: phone mixer now uses compact desktop-style channel strips with less vertical scrolling; play/stop sit above the phone timeline beside mic/record; phone buttons, knobs and sliders have raised hardware styling. Signed-in sideways-phone preview verified, 11 focused tests and typecheck passed.
