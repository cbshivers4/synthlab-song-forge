# Roadmap — Source-code audit & DAW repair

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
