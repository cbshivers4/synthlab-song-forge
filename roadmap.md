# Roadmap — Source-code audit & DAW repair

- [x] All 36 factory effects grouped into nine categories in left/Browser/rack, mixer channel/master and timeline Add effect menus. Shared catalog includes newer devices in older projects without changing saved sessions. 43 tests pass; signed-in unsaved timeline/mixer additions read back as two KICK rack modules; catalog counts verified. Saved music untouched; preview only.

- [x] Shared BYPASS controls added to synths, modular/Touch synth, drums, all samplers and rack/mixer/compact effects. Instrument channels/sends silence independently of mixer mute; video mutes preview audio; effects pass dry audio. 50 related tests pass; signed-in unsaved desktop sampler silences/restores and phone button toggles. Track state uses existing manual project persistence; no saved music touched. Preview only; physical devices unverified.

- [x] Audio Converter added to desktop Files/Audio/Tools and phone Tools: open/drop audio, waveform, output/rate/bitrate/mono WAV, convert/download/share and cancellation. Eight focused tests pass; signed-in unsaved WAV→MP3→WAV downloads verified with actual codecs, phone conversion succeeds. M4A decoding/encoding depends on device support (test Chromium cannot decode AAC and shows a warning); WAV/MP3/AIFF/FLAC available. Saved tracks untouched; preview only.

- [x] Timeline menu creates mono/stereo WAV files from selected audio clips or loaded sampler sources without replacing originals. Nine focused tests pass; signed-in unsaved-session downloads verified as one/two channels, phone menu available, build clean. MIDI/drum patterns must first be recorded to audio; conversion excludes mixer inserts/master processing. Preview only.

- [x] Reduce playback edit work: channel-scoped caches skip unchanged mixer/rack inputs; sequence-only drum edits preserve live envelopes. Thirteen focused tests pass. Signed-in unsaved-session chop edits produce zero mixer writes/rack rebuilds; effect add/remove rebuilds only the affected rack while transport and sample output continue. Preview only; physical-device lag remains unmeasured.

- [x] Restore shared sample/clip/drum routing and inserts after Stop without rebuilding existing channels. Eleven tests pass; signed-in unsaved-session whole-sample/stretch preview, chop press/release and preview after transport Stop produce real master output. Saved music untouched; preview only.
- [ ] Confirm the reported silence on the user's physical output: not reproduced with the test WAV; requires checking the affected sample and device output on the live website. Screenshot shows input activity but no MIDI material or master output.

- [x] Sampler chop pads stop on release even for one-shot samples; pending keyed decoding is cancelled on release. Pad Sampler already stops touch pads on release. Signed-in unsaved sampler press/release measured sound then zero output; five focused tests pass, build clean. Saved music untouched; preview only.

- [x] Sampler whole-sample preview plays on one click without note capture; stretch preview uses gesture-unlocked Web Audio and decodes saved sources before rendering. Signed-in unsaved-session real audio verified for both previews and Stop (output returns to zero); six focused tests pass, build clean. Saved music untouched; preview only, physical devices unverified.

- [x] Added shared previous/next preset arrows to synth, drum kits/saved sounds, effects, Touch lane sounds and modular racks; existing Touch loop arrows retained. Menus and manual-save behavior unchanged. Signed-in unsaved-session desktop synth/effect/drum and sideways-phone synth/drum round trips verified; 42 focused tests pass. Preview only; no saved projects overwritten or deleted.

- [x] Track selection opens editing actions in the synth piano roll; stationary note clicks/right-clicks open Copy/Cut/Paste/Delete without interfering with drags. Loop highlighting follows enabled state and repeated band clicks no longer disable it. Signed-in menus, note copy/paste, boundary adjustment and repeated loop clicks verified; 10 related tests pass. Preview only.

- [x] Piano-roll horizontal navigation stays above the grid with arrow controls and a scroll slider; a white placement playhead has a draggable bar ruler. Signed-in note placement/copy/paste and scrolling verified; 3 piano-edit tests pass. Preview only.

- [x] Confirmed and repaired synth chorus/reverb crossfeed with separate destination scales, retaining fader, automation, mute/VCA and cleanup. Real browser audio and signed-in saved-project Audition verify reverb-only produces zero chorus and chorus-only produces zero reverb; routing/live-control/audio-unlock tests pass. Preview only.

- [x] Sampler/Pad Sampler share inspection-only waveform zoom (1–32×), scrolling, decoded source-detail drawing and a matching seconds ruler. Signed-in desktop and sideways-phone loaded-sample zoom/scroll/manual chops place cuts at 7s in an 8s sample; Fit restores full view. 10 related tests pass; source audio and existing stretch tools remain unchanged. Preview only; physical devices unverified.

- [x] Ordinary timeline/part/keyboard Delete preserves channels and sibling bars through shared bounded repeat expansion; recording retains editable lanes, instrument changes restore live sound, loop button shows selected state without seeking playback. Mixer meters share true -48…+6 dB scale/clip latch, track faders boost to 1.2, loop band is brighter, transport labels identify Learn and Recording options. Signed-in desktop/phone part deletion, fader changes and real output increase verified; instrument/preset additions during recording verified on both. 30 related tests pass; preview only, physical devices unverified.

- [x] Phone channel/recent-project naming uses readable screen-aligned Save/Cancel dialogs, constrained to the visible keyboard area; signed-in typing and channel rename verified at full/reduced phone sizes. Recording shows persistent current bar/beat, next-measure countdown and Stop; zoomed timeline follows the recording cursor (scroll 781px), live position and Stop verified. 18 related tests pass; preview only, physical native keyboards unverified.

- [x] Timeline selection exposes Edit/Copy/Cut/Paste/Delete, with independent tap-location/playhead paste and single-tap synth piano-roll opening. Signed-in saved-project audio copy/paste/delete and synth selection verified on desktop and sideways phone; Edit opens the real clip editor. Phone menu stays within the screen; 36 related tests pass. Preview only; physical devices unverified.

- [x] Piano-roll single-tap Draw/Select/Erase modes, larger notes, zoom, visible paste cursor, explicit selection-only deletion, note clipboard and focused keyboard commands; desktop and sideways-phone placement/copy/paste/delete verified, 13 related tests pass. Native scroll-aware coordinates retain precise phone placement. Preview only.

- [x] Repaired Stop/finalization including pending microphone starts, same-channel material paste and clipboard controls, and pitch-preserving right-edge extension with song growth. Signed-in saved-project recording/Stop/paste/stretch verified on desktop and sideways phone; 24 related tests pass. Phone notifications no longer intercept timeline taps. Preview only; physical devices unverified.

- [x] Repaired phone first-gesture/interrupted audio unlock with valid silent PCM and restored drum routing/inserts after cold start or Stop; 11 tests pass, signed-in phone-sized saved-project taps/patterns/after-Stop taps produce nonzero master output. Physical iPhone audio remains unverified; preview only.

- [x] Added accessible real cable add/remove controls in Studio View and fixed desktop-style time/date/seconds clock throughout phone workspace; four routing tests and signed-in desktop/sideways-phone add/remove flows passed. Fixed monitor/recorder feeds remain labeled; preview only.

- [x] Added independent drum patterns 1–8, preserving Banks A–H and pad sounds; larger high-contrast bottom mixer icons. 22 tests pass; signed-in saved-project pattern switching, empty B and restored 20-pad A verified; preview only.

- [x] Added six Detroit artist wall pictures to front/rear Studio View; all images load in a signed-in saved project, portrait credits open, and equipment/cables remain unobscured. Scan 7 label photo has no stated reuse license; permission required before public release.

- [x] Whole hardware editors have float, header-drag, corner-resize, fit and dock controls; desktop and sideways-touch phone movement/resize verified, preset recall preserved; 9 tests passed.

- [x] Compacted shared effect hardware, packed control decks, reduced rack/mixer widths and EQ/vocoder heights; desktop rack and phone preset recall checked, 29 tests passed.

- [x] Expanded all 23 effect devices with six additional presets each (10 named presets plus Default); 29 tests passed and signed-in saved-project compressor/delay menu recall verified.

- [x] Added live scopes on VCO, Sub, VCF, Fold, Drive, Delay and Output; desktop/phone windows checked, actual module peaks and voice-end cleanup verified; 29 tests passed.

- [x] Added per-effect response/scope frames, proportions and delay side-by-side/reverb readout arrangements plus live vocoder window; phone/desktop five devices and mixer preset/knob edits checked, 28 tests passed.

- [x] SYNCPADS clears legacy Banks B–H once, preserving Bank A and later user additions; 9 bank tests passed, signed-in phone verified all seven empty banks and unchanged 20-pad A, desktop empty-bank view checked.

- [x] Effect-specific preset menus/windows added across Plugins, compact devices and mixer editors; 26 preset tests and 2 live-control tests passed; phone/desktop reverb and mixer compressor recall verified, manual edits show Custom.

- [x] Effects now share segmented input/display/core/output decks with distinct space, pink-buffer, silver-sequence, dynamics, motion and tone finishes; mixer delay/compressor and rack reverb checked on phone/desktop with parameter edits; effect-control tests passed.

- [x] Reel recorder restyled to uploaded silver/wood deck: large silver reels, black hubs, head cover, paired VU meters and raised keys; 9 tape tests passed and desktop/phone controls checked.

- [x] Expanded all 21 Modular Tech devices with sound controls, five CV connections and per-device reset; 29 tests passed, browser audio renders confirmed new controls alter every device, desktop/phone knobs and reset checked.

- [x] Modular Tech: six working devices with distinct narrow/wide hardware decks and two connected racks; 8 tests passed, offline audio renders verified each device changes sound, phone/desktop rack and knob checked.

- [x] Reference-led effects: segmented graphite, silver/red and vintage faceplates; mixed Eurorack modules and scoped rails/jacks; phone/desktop rack checked with 7 modules/4 cables and knob change 0→1; 7 related tests pass.

- [x] Shared distinct hardware effect finishes in rack and mixer editors; phone timeline/mixer menus opened by single touch with 44px targets and light panels; compressor editor checked on phone/desktop, 7 related tests pass.

- [x] Phone Edit and left navigation: whole-page timeline and independent rail scrolling; touch swipes verified in both directions on upright-held phones, landscape Edit checked.

- [x] SYNCPADS: verified unused Banks B–H empty; sound/sample adding and single/multiple-pad deletion preserve other banks and empty-bank recall on desktop/phone.

- [x] SYNCPADS: pad/envelope MIDI Learn and readable envelope labels; simulated MIDI verified learning is silent, note press plays once, release adds no hit, and CC updates both Attack controls.

- [x] Drum Machine: Banks A-H, empty unused banks, selectable sound and multi-file sample pads; bank round-trip tests and browser add/recall verified; cloud drum asset upload/restore included.

- [x] Audit audio signal path (instruments → track → inserts → buses → mixer → master)
- [x] Audit recording & MIDI (mic capture, MIDI notes, drum/sampler pads, overdub, reopen)
- [x] Audit arrangement editor (clips, drag/trim/split, undo, persistence)
- [x] Audit unfinished features — all real implementations, labels honest
- [x] Restore test command (`npm test`) — 130/130 pass
- [x] Stage 1: synth FX bypass mute/volume; capture misses live master FX; decode-after-Stop
- [x] Stage 2: sampler-pad recording routed to mic; desktop drum taps write no hits; Save during recording loses take; rate-aware clip trimming
- [x] Upright-phone pointer fix: canvas-point helper maps rotated touch coords across knobs, timeline, piano roll, mixer, XY pads, drum roll, sampler, EQ — verified playhead tap works
- [ ] Stage 3 (needs runtime verification): Stop can detach live mic monitoring; overdub can re-capture existing printed material; undo debounce gaps; cold-start master gain; metronome clicks after Stop
- [x] Sampler preview: preload saved samples, renew expired cloud links, warn instead of playing silently; re-saving keeps permanent storage paths

## Oct 26 requests
- [x] Reel recorder: respect mutes in reel/QuickTime capture; reels visibly wind while playing/recording
- [x] Stability pass (doubling, waveform rewrites, drum filter, envelope jumps fixed; reverb decay still rebuilds): editing instruments during play/record must not glitch
- [x] Left menu: show computer files without extra buttons (browser limit: must pick folder once)
- [x] Copy/paste a drum track
- [x] New tracks auto-arm
- [x] Timeline: single tap opens track menu, double tap opens drum/piano roll
- [x] Notes: save button on all notes
- [x] Vocoder / Modular Tech stuck sustained noise
- [x] Piano roll: don't place notes by moving the playhead
- [x] Left menu: Studio One-style file browser (breadcrumb, folder tree, search, file sizes) under My Computer; rail resizable by dragging its edge
- [x] Timeline: Paste at end appends drums/clips after existing material (track menu + Clipboard & arrange submenu)
- [x] Instrument faces (Studio One/Reason reference): Spec 4 synth dark charcoal face with blue accent and A·D·S·R envelope displays; Sampler dark wave window + light silver control decks as "Sample One"; Bass Generator light teal panel with key display and step grid. Presentation only — no sound or control changes; 305 tests pass, build OK, visually verified.

## Oct 30 change list
- [x] Reel-to-Reel / QuickTime recorders run independently of the master transport
- [x] Record mute/solo changes during a take (Mixer + Reel) and replay them; re-recording replaces them
- [x] Bass Generator distortion: find cause and fix
- [x] Drum machine waveform block: copy at full length; stretching stretches audio
- [x] Timeline loop button toggles loop on/off
- [x] "Choose your music folder (once)" → "Choose your music"
- [x] Music files listed in left menu after choosing folder
- [x] Mixer channel bottom icon background matches strip color

## Oct 30 — Professional DAW master brief
- [x] Phase 1 audit report + phased development plan (/mnt/documents/SYNCLAB-audit-and-plan.md); awaiting user's choice of first step
- [ ] Clear track content must stay on the edit page — could not reproduce (desktop, narrow, touch all stay); waiting on user for device/track/path
- [x] Step 1: desktop security hardening (navigation lock, safe external links, origin-checked mic/MIDI, IPC sender checks, sandbox, CSP subset, startup crash guard) — verified in a test desktop window
- [x] Step 2: timing and recording fixes (every heard step processed, punch at the marker incl. instrument/drum/sampler, audio-clock count-in, fader/pan/send automation writing + latch read-back, capture disconnect fix, finished synth voices released)
- [x] Step 3: offline export render (shared scheduler, faster than real time, real-time fallback)
- [x] Step 4: crash recovery — skipped at user's request (manual save only stays)
- [x] Step 5a: speed-up — playhead moved out of shared state; only counters, playhead lines and step lights update each step
- [x] Step 5b: Timeline (4,031 → 270 lines + 6 modules) and Mixer (2,167 → 312 + 7 modules) split; duplicate automation-curve maths merged
- [ ] Step 5c (later, higher risk): split audio engine class and studio store provider
- [x] Step 6: loop take recording — microphone passes kept as takes (instrument/drum still stop at loop end)
- [x] Step 8: native plugin hosting design written (/mnt/documents/SYNCLAB-plugin-hosting-design.md); building it needs a C++ developer and real Mac/Windows machines
- [x] Step 7: offline desktop app — stored studio copy (packaged + refreshed online), verified signed-in with networking fully cut; cloud saving/sign-in/payments/AI need internet; plan + start-screen offline fixes reach desktop after publishing
- [x] Plugin preparation: saved-state fields for desktop plugins, pass-through where no host runs, shared-memory audio link + AudioWorklet insert + fake host, all tested (needs cross-origin isolation in the desktop window before real use)

## Nov 1 — Master upgrade brief (phases 1–8, one at a time)
- [x] Phase 1: audit + fixes (synth LFO/arp sync & swing, import success/failure, desktop menu commands, honest update message, Save As/close-save with failed takes, device-library commit, drum lane double-click, capture/preview cleanup); clear track verified staying on Edit (desktop + phone)
- [x] Drum pad samples always saved as the project's own cloud copy; unreadable old samples no longer block opening
- [x] Phase 1 leftover: Generate Stem/Separate Stems no longer Coming Soon
- [x] Phase 2: looper undo + song-bar sync + true rings, reel rotation from tape position, input loss/change handling, MIDI clock send/follow, honest sample-rate display (autosave/crash recovery excluded: manual-save-only rule)
- [ ] Phase 2 not done (needs decisions/hardware): interface inputs beyond 1/2, loopback latency calibration, selectable sample rate/buffer (browser-limited), MIDI-note loops in looper
- [x] Phase 3: file drops at drop position, Ctrl+D clip duplicate, Ctrl/pinch zoom, undo-right-after-edit fix, per-clip colours, pan/width knobs (wheel + double-click reset), mixer peak hold
- [x] MIDI/drum part editing: move one part, trim both edges (drums: left trim, right stretch, Alt+right trim)
- [ ] Phase 3 not done: per-channel input selection, pre/post send switch, automation lane controls in mixer strips
- [x] Phase 4: drum HOLD wired, note repeat (hold-to-roll, 6 rates), sampler/pad knobs + Normalize, reverse plays the trimmed part, preset search, 8 Sequence presets, honest mod-matrix warnings, drum envelope knobs
- [x] Drum pattern chaining (patterns 1–8 in order with bars each, CHAIN on/off, playing step lit, timeline label)
- [ ] Phase 4 not done: multi-sample layers, separate loop points, per-pad sends, per-track swing
- [x] Phase 5: desktop split view (timeline above any editor, draggable divider, remembered), remembered zoom + rail state, 40px touch targets for phone timeline toolbar/zoom/song lane
- [ ] Phase 5 not done: editable keyboard shortcuts, saved-library search + drag to timeline, true portrait layout (phones currently show the sideways studio by design)
- [ ] Phases 6–8: wait for Phase 5 report

- [x] Sign-in page lists AI Co-Producer, Generate Stem and Separate Stems as Available now (Nov 21)
- [x] Phase 6: AI Co-Producer / Generate Stem / Separate Stems switched on; 25 AI uses per person per day (server-enforced, shown in each tool); stem separation 15-min deadline + real cancel; Hum to Beat transpose/snap-to-key/instrument/tempo; Bass Generator regenerate variations
- [ ] Phase 6 not done: true AI voice conversion (no suitable service connected), dedicated Vocal Forge lyrics-to-tempo tool
- [x] Phase 7: whole-song range, stems + one-track export, MIDI export, cancel, choose save folder, export history, delete confirmations, project-owned copies of sampler/clip/pad audio
- [ ] Phase 7 not done: autosave/recovery (manual-save rule), Video Sampler video isn't saved in cloud projects, device-list entries are only shortcuts (not separate saved copies)
- [x] Phase 8: full QA pass (399 tests, 0 type errors, 3-min session memory steady, 60 fps, 22 tools error-free, phone recording, 0 dependency advisories); completion report delivered

## Phone fit-to-screen (sideways)
- [x] Edit screen fits without scrolling; Add track menu pinned in the Edit header
- [x] Drum machine → Drum roll tab fits; all rows in one internally scrolling grid (paging removed per Christopher)
- [x] Studio View front and back both fill the screen edge to edge (back desk/floor rows uncapped on phone fit)
- [ ] Drum Play pads / Sound / Kit tabs
- [ ] Synth, Touch Synth, Sampler, Sample pads, Sound library, Live View, Live Looper
- [ ] Mixer, Studio View, Reel-to-Reel, Video Sampler, Bass Generator, Mastering, Plugins, Settings, Audio Converter

## Nov 6 — Phone fixes (Christopher, sideways phone)
- [x] Pad Sampler pads bigger, still square
- [x] Keyboard shows note names on every key (C D E… and sharps) like a real keyboard
- [x] Mixer: kick fader can be raised from the bottom; channel top no longer overlaps controls
- [x] Knobs and menus easier for big fingers on phone
- [x] Edit screen and drum machine top rows no longer overlap controls
- [x] Bass Generator generates a new pattern each time
- [x] Edit screen: visible vertical scroll bar (Android hides styled scrollbars)
- [x] Edit screen: ruler stays aligned when using the horizontal scroll bar
- [x] Synth screen: pick any synth type, not only Acid Bass
- [x] SYNCPADS bigger so delete/mute buttons aren't hit by accident

## Nov 6 (2) — Phone follow-up (Christopher)
- [x] Bass Generator phone preview plays only the bassline (song stays silent, no extra track)
- [x] Edit screen: touch-sized horizontal scroll bar with zoom − / +, ruler follows
- [x] Edit screen: transport/record row and tool rows no longer cut off (wrap/compact instead of clipping)
- [x] Drum roll: every drum row reachable with its own side scroll bar
- [x] Edit screen: track name area resizable (drag the teal edge; 120–420px on phone, remembered on the device)

## Nov 7 — Bass Generator, mixer loudness, FX Rack, Touch Synth drums (Christopher)
- [x] Bass Generator: "Generate for me" removed; Generate bassline + Write my own notes remain
- [x] Mixer faders: dB taper with up to +6 dB boost (was +1.6 dB) on desktop/phone tracks, buses, master and MIDI CC; printed dB scale beside faders
- [x] "Plugins" renamed "FX Rack" in menus, rail, phone and search
- [x] Touch Synth drums: four columns (kick · closed/open hat · snare · clap) with colour display and lit pads

## Nov 8 — Guitar rig (Christopher)
- [x] Lead Guitar Amp (Clean/Crunch/Lead channels, mid boost, tone stack, master, 3 cabinets, mic) and Bass Guitar Amp (compressor, drive above 250 Hz, 4-band EQ, contour, 3 cabinets, DI/amp blend)
- [x] Ten pedals: overdrive, fuzz, wah (pedal/auto/envelope), octave, analog delay, spring reverb, compressor, clean boost, vibe, rotary speaker — stompbox look with working footswitch
- [x] New "Amps & Pedals" category in every effect list; 15 presets each

## Nov 8 (2) — Christopher
- [x] External MIDI instruments (hardware synths/drum machines through MIDI out, held notes, Stop silences, mute respected, audio return)
- [x] Remove the owner's personal name from customer-facing pages; contact email info@synclabsapp.com
- [x] Update login page features
- [x] Granular synth

## Nov 8 (3) — Live Drummer, DJ Decks (Christopher)
- [x] Live Drummer: 39 styles (Electronic, Hip-Hop & R&B, Band, World & Latin), simple↔complex / soft↔loud pad, fills, feel, swing, hat/ride, kit, piece mutes
- [x] Jam live (Play, Fill, Break, Crash, New variation) on its own or locked to the song's bars; print a groove or the recorded performance to an editable drum track
- [x] DJ Decks: two decks, BPM detection, Sync, pitch/nudge, cue + 4 hot cues, loops, 3-band EQ, filter, crossfader; load files, local files or the current song
- [x] Record the DJ mix and save as WAV or MP3
- [x] Phone sideways layouts fit without scrolling (drummer split into Play / Styles / Print pages)
- [x] Login features updated

## Nov 8 (4) — Turntables, DJ meters, drum sets (Christopher)
- [x] Two turntables on the DJ decks; record turns with the deck, tone arm follows the track; label shows the file's cover picture or a picture you choose
- [x] Left/right meters for deck A, deck B and master on the DJ mixer (peak hold, clip lights)
- [x] Live Drummer drum set that changes with the genre (acoustic, electronic, beat pads, Latin percussion; own colour per style); pieces light up as they play and play when tapped
- [x] Preview the drummer alone (song pauses) or play with the song
- [ ] Listen on a real phone (not checked: real speakers / real phone)

## Nov 8 (5) — Rock drummer, Amp Room (Christopher)
- [x] Live Drummer: Rock is its own genre group (12 styles: Rock, Classic, Hard, Punk, Pop Punk, Metal, Double-Kick Metal, Grunge, Indie, Half-Time, Ballad, Surf) on a rock kit with an amp wall; Band gains Second Line
- [x] Amp Room: separate area for guitar/bass amps and effect pedals (pedalboard, amp stack, signal flow, add/stomp/edit, new guitar/bass track, arm + hear me)
- [ ] Listen to the rock styles and play a real guitar through the Amp Room (not checked: no listening test, no real instrument)

## Nov 8 (6) — DJ playlists (Christopher)
- [x] DJ Decks playlist: add music (button or drag from computer / left menu), reorder, remove, load any track on deck A or B (buttons or drag onto a deck)
- [x] Save named playlists on this device (with a copy of their music), reopen, rename, delete (with confirmation); unsaved-changes warning
- [x] Phone: List button opens the playlist over the whole DJ screen
- [ ] Try on a real phone and after a real reload (test mode keeps playlists in memory only)

## Nov 8 (7) — DJ headphones, turntables, mixer look (Christopher)
- [x] Headphone CUE on each channel (pre-fader): MONO SPLIT on one output (left = cue, right = master) or a second output device (Chrome/Edge on a computer); MIXING and LEVEL knobs
- [x] Silver direct-drive turntables: strobe-dotted platter, tone arm with counterweight, working START·STOP and 33/45 buttons, green pitch-zero light
- [x] Black two-channel club mixer face: TRIM, HI/MID/LOW, COLOR filter, orange CUE, centre meter bridge, headphone section, scaled faders, slotted crossfader
- [ ] Try with real headphones and a real second output (not checked: headless browser has no output devices)

## Nov 8 (8) — DJ back to the start (Christopher)
- [x] ⏮ button on each deck: back to the beginning (keeps playing if playing)
- [x] Drag the top waveform: right winds back, left moves ahead; quick swipes travel further (up to 12×)
- [x] Grab and turn the record: backwards winds back, forwards moves ahead; sound holds while held and plays on when released; tapping the label still picks a picture

## Nov 8 (9) — DJ tone arm and scratching (Christopher)
- [x] Pick up the tone arm and set it down anywhere on the record to play from there (silent while lifted)
- [x] Turning the record by hand now sounds: forwards and backwards at the hand's speed; held still = silent

- [x] Live Keys: session keyboard player (52 styles in Jazz, Rock, Blues & Gospel, Hip-Hop & R&B, Electronic, Pop & Country, World & Latin) with key/chords/sound/range, runs, breaks, hits, lit keyboard and print to timeline; Jazz group (10 styles, bop kit) added to the Live Drummer. Tests pass; not listened to or tried on a real phone.

- [x] Small sideways phones: Live Drummer, Live Keys and DJ Decks controls no longer overlap (two rows of performance buttons, full-width Live Keys keyboard, DJ deck buttons below the turntable and pitch). Test phone at 360×601 and 412×915: zero overlapping controls; Alone preview makes sound on drummer and keys; a loaded track plays on deck A. "This song" now warns when the song is silent instead of loading silence. Real-phone check pending.

- [ ] Phone DJ Decks silent on the owner's Android phone: Play now reports what blocks the sound (phone holding sound back / a control turned down) and logs project.dj_play_check — waiting on the owner to retry on the published app.

- [x] Phone Live Drummer, Live Keys and DJ Decks: wide teal side scroll bar scrolls the page without touching knobs/faders (sits under the DJ playlist/headphone sheets). Tested at 360×669 with drags; real-phone check pending.

- [x] Drum machine Flam, Roll and Mutate work on the chosen drum
- [x] DJ Decks hardware controller: Pioneer DDJ-400/FLX4 layout, Learn for others, button lights
- [x] Help Center: every feature in categories with can / can't lists

## Nov 11 — Preset categories and docked mixer (Christopher)
- [x] Synth preset window opens a categorized browser: sound types, styles, My Presets, search; stays open while auditioning (all five synths, phone sheet)
- [x] Desktop mixer docks under the timeline like Studio Pro: drag bar to resize, F3 shows/hides, Full view option
- [ ] Try on the owner's computer and phone after publishing

## Nov 11 — Expand every scope (Christopher)
- [x] Every device scope opens a big Spectrum Analyzer window like the Studio One reference (source menu, Follow Selection, Analyzer, peak hold, scope view; phone full screen)
- [ ] Try on the owner's computer and phone after publishing

## Nov 11 — Presets, moving blocks, deleting blocks (Christopher)
- [x] Synth presets no longer sound alike: built-in voice warmth made light (it squashed every preset into one tone); voice/choir and big unison presets get level make-up
- [x] Move a note block or beat part to another track: drag it up/down onto the lane, or To track above/below in the block menu / Move part to… in the track menu
- [x] Deleting a tapped block removes that block: hidden recorded takes are no longer deleted instead, cut blocks outside the loop delete whole, and the block's Delete is clickable while the track menu is open
- [ ] Owner listens to the presets and tries moving/deleting blocks on the published app


## Nov 11 — Every effect sounds different (Christopher)
- [x] Measured every effect and preset on the same beat and chords; Tape Echo/Stereo Delay, Pulse Grid, Harmonic Body, Analog Filter, Mod Engine and Stereo Imager made distinct
- [ ] Bit Crusher's character presets barely change the sound — strengthen next
- [ ] Owner listens on the published app

## Nov 11 — Distinct arps/sequences and real pianos (Christopher)
- [x] Every arp/sequence preset gets its own rate, rhythm and riff (shared live/song/export arp)
- [x] Song playback arpeggiates held chords; chord mode for stab sequences
- [x] Modelled piano engine (grand, bright, felt, upright, honky-tonk, tine EP, reed EP, toy) + Piano presets; Live Keys pianos use it

## Request 2026-11-13 (settings, DJ, synths, browser, open source, customizing, drummer, Studio View)
- [x] Settings: hide audio interface details unless an interface is connected
- [x] DJ Decks: record drops onto the platter, replay of recorded moves, list finds the loaded song
- [x] Modular Tech + Granular: many more presets; truly granular sounds
- [x] Modular Tech: more advanced, technical modules
- [x] Logic-style browser: type to find sounds/presets/effects fast
- [x] AI assistants can control the app: in-page studio tools + sign-in-protected connector (synclabsapp.com/mcp)
- [ ] Open-source licence (waiting on Christopher: MIT, GPL or source-visible no-resell)
- [x] Reaper-style customizing: shareable look packs (theme, panel skins, mixer finish)
- [x] Swappable designs, first device: reel-to-reel (5 machines, shared in look packs)
- [ ] Next swappable designs (mixer, synths) — Christopher to choose / send reference pictures
- [x] Live Drummer: real-looking drum kit that visibly plays
- [x] Studio View: connected gear shelf + back-view USB/Bluetooth/cable links

## Cleanup & safety pass (Nov 20)
- [x] 1. Build stability: server functions use validator(); seroval pin skipped (neither 1.6.11 nor 1.6.12 has a ./shared export; build passes on 1.6.12)
- [x] 2. Lint: 0 errors. Prettier on source; var/const/case/unused-expression fixes; modular.ts anys typed; 4 payment anys left as warnings
- [x] 3. Image rights: Scan 7 removed (empty frame), license note added
- [x] 4. Privacy: README/legal pages/Help Center read SUPPORT_EMAIL / FOUNDER_EMAILS; no migration needed
- [x] 5. Maintainability: moved drum voices + DSP helpers out of audio-engine.ts, take-region helpers out of store.tsx (re-exported)
- [x] 6. Verify: 905/905 tests, typecheck, build OK

- [x] Multi pitch (SPREAD one-sound-per-pad and CHORD modes, scale, chord type, original-pitch pad) on Sampler, Pad Sampler and Video Sampler. 14 tests; signed-in browser checks measured the played pitches on all three. Pad/Video setting is session-only; phone layout unverified.
- [x] MPC tools on all three samplers: Note Repeat (rates + swing), pad/chop edit (tune, fine, level, pan, ADSR, filter + envelope, pitch envelope, velocity, mono/poly, mute groups, one-shot/note-on, mute), Pad Sampler pattern swing and tempo follow, Video Sampler through its own mixer channel with pitch-kept stretch. Velocity layers not built.

- [x] Reel shelf (10 reel types, load/remove animations, named reels) and Save reel / cassette / CD to the account (lossless files, downloaded when loaded, delete asks first). Signed-in save → reload → load verified for reel, cassette and CD; CD keeps its own copy after its source reel is deleted; test items removed. Not published.

## Founder dashboard & sign-up emails (Nov 22)
- [x] Sign-in history (name, email, location, device, plan) saved; founder-only read. Verified signed in: entries recorded once per visit; location shows only on the live site (preview has no location data).
- [x] Live pop-up for the founder when someone signs in or sends a support message. Verified with a test customer.
- [x] Founder Analytics page (/admin): overview stats + 30-day chart, sign-ins, accounts, messages inbox (read/done/reply), CSV downloads.
- [x] 30-day, 12-email benefit campaign written; opt-in box on sign-in + Settings switch; privacy policy and Help Center updated.
- [x] Loops connected: opted-in unpaid accounts synced with plan/isPaid and campaign_start; payments re-sync plan. Verified a test contact reached Loops, then deleted it.
- [ ] Build the Loop in Loops (trigger campaign_start, 12 emails, filter isPaid is false) and verify the Loops sending domain — needs the founder in the Loops website.

- [x] Founder-only notification settings (Settings → notifications): sign-in, app opening, time-spent-when-leaving and message pop-ups, optional desktop notifications; time in app on the dashboard. Verified with a test customer: sign-in pop-up and "left after 1 min" pop-up; 70 s recorded.
- [x] Live collaboration ("Live together"): invite people to a song by email, everyone in the song sees changes as they happen, shows who is in the song. Saving stays manual. Verified with two signed-in browsers (channels added on each side appeared on the other).
