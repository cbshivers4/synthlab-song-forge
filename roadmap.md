# Roadmap — Source-code audit & DAW repair

- [ ] Enable moving/resizing whole hardware windows on desktop and sideways phones; preserve mounted controls and audio.

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
